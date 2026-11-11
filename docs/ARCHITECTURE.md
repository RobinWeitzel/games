# Architecture

## Layers

```
src/
  main.tsx        startup: migrate storage → theme → render → idle prefetch
  app/            SHELL: home screen, settings, theme, update/readonly banners
  games/
    types.ts      GameModule: the contract between shell and games
    registry.ts   the list of games (the only place that imports games)
    sudoku/       one self-contained game (reference implementation)
  ui/             DESIGN SYSTEM + GAME KIT, shared by shell and games
    nav.tsx         navigation stack, Screen layout, swipe-back
    components.tsx  lists, rows, toggles, segmented control, sheets, toast
    icons.tsx
    game/           hub building blocks, How to Play (rules.tsx), StatsScreen, ResultSheet, useGameClock, useRestorable
    cards/          card table for card games: card faces/backs, pile slots, tap and drag handling
  core/           SERVICES, no UI
    storage/        versioned key-value storage, layout migrations, backups
    settings.ts     app settings + createGameSettings()
    session.ts      which screen to restore on relaunch
    stats.ts        createGameStats(): per-mode results, best times, streaks, daily
    cards.ts        playing cards: encoding, names, shuffled deck
    daily.ts, random.ts, format.ts, haptics.ts
  styles/         global tokens (iOS colours, light/dark) and shell styles
docs/             this documentation
```

Allowed dependencies (enforced by `src/architecture.test.ts`):

```
app ──► games/registry ──► games/<id> ──► ui ──► core
  └──────────────────────────────────────►┘      ▲
                                    games/<id> ──┘
```

- `core` imports only `core`.
- `ui` imports `ui` and `core`.
- A game imports `core`, `ui` and `games/types.ts`. It never imports `app`, the registry, or another game.
- `app` reaches games only through `games/registry.ts`.

## How the shell uses a game

The shell only knows the `GameModule` interface (`src/games/types.ts`):

| Shell feature | Uses |
|---|---|
| Home tile | `name`, `tagline`, `Icon`, `color`. Tapping pushes `<Hub/>` |
| How to Play | `rules` (the hub shows them with `HowToPlayRow`; required for every game) |
| Home "Continue" card | `resume.describe()`, `resume.store` (to update live), `resume.Screen` |
| Settings | `SettingsSection` |
| Reset statistics | `stats.reset()` |
| Statistics screen | `stats` (modes, per-mode results, daily) |
| Warm-up after launch | `prefetch()` |
| Backups | nothing: they cover all `games/…` data keys automatically |

## Data

All persistence goes through `core/storage` with namespaced keys and versioned envelopes. Each game
declares everything it stores in its own `storage.ts`. See [STORAGE.md](STORAGE.md) for the full
rules. Short version: **data written by any earlier release must stay readable forever.**

## Design

Every screen follows the iOS Human Interface Guidelines as written down in
[DESIGN.md](DESIGN.md) (mandatory). Shared tokens (colours, text styles) live in
`src/styles/base.css`, and standard components in `src/ui/`.

## Startup sequence (`main.tsx`)

1. `initStorage()`: detect the layout version and run layout migrations (with a safety copy).
   Stores are lazy and read their keys only after this.
2. `validateRegistry()`: unique, valid game ids.
3. `initTheme()`: apply light/dark and the status bar colour.
4. Render `<App/>`: navigation stack with `<Home/>` at the root, plus the game hub and game screen
   restored from `games/app/session` if the player was in a game when iOS closed the app.
5. When idle: `game.prefetch()` for each game (e.g. Sudoku pre-generates puzzles in a Web Worker).

## Navigation

`ui/nav.tsx` is a stack of screens (`nav.push(<Screen/>)`, `nav.pop()`, `nav.replace()`), with
iOS-style push/pop animations and a left-edge swipe to go back. Screens are plain components;
there is no URL routing. A home screen app always starts at the home screen, and the "Continue"
cards bring the player back into a running game.

`useIsTop()` tells a screen whether it's visible (`useGameClock` uses it to stop the timer when
another screen covers the game).

## Testing

| Test | Protects |
|---|---|
| `games/<id>/**/*.test.ts` | game logic (engines, reducers) |
| `core/stats.test.ts` | stats and streak maths |
| `core/storage/store.test.ts` | envelopes, per-key migrations, read-only safety |
| `core/storage/layout.test.ts` | layout migrations from real old data, backups |
| `core/storage/contract.test.ts` | no unnoticed change to persisted keys/versions |
| `architecture.test.ts` | module boundaries, registry validity, every game shows its rules |
| `design.test.ts` | static HIG rules: 11pt minimum, Dynamic Type tokens, haptics only in games, no browser dialogs, system appearance |
| `npm run audit:ios` | rendered HIG checks: 44pt targets, text sizes, overflow, game fits (SE, large text, Pro Max) |
