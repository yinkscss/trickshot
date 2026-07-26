#!/usr/bin/env node
/**
 * Post-build PWA sanity check for apps/web/dist.
 * Run from repo root after `npm run build:web`.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(repoRoot, "apps/web/dist");

function fail(msg) {
  console.error(`verify-pwa: ${msg}`);
  process.exit(1);
}

const required = [
  "manifest.webmanifest",
  "sw.js",
  "registerSW.js",
  "index.html",
  "pwa-192.png",
  "pwa-512.png",
];

for (const file of required) {
  if (!existsSync(join(dist, file))) {
    fail(`missing ${file}`);
  }
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(join(dist, "manifest.webmanifest"), "utf8"));
} catch (err) {
  fail(`invalid manifest.webmanifest: ${err.message}`);
}

for (const key of ["name", "short_name", "start_url", "display", "icons"]) {
  if (manifest[key] == null) fail(`manifest missing "${key}"`);
}

if (manifest.orientation !== "portrait") {
  fail(`manifest.orientation expected "portrait", got ${JSON.stringify(manifest.orientation)}`);
}

const iconSizes = new Set(
  (manifest.icons ?? []).flatMap((i) => (i.sizes ?? "").split(" ")),
);
for (const size of ["192x192", "512x512"]) {
  if (!iconSizes.has(size)) fail(`manifest icons missing ${size}`);
}

const sw = readFileSync(join(dist, "sw.js"), "utf8");
if (!sw.includes("precacheAndRoute") && !sw.includes("precache")) {
  fail("sw.js does not appear to precache assets");
}
if (!sw.includes("index.html")) {
  fail("sw.js does not reference index.html shell");
}

console.log("verify-pwa: OK — manifest, icons, and service worker present");
