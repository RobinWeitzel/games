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
npm test           # unit tests (Sudoku engine, game state, stats)
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

## Structure

```
src/
  app/            shell: navigation stack (push/pop + edge swipe), theme, screens (Home, Settings, Stats)
  core/           storage (versioned localStorage, export/import), stats, daily streaks, haptics, settings
  ui/             shared iOS-style components (lists, sheets, segmented control, toggles) and icons
  games/
    registry.tsx  list of games shown on the home screen
    sudoku/
      engine/     solver, generator, difficulty grader, Web Worker (pure TS, unit-tested)
      state.ts    game state reducer (input, notes, undo, hints, mistakes)
      puzzles.ts  puzzle pool (pre-generated in the background) + daily puzzle
      ui/         hub, play screen, board, styles
```

### Sudoku difficulty

Every puzzle has exactly one solution. Difficulty comes from the hardest **technique** needed, as
measured by a human-style solver (`engine/grader.ts`):

| Difficulty | Givens | Hardest technique needed |
|---|---|---|
| Easy | ~38 | naked / hidden singles |
| Medium | ~28–30 | singles only (lots of hidden singles) |
| Hard | ~24–30 | pointing pairs, box/line reduction, naked/hidden pairs |
| Expert | ~24–28 | triples, X-Wing, Swordfish, XY-Wing |

Puzzles that need guessing or chains are never served. The Daily Challenge is seeded by date, so it
is the same puzzle for everyone on a given day. Its difficulty rotates through the week.

### Adding a game

1. Create `src/games/<id>/` with its screens.
2. Record results with `recordResult(gameId, mode, …)` from `core/stats.ts`.
3. Add an entry to `GAMES` in `src/games/registry.tsx` (tile, home screen, stats modes, optional
   "continue" support). The home screen, stats screen and backup work automatically.

## iPhone-specific details

- Standalone display, launch images for current iPhones (light and dark), safe-area insets, `100dvh` layouts.
- No zoom, text selection, callouts, tap highlight or rubber-banding. Buttons react on touch.
- Haptics through the iOS 18+ `<input switch>` trick (no Vibration API on iOS).
- In-app back button plus left-edge swipe-back, since standalone apps have no browser back gesture.
- Saves on every move and when the app is backgrounded. The timer pauses while the app is hidden.
- The service worker update is offered as a toast and never reloads in the middle of a game.
