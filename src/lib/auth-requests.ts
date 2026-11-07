function combineSignals(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === "function") return AbortSignal.any(signals);

  // Safari before 17.4 has timeout signals but cannot combine them natively.
  const controller = new AbortController();
  const cleanup = () => {
    for (const signal of signals) signal.removeEventListener("abort", onAbort);
  };
  const onAbort = (event: Event) => {
    cleanup();
    controller.abort((event.target as AbortSignal).reason);
  };

  for (const signal of signals) {
    if (signal.aborted) {
      cleanup();
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  }

  return controller.signal;
}

function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
  timeoutMs: number,
): ReturnType<typeof fetch> {
  // Keep the deadline signal active after headers arrive so body reads also abort.
  const signals = [AbortSignal.timeout(timeoutMs)];
  if (input instanceof Request) signals.push(input.signal);
  if (init?.signal) signals.push(init.signal);

  return fetch(input, { ...init, signal: combineSignals(signals) });
}

export const fetchAuthPreflight: typeof fetch = (input, init) =>
  fetchWithTimeout(input, init, 15_000);

export const fetchSignupWithTimeout: typeof fetch = (input, init) => {
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (method.toUpperCase() !== "POST" || !supabaseUrl) return fetch(input, init);

  let isSignup = false;
  try {
    const inputUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(inputUrl);
    const signupUrl = new URL(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/signup`);
    isSignup = url.origin === signupUrl.origin && url.pathname === signupUrl.pathname;
  } catch {
    // Relative URLs and invalid configuration retain native fetch behavior.
  }

  return isSignup ? fetchWithTimeout(input, init, 30_000) : fetch(input, init);
};
