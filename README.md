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
```

`npm run icons` uses Playwright's Chromium and writes `scripts/splash-links.html`. Paste those tags into
`index.html` if you changed the device list in `scripts/devices.mjs`.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`: test → build → deploy to Pages.
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The base path is the repository name (`/games/`).

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the app is put together and the module boundaries
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

- Standalone display, launch images for current iPhones (light and dark), safe-area insets, `100dvh` layouts.
- No zoom, text selection, callouts, tap highlight or rubber-banding. Buttons react on touch.
- Haptics through the iOS 18+ `<input switch>` trick (no Vibration API on iOS).
- In-app back button plus left-edge swipe-back, since standalone apps have no browser back gesture.
- Saves on every move and when the app is backgrounded. The timer pauses while the app is hidden.
- The service worker update is offered as a toast and never reloads in the middle of a game.
