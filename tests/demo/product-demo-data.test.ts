import {
  PRODUCT_DEMO_DURATION_FRAMES,
  PRODUCT_DEMO_FPS,
  productDemoScenes,
  summarizeValueProps,
} from "@/demo/product-demo-data";

describe("product demo data", () => {
  it("locks to a 60-second runtime at 30fps", () => {
    const durationSeconds = PRODUCT_DEMO_DURATION_FRAMES / PRODUCT_DEMO_FPS;

    expect(PRODUCT_DEMO_FPS).toBe(30);
    expect(durationSeconds).toBe(60);
  });

  it("covers the strongest user-facing product loop in the right order", () => {
    expect(productDemoScenes.map((scene) => scene.id)).toEqual([
      "intro",
      "dashboard",
      "planner",
      "revision",
      "tests",
      "social",
      "developers",
      "close",
    ]);
  });

  it("anchors each scene in a real product surface", () => {
    expect(productDemoScenes.every((scene) => scene.imagePath.startsWith("/demo/"))).toBe(true);
  });

  it("surfaces the strongest value props without slipping into fluff", () => {
    expect(summarizeValueProps()).toEqual([
      "One preparation loop from planning to PYQs to tests",
      "AI study tools that turn static material into active revision",
      "Gamified dashboards that make consistency and momentum visible",
      "Study rooms and buddies that add accountability without noise",
      "A developer API built on real PSC question intelligence",
    ]);
  });

  it("uses a continuous frame timeline with no gaps or overlaps", () => {
    let cursor = 0;

    for (const scene of productDemoScenes) {
      expect(scene.startFrame).toBe(cursor);
      cursor += scene.durationInFrames;
    }

    expect(cursor).toBe(PRODUCT_DEMO_DURATION_FRAMES);
  });
});
