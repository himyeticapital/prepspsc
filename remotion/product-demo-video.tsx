import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  PRODUCT_DEMO_DURATION_FRAMES,
  productDemoScenes,
  summarizeValueProps,
  type ProductDemoScene,
} from "../src/demo/product-demo-data";

const palette = {
  bg: "#050816",
  bgSoft: "#0a1020",
  panel: "rgba(9, 14, 28, 0.74)",
  stroke: "rgba(255,255,255,0.14)",
  text: "#f8fafc",
  textMuted: "rgba(226,232,240,0.74)",
};

const displayFont = '"SF Pro Display", "Helvetica Neue", Arial, sans-serif';
const bodyFont = '"SF Pro Text", "Helvetica Neue", Arial, sans-serif';
const serifFont = '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif';

const FullFrame: React.CSSProperties = {
  width: "100%",
  height: "100%",
};

const fitText = (title: string) => {
  const words = title.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 24 && current) {
      lines.push(current);
      current = word;
      continue;
    }
    current = next;
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 3);
};

const getProgressWidth = (scene: ProductDemoScene) => {
  return ((scene.startFrame + scene.durationInFrames) / PRODUCT_DEMO_DURATION_FRAMES) * 100;
};

const SceneShell: React.FC<{
  scene: ProductDemoScene;
  index: number;
}> = ({ scene, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entry = spring({
    frame,
    fps,
    config: {
      damping: 220,
      stiffness: 160,
      mass: 0.9,
    },
  });
  const drift = interpolate(frame, [0, scene.durationInFrames], [0, 26], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.19, 1, 0.22, 1),
  });
  const imageScale = interpolate(frame, [0, scene.durationInFrames], [1.12, 1], {
    extrapolateRight: "clamp",
  });
  const textLift = interpolate(entry, [0, 1], [42, 0]);
  const titleLines = fitText(scene.title);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: -220,
          background: `radial-gradient(circle at 16% 20%, ${scene.accent}44 0%, transparent 28%), radial-gradient(circle at 82% 72%, ${scene.accent}22 0%, transparent 24%), linear-gradient(135deg, ${palette.bg} 0%, ${palette.bgSoft} 54%, #020617 100%)`,
          transform: `scale(${1 + entry * 0.025})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 54,
          left: 58,
          right: 58,
          height: 4,
          borderRadius: 999,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${getProgressWidth(scene)}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${scene.accent} 0%, rgba(255,255,255,0.95) 100%)`,
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 76,
          borderRadius: 40,
          background: palette.panel,
          border: `1px solid ${palette.stroke}`,
          backdropFilter: "blur(22px)",
          boxShadow: "0 35px 120px rgba(0,0,0,0.32)",
        }}
      />

      <div
        style={{
          ...FullFrame,
          display: "grid",
          gridTemplateColumns: "0.88fr 1.12fr",
          gap: 42,
          padding: "108px 92px 92px",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 28,
            height: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 20,
              opacity: entry,
              transform: `translateY(${textLift}px)`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: scene.accent,
                  boxShadow: `0 0 32px ${scene.accent}`,
                }}
              />
              <div
                style={{
                  color: scene.accent,
                  fontFamily: bodyFont,
                  fontSize: 20,
                  letterSpacing: 4,
                  textTransform: "uppercase",
                }}
              >
                {scene.eyebrow}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                color: palette.text,
                fontFamily: displayFont,
                fontWeight: 700,
                fontSize: 72,
                lineHeight: 0.98,
                letterSpacing: -3.2,
              }}
            >
              {titleLines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>

            <div
              style={{
                maxWidth: 610,
                color: palette.textMuted,
                fontFamily: bodyFont,
                fontSize: 28,
                lineHeight: 1.42,
              }}
            >
              {scene.body}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              {scene.bullets.map((bullet, bulletIndex) => {
                const bulletSpring = spring({
                  frame: frame - bulletIndex * 6,
                  fps,
                  config: {
                    damping: 180,
                    stiffness: 170,
                    mass: 0.75,
                  },
                });

                return (
                  <div
                    key={bullet}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 18px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.05)",
                      border: `1px solid ${palette.stroke}`,
                      opacity: bulletSpring,
                      transform: `translateY(${interpolate(bulletSpring, [0, 1], [18, 0])}px)`,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: scene.accent,
                      }}
                    />
                    <div
                      style={{
                        color: "#e2e8f0",
                        fontFamily: bodyFont,
                        fontSize: 22,
                      }}
                    >
                      {bullet}
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div
                style={{
                  borderRadius: 24,
                  padding: "18px 22px",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${palette.stroke}`,
                }}
              >
                <div
                  style={{
                    fontFamily: bodyFont,
                    fontSize: 16,
                    color: "rgba(226,232,240,0.58)",
                    letterSpacing: 2.5,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  {scene.statLabel}
                </div>
                <div
                  style={{
                    fontFamily: serifFont,
                    fontSize: 32,
                    color: palette.text,
                    lineHeight: 1.1,
                  }}
                >
                  {scene.statValue}
                </div>
              </div>

              <div
                style={{
                  borderRadius: 24,
                  padding: "18px 22px",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${palette.stroke}`,
                }}
              >
                <div
                  style={{
                    fontFamily: bodyFont,
                    fontSize: 16,
                    color: "rgba(226,232,240,0.58)",
                    letterSpacing: 2.5,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Scene
                </div>
                <div
                  style={{
                    fontFamily: bodyFont,
                    fontSize: 28,
                    color: palette.text,
                  }}
                >
                  {String(index + 1).padStart(2, "0")} / {scene.sceneLabel}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            position: "relative",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "7% 5%",
              borderRadius: 38,
              background: `linear-gradient(140deg, ${scene.accent}2e 0%, rgba(255,255,255,0.08) 48%, rgba(255,255,255,0.02) 100%)`,
              filter: "blur(40px)",
              transform: `scale(${1.03 + entry * 0.02})`,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              padding: "10px 16px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${palette.stroke}`,
              color: "rgba(248,250,252,0.78)",
              fontFamily: bodyFont,
              fontSize: 18,
              letterSpacing: 1.6,
            }}
          >
            prepspsc.com
          </div>
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 10",
              overflow: "hidden",
              borderRadius: 32,
              border: `1px solid ${palette.stroke}`,
              background: "rgba(0,0,0,0.3)",
              boxShadow: "0 44px 120px rgba(0,0,0,0.44)",
            }}
          >
            <Img
              src={staticFile(scene.imagePath.replace(/^\//, ""))}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `translate3d(0, ${drift}px, 0) scale(${imageScale})`,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(2,6,23,0.04) 0%, rgba(2,6,23,0) 34%, rgba(2,6,23,0.24) 100%)",
              }}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const IntroOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({
    frame,
    fps,
    config: {
      damping: 180,
      stiffness: 110,
      mass: 0.85,
    },
  });
  const chips = summarizeValueProps();

  return (
    <AbsoluteFill
      style={{
        padding: "84px 86px 86px",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          opacity: rise,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
          }}
        >
          <Img
            src={staticFile("brand/logo-with-text.svg")}
            style={{ width: 200, height: "auto" }}
          />
          <div
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${palette.stroke}`,
              color: "rgba(248,250,252,0.72)",
              fontFamily: bodyFont,
              fontSize: 18,
            }}
          >
            Product Demo
          </div>
        </div>
        <div
          style={{
            color: "rgba(226,232,240,0.66)",
            fontFamily: bodyFont,
            fontSize: 20,
            letterSpacing: 1.8,
          }}
        >
          Smart. Calm. Premium.
        </div>
      </div>

      <div
        style={{
          maxWidth: 1180,
          opacity: rise,
          transform: `translateY(${interpolate(rise, [0, 1], [48, 0])}px)`,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div
          style={{
            color: palette.text,
            fontFamily: displayFont,
            fontSize: 118,
            lineHeight: 0.9,
            letterSpacing: -6,
            fontWeight: 700,
          }}
        >
          Exam prep that keeps your focus, not your chaos.
        </div>
        <div
          style={{
            color: palette.textMuted,
            fontFamily: bodyFont,
            fontSize: 33,
            lineHeight: 1.42,
            maxWidth: 980,
          }}
        >
          A 60-second walkthrough of the product moments that make PrepSPSC feel
          connected: momentum, planning, active revision, tests, community, and a real platform layer.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {chips.map((item, index) => {
          const chipSpring = spring({
            frame: frame - index * 5,
            fps,
            config: {
              damping: 210,
              stiffness: 175,
              mass: 0.72,
            },
          });

          return (
            <div
              key={item}
              style={{
                padding: "16px 22px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${palette.stroke}`,
                color: "#f8fafc",
                fontFamily: bodyFont,
                fontSize: 21,
                opacity: chipSpring,
                transform: `translateY(${interpolate(chipSpring, [0, 1], [20, 0])}px)`,
              }}
            >
              {item}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const ClosingOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const closeSpring = spring({
    frame,
    fps,
    config: {
      damping: 160,
      stiffness: 120,
      mass: 0.9,
    },
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
      }}
    >
      <div
        style={{
          width: 880,
          borderRadius: 40,
          padding: "42px 48px",
          background: "rgba(7, 11, 24, 0.72)",
          border: `1px solid ${palette.stroke}`,
          backdropFilter: "blur(16px)",
          boxShadow: "0 35px 100px rgba(0,0,0,0.34)",
          textAlign: "center",
          opacity: closeSpring,
          transform: `translateY(${interpolate(closeSpring, [0, 1], [34, 0])}px) scale(${interpolate(closeSpring, [0, 1], [0.96, 1])})`,
        }}
      >
        <Img
          src={staticFile("brand/logo-with-text.svg")}
          style={{
            width: 220,
            height: "auto",
            margin: "0 auto 28px",
          }}
        />
        <div
          style={{
            color: palette.text,
            fontFamily: displayFont,
            fontSize: 64,
            lineHeight: 1.02,
            letterSpacing: -2.8,
            fontWeight: 700,
            marginBottom: 18,
          }}
        >
          A calmer way to prepare for serious exams.
        </div>
        <div
          style={{
            color: palette.textMuted,
            fontFamily: bodyFont,
            fontSize: 26,
            lineHeight: 1.45,
            marginBottom: 26,
          }}
        >
          PrepSPSC unifies planning, active revision, testing, and accountability into one premium study loop.
        </div>
        <div
          style={{
            color: "#8de8cf",
            fontFamily: bodyFont,
            fontSize: 22,
            letterSpacing: 2.6,
            textTransform: "uppercase",
          }}
        >
          prepspsc.com
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const ProductDemoVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const haloMove = interpolate(frame, [0, PRODUCT_DEMO_DURATION_FRAMES], [0, 100]);
  const includeAudio = process.env.REMOTION_INCLUDE_AUDIO !== "0";

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(160deg, #020617 0%, #050816 44%, #0a1020 100%)",
      }}
    >
      {includeAudio ? (
        <Audio src={staticFile("demo/prepspsc-demo-bed.wav")} volume={0.42} />
      ) : null}

      <div
        style={{
          position: "absolute",
          left: -180,
          top: -170 + haloMove * 0.24,
          width: 720,
          height: 720,
          borderRadius: 9999,
          background: "rgba(80, 227, 194, 0.16)",
          filter: "blur(120px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -220,
          bottom: -260 + haloMove * 0.18,
          width: 760,
          height: 760,
          borderRadius: 9999,
          background: "rgba(175, 135, 255, 0.15)",
          filter: "blur(130px)",
        }}
      />

      {productDemoScenes.map((scene, index) => (
        <Sequence
          key={scene.id}
          from={scene.startFrame}
          durationInFrames={scene.durationInFrames}
        >
          <SceneShell scene={scene} index={index} />
        </Sequence>
      ))}

      <Sequence from={0} durationInFrames={185}>
        <IntroOverlay />
      </Sequence>

      <Sequence from={1540} durationInFrames={260}>
        <ClosingOverlay />
      </Sequence>
    </AbsoluteFill>
  );
};
