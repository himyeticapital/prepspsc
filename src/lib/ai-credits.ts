/**
 * Prepaid AI credits.
 *
 * Every AI feature is free on the basic model. A student who wants a stronger answer can pay
 * for one "Better answer" (Gemini 3 Flash) from a prepaid wallet, topped up through Cashfree.
 *
 * Money is handled in paise (₹1 = 100 paise). The wallet itself lives in Postgres
 * (supabase/migrations/20261107160000_ai_credits.sql); only the service role can change it,
 * through the ai_credit_add / ai_credit_spend functions, which are idempotent per reference.
 */
import crypto from "crypto";

export const BETTER_ANSWER_PRICE_PAISE = 500; // ₹5 per better answer

export const CREDIT_PACKS = {
  credits_50: { amountPaise: 5000, label: "₹50" },
  credits_100: { amountPaise: 10000, label: "₹100" },
  credits_200: { amountPaise: 20000, label: "₹200" },
} as const;

export type CreditPackId = keyof typeof CREDIT_PACKS;

export function isCreditPackId(value: unknown): value is CreditPackId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CREDIT_PACKS, value);
}

export function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return Number.isInteger(rupees) ? `₹${rupees}` : `₹${rupees.toFixed(2)}`;
}

export function betterAnswersFor(balancePaise: number): number {
  return Math.max(0, Math.floor(balancePaise / BETTER_ANSWER_PRICE_PAISE));
}

/** The part of a Supabase client these helpers use (service-role client in production). */
export interface CreditsDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
}

// ---------------------------------------------------------------------------
// Spending and refunds
// ---------------------------------------------------------------------------

export type ChargeResult =
  | { ok: true; chargeId: string; balancePaise: number }
  | { ok: false; balancePaise: number };

/** Take ₹5 for one better answer. Throws if the wallet can't be reached (nothing is taken). */
export async function chargeBetterAnswer(db: CreditsDb, userId: string, note?: string): Promise<ChargeResult> {
  const chargeId = `better_${crypto.randomUUID()}`;
  const { data, error } = await db.rpc("ai_credit_spend", {
    p_user_id: userId,
    p_amount_paise: BETTER_ANSWER_PRICE_PAISE,
    p_reference: chargeId,
    p_note: note ? note.slice(0, 200) : null,
  });
  if (error || !data) {
    throw new Error(`AI credit charge failed: ${error?.message ?? "no response"}`);
  }
  if (data.ok !== true) {
    return { ok: false, balancePaise: Number(data.balance_paise ?? 0) };
  }
  return { ok: true, chargeId, balancePaise: Number(data.balance_paise) };
}

/** Give back a charge when the better answer failed. Never throws; a refund is safe to retry. */
export async function refundBetterAnswer(db: CreditsDb, userId: string, chargeId: string): Promise<void> {
  try {
    const { error } = await db.rpc("ai_credit_add", {
      p_user_id: userId,
      p_amount_paise: BETTER_ANSWER_PRICE_PAISE,
      p_reason: "refund",
      p_reference: chargeId,
      p_note: "failed answer",
    });
    if (error) console.error("[AI credits] refund failed", chargeId, error.message);
  } catch (err) {
    console.error("[AI credits] refund failed", chargeId, err);
  }
}

// ---------------------------------------------------------------------------
// Cashfree top-ups
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_ID_RE = /^[A-Za-z0-9_-]{1,50}$/;

export function cashfreeBaseUrl(): string {
  return process.env.CASHFREE_ENV === "production" ? "https://api.cashfree.com" : "https://sandbox.cashfree.com";
}

export function cashfreeHeaders(): Record<string, string> | null {
  const clientId = process.env.CASHFREE_APP_ID;
  const clientSecret = process.env.CASHFREE_SECRET_KEY;
  if (!clientId || !clientSecret) return null;
  return {
    "Content-Type": "application/json",
    "x-client-id": clientId,
    "x-client-secret": clientSecret,
    "x-api-version": "2023-08-01",
  };
}

