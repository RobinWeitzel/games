# Adding a game

A game is a folder `src/games/<id>/` that exports a `GameModule` (`src/games/types.ts`). The app
shell gives every game these for free:

- a tile on the home screen, plus a "Continue" card if the game has a save
- a section in Settings
- the Statistics screen (per mode, with daily streaks if the game has a daily challenge)
- "Reset statistics" and backup export/import

**Nothing outside your game folder changes except one line in `src/games/registry.ts`.**

## 1. Choose the id (permanent)

Lowercase letters, digits and dashes, e.g. `minesweeper`. The id is part of every storage key the
game writes (`games/game/minesweeper/…`), so **it can never change** once released. The display
name can.

## 2. Folder layout

```
src/games/minesweeper/
  index.tsx        the GameModule definition (the only file the registry imports)
  storage.ts       EVERY persisted value of this game (settings, stats, save, caches)
  state.ts         pure game logic / reducer, with tests next to it (state.test.ts)
  ui/
    MinesweeperHub.tsx     first screen: continue, modes, stats link
    MinesweeperPlay.tsx    the game screen
    MinesweeperIcon.tsx    white glyph for the home tile
    minesweeper.css        styles, prefixed with the game id (.ms-…)
```

Boundaries, enforced by `src/architecture.test.ts`:

- A game may import from `src/core/`, `src/ui/` and `src/games/types.ts`.
- A game may **not** import from `src/app/`, `src/games/registry.ts` or another game.
  If two games need the same thing, move it into `core/` (logic) or `ui/` (components).

## 3. Declare storage (`storage.ts`)

```ts
import { cacheKey, defineCache, defineStore, gameKey } from '../../core/storage';
import { createGameSettings } from '../../core/settings';
import { createGameStats } from '../../core/stats';
import type { MinesweeperGame } from './state';

export const GAME_ID = 'minesweeper';

// games/game/minesweeper/settings: new settings just need a default here.
export const msSettings = createGameSettings(GAME_ID, { chordClick: true, flagOnLongPress: true });

// games/game/minesweeper/stats (+ /daily if daily: true). Mode ids are permanent.
export const msStats = createGameStats(GAME_ID, {
  modes: [
    { id: 'beginner', label: 'Beginner' },
    { id: 'intermediate', label: 'Intermediate' },
    { id: 'expert', label: 'Expert' },
  ],
  daily: false,
});

// games/game/minesweeper/save: the game in progress.
export const msSave = defineStore<MinesweeperGame | null>({
  key: gameKey(GAME_ID, 'save'),
  version: 1,
  initial: null,
});
```

Then add the new keys to the list in `src/core/storage/contract.test.ts`. Read
[STORAGE.md](STORAGE.md) before changing any of these after release.

## 4. Build the screens with the game kit

| Need | Use |
|---|---|
| Screen with nav bar, back button, swipe-back | `Screen` from `ui/nav` (`largeTitle` for the hub, `title` + `fixed` for the game screen) |
| Hub building blocks | `ContinueRow`, `DailyCard`, `ModeList`, `StatsRow`, `ConfirmNewGameSheet`, `LoadingOverlay` from `ui/game/hub` |
| Timer that pauses in the background and saves | `useGameClock` from `ui/game/useGameClock` |
| Come back to the game after iOS closes the app | `useRestorable` from `ui/game/useRestorable` |
| Win / lose sheet with big time | `ResultSheet` from `ui/game/hub` |
| Lists, toggles, segmented control, sheets | `ui/components` |
| Icons | `ui/icons` |
| Haptics | `haptic('selection' \| 'success' \| 'error')` from `core/haptics` (call it inside a tap handler) |
| Seeded randomness (daily puzzles) | `createRng`, `hashString` from `core/random` |
| Dates for daily challenges | `todayKey`, `dailyStreak` from `core/daily` |

`src/games/sudoku/` is the reference implementation of all of these.

**Every screen must follow [DESIGN.md](DESIGN.md)** (Apple HIG). It's not optional. The essentials
for a game screen:

- Fit the screen **without scrolling** in portrait, from iPhone SE (375×667pt) up, also with
  large text. Size the board from `100dvh` like `sudoku.css` does.
- Controls in the bottom half, **≥ 44×44pt**, 8–12pt apart. 8pt side padding, so the board uses the full width.
- Text with the `--fs-*` tokens (cap them with `min()` in the fixed game layout), never below 11pt.
- Colours from the tokens. Contrast ≥ 4.5:1. Never colour alone (add shape or text).
- Haptics only for game events: `selection` = move accepted, `success` = completed or won, `error` = mistake or lost.
- Call `useRestorable(GAME_ID, 'resume')` in the game screen and pass its result as
  `startPaused` to `useGameClock`: relaunching the app comes back to the game, paused.
- Save on every move (`store.set`) and in `useGameClock`'s `onSuspend`. iOS can kill the app
  in the background at any time.
- Record each finished game exactly once: `stats.record(mode, { outcome, timeMs, assists })`.
  Count an abandoned game (a new game started over a touched one) as `'abandoned'`.
- VoiceOver: label controls and cells (including state), and make activation work via `click`.

## 5. Define the module (`index.tsx`)

```tsx
import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { GAME_ID, msSave, msStats } from './storage';
import { MinesweeperHub } from './ui/MinesweeperHub';
import { MinesweeperPlay } from './ui/MinesweeperPlay';
import { MinesweeperIcon } from './ui/MinesweeperIcon';
import './ui/minesweeper.css';

export const minesweeper: GameModule = {
  id: GAME_ID,
  name: 'Minesweeper',
  tagline: 'Clear the field, avoid the mines',
  Icon: MinesweeperIcon,
  color: 'linear-gradient(135deg, #30b0c7, #0a84ff)',
  Hub: MinesweeperHub,
  stats: msStats,
  resume: {
    store: msSave as Store<unknown>,
    describe: () => {
      const g = msSave.get();
      return g && g.status === 'playing' ? { label: g.mode, progress: g.revealed / g.safeCells } : null;
    },
    Screen: MinesweeperPlay,
  },
  // SettingsSection: MinesweeperSettings,   // optional
  // prefetch: () => warmUpSomething(),     // optional, runs when idle after launch
};
```

## 6. Register it

```ts
// src/games/registry.ts
import { minesweeper } from './minesweeper';
export const GAMES: GameModule[] = [sudoku, minesweeper];
```

## 7. Check

```sh
npm test           # logic tests, storage contract, architecture boundaries, design lint
npm run audit:ios  # HIG audit: hit targets, text sizes, overflow, game fits (SE, large text, Pro Max)
npm run preview    # try it on the phone
```

- [ ] The review checklist in [DESIGN.md](DESIGN.md) is done
- [ ] Game id and mode ids are final
- [ ] All persisted data is declared in `storage.ts` and listed in the contract test
- [ ] Game logic is in pure functions with unit tests
- [ ] Leaving and reopening the app mid-game resumes exactly where you were
- [ ] Finished games show up in Statistics. Reset statistics clears them

## Removing or retiring a game

Remove it from `GAMES` but **keep its folder's `storage.ts` and its data**. Players' saves and
stats stay on the device and in backups, so the game can come back later with all progress intact.
