# Games

A collection of small single-player puzzle games, built as a PWA for **portrait play on iPhone**.
It's hosted on GitHub Pages: no backend, no accounts, works offline. Statistics stay on the device.

**Games:** Sudoku (Easy / Medium / Hard / Expert + Daily Challenge). More to come.

## Install on iPhone

Open the site in Safari → Share → **Add to Home Screen**. It then launches full-screen like a native app
and works offline.

## Development

```sh
npm install
npm run dev        # http://localhost:5173/games/
npm test           # unit tests, storage migrations + contract, architecture boundaries
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build (service worker active)
npm run icons      # re-render icons + iOS launch images from public/favicon.svg
npm run audit:ios  # build, then check every screen against the iOS HIG rules (Playwright)
```

`npm run icons` uses Playwright's Chromium and writes `scripts/splash-links.html`. Paste those tags into
`index.html` if you changed the device list in `scripts/devices.mjs`.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`: test → build → deploy to Pages.
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The base path is the repository name (`/games/`).

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the app is put together and the module boundaries
- [docs/DESIGN.md](docs/DESIGN.md): **mandatory** iOS design rules (Apple HIG) and the review checklist
- [docs/ADDING_A_GAME.md](docs/ADDING_A_GAME.md): step-by-step guide and checklist for a new game
- [docs/STORAGE.md](docs/STORAGE.md): how saved data is versioned and migrated so updates never lose
  progress. **Read this before changing anything that is stored.**

### Sudoku difficulty

Every puzzle has exactly one solution. Difficulty comes from the hardest **technique** needed, as
measured by a human-style solver (`src/games/sudoku/engine/grader.ts`):

| Difficulty | Givens | Hardest technique needed |
|---|---|---|
| Easy | ~38 | naked / hidden singles |
| Medium | ~28–30 | singles only (lots of hidden singles) |
| Hard | ~24–30 | pointing pairs, box/line reduction, naked/hidden pairs |
| Expert | ~24–28 | triples, X-Wing, Swordfish, XY-Wing |

Puzzles that need guessing or chains are never served. The Daily Challenge is seeded by date, so it
is the same puzzle for everyone on a given day. Its difficulty rotates through the week.

## iPhone-specific details

The app follows Apple's Human Interface Guidelines. See [docs/DESIGN.md](docs/DESIGN.md) for all the rules. Highlights:

- Standalone display with plain launch images (light/dark), safe areas, portrait layouts that fit without scrolling.
- System light/dark, Dynamic Type, Increase Contrast, Reduce Transparency, Reduce Motion, VoiceOver.
- Large titles that collapse into the navigation bar, left-edge swipe-back, action sheets, native switches.
- Haptics for game events only (via the iOS 18+ `<input switch>` trick; there's no Vibration API on iOS).
- Relaunching after iOS closed the app returns to the same screen. Games resume paused.
- The service worker update is offered as a toast and never reloads in the middle of a game.