/** What Cashfree returns for GET /pg/orders/{id} (only the fields we use). */
export interface CashfreeOrder {
  order_id?: string;
  order_status?: string;
  order_amount?: number;
  order_currency?: string;
  customer_details?: { customer_id?: string };
  order_tags?: Record<string, string> | null;
}

export type OrderCheck =
  | { ok: true; userId: string; packId: CreditPackId; amountPaise: number }
  | { ok: false; reason: string };

/** Decide whether a Cashfree order is a fully paid credit pack (optionally for a given student). */
export function checkPaidCreditOrder(order: CashfreeOrder, expectedUserId?: string): OrderCheck {
  if (order.order_status !== "PAID") return { ok: false, reason: "not paid" };
  if (order.order_currency !== "INR") return { ok: false, reason: "wrong currency" };
  const tags = order.order_tags ?? {};
  if (tags.purpose !== "ai_credits") return { ok: false, reason: "not a credit order" };
  if (!isCreditPackId(tags.packId)) return { ok: false, reason: "unknown pack" };
  const pack = CREDIT_PACKS[tags.packId];
  if (Math.round(Number(order.order_amount) * 100) !== pack.amountPaise) return { ok: false, reason: "wrong amount" };
  const userId = order.customer_details?.customer_id ?? "";
  if (!UUID_RE.test(userId)) return { ok: false, reason: "bad customer" };
  if (expectedUserId && userId !== expectedUserId) return { ok: false, reason: "not your order" };
  return { ok: true, userId, packId: tags.packId, amountPaise: pack.amountPaise };
}

export type GrantResult =
  | { ok: true; balancePaise: number; applied: boolean }
  | { ok: false; reason: string };

/**
 * Look the order up at Cashfree (never trusting what the browser or webhook body says) and,
 * if it is a paid credit pack, add it to the student's wallet. Safe to call many times.
 */
export async function grantPaidCreditOrder(db: CreditsDb, orderId: string, expectedUserId?: string): Promise<GrantResult> {
  if (!ORDER_ID_RE.test(orderId)) return { ok: false, reason: "bad order id" };
  const headers = cashfreeHeaders();
  if (!headers) return { ok: false, reason: "payments not configured" };

  const res = await fetch(`${cashfreeBaseUrl()}/pg/orders/${encodeURIComponent(orderId)}`, { method: "GET", headers });
  if (!res.ok) return { ok: false, reason: "order not found" };
  const order = (await res.json()) as CashfreeOrder;
  if (order.order_id && order.order_id !== orderId) return { ok: false, reason: "order mismatch" };

  const check = checkPaidCreditOrder(order, expectedUserId);
  if (!check.ok) return check;

  const { data, error } = await db.rpc("ai_credit_add", {
    p_user_id: check.userId,
    p_amount_paise: check.amountPaise,
    p_reason: "topup",
    p_reference: `cashfree:${orderId}`,
    p_note: check.packId,
  });
  if (error || !data) {
    console.error("[AI credits] top-up failed", orderId, error?.message);
    return { ok: false, reason: "wallet error" };
  }

  // Keep the payments record in step (best effort; the ledger is the source of truth).
  try {
    await db.from("payments").update({ status: "paid" }).eq("cashfree_order_id", orderId);
  } catch (err) {
    console.error("[AI credits] payments row update failed", orderId, err);
  }

  return { ok: true, balancePaise: Number(data.balance_paise), applied: data.applied === true };
}

/** Cashfree webhook signature: base64(HMAC-SHA256(timestamp + rawBody, secret)), compared in constant time. */
export function verifyCashfreeSignature(rawBody: string, signature: string, timestamp: string, secret: string): boolean {
  if (!secret || !signature || !timestamp) return false;
  const expected = crypto.createHmac("sha256", secret).update(timestamp + rawBody).digest();
  let given: Buffer;
  try {
    given = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}
