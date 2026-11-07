import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";

const mocks = vi.hoisted(() => ({ client: { auth: { getUser: vi.fn() }, from: vi.fn() } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => mocks.client }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => mocks.client }));
vi.mock("@/lib/rate-limit", () => ({ applyRateLimit: async () => null }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstileToken: async () => true }));

const userId = "00000000-0000-4000-8000-000000000001";
const operations: Array<{ table: string; method: string; args: unknown[] }> = [];
let alreadyPaid = false;

beforeEach(() => {
  vi.resetModules();
  operations.length = 0;
  alreadyPaid = false;
  vi.stubEnv("CASHFREE_APP_ID", "test-app");
  vi.stubEnv("CASHFREE_SECRET_KEY", "test-secret");
  vi.stubEnv("CASHFREE_ENV", "production");
  mocks.client.auth.getUser.mockResolvedValue({ data: { user: { id: userId, email: "test@example.test" } } });
  mocks.client.from.mockImplementation((table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "update", "insert"]) {
      query[method] = (...args: unknown[]) => { operations.push({ table, method, args }); return query; };
    }
    query.single = async () => ({ data: table === "profiles" ? { full_name: "Test" } : table === "payments" ? { status: alreadyPaid ? "paid" : "created" } : null });
    return query;
  });
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({
    payment_session_id: "test-session", cf_order_id: 1234, order_status: "PAID", customer_details: { customer_id: userId },
  })));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const request = (body: object) => new Request("https://prepspsc.com/api/cashfree", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
function webhook(type: string) {
  const body = JSON.stringify({ type, data: { order: { order_id: "test-order", order_tags: { userId, planId: "monthly" } }, payment: { cf_payment_id: 5678 } } });
  const timestamp = String(Date.now());
  return new Request("https://prepspsc.com/api/cashfree/webhook", {
    method: "POST", body, headers: {
      "x-webhook-timestamp": timestamp,
      "x-webhook-signature": crypto.createHmac("sha256", "test-secret").update(timestamp + body).digest("base64"),
    },
  });
}
const paymentOps = () => operations.filter(op => op.table === "payments");

describe("Cashfree payment column names", () => {
  it("stores newly created orders under cashfree_order_id", async () => {
    const { POST } = await import("@/app/api/cashfree/create-order/route");
    const response = await POST(request({ planId: "monthly" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(paymentOps()).toContainEqual({ table: "payments", method: "insert", args: [expect.objectContaining({ cashfree_order_id: body.orderId })] });
  });
  it("verifies payments using Cashfree columns", async () => {
    const { POST } = await import("@/app/api/cashfree/verify-payment/route");
    expect((await POST(request({ orderId: "test-order", planId: "monthly" }))).status).toBe(200);
    expect(paymentOps()).toContainEqual({ table: "payments", method: "update", args: [{ cashfree_payment_id: "1234", status: "paid" }] });
    expect(paymentOps()).toContainEqual({ table: "payments", method: "eq", args: ["cashfree_order_id", "test-order"] });
  });
  it("writes successful webhooks to Cashfree columns", async () => {
    const { POST } = await import("@/app/api/cashfree/webhook/route");
    expect((await POST(webhook("PAYMENT_SUCCESS_WEBHOOK"))).status).toBe(200);
    expect(paymentOps()).toContainEqual({ table: "payments", method: "update", args: [{ cashfree_payment_id: "5678", status: "paid" }] });
    expect(paymentOps().filter(op => op.method === "eq").every(op => op.args[0] === "cashfree_order_id")).toBe(true);
  });
  it("finds already processed payments by cashfree_order_id", async () => {
    alreadyPaid = true;
    const { POST } = await import("@/app/api/cashfree/webhook/route");
    expect((await POST(webhook("PAYMENT_SUCCESS_WEBHOOK"))).status).toBe(200);
    expect(paymentOps()).toContainEqual({ table: "payments", method: "eq", args: ["cashfree_order_id", "test-order"] });
    expect(paymentOps().some(op => op.method === "update")).toBe(false);
  });
  it("finds failed payments by cashfree_order_id", async () => {
    const { POST } = await import("@/app/api/cashfree/webhook/route");
    expect((await POST(webhook("PAYMENT_FAILED_WEBHOOK"))).status).toBe(200);
    expect(paymentOps()).toContainEqual({ table: "payments", method: "eq", args: ["cashfree_order_id", "test-order"] });
  });
});
