// iOS HIG audit of the built app (see docs/DESIGN.md).
//
//   npm run audit:ios
//
// Builds are served with `vite preview`, then every screen is opened on a small and a large
// iPhone, in light and dark mode and with large Dynamic Type, and measured:
//   - interactive elements have at least a 44×44pt hit target (documented exceptions below)
//   - no visible text is smaller than 11pt
//   - nothing overflows horizontally
//   - game screens fit without scrolling
// Exits with code 1 if anything fails. Needs Playwright with Chromium installed.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const PORT = 4179;
const URL = `http://localhost:${PORT}/games/`;

/** Elements allowed below 44pt, with the HIG reason. Keep this list short. */
const EXEMPT = [
  ['.cell', 'game board cells: a 9×9 grid cannot have 44pt cells on iPhone; the board is one large target'],
  ['input.toggle', 'native iOS switch (51×31pt standard control inside a ≥44pt list row)'],
  ['.segmented button', 'segmented control segments use the standard 32pt control height'],
  ['.edge-swipe', 'invisible swipe-back strip, not a tap target'],
];

/** iPhone SE (2nd/3rd gen): the smallest supported screen. */
const SE = { ...devices['iPhone SE'], viewport: { width: 375, height: 667 }, screen: { width: 375, height: 667 } };

const VARIANTS = [
  { name: 'iPhone SE · light', device: SE, scheme: 'light' },
  { name: 'iPhone SE · dark · large text (xxxL)', device: SE, scheme: 'dark', rootPx: 23 },
  { name: 'iPhone 15 Pro Max · light', device: devices['iPhone 15 Pro Max'], scheme: 'light' },
];

async function audit(page, screen) {
  return page.evaluate(
    ({ screen, exempt }) => {
      const issues = [];
      const top = [...document.querySelectorAll('.screen')].pop();
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('.sr-only,[aria-hidden="true"]');
      };
      const roots = [top, ...document.querySelectorAll('.sheet-backdrop.visible')];
      for (const root of roots) {
        for (const el of root.querySelectorAll('button, [role="button"], a[href], input, select, [role="tab"]')) {
          if (!visible(el) || el.disabled || exempt.some(([sel]) => el.matches(sel))) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 43.5 || r.height < 43.5) {
            const label = el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30) || el.className;
            issues.push(`hit target ${Math.round(r.width)}×${Math.round(r.height)}pt: "${label}"`);
          }
        }
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const seen = new Set();
        while (walker.nextNode()) {
          const el = walker.currentNode.parentElement;
          if (!walker.currentNode.textContent.trim() || seen.has(el) || !visible(el)) continue;
          seen.add(el);
          const size = parseFloat(getComputedStyle(el).fontSize);
          if (size < 10.95) issues.push(`text ${size.toFixed(1)}pt: "${el.textContent.trim().slice(0, 30)}"`);
        }
      }
      if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('page overflows horizontally');
      const main = top.querySelector('main');
      if (main && main.scrollWidth > main.clientWidth + 1) issues.push('content overflows horizontally');
      const fixed = top.querySelector('.content-fixed');
      if (fixed && fixed.scrollHeight > fixed.clientHeight + 1) issues.push(`game screen needs scrolling (${fixed.scrollHeight - fixed.clientHeight}px too tall)`);
      return issues.map((i) => `${screen}: ${i}`);
    },
    { screen, exempt: EXEMPT },
  );
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
let failures = 0;
try {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(URL)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  const browser = await chromium.launch();
  for (const v of VARIANTS) {
    const ctx = await browser.newContext({ ...v.device, deviceScaleFactor: 1, colorScheme: v.scheme });
    const page = await ctx.newPage();
    if (v.rootPx) await page.addInitScript((px) => {
      // Emulate a large Dynamic Type size (Chromium has no -apple-system-body).
      document.addEventListener('DOMContentLoaded', () => {
        const s = document.createElement('style');
        s.textContent = `html{font-size:${px}px !important}`;
        document.head.appendChild(s);
      });
    }, v.rootPx);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const wait = () => page.waitForTimeout(500);
    const back = async () => {
      await page.click('.screen:last-child .nav-back');
      await wait();
    };

    await page.goto(URL);
    await wait();
    const issues = [...(await audit(page, 'Home'))];
    await page.click('[aria-label=Settings]');
    await wait();
    issues.push(...(await audit(page, 'Settings')));
    await back();
    await page.click('.tile >> nth=0');
    await wait();
    issues.push(...(await audit(page, 'Game hub')));
    await page.click('.screen:last-child .row >> text=Statistics');
    await wait();
    issues.push(...(await audit(page, 'Statistics')));
    await back();
    await page.click('.screen:last-child .section-body .row >> nth=0'); // first mode
    await page.waitForSelector('.content-fixed');
    await wait();
    issues.push(...(await audit(page, 'Game')));
    await page.click('.screen:last-child [aria-label=Pause]');
    await wait();
    issues.push(...(await audit(page, 'Game (paused)')));
    issues.push(...errors.map((e) => `page error: ${e}`));

    console.log(`\n${issues.length ? '✗' : '✓'} ${v.name}`);
    for (const i of issues) console.log(`   - ${i}`);
    failures += issues.length;
    await ctx.close();
  }
  await browser.close();
} finally {
  server.kill();
}
console.log(failures ? `\n${failures} issue(s). See docs/DESIGN.md.` : '\nAll screens pass the iOS audit.');
process.exit(failures ? 1 : 0);
