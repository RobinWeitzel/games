/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// Served from https://<user>.github.io/games/
const base = process.env.BASE_PATH ?? '/games/';

export default defineConfig({
  base,
  define: {
    // e.g. "0.1.0 (06dff72)" on GitHub Pages, so you can see which build is installed.
    __APP_VERSION__: JSON.stringify(
      `${process.env.npm_package_version ?? 'dev'}${process.env.GITHUB_SHA ? ` (${process.env.GITHUB_SHA.slice(0, 7)})` : ''}`,
    ),
  },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'favicon.svg'],
      manifest: {
        id: base,
        name: 'Games',
        short_name: 'Games',
        description: 'Small offline puzzle games, made for iPhone.',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f2f2f7',
        theme_color: '#f2f2f7',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // iOS fetches launch images once at install; no need to precache ~1 MB of them.
        globIgnores: ['splash/**'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  worker: { format: 'es' },
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
});
