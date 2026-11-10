// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import OnboardingPage from "@/app/(auth)/onboarding/page";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
  rejectPhone: false,
  rejectRead: false,
  writes: [] as string[],
  confirm: vi.fn(async () => ({})),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => {
  const router = { push: state.push };
  return { useRouter: () => router };
});
vi.mock("next/image", () => ({
  default: function TestImage(props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) {
    const domProps = { ...props };
    delete domProps.fill;
    return React.createElement("img", domProps);
  },
}));
vi.mock("@/components/ui/exam-selector", () => ({ ExamSelector: () => null }));
vi.mock("framer-motion", () => {
  const element = (tag: "div" | "button") => function MotionElement(props: Record<string, unknown>) {
    const domProps = { ...props };
    for (const key of ["initial", "animate", "exit", "transition", "whileHover", "whileTap"]) delete domProps[key];
    return React.createElement(tag, domProps);
  };
  return { motion: { div: element("div"), button: element("button") } };
});
vi.mock("@/lib/firebase", () => ({
  getFirebaseAuth: () => ({}),
  RecaptchaVerifier: class { clear() {} },
  signInWithPhoneNumber: async () => ({ confirm: state.confirm }),
}));
vi.mock("@/lib/supabase/client", () => {
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "u1", email: "fixture@example.invalid" } } }) },
    from: (table: string) => {
      let writing = false;
      let checkingUsername = false;
      const result = async () => {
        if (state.rejectRead && !writing) return { data: null, error: { message: "read failed" } };
        if (writing) {
          state.writes.push(table);
          return state.rejectPhone && table === "profile_private"
            ? { data: null, error: { message: "permission denied", code: "42501" } }
            : { data: { id: "u1" }, error: null };
        }
        if (checkingUsername) return { data: null, error: null };
        return { data: table === "profiles"
          ? { username: "fixture", avatar_url: "/avatars/avatar-1.svg", phone_verified: true }
          : { phone_number: null }, error: null };
      };
      const q = {
        select: () => q, eq: () => q, abortSignal: () => q,
        neq: () => { checkingUsername = true; return q; },
        update: () => { writing = true; return q; },
        single: result, maybeSingle: result,
      };
      return q;
    },
  };
  return { createClient: () => client };
});

describe("onboarding page recovery", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    state.rejectPhone = state.rejectRead = false;
    state.writes = [];
    state.confirm.mockClear();
    state.push.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const button = (text: string) => Array.from(container.querySelectorAll("button"))
    .find(el => el.textContent?.trim() === text)!;
  const fill = async (selector: string, value: string) => {
    const el = container.querySelector<HTMLInputElement>(selector)!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const mount = async () => {
    await act(async () => root.render(React.createElement(OnboardingPage)));
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
  };

  it("keeps a failed Google phone save on the profile step, then allows retry without another OTP", async () => {
    await mount();
    expect(button("Continue").disabled).toBe(true);
    await fill('input[type="tel"]', "9800000002");
    await act(async () => button("Send OTP").click());
    await fill('input[placeholder="Enter 6-digit OTP"]', "123456");
    await act(async () => button("Verify").click());
    expect(state.confirm).toHaveBeenCalledWith("123456");
    expect(button("Continue").disabled).toBe(false);

    state.rejectPhone = true;
    await act(async () => button("Continue").click());
    expect(container.textContent).toContain("Failed to save your phone number");
    expect(container.textContent).not.toContain("Connect Telegram Bot");
    expect(button("Continue").disabled).toBe(false);
    expect(state.writes).toEqual(["profile_private"]);

    state.rejectPhone = false;
    await act(async () => button("Continue").click());
    expect(container.textContent).toContain("Connect Telegram Bot");
    expect(state.writes).toEqual(["profile_private", "profile_private", "profiles"]);
    expect(state.confirm).toHaveBeenCalledTimes(1);
  });

  it("shows a retry action after a profile read fails instead of a permanent spinner", async () => {
    state.rejectRead = true;
    await mount();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Could not load your profile");
    state.rejectRead = false;
    await act(async () => button("Try again").click());
    expect(container.querySelector('input[type="tel"]')).not.toBeNull();
  });
});
