import { beforeEach, describe, expect, it, vi } from "vitest";

const userId = "00000000-0000-4000-8000-000000000001";

const mocks = vi.hoisted(() => ({
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  spendResult: { ok: true, balance_paise: 1000, applied: true } as Record<string, unknown>,
  modelsUsed: [] as string[],
  geminiFails: false,
  geminiText: JSON.stringify({ title: "Summary", points: ["a"] }),
  inserted: [] as Array<{ table: string; row: Record<string, unknown> }>,
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel({ model }: { model: string }) {
      return {
        generateContent: async (prompt: string) => {
          if (prompt === "test") return { response: { text: () => "ok" } };
          mocks.modelsUsed.push(model);
          if (mocks.geminiFails) throw new Error("boom");
          return { response: { text: () => mocks.geminiText } };
        },
      };
    }
  },
}));

function query(table: string) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gte", "update"]) q[m] = () => q;
  q.insert = (row: Record<string, unknown>) => { mocks.inserted.push({ table, row }); return q; };
  q.single = async () => {
    if (table === "study_ai_goals") return { data: { id: 1, user_id: userId }, error: null };
    if (table === "ai_generations") return { data: { id: 9, ...mocks.inserted.at(-1)?.row }, error: null };
    if (table === "profiles") return { data: { is_pro_member: false, xp_points: 0 }, error: null };
    return { data: null, error: null };
  };
  q.then = (res: (v: unknown) => void) => res({ data: null, error: null, count: 0 });
  return q;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
    from: (t: string) => query(t),
  }),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      mocks.rpcCalls.push({ fn, args });
      return { data: fn === "ai_credit_spend" ? mocks.spendResult : { balance_paise: 1500, applied: true }, error: null };
    },
    from: (t: string) => query(t),
  }),
}));
vi.mock("@/lib/rate-limit", () => ({ applyRateLimit: async () => null }));
vi.mock("@/lib/daily-cap", () => ({ enforceDailyCap: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const content = "The Teesta river flows through Sikkim. ".repeat(20);
const request = (extra: Record<string, unknown> = {}) => new Request("https://prepspsc.com/api/study-ai/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ goalId: 1, generationType: "summary", sourceContent: content, ...extra }),
});

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("GOOGLE_GEMINI_API_KEY", "test-key");
  mocks.rpcCalls.length = 0;
  mocks.modelsUsed.length = 0;
  mocks.inserted.length = 0;
  mocks.geminiFails = false;
  mocks.geminiText = JSON.stringify({ title: "Summary", points: ["a"] });
  mocks.spendResult = { ok: true, balance_paise: 1000, applied: true };
});

async function run(extra: Record<string, unknown> = {}) {
  const { POST } = await import("@/app/api/study-ai/generate/route");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return POST(request(extra) as any);
}

describe("Study AI generate: basic vs better answer", () => {
  it("uses the free basic model and charges nothing by default", async () => {
    const res = await run();
    expect(res.status).toBe(200);
    expect(mocks.modelsUsed).toEqual(["gemini-3.1-flash-lite"]);
    expect(mocks.rpcCalls).toHaveLength(0);
  });

  it("charges ₹5 and uses Gemini 3 Flash for a better answer", async () => {
    const res = await run({ modelTier: "better" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(mocks.modelsUsed).toEqual(["gemini-3-flash-preview"]);
    expect(mocks.rpcCalls.map((c) => c.fn)).toEqual(["ai_credit_spend"]);
    expect(mocks.rpcCalls[0].args).toMatchObject({ p_user_id: userId, p_amount_paise: 500 });
    expect(body).toMatchObject({ modelTier: "better", creditsBalancePaise: 1000 });
  });

  it("refuses a better answer when the balance is too low, without calling the AI", async () => {
    mocks.spendResult = { ok: false, balance_paise: 200 };
    const res = await run({ modelTier: "better" });
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ code: "INSUFFICIENT_CREDITS", balancePaise: 200, pricePaise: 500 });
    expect(mocks.modelsUsed).toHaveLength(0);
  });

  it("refunds the charge when the better answer fails", async () => {
    mocks.geminiFails = true;
    const res = await run({ modelTier: "better" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const [spend, refund] = mocks.rpcCalls;
    expect(refund).toMatchObject({ fn: "ai_credit_add", args: { p_reason: "refund", p_reference: spend.args.p_reference } });
  });

  it("refunds the charge when the better answer can't be read", async () => {
    mocks.geminiText = "not json at all";
    const res = await run({ modelTier: "better" });
    expect(res.status).toBe(500);
    expect(mocks.rpcCalls.map((c) => c.fn)).toEqual(["ai_credit_spend", "ai_credit_add"]);
  });

  it("rejects an unknown model tier", async () => {
    expect((await run({ modelTier: "ultra" })).status).toBe(400);
  });
});
