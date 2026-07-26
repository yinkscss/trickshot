# @trickshot/web

Canvas2D pitch client (`client=canvas2d_pitch`) — vanilla HTML + `CanvasRenderingContext2D` + Nunito + `requestAnimationFrame`. Visual language matches [docs/animation-pitch.html](../../docs/animation-pitch.html). Physics/logic authority stays in `@trickshot/physics` and `@trickshot/logic`. Installable PWA shell wraps this canvas app — **no Phaser**.

## Dev

```bash
# from repo root
npm install
npm run dev:web
```

## Build & PWA artifacts

```bash
npm run build:web
node scripts/verify-pwa.mjs
```

Produces `apps/web/dist/` with:

| Artifact | Purpose |
|---|---|
| `manifest.webmanifest` | Install prompt metadata (portrait, pitch greys/orange/blue theme) |
| `sw.js` + `workbox-*.js` | Precached shell + hashed Vite bundles |
| `registerSW.js` | Auto-update registration (`registerType: "autoUpdate"`) |
| `pwa-192.png` / `pwa-512.png` | Brand icons (hoop + ball on pitch grey) |

Preview the production shell locally:

```bash
npm run preview -w @trickshot/web
```

### Service worker update strategy

Vite content-hashes JS/CSS filenames on every build. The generated Workbox service worker:

1. **Precaches** `index.html`, `registerSW.js`, icons, and all emitted `assets/*` chunks.
2. **Document fallback** — navigations that are not static files serve cached `index.html` (SPA shell).
3. **Auto-update** — `registerType: "autoUpdate"` enables `skipWaiting` + `clientsClaim` so a new deploy activates on the next load instead of leaving players on a stale boot forever.
4. **Cleanup** — `cleanupOutdatedCaches` drops superseded precache entries after activation.

Do **not** hand-edit `dist/sw.js`. Change caching via `apps/web/vite.config.ts` → `workbox` options.

### Touch & safe-area (drag-aim)

Shell CSS (`index.html`) sets `touch-action: none`, `overscroll-behavior: none`, and `env(safe-area-inset-*)` padding on `.stage` / `.phone`. The canvas uses pointer events with `preventDefault()` + `setPointerCapture` in `PlayLoop` so browser scroll/zoom gestures do not steal drag-aim. `ResizeObserver` + `orientationchange` keep court layout stable when the mobile address bar shows/hides.

## MiniPay WebView smoke checklist

Run on a mid-tier Android device (or emulator) before Alpha cut.

### Chromium “Add to Home Screen”

- [ ] `npm run build:web` then serve `apps/web/dist` over **HTTPS** (or `vite preview` on LAN).
- [ ] Open in Chrome → menu → **Install app** / **Add to Home Screen** appears.
- [ ] Installed icon matches brand hoop/ball asset (not a blank tile).
- [ ] Launch from home screen → standalone, portrait, no browser URL bar.
- [ ] Drag-aim on canvas: net stretches, release shoots — no page scroll rubber-band.

### MiniPay embedded browser

- [ ] Deploy staging build to HTTPS origin (Cloudflare / static host).
- [ ] Open staging URL inside **MiniPay** app browser (Celo test wallet).
- [ ] Page loads without console errors; court fills viewport under status bar.
- [ ] Drag-aim works on first touch (no stuck scroll / double-tap zoom).
- [ ] Rotate to landscape → return portrait: canvas resizes, aim still aligned.
- [ ] Background app → return: game resumes or cleanly reloads (no frozen black screen).
- [ ] Deploy a new build → reload MiniPay tab: new hashed bundle loads (SW auto-update).

### Lighthouse (optional)

- [ ] PWA category: installable manifest + registered service worker.
- [ ] Performance: first load acceptable on 4G (single ~100 KB JS bundle precached).

## References

- [docs/STACK_LOCK.md](../../docs/STACK_LOCK.md) — `platforms=pwa_first`, `client=canvas2d_pitch`
- [GitHub #5](https://github.com/yinkscss/trickshot/issues/5) — PWA installability scope
