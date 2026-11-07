import dns from "node:dns/promises";
import { isDisposableDomain } from "./disposable-domains";

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Re-export for backward compatibility.
 * Uses the shared comprehensive disposable domains list (200+ domains).
 */
export function isDisposableEmail(email: string): boolean {
  return isDisposableDomain(email);
}

export async function hasMxRecords(email: string): Promise<boolean> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  try {
    const records = await dns.resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}

/**
 * Validates an email: format check + disposable domain check + MX record check.
 * Returns null if valid, or an error string if invalid.
 */
export async function validateEmail(email: string): Promise<string | null> {
  if (!email || typeof email !== "string" || !isValidEmail(email.trim())) {
    return "A valid email address is required";
  }

  if (isDisposableEmail(email.trim())) {
    return "Disposable or temporary email addresses are not allowed";
  }

  if (!(await hasMxRecords(email.trim()))) {
    return "This email domain doesn't appear to accept mail. Please use a valid email address.";
  }

  return null;
}
