import { getVercelTelemetryConfig } from "@/lib/vercel-observability";

describe("getVercelTelemetryConfig", () => {
  it("disables telemetry in test environments", () => {
    expect(
      getVercelTelemetryConfig({
        NODE_ENV: "test",
      })
    ).toEqual({
      enableAnalytics: false,
      enableSpeedInsights: false,
    });
  });

  it("enables analytics and speed insights by default outside tests", () => {
    expect(
      getVercelTelemetryConfig({
        NODE_ENV: "production",
      })
    ).toEqual({
      enableAnalytics: true,
      enableSpeedInsights: true,
    });
  });

  it("supports disabling all Vercel telemetry with one env flag", () => {
    expect(
      getVercelTelemetryConfig({
        NODE_ENV: "production",
        NEXT_PUBLIC_VERCEL_TELEMETRY: "false",
      })
    ).toEqual({
      enableAnalytics: false,
      enableSpeedInsights: false,
    });
  });

  it("supports disabling analytics or speed insights independently", () => {
    expect(
      getVercelTelemetryConfig({
        NODE_ENV: "production",
        NEXT_PUBLIC_VERCEL_ANALYTICS: "0",
        NEXT_PUBLIC_VERCEL_SPEED_INSIGHTS: "off",
      })
    ).toEqual({
      enableAnalytics: false,
      enableSpeedInsights: false,
    });
  });
});
