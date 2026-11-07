import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { MusicProvider } from "@/components/providers/music-provider";
import { TimerProvider } from "@/components/providers/timer-provider";
import { Toaster } from "@/components/ui/sonner";
import { getVercelTelemetryConfig } from "@/lib/vercel-observability";
import { Agentation } from "agentation";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PrepSPSC - Sikkim PSC Exam Preparation",
  description: "A gamified, social study platform for Sikkim SPSC aspirants. Practice with mock tests, track your progress, and study with fellow aspirants.",
  keywords: ["Sikkim PSC", "SPSC", "exam preparation", "mock test", "study app"],
  authors: [{ name: "PrepSPSC" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PrepSPSC",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const telemetry = getVercelTelemetryConfig();

  return (
    <html lang="en" suppressHydrationWarning className="overflow-x-hidden max-w-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-x-hidden overflow-y-auto w-full max-w-full`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          themes={["dark", "lofi"]}
          disableTransitionOnChange
        >
          <AuthProvider>
            {/* Persistent Music Player - must be in root layout to survive all navigations */}
            <MusicProvider />
            {/* Persistent Timer - keeps ticking across all page navigations */}
            <TimerProvider />
            {children}
            {telemetry.enableAnalytics && <Analytics />}
            {telemetry.enableSpeedInsights && <SpeedInsights />}
            {process.env.NODE_ENV === "development" && <Agentation />}
            <Toaster position="top-center" richColors />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
