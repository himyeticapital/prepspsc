import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const outputPath = path.join(repoRoot, "public", "demo", "prepspsc-demo-bed.wav");

const sampleRate = 48_000;
const seconds = 60;
const totalSamples = sampleRate * seconds;
const channelCount = 2;

const ensureDir = (targetPath) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
};

const clamp = (value) => Math.max(-1, Math.min(1, value));

const envelope = (time, attack, release, duration) => {
  const attackValue = Math.min(1, time / attack);
  const releaseStart = Math.max(0, duration - release);
  const releaseValue =
    time > releaseStart ? Math.max(0, 1 - (time - releaseStart) / release) : 1;
  return attackValue * releaseValue;
};

const note = (midi) => 440 * 2 ** ((midi - 69) / 12);

const progression = [
  [note(45), note(52), note(57)],
  [note(47), note(54), note(59)],
  [note(40), note(47), note(52)],
  [note(43), note(50), note(55)],
];

const bpm = 74;
const beatDuration = 60 / bpm;
const bars = progression.length;
const sectionDuration = seconds / bars;

const createWavBuffer = (samples) => {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channelCount * 2, 28);
  buffer.writeUInt16LE(channelCount * 2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i += 1) {
    buffer.writeInt16LE(samples[i], 44 + i * 2);
  }

  return buffer;
};

ensureDir(outputPath);

const interleaved = new Int16Array(totalSamples * channelCount);
let noiseState = 0x12345678;

for (let index = 0; index < totalSamples; index += 1) {
  const time = index / sampleRate;
  const sectionIndex = Math.min(
    progression.length - 1,
    Math.floor(time / sectionDuration),
  );
  const sectionTime = time % sectionDuration;
  const chord = progression[sectionIndex];

  let left = 0;
  let right = 0;

  // Soft pad bed.
  chord.forEach((frequency, voiceIndex) => {
    const detune = voiceIndex === 0 ? -0.12 : voiceIndex === 1 ? 0.08 : -0.05;
    const pad =
      Math.sin(2 * Math.PI * frequency * time) * 0.11 +
      Math.sin(2 * Math.PI * (frequency + detune) * time) * 0.06;
    const motion = 0.75 + 0.25 * Math.sin(2 * Math.PI * 0.08 * time + voiceIndex);
    left += pad * motion * (voiceIndex === 1 ? 0.8 : 1);
    right += pad * motion * (voiceIndex === 1 ? 1 : 0.82);
  });

  // Warm bass pulse.
  const bassFrequency = chord[0] / 2;
  const bass = Math.sin(2 * Math.PI * bassFrequency * time) * 0.09;
  left += bass * 0.95;
  right += bass * 0.88;

  // Gentle pluck every beat.
  const beatPosition = time % beatDuration;
  const pluckEnv = Math.exp(-beatPosition * 10);
  const pluckFreq = chord[Math.floor((time / beatDuration) % chord.length)];
  const pluck =
    Math.sin(2 * Math.PI * pluckFreq * time) *
    pluckEnv *
    (0.05 + 0.015 * Math.sin(2 * Math.PI * 0.03 * time));
  left += pluck * 0.9;
  right += pluck * 1.05;

  // Slow filtered lead bloom in each section.
  const leadEnv = envelope(sectionTime, 1.8, 2.6, sectionDuration);
  const leadFreq = chord[2] * 2;
  const lead =
    Math.sin(2 * Math.PI * leadFreq * time + Math.sin(time * 0.8) * 0.6) *
    leadEnv *
    0.025;
  left += lead * 0.95;
  right += lead * 1.1;

  // Subtle vinyl-style noise.
  noiseState = (1664525 * noiseState + 1013904223) >>> 0;
  const noise = ((noiseState / 0xffffffff) * 2 - 1) * 0.0075;
  left += noise;
  right += noise * 0.92;

  const fadeIn = Math.min(1, time / 2.5);
  const fadeOut = Math.min(1, (seconds - time) / 3.5);
  const gain = fadeIn * fadeOut * 0.9;

  interleaved[index * 2] = Math.round(clamp(left * gain) * 32767);
  interleaved[index * 2 + 1] = Math.round(clamp(right * gain) * 32767);
}

fs.writeFileSync(outputPath, createWavBuffer(interleaved));
console.log(`Generated demo audio: ${outputPath}`);
