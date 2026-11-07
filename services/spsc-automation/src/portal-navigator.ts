/**
 * Portal Navigator
 * Puppeteer scripts for navigating the SPSC recruitment portal
 */

import { Page } from "puppeteer-core";
import { extractCaptcha, fillCaptcha, clearAndType, clearAndTypeElement } from "./captcha-handler";
import type { FillFormRequest, UploadDocumentRequest } from "./types";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const PORTAL_BASE_URL = "https://spscrecruitment.sikkim.gov.in/rpaonline";

/**
 * Navigate to the login page and extract CAPTCHA
 */
export async function navigateToLogin(page: Page): Promise<string> {
  await page.goto(`${PORTAL_BASE_URL}/login`, { waitUntil: "networkidle0" });
  return extractCaptcha(page);
}

/**
 * Navigate to the registration page and extract CAPTCHA
 */
export async function navigateToRegister(page: Page): Promise<string> {
  await page.goto(`${PORTAL_BASE_URL}/register`, { waitUntil: "networkidle0" });
  return extractCaptcha(page);
}

/**
 * Login to the portal
 */
export async function login(
  page: Page,
  email: string,
  password: string,
  captchaCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fill login form — try multiple selectors for the email field
    const emailSelectors = [
      'input[type="email"]',
      'input[type="text"][name*="user" i]',
      'input[placeholder*="Email" i]',
    ];
    for (const sel of emailSelectors) {
      const el = await page.$(sel);
      if (el) { await clearAndType(page, sel, email); break; }
    }

    await clearAndType(page, 'input[type="password"]', password);
    await fillCaptcha(page, captchaCode);

    // Click login button
    const loginBtn = await page.$('button[type="submit"], input[type="submit"]');
    if (loginBtn) await loginBtn.click();

    await new Promise(r => setTimeout(r, 3000));

    // Check if we're still on login page (means login failed)
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      const errorText = await safeTextContent(page, ".alert-danger, .error-message, .text-danger");
      return {
        success: false,
        error: errorText || "Login failed. Please check your credentials or CAPTCHA.",
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Login error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Register a new account on the portal
 */
export async function registerAccount(
  page: Page,
  name: string,
  email: string,
  mobile: string,
  password: string,
  captchaCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fill name field (not password, not email, not mobile)
    const nameInput = await page.$('input[name*="name" i]:not([type="password"]):not([name*="email"]):not([name*="mobile"])');
    if (nameInput) await clearAndTypeElement(nameInput, name);

    // Email
    const emailInput = await page.$('input[name*="email" i], input[type="email"]');
    if (emailInput) await clearAndTypeElement(emailInput, email);

    // Mobile
    const mobileInput = await page.$('input[name*="mobile" i], input[type="tel"]');
    if (mobileInput) await clearAndTypeElement(mobileInput, mobile);

    // Fill both password fields
    const passwordInputs = await page.$$('input[type="password"]');
    if (passwordInputs.length >= 2) {
      await clearAndTypeElement(passwordInputs[0], password);
      await clearAndTypeElement(passwordInputs[1], password);
    }

    await fillCaptcha(page, captchaCode);

    // Click register button
    const regBtn = await page.$('button[type="submit"], input[type="submit"]');
    if (regBtn) await regBtn.click();

    await new Promise(r => setTimeout(r, 3000));

    // Check for success
    const currentUrl = page.url();
    if (currentUrl.includes("/register")) {
      const errorText = await safeTextContent(page, ".alert-danger, .error-message, .text-danger");
      return {
        success: false,
        error: errorText || "Registration failed. The email or mobile may already be registered.",
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Registration error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Check if session has expired (redirected to login)
 */
export async function isSessionExpired(page: Page): Promise<boolean> {
  const currentUrl = page.url();
  return currentUrl.includes("/login");
}

/**
 * Fill the recruitment application form with provided data
 */
export async function fillApplicationForm(
  page: Page,
  data: FillFormRequest
): Promise<{ success: boolean; screenshots: string[]; error?: string }> {
  const screenshots: string[] = [];

  try {
    if (await isSessionExpired(page)) {
      return { success: false, screenshots, error: "Session expired. Please login again." };
    }

    // Navigate to application form
    const applyLink = await page.$('a[href*="apply"]');
    if (applyLink) {
      await applyLink.click();
      await new Promise(r => setTimeout(r, 2000));
    }

    // --- Personal Details Section ---
    await fillFieldIfExists(page, 'input[name*="name" i]:not([name*="father"]):not([name*="mother"])', data.personalDetails.fullName);
    await fillFieldIfExists(page, 'input[name*="father" i]', data.personalDetails.fatherName);
    await fillFieldIfExists(page, 'input[name*="mother" i]', data.personalDetails.motherName);
    await fillFieldIfExists(page, 'input[name*="dob" i], input[type="date"]', data.personalDetails.dateOfBirth);

    await selectOptionIfExists(page, 'select[name*="gender" i]', data.personalDetails.gender);
    await selectOptionIfExists(page, 'select[name*="category" i]', data.personalDetails.category);
    await selectOptionIfExists(page, 'select[name*="marital" i]', data.personalDetails.maritalStatus);
    await selectOptionIfExists(page, 'select[name*="nationality" i]', data.personalDetails.nationality);

    if (data.personalDetails.religion) {
      await selectOptionIfExists(page, 'select[name*="religion" i]', data.personalDetails.religion);
    }

    screenshots.push(Buffer.from(await page.screenshot()).toString("base64"));

    // --- Contact Details Section ---
    const addr = data.contactDetails.permanentAddress;
    const fullAddr = `${addr.line1}${addr.line2 ? ', ' + addr.line2 : ''}, ${addr.city}, ${addr.district}, ${addr.state} - ${addr.pin}`;
    await fillFieldIfExists(page, 'input[name*="address" i], textarea[name*="address" i]', fullAddr);
    await fillFieldIfExists(page, 'input[name*="pin" i]', addr.pin);
    await selectOptionIfExists(page, 'select[name*="state" i]', addr.state);
    await selectOptionIfExists(page, 'select[name*="district" i]', addr.district);

    await fillFieldIfExists(page, 'input[name*="phone" i], input[name*="mobile" i], input[type="tel"]', data.contactDetails.phone);
    await fillFieldIfExists(page, 'input[name*="email" i], input[type="email"]', data.contactDetails.email);

    screenshots.push(Buffer.from(await page.screenshot()).toString("base64"));

    // --- Education Section ---
    for (const qual of data.qualifications) {
      await fillFieldIfExists(page, 'input[name*="degree" i], input[name*="qualification" i]', qual.degree);
      await fillFieldIfExists(page, 'input[name*="institution" i], input[name*="college" i]', qual.institution);
      await fillFieldIfExists(page, 'input[name*="board" i], input[name*="university" i]', qual.boardUniversity);
      await fillFieldIfExists(page, 'input[name*="year" i]', qual.year.toString());
      await fillFieldIfExists(page, 'input[name*="percentage" i], input[name*="marks" i]', qual.percentage.toString());

      // Try to click "Add More" if there are more qualifications
      const addMoreBtns = await page.$$('button');
      for (const btn of addMoreBtns) {
        const text = await btn.evaluate(el => el.textContent);
        if (text && /add/i.test(text) && data.qualifications.indexOf(qual) < data.qualifications.length - 1) {
          await btn.click();
          await new Promise(r => setTimeout(r, 1000));
          break;
        }
      }
    }

    screenshots.push(Buffer.from(await page.screenshot()).toString("base64"));

    // --- Work Experience Section ---
    if (data.workExperience && data.workExperience.length > 0) {
      for (const exp of data.workExperience) {
        await fillFieldIfExists(page, 'input[name*="organization" i], input[name*="employer" i]', exp.organization);
        await fillFieldIfExists(page, 'input[name*="designation" i], input[name*="position" i]', exp.designation);
        await fillFieldIfExists(page, 'input[name*="from" i]', exp.fromDate);
        await fillFieldIfExists(page, 'input[name*="to" i]:not([name*="from"])', exp.toDate);
      }
    }

    // Try to navigate to next page
    const submitBtn = await page.$('button[type="submit"], input[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await new Promise(r => setTimeout(r, 2000));
    }

    screenshots.push(Buffer.from(await page.screenshot()).toString("base64"));

    return { success: true, screenshots };
  } catch (error) {
    screenshots.push(Buffer.from(await page.screenshot()).toString("base64"));
    return {
      success: false,
      screenshots,
      error: `Form fill error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Upload a document to the portal form
 */
export async function uploadDocument(
  page: Page,
  data: UploadDocumentRequest
): Promise<{ success: boolean; error?: string }> {
  try {
    const fieldSelectors = [
      `input[type="file"][name*="${data.fieldName}" i]`,
      `input[type="file"][id*="${data.fieldName}" i]`,
      `input[type="file"]`,
    ];

    let fileInput = null;
    for (const selector of fieldSelectors) {
      fileInput = await page.$(selector);
      if (fileInput) break;
    }

    if (!fileInput) {
      return { success: false, error: `File upload field not found for: ${data.fieldName}` };
    }

    // Write to temp file (Puppeteer needs file path, not buffer)
    const tmpDir = os.tmpdir();
    const tmpPath = path.join(tmpDir, `spsc-upload-${Date.now()}-${data.fileName}`);
    const buffer = Buffer.from(data.documentBase64, "base64");
    fs.writeFileSync(tmpPath, buffer);

    try {
      await (fileInput as import("puppeteer-core").ElementHandle<HTMLInputElement>).uploadFile(tmpPath);
      await new Promise(r => setTimeout(r, 2000));
      return { success: true };
    } finally {
      // Clean up temp file
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  } catch (error) {
    return {
      success: false,
      error: `Upload error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Submit the completed form
 */
export async function submitForm(
  page: Page,
  captchaCode?: string
): Promise<{ success: boolean; confirmationNumber?: string; screenshotBase64: string; error?: string }> {
  try {
    if (captchaCode) {
      await fillCaptcha(page, captchaCode);
    }

    // Find submit button by text content
    const buttons = await page.$$('button, input[type="submit"]');
    let submitBtn = null;
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent || (el as HTMLInputElement).value || "");
      if (/submit/i.test(text)) {
        submitBtn = btn;
        break;
      }
    }

    if (!submitBtn) {
      const screenshot = Buffer.from(await page.screenshot()).toString("base64");
      return { success: false, screenshotBase64: screenshot, error: "Submit button not found" };
    }

    await submitBtn.click();
    await new Promise(r => setTimeout(r, 5000));

    const screenshot = Buffer.from(await page.screenshot()).toString("base64");

    // Try to extract confirmation number
    const pageText = await page.$eval("body", el => el.textContent).catch(() => "");
    const confirmMatch = pageText?.match(/(?:confirmation|reference|application)\s*(?:no|number|id)[\s:]*([A-Z0-9-]+)/i);
    const confirmationNumber = confirmMatch?.[1] || undefined;

    // Check for error messages
    const errorText = await safeTextContent(page, ".alert-danger, .error-message");
    if (errorText) {
      return { success: false, screenshotBase64: screenshot, error: errorText };
    }

    return { success: true, confirmationNumber, screenshotBase64: screenshot };
  } catch (error) {
    const screenshot = Buffer.from(await page.screenshot()).toString("base64");
    return {
      success: false,
      screenshotBase64: screenshot,
      error: `Submit error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Take a full-page screenshot
 */
export async function takeScreenshot(page: Page): Promise<string> {
  const screenshot = await page.screenshot({ fullPage: true });
  return Buffer.from(screenshot).toString("base64");
}

// --- Helper functions ---

/**
 * Safely get text content from a selector (returns null if not found)
 */
async function safeTextContent(page: Page, selector: string): Promise<string | null> {
  try {
    return await page.$eval(selector, el => el.textContent?.trim() || null);
  } catch {
    return null;
  }
}

/**
 * Find first matching element from comma-separated selectors and type into it
 */
async function fillFieldIfExists(page: Page, selector: string, value: string): Promise<void> {
  try {
    // Split comma-separated selectors and try each
    const selectors = selector.split(",").map(s => s.trim());
    for (const sel of selectors) {
      const element = await page.$(sel);
      if (element) {
        await clearAndTypeElement(element, value);
        return;
      }
    }
  } catch {
    // Field not found or not fillable, skip
  }
}

/**
 * Select an option from a dropdown
 */
async function selectOptionIfExists(page: Page, selector: string, value: string): Promise<void> {
  try {
    const element = await page.$(selector);
    if (element) {
      // page.select() uses option value attribute; try value first, then by visible text
      try {
        await page.select(selector, value);
      } catch {
        // Try finding option by label text and selecting by its value
        const optionValue = await page.$eval(selector, (sel, label) => {
          const options = Array.from((sel as HTMLSelectElement).options);
          for (const opt of options) {
            if (opt.text.trim().toLowerCase() === label.toLowerCase()) {
              return opt.value;
            }
          }
          // Partial match
          for (const opt of options) {
            if (opt.text.trim().toLowerCase().includes(label.toLowerCase())) {
              return opt.value;
            }
          }
          return null;
        }, value);

        if (optionValue) {
          await page.select(selector, optionValue);
        }
      }
    }
  } catch {
    // Select not found or option not available, skip
  }
}
