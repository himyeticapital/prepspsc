// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Turnstile } from "@/components/ui/turnstile";

// Tell React this environment supports act().
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type RenderOptions = { callback: (token: string) => void; "expired-callback"?: () => void };

describe("Turnstile widget", () => {
  let render: ReturnType<typeof vi.fn>;
  let remove: ReturnType<typeof vi.fn>;
  let reset: ReturnType<typeof vi.fn>;
  let rendered: RenderOptions[];
  let container: HTMLDivElement;
  let root: Root;

  const widget = (props: Partial<React.ComponentProps<typeof Turnstile>> = {}) =>
    React.createElement(Turnstile, {
      // Fresh inline functions on every call, like the real pages pass.
      onVerify: () => {},
      onError: () => {},
      onExpire: () => {},
      ...props,
    });

  beforeEach(() => {
    rendered = [];
    render = vi.fn((_el: HTMLElement, opts: RenderOptions) => {
      rendered.push(opts);
      return `widget-${rendered.length}`;
    });
    remove = vi.fn();
    reset = vi.fn();
    (window as unknown as { turnstile: unknown }).turnstile = { render, remove, reset };

    // Script tag already on the page, so the component uses window.turnstile directly.
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    document.head.appendChild(script);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.head.innerHTML = "";
    delete (window as unknown as { turnstile?: unknown }).turnstile;
  });

  it("keeps one widget while the parent re-renders with new callbacks", () => {
    act(() => root.render(widget()));
    // e.g. typing in a field, or the OTP resend countdown ticking every second
    for (let i = 0; i < 5; i++) {
      act(() => root.render(widget()));
    }

    expect(render).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
  });

  it("delivers the token to the latest onVerify", () => {
    const first = vi.fn();
    const latest = vi.fn();
    act(() => root.render(widget({ onVerify: first })));
    act(() => root.render(widget({ onVerify: latest })));

    act(() => rendered[0].callback("token-123"));

    expect(latest).toHaveBeenCalledWith("token-123");
    expect(first).not.toHaveBeenCalled();
  });

  it("resets the widget and tells the latest onExpire when the token expires", () => {
    const latestExpire = vi.fn();
    act(() => root.render(widget()));
    act(() => root.render(widget({ onExpire: latestExpire })));

    act(() => rendered[0]["expired-callback"]?.());

    expect(reset).toHaveBeenCalledWith("widget-1");
    expect(latestExpire).toHaveBeenCalledTimes(1);
  });

  it("adds the script when missing and renders once it has loaded", () => {
    document.head.innerHTML = "";
    const api = (window as unknown as { turnstile?: unknown }).turnstile;
    delete (window as unknown as { turnstile?: unknown }).turnstile;

    act(() => root.render(widget()));
    const script = document.head.querySelector<HTMLScriptElement>('script[src*="turnstile"]');
    expect(script).not.toBeNull();
    expect(render).not.toHaveBeenCalled();

    (window as unknown as { turnstile?: unknown }).turnstile = api;
    act(() => script!.dispatchEvent(new Event("load")));
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("removes the widget when unmounted", () => {
    act(() => root.render(widget()));
    act(() => root.render(React.createElement("div")));

    expect(remove).toHaveBeenCalledWith("widget-1");
  });
});
