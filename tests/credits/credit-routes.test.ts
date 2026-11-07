import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const userId = "00000000-0000-4000-8000-000000000001";
const otherUser = "00000000-0000-4000-8000-000000000002";

const mocks = vi.hoisted(() => ({
  user: null as null | { id: string; email?: string },
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  inserts: [] as Array<{ table: string; row: unknown }>,
  wallet: { balance_paise: 1500 } as null | { balance_paise: number },
  cashfreeOrder: {} as Record<string, unknown>,
  fetchCalls: [] as Array<{ url: string; init?: RequestInit }>,
}));

function query(table: string) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit", "update"]) q[m] = () => q;
  q.insert = async (row: unknown) => { mocks.inserts.push({ table, row }); return { error: null }; };
  q.maybeSingle = async () => ({ data: table === "ai_credit_wallets" ? mocks.wallet : null, error: null });
  q.then = (res: (v: unknown) => void) => res({ data: table === "ai_credit_ledger" ? [] : null, error: null });
  return q;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
    from: (t: string) => query(t),
  }),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      mocks.rpcCalls.push({ fn, args });
      return { data: { balance_paise: 6500, applied: true }, error: null };
    },
    from: (t: string) => query(t),
  }),
}));
vi.mock("@/lib/rate-limit", () => ({ applyRateLimit: async () => null }));

