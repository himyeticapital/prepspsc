import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";

dotenv.config({ path: ".env.local" });

const BASE_URL = process.env.MARKETING_SCREENSHOT_BASE_URL || "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "screenshots", "marketing");
const SCREENSHOT_WIDTH = 1512;
const SCREENSHOT_HEIGHT = 982;
const SUPABASE_PROJECT_REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const AUTH_COOKIE_NAME = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
const AUTH_EMAIL = process.env.MARKETING_SCREENSHOT_EMAIL;
if (!AUTH_EMAIL) {
  console.error("Set MARKETING_SCREENSHOT_EMAIL to the account whose screens should be captured.");
  process.exit(1);
}

async function createFreshSession() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: AUTH_EMAIL,
  });

  if (linkError) {
    throw linkError;
  }

  const tokenHash = linkData?.properties?.hashed_token;

  if (!tokenHash) {
    throw new Error("Magic link generation did not return a hashed token.");
  }

  const { data: otpData, error: otpError } = await anon.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });

  if (otpError) {
    throw otpError;
  }

  if (!otpData.session) {
    throw new Error("OTP verification succeeded without a session.");
  }

  return otpData.session;
}

function encodeSessionCookie(session) {
  return `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function capture(page, name, url, options = {}) {
  const destination = path.join(OUT_DIR, `${name}.png`);
  await page.goto(`${BASE_URL}${url}`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(options.waitMs ?? 2500);

  if (typeof options.beforeShot === "function") {
    await options.beforeShot(page);
    await page.waitForTimeout(options.postActionWaitMs ?? 1500);
  }

  await page.screenshot({
    path: destination,
    fullPage: options.fullPage ?? false,
  });

  console.log(`Saved ${destination}`);
}

async function maybeCaptureRoomDetail(page) {
  await page.goto(`${BASE_URL}/rooms`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(2500);

  const roomLink = page.locator('a[href^="/room/"]').first();
  if ((await roomLink.count()) === 0) {
    console.log("Skipped room detail screenshot: no room link found.");
    return;
  }

  await roomLink.click();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2500);

  await page.screenshot({
    path: path.join(OUT_DIR, "07-study-room-detail.png"),
    fullPage: false,
  });

  console.log(`Saved ${path.join(OUT_DIR, "07-study-room-detail.png")}`);
}

async function maybeCaptureKnowledgeGraph(page) {
  await page.goto(`${BASE_URL}/study-ai?tab=planner`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(3000);

  const graphToggle = page.getByRole("button", { name: /knowledge graph/i }).first();

  if (!(await graphToggle.isVisible().catch(() => false))) {
    await page.goto(`${BASE_URL}/`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    const featureCard = page
      .getByText("Knowledge Graph")
      .first()
      .locator("xpath=ancestor::div[contains(@class, 'widget-glass')]")
      .first();

    if (!(await featureCard.isVisible().catch(() => false))) {
      console.log("Skipped knowledge graph screenshot: planner toggle and landing card were not visible.");
      return;
    }

    await featureCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await featureCard.screenshot({
      path: path.join(OUT_DIR, "04-study-ai-knowledge-graph.png"),
    });
    console.log(`Saved ${path.join(OUT_DIR, "04-study-ai-knowledge-graph.png")}`);
    return;
  }

  await graphToggle.click();
  await page.waitForTimeout(3500);

  await page.screenshot({
    path: path.join(OUT_DIR, "04-study-ai-knowledge-graph.png"),
    fullPage: false,
  });

  console.log(`Saved ${path.join(OUT_DIR, "04-study-ai-knowledge-graph.png")}`);
}

async function run() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing required Supabase environment variables.");
  }

  await ensureDir(OUT_DIR);

  const session = await createFreshSession();
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });

  const context = await browser.newContext({
    viewport: { width: SCREENSHOT_WIDTH, height: SCREENSHOT_HEIGHT },
    colorScheme: "dark",
  });

  await context.addCookies([
    {
      name: AUTH_COOKIE_NAME,
      value: encodeSessionCookie(session),
      domain: "localhost",
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();

  await capture(page, "01-landing-page", "/", {
    waitMs: 3000,
  });

  await capture(page, "02-dashboard", "/dashboard");
  await capture(page, "03-study-ai-planner", "/study-ai?tab=planner", {
    waitMs: 3500,
  });
  await maybeCaptureKnowledgeGraph(page);
  await capture(page, "05-study-ai-notebook", "/study-ai?tab=notebook", {
    waitMs: 3500,
  });
  await capture(page, "06-study-ai-revision", "/study-ai?tab=revision", {
    waitMs: 3500,
  });
  await capture(page, "08-tests-arena", "/tests", {
    waitMs: 3500,
  });
  await capture(page, "09-study-rooms", "/rooms", {
    waitMs: 3500,
  });
  await maybeCaptureRoomDetail(page);

  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
