#!/usr/bin/env node
/**
 * Generate PWA icons from src/app/icon.svg.
 *
 * Outputs four PNGs in public/icons/:
 *   pwa-192.png             — 192×192 standard
 *   pwa-512.png             — 512×512 standard
 *   pwa-512-maskable.png    — 512×512 with safe zone (icon centered in inner 80%)
 *   pwa-180-apple.png       — 180×180 iOS home screen
 *
 * Run: node scripts/generate-pwa-icons.mjs
 */

import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SVG_PATH = path.join(ROOT, "src/app/icon.svg");
const OUT_DIR = path.join(ROOT, "public/icons");
const BACKGROUND = "#1F1A1C";

async function renderSquare(svg, size, padding = 0) {
  const innerSize = size - padding * 2;
  const inner = await sharp(svg, { density: 384 })
    .resize(innerSize, innerSize, { fit: "contain", background: BACKGROUND })
    .png()
    .toBuffer();

  if (padding === 0) return inner;

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([{ input: inner, top: padding, left: padding }])
    .png()
    .toBuffer();
}

async function main() {
  const svg = await readFile(SVG_PATH);
  await mkdir(OUT_DIR, { recursive: true });

  const targets = [
    { name: "pwa-192.png", size: 192, padding: 0 },
    { name: "pwa-512.png", size: 512, padding: 0 },
    { name: "pwa-512-maskable.png", size: 512, padding: Math.round(512 * 0.1) },
    { name: "pwa-180-apple.png", size: 180, padding: 0 },
  ];

  for (const { name, size, padding } of targets) {
    const buf = await renderSquare(svg, size, padding);
    const outPath = path.join(OUT_DIR, name);
    await writeFile(outPath, buf);
    console.log(`✓ ${name} (${size}×${size}${padding ? `, padding ${padding}` : ""})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
