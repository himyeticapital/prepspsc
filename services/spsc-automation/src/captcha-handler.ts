/**
 * CAPTCHA Handler
 * Extracts CAPTCHA images from the SPSC portal pages
 */

import { Page, ElementHandle } from "puppeteer-core";

/**
 * Clear an input field and type new text (Puppeteer has no .fill())
 */
export async function clearAndType(page: Page, selector: string, value: string): Promise<void> {
  await page.click(selector, { count: 3 }); // Triple-click to select all
  await page.keyboard.press("Backspace");
  await page.type(selector, value);
}

/**
 * Clear and type on an element handle
 */
export async function clearAndTypeElement(element: ElementHandle, value: string): Promise<void> {
  await element.click({ count: 3 });
  await element.press("Backspace");
  await element.type(value);
}

/**
 * Extract CAPTCHA image from the current page
 */
export async function extractCaptcha(page: Page): Promise<string> {
  const captchaSelector = 'img[alt="Click to reload"], img[src*="captcha"], img[src*="Captcha"]';

  try {
    await page.waitForSelector(captchaSelector, { timeout: 10000 });
    const captchaElement = await page.$(captchaSelector);

    if (!captchaElement) {
      throw new Error("CAPTCHA image not found on page");
    }

    // Screenshot just the CAPTCHA element
    const screenshotBuffer = await captchaElement.screenshot();
    if (!screenshotBuffer) throw new Error("Screenshot failed");
    return Buffer.from(screenshotBuffer).toString("base64");
  } catch (error) {
    // Fallback: try to find any image near the captcha input
    const captchaInput = await page.$('input[name*="captcha" i]');

    if (captchaInput) {
      const bbox = await captchaInput.boundingBox();
      if (bbox) {
        const screenshot = await page.screenshot({
          clip: {
            x: Math.max(0, bbox.x - 20),
            y: Math.max(0, bbox.y - 80),
            width: 250,
            height: 70,
          },
        });
        return Buffer.from(screenshot).toString("base64");
      }
    }

    throw new Error(`Failed to extract CAPTCHA: ${error}`);
  }
}

/**
 * Fill CAPTCHA code into the input field
 */
export async function fillCaptcha(page: Page, code: string): Promise<void> {
  const captchaInputSelectors = [
    'input[name*="captcha" i]',
    'input[placeholder*="captcha" i]',
    'input[id*="captcha" i]',
    '#captchaCode',
  ];

  for (const selector of captchaInputSelectors) {
    const input = await page.$(selector);
    if (input) {
      await clearAndTypeElement(input, code);
      return;
    }
  }

  throw new Error("CAPTCHA input field not found");
}

/**
 * Reload CAPTCHA image (click the reload button/image)
 */
export async function reloadCaptcha(page: Page): Promise<string> {
  const reloadSelectors = [
    'img[alt="Click to reload"]',
    'a[href*="captcha"]',
    'button[onclick*="captcha"]',
    '.captcha-reload',
  ];

  for (const selector of reloadSelectors) {
    const element = await page.$(selector);
    if (element) {
      await element.click();
      await new Promise(r => setTimeout(r, 1000));
      break;
    }
  }

  return extractCaptcha(page);
}
