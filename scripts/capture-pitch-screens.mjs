/**
 * Capture 390×780 pitch-visual screenshots via DEV pose helpers.
 * Usage: node scripts/capture-pitch-screens.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs/screenshots");
const base = process.argv[2] || "http://127.0.0.1:5173";

const poses = [
  ["idle", "01-idle.png"],
  ["aim", "02-aim-net-stretch.png"],
  ["flight", "03-mid-flight-trail.png"],
  ["scored", "04-scored.png"],
];

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 780 },
  deviceScaleFactor: 1,
});

await page.goto(base, { waitUntil: "networkidle" });
await page.waitForFunction(
  () =>
    typeof window.__trickshotPose === "function" &&
    typeof window.__trickshotCapture === "function",
  { timeout: 15000 },
);
// Boot → PlayScene settle
await page.waitForTimeout(700);

await mkdir(outDir, { recursive: true });
const md5s = {};

for (const [kind, file] of poses) {
  await page.evaluate((k) => window.__trickshotPose(k), kind);
  await page.waitForTimeout(80);
  const dataUrl = await page.evaluate(() => window.__trickshotCapture());
  const b64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  const buf = Buffer.from(b64, "base64");
  const dest = path.join(outDir, file);
  await writeFile(dest, buf);
  md5s[file] = createHash("md5").update(buf).digest("hex");
  console.log(`${file} ${md5s[file]} ${buf.length}B`);
}

const unique = new Set(Object.values(md5s));
if (unique.size !== poses.length) {
  console.error("ERROR: screenshot MD5s are not all unique", md5s);
  process.exit(1);
}

await browser.close();
console.log("OK — 4 unique screenshots");
