import { readFileSync } from "fs";

import { describe, expect, it } from "vitest";

describe("SPSC scraper pattern mapping", () => {
  it("only references pattern IDs that exist in the mock-test edge function", () => {
    const scraperSource = readFileSync("src/app/api/spsc-scraper/route.ts", "utf8");
    const mockTestSource = readFileSync("supabase/functions/mock-test/index.ts", "utf8");

    const scraperPatternIds = new Set(
      Array.from(scraperSource.matchAll(/patternId:\s*"([^"]+)"/g)).map((match) => match[1])
    );
    const validPatternIds = new Set(
      Array.from(mockTestSource.matchAll(/"([a-z0-9-]+)":\s*\{/g)).map((match) => match[1])
    );

    const invalid = Array.from(scraperPatternIds).filter((id) => !validPatternIds.has(id));

    expect(invalid).toEqual([]);
  });
});
