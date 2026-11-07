import React from "react";
import { Composition } from "remotion";
import {
  PRODUCT_DEMO_DURATION_FRAMES,
  PRODUCT_DEMO_FPS,
} from "../src/demo/product-demo-data";
import { ProductDemoVideo } from "./product-demo-video";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PrepSPSCProductDemo"
        component={ProductDemoVideo}
        durationInFrames={PRODUCT_DEMO_DURATION_FRAMES}
        fps={PRODUCT_DEMO_FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};