beforeEach(() => {
  vi.resetModules();
  mocks.user = { id: userId, email: "s@example.test" };
  mocks.rpcCalls.length = 0;
  mocks.inserts.length = 0;
  mocks.fetchCalls.length = 0;
  mocks.wallet = { balance_paise: 1500 };
  mocks.cashfreeOrder = {
    order_id: "credits_abc", order_status: "PAID", order_amount: 50, order_currency: "INR",
    customer_details: { customer_id: userId }, order_tags: { purpose: "ai_credits", packId: "credits_50" },
  };
  vi.stubEnv("CASHFREE_APP_ID", "app");
  vi.stubEnv("CASHFREE_SECRET_KEY", "secret");
  vi.stubEnv("CASHFREE_ENV", "sandbox");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://prepspsc.com");
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    mocks.fetchCalls.push({ url: String(url), init });
    if (init?.method === "POST") return Response.json({ payment_session_id: "sess_1" });
    return Response.json(mocks.cashfreeOrder);
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const post = (url: string, body: unknown) => new Request(url, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

describe("GET /api/credits", () => {
  it("needs a signed-in student", async () => {
    mocks.user = null;
    const { GET } = await import("@/app/api/credits/route");
    expect((await GET()).status).toBe(401);
  });

  it("returns the balance, the price and the packs", async () => {
    const { GET } = await import("@/app/api/credits/route");
    const body = await (await GET()).json();
    expect(body).toMatchObject({ balancePaise: 1500, betterAnswerPricePaise: 500, betterAnswersLeft: 3 });
    expect(body.packs.map((p: { id: string }) => p.id)).toEqual(["credits_50", "credits_100", "credits_200"]);
  });

  it("shows zero for a student with no wallet yet", async () => {
    mocks.wallet = null;
    const { GET } = await import("@/app/api/credits/route");
    expect((await (await GET()).json()).balancePaise).toBe(0);
  });
});

describe("POST /api/credits/create-order", () => {
  it("needs a signed-in student", async () => {
    mocks.user = null;
    const { POST } = await import("@/app/api/credits/create-order/route");
    expect((await POST(post("https://prepspsc.com/api/credits/create-order", { packId: "credits_50" }))).status).toBe(401);
  });

  it("rejects an unknown pack", async () => {
    const { POST } = await import("@/app/api/credits/create-order/route");
    expect((await POST(post("https://prepspsc.com/api/credits/create-order", { packId: "credits_1" }))).status).toBe(400);
  });

  it("creates a Cashfree order for the pack, even while everything else is free", async () => {
    const { POST } = await import("@/app/api/credits/create-order/route");
    const res = await POST(post("https://prepspsc.com/api/credits/create-order", { packId: "credits_100" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paymentSessionId).toBe("sess_1");
    const sent = JSON.parse(String(mocks.fetchCalls[0].init?.body));
    expect(sent).toMatchObject({
      order_id: body.orderId, order_amount: 100, order_currency: "INR",
      customer_details: { customer_id: userId },
      order_meta: { notify_url: "https://prepspsc.com/api/credits/webhook" },
      order_tags: { purpose: "ai_credits", packId: "credits_100" },
    });
    expect(body.orderId).toMatch(/^credits_[A-Za-z0-9_-]+$/);
    expect(mocks.inserts).toContainEqual({ table: "payments", row: expect.objectContaining({
      user_id: userId, cashfree_order_id: body.orderId, amount: 10000, status: "created", plan_type: "credits_100",
    }) });
  });
});

describe("POST /api/credits/verify", () => {
  it("adds a paid pack to the student's wallet", async () => {
    const { POST } = await import("@/app/api/credits/verify/route");
    const res = await POST(post("https://prepspsc.com/api/credits/verify", { orderId: "credits_abc" }));
    expect(res.status).toBe(200);
    expect((await res.json()).balancePaise).toBe(6500);
    expect(mocks.rpcCalls[0]).toMatchObject({ fn: "ai_credit_add", args: { p_user_id: userId, p_amount_paise: 5000 } });
  });

  it("won't credit someone else's order", async () => {
    mocks.cashfreeOrder.customer_details = { customer_id: otherUser };
    const { POST } = await import("@/app/api/credits/verify/route");
    expect((await POST(post("https://prepspsc.com/api/credits/verify", { orderId: "credits_abc" }))).status).toBe(400);
    expect(mocks.rpcCalls).toHaveLength(0);
  });

  it("won't credit an unpaid order", async () => {
    mocks.cashfreeOrder.order_status = "ACTIVE";
    const { POST } = await import("@/app/api/credits/verify/route");
    expect((await POST(post("https://prepspsc.com/api/credits/verify", { orderId: "credits_abc" }))).status).toBe(400);
    expect(mocks.rpcCalls).toHaveLength(0);
  });
});

describe("POST /api/credits/webhook", () => {
  function signed(payload: unknown, secret = "secret") {
    const body = JSON.stringify(payload);
    const ts = String(Date.now());
    return new Request("https://prepspsc.com/api/credits/webhook", {
      method: "POST", body, headers: {
        "x-webhook-timestamp": ts,
        "x-webhook-signature": crypto.createHmac("sha256", secret).update(ts + body).digest("base64"),
      },
    });
  }
  const success = { type: "PAYMENT_SUCCESS_WEBHOOK", data: { order: { order_id: "credits_abc", order_amount: 999999 } } };

  it("rejects an unsigned or wrongly signed call, even in sandbox", async () => {
    const { POST } = await import("@/app/api/credits/webhook/route");
    expect((await POST(signed(success, "wrong"))).status).toBe(401);
    expect((await POST(new Request("https://prepspsc.com/api/credits/webhook", { method: "POST", body: JSON.stringify(success) }))).status).toBe(401);
    expect(mocks.rpcCalls).toHaveLength(0);
  });

  it("re-checks the order with Cashfree and credits the real pack amount", async () => {
    const { POST } = await import("@/app/api/credits/webhook/route");
    expect((await POST(signed(success))).status).toBe(200);
    expect(mocks.fetchCalls[0].url).toContain("/pg/orders/credits_abc");
    expect(mocks.rpcCalls[0]).toMatchObject({ fn: "ai_credit_add", args: { p_amount_paise: 5000, p_reference: "cashfree:credits_abc" } });
  });

  it("acknowledges other events without crediting", async () => {
    const { POST } = await import("@/app/api/credits/webhook/route");
    expect((await POST(signed({ type: "PAYMENT_FAILED_WEBHOOK", data: { order: { order_id: "credits_abc" } } }))).status).toBe(200);
    expect(mocks.rpcCalls).toHaveLength(0);
  });
});
