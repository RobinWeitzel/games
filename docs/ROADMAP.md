# Game roadmap

Candidate games for this app, ranked by how well they fit the format. Pick from the top unless
the owner asks for something else. **Research only. Nothing below is decided or built until its
status says so.**

When you start a game: set its status to `in progress` (with the branch name). When it ships:
set it to `shipped` and move it to the table at the bottom. Read
[ADDING_A_GAME.md](ADDING_A_GAME.md) first and choose a permanent id from the suggestions below
(ids can never change, see [STORAGE.md](STORAGE.md)).

## Why these games: what the format favours

| Constraint (CLAUDE.md, DESIGN.md) | Consequence for game choice |
|---|---|
| Save on every move, restore paused, offline, no backend | Turn-based, single-player, deterministic. No real time. |
| No decorative or looping animation | No arcade or action games. |
| Fits iPhone SE (375×667pt) portrait without scrolling, controls in the bottom half | Boards of about 8 columns at 44pt. Denser grids only under the `.cell` exemption in `scripts/ios-audit.mjs` (one large board target), or with a scrolling board like Minesweeper's. |
| Never colour alone | Colour-coded pieces also need a number, letter, symbol or border. |
| Game kit has seeded daily, modes, stats, streaks, timer (`core/daily.ts`, `core/random.ts`, `createGameStats`) | Puzzles **generated from a seed** get the most from the shell: a daily plus difficulty modes for free. |
| Haptics: `selection` / `success` / `error` | Games with clear "move accepted" and "mistake" events. |

So the best fits are **generated logic puzzles** and **solitaire-style card or tile games**.

### Naming and originality

