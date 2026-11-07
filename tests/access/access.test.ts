import { afterEach, describe, expect, it } from "vitest";
import { hasProAccess, isAllFeaturesFree } from "@/lib/access";

const FLAG = "NEXT_PUBLIC_ALL_FEATURES_FREE";
const original = process.env[FLAG];

afterEach(() => {
  if (original === undefined) delete process.env[FLAG];
  else process.env[FLAG] = original;
});

describe("feature access", () => {
  it("makes every feature free when the flag is not set", () => {
    delete process.env[FLAG];
    expect(isAllFeaturesFree()).toBe(true);
    expect(hasProAccess(null)).toBe(true);
    expect(hasProAccess(undefined)).toBe(true);
    expect(hasProAccess({ is_pro_member: false })).toBe(true);
    expect(hasProAccess({ is_pro_member: null })).toBe(true);
  });

  it("makes every feature free when the flag is 'true'", () => {
    process.env[FLAG] = "true";
    expect(isAllFeaturesFree()).toBe(true);
    expect(hasProAccess({ is_pro_member: false })).toBe(true);
  });

  it("falls back to paid Pro status when the flag is 'false'", () => {
    process.env[FLAG] = "false";
    expect(isAllFeaturesFree()).toBe(false);
    expect(hasProAccess(null)).toBe(false);
    expect(hasProAccess({ is_pro_member: false })).toBe(false);
    expect(hasProAccess({ is_pro_member: null })).toBe(false);
    expect(hasProAccess({ is_pro_member: true })).toBe(true);
  });
});
