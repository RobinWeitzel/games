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

### More solitaire: Pyramid
- Status: `planned` · suggested id: `pyramid` (TriPeaks and Golf have shipped)
- FreeCell and Spider have shipped (see below). The card code they share with Solitaire lives in
  `src/ui/cards/` (card faces, pile slots, tap and drag) and `src/core/cards.ts` (encoding, names,
  shuffle). Build new card games on those, as separate games with their own stats.
- Pyramid: pairs that add up to 13; needs a solver or reverse dealing for winnable deals (Golf
  builds its deals backwards from a random winning game, which is fast and certain).

### Calcudoku / Killer Sudoku
- Status: `shipped` (both) · ids: `calcudoku`, `killer-sudoku`
- The number pad (keys, notes look, touch-and-hold number lock) is shared in `ui/game/numpad.tsx`,
  and the play logic of number grids with a known solution (digits, notes, mistakes, undo, hints)
  in `core/numberGrid.ts`. Kakuro can build on both.
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
- Status: `shipped` · id: `bridges`
- Connect islands so each has as many bridges as its number, all connected, no crossings.
- Tap between two islands to cycle 0 → 1 → 2 bridges. Islands are large targets even when the
  grid is dense. It generates well.

### Star Battle / Queens
- Status: `shipped` · id: `star-battle`
- One star (or two on larger boards) per row, column and region, and no two stars touching.
- Regions are normally colour-only. **Draw thick region borders as well** (colour rule).
- Sizes 6×6 to 10×10. Needs a uniqueness solver.

### Grid logic pack: Slitherlink, Nurikabe, Light Up (Akari)
- Status: Light Up `shipped`; Slitherlink and Nurikabe `planned` · suggested ids: `slitherlink`, `nurikabe`
- Classic generated logic puzzles. Each needs its own solver for uniqueness. A shared
  constraint-propagation and backtracking helper in `core/` would serve all of them (and Nonogram,
  Star Battle, Kakuro).
- Slitherlink has to hit edges between dots, so its hit areas need care: tap the nearest edge.

### Numberlink (connect the pairs)
- Status: `shipped` · id: `numberlink`
- Draw paths between matching endpoints until every cell is filled. Endpoints carry **numbers**,
  not just colours.
- Dragging a path must not fight the edge swipe-back: start paths only on cells, keep the board
  away from the left edge.

### Codebreaker (code-breaking with pegs)
- Status: `shipped` · id: `codebreaker`
- Guess a hidden code of 4 to 5 pegs; feedback gives exact and partial hits. Natural daily.
- Pegs need symbols or shapes besides colour, and feedback is shown as counts or icons, not just
  black and white dots.

### Classics: sliding puzzle (15-puzzle), peg solitaire
- Status: `shipped` (both) · ids: `sliding-puzzle`, `peg-solitaire`
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
- Status: Reversi and Four in a Row `shipped`; Dots and Boxes and Checkers `planned` · suggested ids: `dots-and-boxes`, `checkers`
- The shipped ones run the AI on the main thread (negamax + alpha-beta; worst case ~150ms at the
  highest level on a desktop). If a level ever feels slow on a phone, move it into a worker.
- Statistics know only won/lost, so a draw is recorded as not won (no storage change needed).
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

1. Kakuro (number pad and `core/numberGrid.ts`).
2. Slitherlink and Nurikabe, Kakuro, Pyramid; Dots and Boxes.
3. Word guessing, once a name, look and word list are settled (see the rules above).

## Shipped

| Game | id | Notes |
|---|---|---|
| Sudoku | `sudoku` | reference implementation |
| Numbers | `numbers` | reach a target with six numbers |
| Minesweeper | `minesweeper` | no-guess boards |
| Solitaire | `solitaire` | Klondike, Draw 1 / Draw 3, daily |
| FreeCell | `freecell` | Classic and daily; deals proven winnable by a best-first solver (also used for hints); supermoves; safe cards go home by themselves |
| Spider | `spider` | 1, 2 and 4 suits, no daily (deals aren't checked for winnability). Possible follow-up: a solver for winnable 1-suit deals and a daily |
| Calcudoku | `calcudoku` | 4×4 to 7×7 and a daily 6×6; random Latin square + random cages, kept only with exactly one solution (cage-by-cage solver) |
| Bridges | `bridges` | 7×7, 9×9, 11×11 and a daily 9×9; grown island networks kept only with one solution (bounds-propagation solver); tap the water or drag from an island |
| Star Battle | `star-battle` | 6×6, 8×8 (1 star), 10×10 (2 stars), daily 8×8; random star layout, regions grown around it, then repaired until one solution remains; neighbouring regions get different tints plus thick borders |
| TriPeaks | `tripeaks` | Classic and daily; deals proven winnable by a memoised DFS (~90% of random deals pass), which also gives hints |
| Golf | `golf` | Classic and daily; only ~30% of random deals can be won, so deals are built backwards from a random winning game |
| Killer Sudoku | `killer-sudoku` | Easy/Medium/Hard by cage size, daily Medium; random grid + cages without repeated digits; while a second solution exists, a cage is split where the solutions differ |
| Codebreaker | `codebreaker` | 4 of 6, 5 of 8, daily 4 of 6; symbols differ by shape, feedback marks by shape (dot, ring, dash) |
| Sliding Puzzle | `sliding-puzzle` | 3×3, 4×4, 5×5, daily 4×4; random permutations fixed to be solvable by the parity rule |
| Peg Solitaire | `peg-solitaire` | 33-hole cross and 15-hole triangle, no daily (fixed boards); hints from a memoised DFS (the cross solves in ~20ms) |
| Light Up | `light-up` | Easy 7×7, Medium/Hard 10×10, daily Medium; symmetric walls, greedy bulbs, then numbers removed while a propagation solver keeps one solution |
| Numberlink | `numberlink` | 5×5, 7×7, 9×9, daily 7×7; the grid is covered with random paths and only their ends are kept; any full joining wins, the generated paths give hints |
| Four in a Row | `four-in-a-row` | vs the computer, Easy/Medium/Hard (2/4/8 plies), who starts alternates; your discs a ring, the computer's a cross |
| Reversi | `reversi` | vs the computer, Easy/Medium/Hard (1/3/5 plies, position weights + mobility); legal moves shown as dots |
| Nonogram | `nonogram` | 5×5, 10×10, 15×15, daily 10×10; generated, line-solvable (unique) pictures. Possible follow-up: a small set of hand-made pictures |