Build genres, not copies of specific products. Use generic names and our own visuals. Avoid
trademarked names: KenKen → "Calcudoku", Othello → "Reversi", Connect Four → "Four in a Row",
Mastermind → "Codebreaker", Picross → "Nonogram", Wordle → see [Word guessing](#word-guessing-daily-5-letter-word).

## Tier 1: strong fit, builds on existing code

### Nonogram (picture logic)
- Status: `planned` · suggested id: `nonogram`
- Fill cells from row and column run clues, and a solved puzzle reveals a picture.
- Modes: 5×5, 10×10, 15×15 (15×15 uses a scrolling or zoomable board like Minesweeper's) plus daily.
- Hard part: generated grids must have a **unique, line-solvable solution**. Write a line solver
  and reject or adjust random grids (same idea as Minesweeper's no-guess generation). Optionally
  ship a small set of hand-made pictures.
- UX: fill/cross mode in the tool row, drag to paint a run, clues that grey out when satisfied
  (text change plus a strikethrough or opacity, not colour alone).

### More solitaire: FreeCell, Spider, Pyramid, TriPeaks, Golf
- Status: `planned` · suggested ids: `freecell`, `spider`, `pyramid`, `tripeaks`, `golf`
- **Prerequisite:** move the reusable card code (card rendering, deck, shuffle/deal, drag)
  out of `src/games/solitaire/` into `src/ui/cards/` (components) and `src/core/cards.ts`
  (logic). Games may not import each other (`src/architecture.test.ts`). Do this as its own
  change, with Solitaire behaving identically and its storage untouched.
- FreeCell: almost every deal is solvable, so it's a great daily. Spider: 1, 2 and 4 suit modes,
  but 10 columns are tight on the SE, so overlap cards more. TriPeaks and Golf: fast, low effort.
- Each could be a separate game (own stats) or a mode of Solitaire. Separate games are simpler:
  adding modes to `solitaire` means a storage migration.

### Calcudoku / Killer Sudoku
- Status: `planned` · suggested ids: `calcudoku`, `killer-sudoku`
- Arithmetic cages. They reuse Sudoku's input UX: number pad, notes, number lock, autofill.
  Share that via `ui/`, not by importing `sudoku/`.
- Calcudoku 4×4 to 6×6 gets 44pt cells easily. Killer Sudoku is 9×9 under the `.cell` exemption.
- Cage borders must be readable in light and dark, and cage sums need ≥ 11pt text.
- Hard part: a generator that produces unique solutions (solver plus cage merging and splitting).

### Kakuro (cross sums)
- Status: `planned` · suggested id: `kakuro`
- Number-pad and notes puzzle, a natural fit for people who play Numbers and Sudoku.
- Hard part: layout generation plus a uniqueness check. Keep sizes ≤ 8 columns for 44pt cells.

## Tier 2: good fit, small new engines

### Bridges (Hashiwokakero)
- Status: `planned` · suggested id: `bridges`
- Connect islands so each has as many bridges as its number, all connected, no crossings.
- Tap between two islands to cycle 0 → 1 → 2 bridges. Islands are large targets even when the
  grid is dense. It generates well.

### Star Battle / Queens
- Status: `planned` · suggested id: `star-battle`
- One star (or two on larger boards) per row, column and region, and no two stars touching.
- Regions are normally colour-only. **Draw thick region borders as well** (colour rule).
- Sizes 6×6 to 10×10. Needs a uniqueness solver.

### Grid logic pack: Slitherlink, Nurikabe, Light Up (Akari)
- Status: `planned` · suggested ids: `slitherlink`, `nurikabe`, `light-up`
- Classic generated logic puzzles. Each needs its own solver for uniqueness. A shared
  constraint-propagation and backtracking helper in `core/` would serve all of them (and Nonogram,
  Star Battle, Kakuro).
- Slitherlink has to hit edges between dots, so its hit areas need care: tap the nearest edge.

### Numberlink (connect the pairs)
- Status: `planned` · suggested id: `numberlink`
- Draw paths between matching endpoints until every cell is filled. Endpoints carry **numbers**,
  not just colours.
- Dragging a path must not fight the edge swipe-back: start paths only on cells, keep the board
  away from the left edge.

### Codebreaker (code-breaking with pegs)
- Status: `planned` · suggested id: `codebreaker`
- Guess a hidden code of 4 to 5 pegs; feedback gives exact and partial hits. Natural daily.
- Pegs need symbols or shapes besides colour, and feedback is shown as counts or icons, not just
  black and white dots.

### Classics: sliding puzzle (15-puzzle), peg solitaire
- Status: `planned` · suggested ids: `sliding-puzzle`, `peg-solitaire`
- Trivial engines and great for move-count and best-time stats. The sliding puzzle must only
  generate solvable permutations (parity check).

## Tier 3: possible, with a real cost

### Word guessing (daily 5-letter word)
- Status: `planned` · suggested id: `word-guess` (pick a final generic name before release)
- The **mechanic** is old and generic: Jotto (1955) and the TV show Lingo used it before Wordle.
  Game mechanics are not protected by copyright. What the NYT has enforced (DMCA notices against
  Reactle and ~1,900 forks in March 2024) is the **name, the 6×5 grid with green/yellow tiles and
  similar trade dress**. "Use an open-source clone" doesn't help: those projects carry the same
  risk, and the takedown hit open-source repos specifically.
- **Rules for this app if built:**
  - Don't use "Wordle" or "-rdle" names, the NYT answer list, or the green/yellow/grey palette and
    6×5 grid presentation. Use our own name, our own palette from the semantic tokens, and our own
    layout, e.g. a different word length or guess count, or Jotto-style feedback (count of shared
    letters).
  - Feedback must not rely on colour (shapes or icons per tile, plus VoiceOver labels like
    "A, correct position").
  - Word lists: **ENABLE** (explicitly public domain) or the public-domain parts of
    **SCOWL / 12dicts** (check the copyright file of the exact release, because parts are BSD).
    Curate our own answer list of common words. A German list needs its own license check.
  - Size budget: a 5-letter English list is ~13k words (~70 KB raw, less gzipped). Lazy-load it
    so it doesn't weigh down app start, and make sure the service worker caches it for offline use.
- Other word options with the same list: word search (needs nothing but a list), anagram/word
  wheel.

### Mahjong solitaire (tile matching)
- Status: `planned` · suggested id: `mahjong-solitaire`
- Very popular on iPhone. Costs: a full original tile set that works in light and dark (symbols
  beyond colour), solvable deals (deal by reverse-removal), and stacked layouts that fit portrait
  SE with ≥ 44pt tiles. That last part is the hard part.

### Board games against an AI: Reversi, Four in a Row, Dots and Boxes, Checkers
- Status: `planned` · suggested ids: `reversi`, `four-in-a-row`, `dots-and-boxes`, `checkers`
- Fit 8×8 grids and save-every-move well. Need an AI (minimax plus alpha-beta) with difficulty
  modes, run in a worker or in small time slices so the UI never stalls. Get little value from
  the daily. Stats per difficulty (win/loss).

### Box pushing (Sokoban-style)
- Status: `planned` · suggested id: `box-push`
- Good on touch (swipe or tap to move, undo). Generated levels are weak, and good hand-made levels
  are a lot of design work, which must be our own.

### Dice scorecard (Yacht / Generala-style)
- Status: `planned` · suggested id: `yacht`
- Easy engine, but luck-driven and shallow with a daily. Avoid the name "Yahtzee".

## Poor fit: don't build

Real-time and arcade games (falling blocks, runners, Snake), physics games, anything multiplayer
or online, anything that needs landscape, and close clones of specific products (2048 and
similar).

## Suggested order

1. Nonogram: a new type of puzzle, strong daily, fits existing patterns.
2. Extract card code to `ui/` and `core/`, then FreeCell and Spider.
3. Calcudoku or Killer Sudoku (share Sudoku's number-pad UX via `ui/`).
4. Bridges or Star Battle.
5. Word guessing, once a name, look and word list are settled (see the rules above).

## Shipped

| Game | id | Notes |
|---|---|---|
| Sudoku | `sudoku` | reference implementation |
| Numbers | `numbers` | reach a target with six numbers |
| Minesweeper | `minesweeper` | no-guess boards |
| Solitaire | `solitaire` | Klondike, Draw 1 / Draw 3, daily |
