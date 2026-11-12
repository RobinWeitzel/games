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
  rules.ts         How to Play: the rules shown on the hub (required)
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
| Game screen chrome (layout, status line, timer, tool row, pause overlay) | classes `play`, `play-layout`, `play-info`, `timer`, `tools`/`tool`, `pause-overlay` from `ui/game/game.css` (loaded with the game kit) |
| Hub building blocks | `ContinueRow`, `DailyCard`, `ModeList`, `HowToPlayRow`, `StatsRow`, `ConfirmNewGameSheet`, `LoadingOverlay` from `ui/game/hub` |
| Timer that pauses in the background and saves | `useGameClock` from `ui/game/useGameClock` |
| Come back to the game after iOS closes the app | `useRestorable` from `ui/game/useRestorable` |
| Win / lose sheet with big time | `ResultSheet` from `ui/game/hub` |
| Card games: cards, pile slots, tap and drag on the table | `CardView`, `Slot`, `useCardTable` from `ui/cards`, card logic from `core/cards` (see `src/games/freecell/`) |
| Number pad (digits, notes look, touch-and-hold number lock) | `NumberPad` from `ui/game/numpad` |
| Play logic of a number grid with a known solution (digits, notes, mistakes, undo, hints) | `reduceGrid` from `core/numberGrid` (see `src/games/killer-sudoku/`) |
| Lists, toggles, segmented control, sheets | `ui/components` |
| Icons | `ui/icons` |
| Haptics | `haptic('selection' \| 'success' \| 'error')` from `core/haptics` (call it inside a tap handler) |
| Seeded randomness (daily puzzles) | `createRng`, `hashString` from `core/random` |
| Puzzle generation in a Web Worker, with one puzzle per mode kept ready in memory | `createPuzzleSource` / `servePuzzles` from `core/puzzleSource` (see `src/games/nurikabe/`) |
| Dates for daily challenges | `todayKey`, `dailyStreak` from `core/daily` |

`src/games/sudoku/` is the reference implementation of all of these. `src/games/numbers/` is a smaller
example without a board grid, and with a setup step before the clock starts.

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

## 5. Write the rules (`rules.ts`), required

Every game explains itself on its hub. `rules.ts` exports the rules as inset-grouped sections,
and the hub shows them with `<HowToPlayRow rules={RULES} gameName="Minesweeper" />` right above
`<StatsRow/>`. The row opens a "How to Play" detail screen.

```ts
import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  { header: 'Goal', rules: ['Open every cell that doesn’t hide a mine. If you open a mine, the game is lost.'] },
  { header: 'Playing', rules: ['Tap a cell to open it. Touch and hold a cell to put a flag on it.', '…'] },
  { header: 'Modes', rules: ['Easy: 8 × 10 with 10 mines. …', 'The Daily Challenge …'] },
];
```

Cover: the goal, how a move works, how you win (and lose), every mode, every tool (Undo, Hint,
assists), and every gesture. Short, plain sentences, one per entry. Describe what the game actually
does (read `state.ts`), and update `rules.ts` whenever the rules, modes or tools change.
`validateRegistry` rejects a game without rules, and `src/architecture.test.ts` fails if a game's hub
doesn't render `<HowToPlayRow/>`.

## 6. Define the module (`index.tsx`)

```tsx
import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { RULES } from './rules';
import { GAME_ID, msSave, msStats } from './storage';
import { MinesweeperHub } from './ui/MinesweeperHub';
import { MinesweeperPlay } from './ui/MinesweeperPlay';
import { MinesweeperIcon } from './ui/MinesweeperIcon';
import './ui/minesweeper.css';

export const minesweeper: GameModule = {
  id: GAME_ID,
  name: 'Minesweeper',
  tagline: 'Clear the field, avoid the mines',
  category: 'logic', // home screen group: 'numbers' | 'logic' | 'cards' | 'board'
  Icon: MinesweeperIcon,
  color: 'linear-gradient(135deg, #30b0c7, #0a84ff)',
  Hub: MinesweeperHub,
  rules: RULES,
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

## 7. Register it

```ts
// src/games/registry.ts
import { minesweeper } from './minesweeper';
export const GAMES: GameModule[] = [sudoku, minesweeper];
```

## 8. Check

```sh
npm test           # logic tests, storage contract, architecture boundaries, design lint
npm run audit:ios  # HIG audit of every game: hit targets, text sizes, overflow, game fits (SE, large text, Pro Max)
                   # If your game starts with a setup step, mark one control with data-audit-next.
npm run preview    # try it on the phone
```

- [ ] The review checklist in [DESIGN.md](DESIGN.md) is done
- [ ] How to Play explains the goal, moves, winning/losing, every mode and every tool
- [ ] Game id and mode ids are final
- [ ] All persisted data is declared in `storage.ts` and listed in the contract test
- [ ] Game logic is in pure functions with unit tests
- [ ] Leaving and reopening the app mid-game resumes exactly where you were
- [ ] Finished games show up in Statistics. Reset statistics clears them

## Removing or retiring a game

Remove it from `GAMES` but **keep its folder's `storage.ts` and its data**. Players' saves and
stats stay on the device and in backups, so the game can come back later with all progress intact.
