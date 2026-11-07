/**
 * Where the Upstash Redis (rate limits and daily caps) lives.
 *
 * Prefers the database connected through Vercel's Upstash integration (KV_REST_API_URL /
 * KV_REST_API_TOKEN). Falls back to manually set UPSTASH_REDIS_REST_URL / _TOKEN.
 * A URL and token are always taken as a pair from the same source.
 */
export function getRedisRestConfig(
  env: Record<string, string | undefined> = process.env
): { url: string; token: string } | null {
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    return { url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN };
  }
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return { url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN };
  }
  return null;
}
