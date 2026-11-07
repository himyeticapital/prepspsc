import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "screenshots");
const COOKIES_FILE = path.join(OUT_DIR, ".cookies.json");

const pages = [
  { name: "01-dashboard", url: "/dashboard" },
  { name: "02-study-ai", url: "/study-ai" },
  { name: "03-study-ai-revision", url: "/study-ai/revision" },
  { name: "04-tests-arena", url: "/tests" },
  { name: "05-study-halls", url: "/rooms" },
  { name: "06-leaderboard", url: "/leaderboard" },
  { name: "07-achievements", url: "/achievements" },
  { name: "08-profile", url: "/profile" },
  { name: "09-buddies", url: "/buddies" },
  { name: "10-notes", url: "/notes" },
  { name: "11-pricing", url: "/pricing" },
  { name: "12-contact", url: "/contact" },
  { name: "13-terms", url: "/terms" },
  { name: "14-refund-policy", url: "/refund-policy" },
  { name: "15-developers", url: "/developers" },
  { name: "16-login", url: "/login" },
  { name: "17-signup", url: "/signup" },
];

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Load cookies captured from the logged-in MCP browser session
  const rawCookies: { name: string; value: string }[] = JSON.parse(
    fs.readFileSync(COOKIES_FILE, "utf-8")
  );

  const browser = await chromium.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  // Inject auth cookies so server-side auth passes
  await context.addCookies(
    rawCookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: "localhost",
      path: "/",
    }))
  );

  const page = await context.newPage();

  // Verify we're actually logged in
  await page.goto(`${BASE_URL}/dashboard`, {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });
  await page.waitForTimeout(1000);

  if (page.url().includes("/login")) {
    console.error("❌ Auth failed — cookie may be expired. Re-run /api/dump-cookies from the browser.");
    await browser.close();
    process.exit(1);
  }

  console.log("✓ Authenticated. Capturing pages...\n");

  for (const { name, url } of pages) {
    console.log(`Capturing ${name}...`);
    try {
      await page.goto(`${BASE_URL}${url}`, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
      await page.waitForTimeout(2000);

      await page.screenshot({
        path: path.join(OUT_DIR, `${name}.png`),
        fullPage: true,
      });
      console.log(`  ✓ ${name}.png`);
    } catch (err) {
      console.error(`  ✗ failed ${name}: ${(err as Error).message}`);
    }
  }

  await browser.close();
  console.log(`\nDone! ${pages.length} screenshots saved to: ${OUT_DIR}`);
}

run().catch(console.error);
