import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable React StrictMode to prevent double-mounting issues with Supabase
  reactStrictMode: false,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=(), interest-cohort=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.cashfree.com https://*.cashfree.com https://challenges.cloudflare.com https://www.youtube.com https://www.google.com https://www.gstatic.com https://recaptchaenterprise.googleapis.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com https://images.unsplash.com https://i.ytimg.com https://*.mzstatic.com https://www.gstatic.com",
              "media-src 'self' https://audio-ssl.itunes.apple.com",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://*.cashfree.com https://challenges.cloudflare.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebaseinstallations.googleapis.com https://firebase.googleapis.com https://recaptchaenterprise.googleapis.com https://www.googleapis.com https://www.google.com",
              "frame-src 'self' https://sdk.cashfree.com https://*.cashfree.com https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://www.google.com https://prepspsc-18c1e.firebaseapp.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https://*.cashfree.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
