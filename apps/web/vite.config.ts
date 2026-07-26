import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/** Pitch palette — keep aligned with src/render/colors.ts and docs/animation-pitch.html */
const PITCH_GREY_BG = "#cfd1d6";
const PITCH_GREY_THEME = "#1a1c22";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "pwa-192.png", "pwa-512.png"],
      workbox: {
        // Precache hashed Vite bundles + shell; serve index.html for SPA navigations.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: "Trick Shot",
        short_name: "TrickShot",
        description: "Precision chain-hoop arcade on Celo",
        theme_color: PITCH_GREY_THEME,
        background_color: PITCH_GREY_BG,
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
});
