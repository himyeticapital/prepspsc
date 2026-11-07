/**
 * API Key Management CLI
 * Run with:
 *   npx tsx scripts/manage-api-keys.ts <command>
 *
 * Commands:
 *   generate --email user@example.com --name "My App" --tier free
 *   list [--email user@example.com]
 *   revoke --prefix sk_live_abcd1234
 *   stats --prefix sk_live_abcd1234
 *
 * Required .env.local variables:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "crypto";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const flags: Record<string, string> = {};
  for (let i = 1; i < args.length; i += 2) {
    if (args[i]?.startsWith("--")) {
      flags[args[i].substring(2)] = args[i + 1] || "";
    }
  }
  return { command, flags };
}

// ---------------------------------------------------------------------------
// Tier config
// ---------------------------------------------------------------------------

const TIER_LIMITS: Record<string, { rate_limit_rpm: number; monthly_quota: number }> = {
  free: { rate_limit_rpm: 10, monthly_quota: 1000 },
  paid: { rate_limit_rpm: 60, monthly_quota: 50000 },
  enterprise: { rate_limit_rpm: 500, monthly_quota: 0 },
};

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function generateKey(flags: Record<string, string>) {
  const { email, name, tier = "free" } = flags;

  if (!email || !name) {
    console.error("Usage: generate --email <email> --name <name> [--tier free|paid|enterprise]");
    process.exit(1);
  }

  if (!TIER_LIMITS[tier]) {
    console.error(`Invalid tier "${tier}". Must be one of: free, paid, enterprise`);
    process.exit(1);
  }

  const rawKey = `sk_live_${randomBytes(16).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.substring(0, 16);
  const limits = TIER_LIMITS[tier];

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

  if (error) {
    console.error("Failed to insert key:", error.message);
    process.exit(1);
  }

  console.log("\n\u2705 API key generated successfully!\n");
  console.log(`  Key:    ${rawKey}`);
  console.log(`  Prefix: ${keyPrefix}`);
  console.log(`  Owner:  ${email}`);
  console.log(`  Name:   ${name}`);
  console.log(`  Tier:   ${tier} (${limits.rate_limit_rpm} RPM, ${limits.monthly_quota === 0 ? "unlimited" : limits.monthly_quota} requests/month)`);
  console.log("\n\u26a0\ufe0f  Save this key -- it cannot be retrieved again!\n");
}

async function listKeys(flags: Record<string, string>) {
  let query = supabase
    .from("external_api_keys")
    .select("key_prefix, name, owner_email, tier, status, total_requests, last_used_at, created_at")
    .order("created_at", { ascending: false });

  if (flags.email) {
    query = query.eq("owner_email", flags.email);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to list keys:", error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log("No API keys found.");
    return;
  }

  console.log(`\nFound ${data.length} key(s):\n`);

  const header = [
    "Prefix".padEnd(18),
    "Name".padEnd(20),
    "Owner".padEnd(28),
    "Tier".padEnd(12),
    "Status".padEnd(10),
    "Requests".padEnd(10),
    "Last Used".padEnd(22),
    "Created",
  ].join(" ");

  console.log(header);
  console.log("-".repeat(header.length));

  for (const row of data) {
    console.log(
      [
        (row.key_prefix || "").padEnd(18),
        (row.name || "").substring(0, 18).padEnd(20),
        (row.owner_email || "").substring(0, 26).padEnd(28),
        (row.tier || "").padEnd(12),
        (row.status === "active" ? "\u2705 active" : "\u274c revoked").padEnd(10),
        String(row.total_requests ?? 0).padEnd(10),
        (row.last_used_at ? new Date(row.last_used_at).toISOString().substring(0, 19) : "never").padEnd(22),
        row.created_at ? new Date(row.created_at).toISOString().substring(0, 10) : "",
      ].join(" ")
    );
  }

  console.log("");
}

async function revokeKey(flags: Record<string, string>) {
  const { prefix } = flags;

  if (!prefix) {
    console.error("Usage: revoke --prefix <key_prefix>");
    process.exit(1);
  }

  const { data, error } = await supabase
    .from("external_api_keys")
    .update({ status: "revoked" })
    .eq("key_prefix", prefix)
    .select("key_prefix, name, owner_email");

  if (error) {
    console.error("Failed to revoke key:", error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.error(`No key found with prefix "${prefix}"`);
    process.exit(1);
  }

  const row = data[0];
  console.log(`\n\u274c Key revoked: ${row.key_prefix} (${row.name}, ${row.owner_email})\n`);
}

async function showStats(flags: Record<string, string>) {
  const { prefix } = flags;

  if (!prefix) {
    console.error("Usage: stats --prefix <key_prefix>");
    process.exit(1);
  }

  // Fetch key info
  const { data: keyData, error: keyError } = await supabase
    .from("external_api_keys")
    .select("*")
    .eq("key_prefix", prefix)
    .single();

  if (keyError || !keyData) {
    console.error(`No key found with prefix "${prefix}"`);
    process.exit(1);
  }

  console.log("\n--- Key Info ---");
  console.log(`  Name:           ${keyData.name}`);
  console.log(`  Owner:          ${keyData.owner_email}`);
  console.log(`  Tier:           ${keyData.tier}`);
  console.log(`  Status:         ${keyData.status === "active" ? "\u2705 active" : "\u274c revoked"}`);
  console.log(`  Total Requests: ${keyData.total_requests ?? 0}`);
  console.log(`  Rate Limit:     ${keyData.rate_limit_rpm} RPM`);
  console.log(`  Monthly Quota:  ${keyData.monthly_quota === 0 ? "unlimited" : keyData.monthly_quota}`);
  console.log(`  Created:        ${keyData.created_at ? new Date(keyData.created_at).toISOString().substring(0, 19) : "N/A"}`);
  console.log(`  Last Used:      ${keyData.last_used_at ? new Date(keyData.last_used_at).toISOString().substring(0, 19) : "never"}`);

  // Fetch monthly quota breakdown (last 6 months)
  const { data: quotaData, error: quotaError } = await supabase
    .from("api_key_quotas")
    .select("month, request_count")
    .eq("key_id", keyData.id)
    .order("month", { ascending: false })
    .limit(6);

  if (!quotaError && quotaData && quotaData.length > 0) {
    console.log("\n--- Monthly Breakdown ---");
    for (const row of quotaData) {
      console.log(`  ${row.month}:  ${row.request_count} requests`);
    }
  } else {
    console.log("\n--- Monthly Breakdown ---");
    console.log("  No monthly data yet.");
  }

  // Fetch recent usage (last 10 requests)
  const { data: usageData, error: usageError } = await supabase
    .from("api_usage_log")
    .select("requested_at, endpoint, status_code, response_time_ms")
    .eq("key_id", keyData.id)
    .order("requested_at", { ascending: false })
    .limit(10);

  if (!usageError && usageData && usageData.length > 0) {
    console.log("\n--- Recent Usage (last 10) ---");
    for (const row of usageData) {
      const time = row.requested_at ? new Date(row.requested_at).toISOString().substring(0, 19) : "";
      console.log(`  ${time}  ${(row.endpoint || "").padEnd(30)}  ${row.status_code}  ${row.response_time_ms ?? "-"}ms`);
    }
  } else {
    console.log("\n--- Recent Usage ---");
    console.log("  No usage data yet.");
  }

  console.log("");
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`
API Key Management CLI

Usage: npx tsx scripts/manage-api-keys.ts <command> [options]

Commands:
  generate   Create a new API key
             --email <email>   Owner email (required)
             --name <name>     Key name/label (required)
             --tier <tier>     free | paid | enterprise (default: free)

  list       List all API keys
             --email <email>   Filter by owner email (optional)

  revoke     Revoke an API key
             --prefix <prefix> Key prefix, e.g. sk_live_abcd1234 (required)

  stats      Show detailed stats for a key
             --prefix <prefix> Key prefix (required)

  help       Show this help message
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { command, flags } = parseArgs();

  switch (command) {
    case "generate":
      await generateKey(flags);
      break;
    case "list":
      await listKeys(flags);
      break;
    case "revoke":
      await revokeKey(flags);
      break;
    case "stats":
      await showStats(flags);
      break;
    case "help":
      printHelp();
      break;
    default:
      if (command) {
        console.error(`Unknown command: "${command}"\n`);
      }
      printHelp();
      process.exit(command ? 1 : 0);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
