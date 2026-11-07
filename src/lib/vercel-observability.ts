const DISABLED_VALUES = new Set(["0", "false", "off", "no"]);

function isEnabled(value: string | undefined): boolean {
  if (!value) {
    return true;
  }

  return !DISABLED_VALUES.has(value.trim().toLowerCase());
}

export interface VercelTelemetryConfig {
  enableAnalytics: boolean;
  enableSpeedInsights: boolean;
}

export function getVercelTelemetryConfig(
  env: NodeJS.ProcessEnv = process.env
): VercelTelemetryConfig {
  if (env.NODE_ENV === "test") {
    return {
      enableAnalytics: false,
      enableSpeedInsights: false,
    };
  }

  const telemetryEnabled = isEnabled(env.NEXT_PUBLIC_VERCEL_TELEMETRY);

  return {
    enableAnalytics: telemetryEnabled && isEnabled(env.NEXT_PUBLIC_VERCEL_ANALYTICS),
    enableSpeedInsights:
      telemetryEnabled && isEnabled(env.NEXT_PUBLIC_VERCEL_SPEED_INSIGHTS),
  };
}
