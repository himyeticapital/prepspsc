import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BETTER_ANSWER_PRICE_PAISE,
  CREDIT_PACKS,
  betterAnswersFor,
  chargeBetterAnswer,
  checkPaidCreditOrder,
  formatRupees,
  grantPaidCreditOrder,
  isCreditPackId,
  refundBetterAnswer,
  verifyCashfreeSignature,
} from "@/lib/ai-credits";

const userId = "00000000-0000-4000-8000-000000000001";
const otherUser = "00000000-0000-4000-8000-000000000002";

function paidOrder(overrides: Record<string, unknown> = {}) {
  return {
    order_id: "credits_test_1",
    order_status: "PAID",
    order_amount: 50,
    order_currency: "INR",
    customer_details: { customer_id: userId },
    order_tags: { purpose: "ai_credits", packId: "credits_50" },
    ...overrides,
  };
}

function fakeDb(result: unknown, error: unknown = null) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const updates: unknown[] = [];
  const db = {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return { data: typeof result === "function" ? (result as (a: unknown) => unknown)(args) : result, error };
    }),
    from: vi.fn(() => {
      const q = {
        update: (v: unknown) => { updates.push(v); return q; },
        eq: () => q,
        then: (res: (v: unknown) => void) => res({ error: null }),
      };
      return q;
    }),
  };
  return { db, calls, updates };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("credit packs and prices", () => {
  it("sells ₹50, ₹100 and ₹200 packs and charges ₹5 for a better answer", () => {
    expect(BETTER_ANSWER_PRICE_PAISE).toBe(500);
    expect(CREDIT_PACKS.credits_50.amountPaise).toBe(5000);
    expect(CREDIT_PACKS.credits_100.amountPaise).toBe(10000);
    expect(CREDIT_PACKS.credits_200.amountPaise).toBe(20000);
    expect(isCreditPackId("credits_100")).toBe(true);
    expect(isCreditPackId("monthly")).toBe(false);
  });

  it("formats rupees and counts how many better answers a balance buys", () => {
    expect(formatRupees(4500)).toBe("₹45");
    expect(formatRupees(450)).toBe("₹4.50");
    expect(betterAnswersFor(4999)).toBe(9);
    expect(betterAnswersFor(0)).toBe(0);
  });
});

describe("checkPaidCreditOrder", () => {
  it("accepts a paid credit order for the right amount", () => {
    expect(checkPaidCreditOrder(paidOrder(), userId)).toEqual({
      ok: true, userId, packId: "credits_50", amountPaise: 5000,
    });
  });

  it.each([
    ["an unpaid order", { order_status: "ACTIVE" }],
    ["the wrong amount", { order_amount: 1 }],
    ["another currency", { order_currency: "USD" }],
    ["a Pro subscription order", { order_tags: { planId: "monthly" } }],
    ["an unknown pack", { order_tags: { purpose: "ai_credits", packId: "credits_9999" } }],
    ["a bad customer id", { customer_details: { customer_id: "not-a-user" } }],
  ])("rejects %s", (_label, overrides) => {
    expect(checkPaidCreditOrder(paidOrder(overrides)).ok).toBe(false);
  });

  it("rejects an order that belongs to someone else", () => {
    expect(checkPaidCreditOrder(paidOrder(), otherUser).ok).toBe(false);
  });
});

describe("verifyCashfreeSignature", () => {
  const body = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK" });
  const ts = "1700000000";
  const good = crypto.createHmac("sha256", "secret").update(ts + body).digest("base64");

  it("accepts a correct signature and rejects anything else", () => {
    expect(verifyCashfreeSignature(body, good, ts, "secret")).toBe(true);
    expect(verifyCashfreeSignature(body + " ", good, ts, "secret")).toBe(false);
    expect(verifyCashfreeSignature(body, "short", ts, "secret")).toBe(false);
    expect(verifyCashfreeSignature(body, good, ts, "")).toBe(false);
    expect(verifyCashfreeSignature(body, "", "", "secret")).toBe(false);
  });
});

describe("chargeBetterAnswer / refundBetterAnswer", () => {
  it("takes ₹5 under a fresh charge reference", async () => {
    const { db, calls } = fakeDb({ ok: true, balance_paise: 4500, applied: true });
    const result = await chargeBetterAnswer(db, userId, "summary");
    expect(result).toMatchObject({ ok: true, balancePaise: 4500 });
    expect(calls[0].fn).toBe("ai_credit_spend");
    expect(calls[0].args).toMatchObject({ p_user_id: userId, p_amount_paise: 500 });
    expect(String(calls[0].args.p_reference)).toMatch(/^better_[0-9a-f-]{36}$/);
    if (result.ok) expect(result.chargeId).toBe(calls[0].args.p_reference);
  });

  it("reports a low balance without taking anything", async () => {
    const { db } = fakeDb({ ok: false, balance_paise: 200 });
    expect(await chargeBetterAnswer(db, userId)).toEqual({ ok: false, balancePaise: 200 });
  });

  it("throws if the wallet can't be reached, so the route can stop", async () => {
    const { db } = fakeDb(null, { message: "down" });
    await expect(chargeBetterAnswer(db, userId)).rejects.toThrow();
  });

  it("refunds the exact charge and never throws", async () => {
    const { db, calls } = fakeDb({ balance_paise: 5000, applied: true });
    await refundBetterAnswer(db, userId, "better_x");
    expect(calls[0]).toEqual({
      fn: "ai_credit_add",
      args: { p_user_id: userId, p_amount_paise: 500, p_reason: "refund", p_reference: "better_x", p_note: "failed answer" },
    });
    const broken = fakeDb(null, { message: "down" });
    await expect(refundBetterAnswer(broken.db, userId, "better_y")).resolves.toBeUndefined();
  });
});

describe("grantPaidCreditOrder", () => {
  function stubCashfree(order: unknown, ok = true) {
    vi.stubEnv("CASHFREE_APP_ID", "app");
    vi.stubEnv("CASHFREE_SECRET_KEY", "secret");
    const fetchMock = vi.fn(async () => (ok ? Response.json(order) : Response.json({}, { status: 404 })));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("asks Cashfree for the order and adds the pack once", async () => {
    const fetchMock = stubCashfree(paidOrder());
    const { db, calls, updates } = fakeDb({ balance_paise: 5000, applied: true });
    const result = await grantPaidCreditOrder(db, "credits_test_1", userId);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("/pg/orders/credits_test_1");
    expect(calls[0]).toEqual({
      fn: "ai_credit_add",
      args: { p_user_id: userId, p_amount_paise: 5000, p_reason: "topup", p_reference: "cashfree:credits_test_1", p_note: "credits_50" },
    });
    expect(result).toEqual({ ok: true, balancePaise: 5000, applied: true });
    expect(updates).toContainEqual({ status: "paid" });
  });

  it("adds nothing for an unpaid order", async () => {
    stubCashfree(paidOrder({ order_status: "ACTIVE" }));
    const { db, calls } = fakeDb({});
    const result = await grantPaidCreditOrder(db, "credits_test_1", userId);
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("adds nothing if Cashfree doesn't know the order", async () => {
    stubCashfree({}, false);
    const { db, calls } = fakeDb({});
    expect((await grantPaidCreditOrder(db, "credits_test_1")).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("refuses odd order ids before calling Cashfree", async () => {
    const fetchMock = stubCashfree(paidOrder());
    const { db } = fakeDb({});
    expect((await grantPaidCreditOrder(db, "../../etc", userId)).ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
