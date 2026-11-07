import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const repoRoot = path.resolve(import.meta.dirname, "..");
const quick = process.argv.includes("--quick");
const width = quick ? 960 : 1920;
const height = quick ? 540 : 1080;
const outputPath = path.join(
  repoRoot,
  "out",
  quick ? "prepspsc-product-demo-preview.mp4" : "prepspsc-product-demo.mp4",
);
const audioPath = path.join(repoRoot, "public", "demo", "prepspsc-demo-bed.wav");
const filterScriptPath = path.join(repoRoot, "out", "prepspsc-product-demo-filter.txt");
const assPath = path.join(repoRoot, "out", "prepspsc-product-demo-captions.ass");

const ffmpegPath = require("ffmpeg-static");
const ffprobeInfo = require("ffprobe-static");
const ffprobePath =
  typeof ffprobeInfo === "string" ? ffprobeInfo : ffprobeInfo.path ?? ffprobeInfo.default?.path;

const scenes = [
  {
    image: "public/demo/01-landing-page.png",
    eyebrow: "PrepSPSC",
    title: "Serious exam prep\\nin one calm system",
    subtitle: "AI guidance, mock tests, and accountability for Sikkim aspirants",
    accent: "0x62e6c7",
  },
  {
    image: "public/demo/02-dashboard.png",
    eyebrow: "Daily Momentum",
    title: "Visible progress\\nevery time you log in",
    subtitle: "XP, streaks, and study stats turn consistency into a habit loop",
    accent: "0x4fd1ff",
  },
  {
    image: "public/demo/03-study-ai-planner.png",
    eyebrow: "AI Planner",
    title: "Turn a syllabus into\\nthe next smart session",
    subtitle: "Clear topic paths and revision checkpoints replace guesswork",
    accent: "0x8ab4ff",
  },
  {
    image: "public/demo/06-study-ai-revision.png",
    eyebrow: "Active Revision",
    title: "Static notes become\\nactive recall",
    subtitle: "Revision views, notebook support, and fast feedback improve retention",
    accent: "0xff8ed1",
  },
  {
    image: "public/demo/08-tests-arena.png",
    eyebrow: "Tests Arena",
    title: "Practice against the\\npattern that matters",
    subtitle: "PSC focused mocks and PYQ intelligence make performance measurable",
    accent: "0xff9b7a",
  },
  {
    image: "public/demo/09-study-rooms.png",
    eyebrow: "Study Rooms",
    title: "Accountability without\\nturning into noise",
    subtitle: "Study rooms and buddies keep self study consistent and calm",
    accent: "0xffc46d",
  },
  {
    image: "public/demo/07-developers.png",
    eyebrow: "Developer API",
    title: "The product also works\\nas a platform",
    subtitle: "Semantic PYQ search, mock tests, analytics, and self serve API keys",
    accent: "0xb89cff",
  },
  {
    image: "public/demo/01-landing-page.png",
    eyebrow: "The Loop",
    title: "Plan  Revise  Test\\nStay consistent",
    subtitle: "PrepSPSC keeps the full preparation loop in one premium flow",
    accent: "0x7cf1b8",
  },
];

const run = (command, args) => {
  return spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
  });
};

const escapeAssText = (value) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\N")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}");

const formatAssTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centis = Math.round((seconds - Math.floor(seconds)) * 100);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(
    centis,
  ).padStart(2, "0")}`;
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const audioResult = run("node", ["scripts/generate-demo-audio.mjs"]);
if (audioResult.status !== 0) {
  process.exit(audioResult.status ?? 1);
}

const filterLines = scenes.map((scene, index) => {
  const driftX = 16 + index * 2;
  const driftY = 10 + index;
  const boxWidth = Math.round(width * 0.58);
  const boxHeight = Math.round(height * 0.32);
  const padX = Math.round(width * 0.055);
  const boxY = Math.round(height * 0.06);

  return [
    `[${index}:v]scale=${Math.round(width * 1.08)}:${Math.round(height * 1.08)}:force_original_aspect_ratio=increase,`,
    `crop=${width}:${height}:x='(in_w-out_w)/2+${driftX}*sin(t/3.1+${index})':y='(in_h-out_h)/2+${driftY}*cos(t/3.6+${index})',`,
    `format=yuv420p,`,
    `drawbox=x=${padX}:y=${boxY}:w=${boxWidth}:h=${boxHeight}:color=0x050816@0.62:t=fill,`,
    `drawbox=x=${padX}:y=${boxY}:w=${boxWidth}:h=${boxHeight}:color=${scene.accent}@0.4:t=2,`,
    `fade=t=in:st=0:d=0.45,fade=t=out:st=7.45:d=0.45[v${index}]`,
  ].join("");
});

let previousLabel = "[v0]";
let offset = 7.5;

for (let index = 1; index < scenes.length; index += 1) {
  const nextLabel = index === scenes.length - 1 ? "[basev]" : `[x${index}]`;
  filterLines.push(
    `${previousLabel}[v${index}]xfade=transition=fade:duration=0.5:offset=${offset}${nextLabel}`,
  );
  previousLabel = nextLabel;
  offset += 7.5;
}

filterLines.push(`[basev]ass='${assPath.replace(/\\/g, "/")}'[videoout]`);
fs.writeFileSync(filterScriptPath, filterLines.join(";\n"));

const assEvents = scenes.flatMap((scene, index) => {
  const start = index * 7.5 + 0.35;
  const end = start + 6.7;

  return [
    `Dialogue: 0,${formatAssTime(start)},${formatAssTime(end)},Eyebrow,,0,0,0,,{\\an7\\pos(${Math.round(
      width * 0.082,
    )},${Math.round(height * 0.11)})}${escapeAssText(scene.eyebrow)}`,
    `Dialogue: 0,${formatAssTime(start)},${formatAssTime(end)},Title,,0,0,0,,{\\an7\\pos(${Math.round(
      width * 0.08,
    )},${Math.round(height * 0.18)})}${escapeAssText(scene.title)}`,
    `Dialogue: 0,${formatAssTime(start + 0.08)},${formatAssTime(end)},Subtitle,,0,0,0,,{\\an7\\pos(${Math.round(
      width * 0.082,
    )},${Math.round(height * 0.31)})}${escapeAssText(scene.subtitle)}`,
  ];
});

const assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Eyebrow,Arial,${Math.round(height * 0.033)},&H0062E6C7,&H0062E6C7,&H00050816,&H00050816,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Title,Arial,${Math.round(height * 0.067)},&H00FFFFFF,&H00FFFFFF,&H00050816,&H00050816,-1,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Subtitle,Arial,${Math.round(height * 0.03)},&H00D7DDE7,&H00D7DDE7,&H00050816,&H00050816,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
${assEvents.join("\n")}
`;

fs.writeFileSync(assPath, assContent);

const ffmpegArgs = scenes.flatMap((scene) => [
  "-loop",
  "1",
  "-t",
  "8",
  "-i",
  path.join(repoRoot, scene.image),
]);

ffmpegArgs.push(
  "-i",
  audioPath,
  "-filter_complex_script",
  filterScriptPath,
  "-map",
  "[videoout]",
  "-map",
  `${scenes.length}:a`,
  "-c:v",
  "libx264",
  "-preset",
  "medium",
  "-crf",
  quick ? "22" : "20",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  "-shortest",
  "-t",
  "60",
  "-y",
  outputPath,
);

const renderResult = run(ffmpegPath, ffmpegArgs);
if (renderResult.status !== 0) {
  process.exit(renderResult.status ?? 1);
}

if (ffprobePath && fs.existsSync(ffprobePath)) {
  const probeResult = run(ffprobePath, [
    "-v",
    "error",
    "-show_entries",
    "format=duration:stream=codec_name,codec_type,width,height",
    "-of",
    "default=noprint_wrappers=1",
    outputPath,
  ]);

  if (probeResult.status !== 0) {
    process.exit(probeResult.status ?? 1);
  }
}

console.log(`Final demo video written to ${outputPath}`);
