"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileOptions) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

interface TurnstileOptions {
  sitekey: string;
  callback: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact";
}

interface TurnstileProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  className?: string;
}

export function Turnstile({ onVerify, onError, onExpire, className }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // True straight away when another page already loaded the Turnstile script.
  // This only gates an effect, never the markup, so it can't cause a hydration mismatch.
  const [isLoaded, setIsLoaded] = useState(
    () => typeof window !== "undefined" && !!window.turnstile
  );

  // Pages pass fresh inline callbacks on every render (typing, OTP countdowns).
  // Keep the latest ones in refs so the widget is created once per mount
  // instead of being torn down and restarted ("Verifying...") on every render.
  const onVerifyRef = useRef(onVerify);
  const onErrorRef = useRef(onError);
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onVerifyRef.current = onVerify;
    onErrorRef.current = onError;
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (isLoaded) return;
    const markLoaded = () => setIsLoaded(true);
    const script =
      document.querySelector<HTMLScriptElement>('script[src*="turnstile"]') ??
      document.head.appendChild(
        Object.assign(document.createElement("script"), {
          src: "https://challenges.cloudflare.com/turnstile/v0/api.js",
          async: true,
        })
      );
    // Also covers a script another component added that is still loading.
    script.addEventListener("load", markLoaded);
    return () => script.removeEventListener("load", markLoaded);
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded || !containerRef.current || !window.turnstile) return;

    const widgetId = window.turnstile.render(containerRef.current, {
      sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!,
      callback: (token) => onVerifyRef.current(token),
      "error-callback": () => onErrorRef.current?.(),
      "expired-callback": () => {
        // Reset widget to get a fresh token
        window.turnstile?.reset(widgetId);
        onExpireRef.current?.();
      },
      theme: "dark",
      size: "normal",
    });

    return () => {
      window.turnstile?.remove(widgetId);
    };
  }, [isLoaded]);

  return <div ref={containerRef} className={className} />;
}
