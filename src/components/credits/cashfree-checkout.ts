"use client";

interface CashfreeInstance {
  checkout: (options: {
    paymentSessionId: string;
    redirectTarget: string;
  }) => Promise<{ error?: { message: string }; paymentDetails?: { paymentMessage: string } }>;
}

type CashfreeFactory = (config: { mode: string }) => CashfreeInstance;

function loadCashfree(): Promise<CashfreeFactory | null> {
  const w = window as unknown as { Cashfree?: CashfreeFactory };
  if (w.Cashfree) return Promise.resolve(w.Cashfree);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.onload = () => resolve(w.Cashfree ?? null);
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });
}

export type BuyResult = { ok: true; balancePaise: number } | { ok: false; message: string };

/** Pay for an AI credit pack with Cashfree, then confirm it on the server. */
export async function buyCreditPack(packId: string): Promise<BuyResult> {
  const Cashfree = await loadCashfree();
  if (!Cashfree) return { ok: false, message: "Couldn't load the payment page. Check your connection." };

  const orderRes = await fetch("/api/credits/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packId }),
  });
  const order = await orderRes.json().catch(() => ({}));
  if (!orderRes.ok) return { ok: false, message: order.error || "Couldn't start the payment." };

  const mode = process.env.NEXT_PUBLIC_CASHFREE_ENV === "production" ? "production" : "sandbox";
  const result = await Cashfree({ mode }).checkout({
    paymentSessionId: order.paymentSessionId,
    redirectTarget: "_modal",
  });
  if (result.error) return { ok: false, message: result.error.message || "Payment was cancelled." };

  // Cashfree can take a moment to mark the order paid; try a few times.
  for (let attempt = 0; attempt < 4; attempt++) {
    const verifyRes = await fetch("/api/credits/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.orderId }),
    });
    const verified = await verifyRes.json().catch(() => ({}));
    if (verifyRes.ok) return { ok: true, balancePaise: verified.balancePaise };
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  return {
    ok: false,
    message: "We couldn't confirm the payment yet. If money was taken, your credits will appear within a few minutes.",
  };
}
