// Renders the app icon and iOS launch images to PNG with the preinstalled Chromium.
// Usage: npm run icons   (writes into public/ and prints the <link> tags for index.html)
import { createRequire } from 'node:module';
// Playwright is preinstalled globally in the dev container; resolve it via require().
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DEVICES } from './devices.mjs';

const icon = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
mkdirSync('public/icons', { recursive: true });
mkdirSync('public/splash', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

async function shot(path, w, h, html) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0">${html}</body></html>`);
  await page.screenshot({ path, omitBackground: false });
}

// Full-bleed square icons (iOS applies its own rounded mask).
const square = icon.replace(/rx="\d+"/, 'rx="0"');
for (const [name, size] of [['apple-touch-icon', 180], ['icon-192', 192], ['icon-512', 512]]) {
  await shot(`public/icons/${name}.png`, size, size, square.replace('<svg', `<svg width="${size}" height="${size}"`));
}

const links = [];
for (const d of DEVICES) {
  for (const theme of ['light', 'dark']) {
    const bg = theme === 'light' ? '#f2f2f7' : '#000000';
    const W = d.w * d.r;
    const H = d.h * d.r;
    const s = 120 * d.r;
    const file = `splash/${W}x${H}-${theme}.png`;
    await shot(
      `public/${file}`,
      W,
      H,
      `<div style="width:${W}px;height:${H}px;background:${bg};display:grid;place-items:center">
        <div style="width:${s}px;height:${s}px;border-radius:${s * 0.225}px;overflow:hidden">${square.replace('<svg', `<svg width="${s}" height="${s}"`)}</div>
      </div>`,
    );
    links.push(
      `<link rel="apple-touch-startup-image" href="${file}" media="screen and (device-width: ${d.w}px) and (device-height: ${d.h}px) and (-webkit-device-pixel-ratio: ${d.r}) and (orientation: portrait) and (prefers-color-scheme: ${theme})" />`,
    );
  }
}
await browser.close();
writeFileSync('scripts/splash-links.html', links.join('\n') + '\n'); // paste into index.html
console.log(`Wrote icons and ${links.length} launch images; links in scripts/splash-links.html`);
