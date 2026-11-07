"use server";

import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "crypto";
import { validateEmail } from "@/lib/email-validation";

const TIER_LIMITS: Record<string, { rate_limit_rpm: number; monthly_quota: number }> = {
  free: { rate_limit_rpm: 10, monthly_quota: 1000 },
  paid: { rate_limit_rpm: 60, monthly_quota: 50000 },
  enterprise: { rate_limit_rpm: 500, monthly_quota: 0 },
};

async function verifyAdmin() {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await authClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") throw new Error("Forbidden");
  return user;
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function generateApiKey(formData: {
  email: string;
  name: string;
  tier: string;
}) {
  await verifyAdmin();
  const supabase = getServiceClient();

  const { email, name, tier } = formData;

  if (!name || name.trim().length < 2) {
    throw new Error("Name is required (minimum 2 characters)");
  }

  const emailError = await validateEmail(email);
  if (emailError) throw new Error(emailError);

  const limits = TIER_LIMITS[tier];
  if (!limits) throw new Error(`Invalid tier: ${tier}`);

  const rawKey = `sk_live_${randomBytes(16).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.substring(0, 16);

  const { error } = await supabase.from("external_api_keys").insert({
    key_hash: keyHash,
    key_prefix: keyPrefix,
    owner_email: email,
    name,
    tier,
    status: "active",
    rate_limit_rpm: limits.rate_limit_rpm,
    monthly_quota: limits.monthly_quota,
  });

  if (error) throw new Error(error.message);

  return { success: true, key: rawKey };
}

export async function listApiKeys() {
  await verifyAdmin();
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("external_api_keys")
    .select("id, key_prefix, name, owner_email, tier, status, total_requests, rate_limit_rpm, monthly_quota, allowed_ips, last_used_at, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  // Fetch current month quotas for all keys
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const { data: quotas } = await supabase
    .from("api_key_quotas")
    .select("api_key_id, request_count")
    .eq("month", currentMonth);

  const quotaMap: Record<string, number> = {};
  quotas?.forEach((q) => {
    quotaMap[q.api_key_id] = q.request_count;
  });

  // Fetch developer signup info for each key
  const { data: signups } = await supabase
    .from("api_developer_signups")
    .select("api_key_id, app_name, website_url, phone_number, email");

  const signupMap: Record<string, { app_name: string; website_url: string | null; phone_number: string | null; email: string | null }> = {};
  signups?.forEach((s) => {
    if (s.api_key_id) signupMap[s.api_key_id] = { app_name: s.app_name, website_url: s.website_url, phone_number: s.phone_number || null, email: s.email || null };
  });

  return (data || []).map((k) => ({
    ...k,
    current_month_usage: quotaMap[k.id] || 0,
    app_name: signupMap[k.id]?.app_name || null,
    website_url: signupMap[k.id]?.website_url || null,
    phone_number: signupMap[k.id]?.phone_number || null,
    developer_email: signupMap[k.id]?.email || null,
  }));
}

export async function revokeApiKey(keyId: string) {
  await verifyAdmin();
  const supabase = getServiceClient();

  const { error } = await supabase
    .from("external_api_keys")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", keyId);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function getKeyStats(keyId: string) {
  await verifyAdmin();
  const supabase = getServiceClient();

  const { data: keyData, error: keyError } = await supabase
    .from("external_api_keys")
    .select("*")
    .eq("id", keyId)
    .single();

  if (keyError || !keyData) throw new Error("Key not found");

  const { data: quotas } = await supabase
    .from("api_key_quotas")
    .select("month, request_count")
    .eq("api_key_id", keyId)
    .order("month", { ascending: false })
    .limit(6);

  const { data: recentUsage } = await supabase
    .from("api_usage_log")
    .select("endpoint, query, status_code, response_time_ms, ip_address, results_count, error_message, created_at")
    .eq("api_key_id", keyId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Compute endpoint breakdown from all usage logs
  const { data: allLogs } = await supabase
    .from("api_usage_log")
    .select("endpoint, status_code, response_time_ms, ip_address")
    .eq("api_key_id", keyId);

  const endpointStats: Record<string, { count: number; errors: number; totalMs: number; msCount: number }> = {};
  let totalErrors = 0;
  let totalResponseTime = 0;
  let responseTimeCount = 0;

  (allLogs || []).forEach((log) => {
    const ep = log.endpoint || "unknown";
    if (!endpointStats[ep]) endpointStats[ep] = { count: 0, errors: 0, totalMs: 0, msCount: 0 };
    endpointStats[ep].count++;
    if (log.status_code >= 400) {
      endpointStats[ep].errors++;
      totalErrors++;
    }
    if (log.response_time_ms != null) {
      endpointStats[ep].totalMs += log.response_time_ms;
      endpointStats[ep].msCount++;
      totalResponseTime += log.response_time_ms;
      responseTimeCount++;
    }
  });

  const endpointBreakdown = Object.entries(endpointStats)
    .map(([endpoint, stats]) => ({
      endpoint,
      count: stats.count,
      errors: stats.errors,
      avgMs: stats.msCount > 0 ? Math.round(stats.totalMs / stats.msCount) : null,
    }))
    .sort((a, b) => b.count - a.count);

  // Count unique users and questions answered via this key
  const { count: uniqueUsers } = await supabase
    .from("api_user_progress")
    .select("external_user_id", { count: "exact", head: true })
    .eq("api_key_id", keyId);

  const { count: totalAnswered } = await supabase
    .from("api_user_progress")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", keyId);

  const { count: correctAnswers } = await supabase
    .from("api_user_progress")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", keyId)
    .eq("is_correct", true);

  const { count: bookmarkCount } = await supabase
    .from("api_user_bookmarks")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", keyId);

  // Unique IPs
  const uniqueIps = new Set((allLogs || []).map((l) => l.ip_address).filter(Boolean));

  // Developer signup info
  const { data: signup } = await supabase
    .from("api_developer_signups")
    .select("name, email, app_name, app_description, website_url, created_at")
    .eq("api_key_id", keyId)
    .single();

  return {
    key: keyData,
    quotas: quotas || [],
    recentUsage: (recentUsage || []).slice(0, 20),
    endpointBreakdown,
    summary: {
      totalRequests: allLogs?.length || 0,
      totalErrors,
      errorRate: (allLogs?.length || 0) > 0 ? Math.round((totalErrors / allLogs!.length) * 100) : 0,
      avgResponseMs: responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount) : null,
      uniqueIps: uniqueIps.size,
      uniqueUsers: uniqueUsers || 0,
      totalAnswered: totalAnswered || 0,
      correctAnswers: correctAnswers || 0,
      bookmarks: bookmarkCount || 0,
    },
    developer: signup || null,
  };
}

export async function updateAllowedIps(keyId: string, ips: string[]) {
  await verifyAdmin();
  const supabase = getServiceClient();

  // Validate each IP is a valid IPv4/IPv6 address
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^[0-9a-fA-F:]+$/;
  for (const ip of ips) {
    const trimmed = ip.trim();
    if (!ipv4Regex.test(trimmed) && !ipv6Regex.test(trimmed)) {
      throw new Error(`Invalid IP address: ${trimmed}`);
    }
  }

  const cleaned = ips.map((ip) => ip.trim()).filter(Boolean);

  const { error } = await supabase
    .from("external_api_keys")
    .update({ allowed_ips: cleaned, updated_at: new Date().toISOString() })
    .eq("id", keyId);

  if (error) throw new Error(error.message);
  return { success: true };
}
