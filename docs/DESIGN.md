# Design rules: feeling native on iPhone

This app is a web app that must be **indistinguishable from a native iOS app**. These rules apply
Apple's Human Interface Guidelines
([Designing for iOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-ios)
and the pages it links) to this codebase. They are **mandatory** for every change and every new
game. `npm test` (`src/design.test.ts`) and `npm run audit:ios` (`scripts/ios-audit.mjs`) enforce
what can be checked automatically. The rest is the review checklist at the end.

## The iOS fundamentals (from "Designing for iOS")

| HIG says | What it means here |
|---|---|
| Limit onscreen controls so people can concentrate on the primary task. Make secondary actions discoverable with minimal interaction | Game screens show the board plus a single row of tools. Options live in Settings, details in Statistics |
| Adapt seamlessly to appearance changes (Dark Mode, Dynamic Type) | Follow the system appearance only. All text scales with Dynamic Type |
| Put controls where hands reach them: middle and bottom of the screen. Let people swipe to navigate back | Game controls sit in the bottom half. Every pushed screen supports left-edge swipe-back *and* a back button |
| Short sessions and frequent app switching | Save on every move. Pause and save when backgrounded. Restore the exact screen on relaunch |
| Device orientation | **Documented exception:** the product is portrait-only by design (user requirement). Landscape shows a "rotate back" hint |

## Rules

### 1. Navigation and structure
- Use `Screen` from `ui/nav` for every screen. Push/pop and swipe-back come with it.
- **Top-level screens** (home, a game's hub, Settings) use `largeTitle`, which collapses into the
  bar on scroll. **Detail screens** (Statistics, the game itself) use the inline `title`.
- The back button shows the previous screen's title (`back="Sudoku"`), never just "Back".
- The navigation bar has no background at rest and gets material plus a hairline once content
  scrolls under it (automatic in `Screen`).
- The left 16pt edge is the swipe-back strip. It only takes horizontal drags: taps on it are forwarded
  to the content underneath, so content may extend under it.

### 2. Layout
- Respect safe areas: use `--safe-top`, `--safe-bottom` and so on, already handled by `Screen` and the sheets.
- 16pt side margins for content screens (inset grouped lists). Game screens use 8pt so the board can use
  the full width (only safe areas are mandatory in the HIG; margins are ours to choose).
- Game screens **fit without scrolling** in portrait, from iPhone SE (375×667pt) up, including
  with large text. Size the board from the available height, like `sudoku.css`'s `.board-wrap`.
  A board that would otherwise need cells under 44pt may instead **scroll vertically inside its
  area** while the status line and controls stay fixed (Minesweeper). Never horizontally: the left
  edge is swipe-back. A drag must never count as a tap, and neither may a touch that stops a
  flick-scroll.
- Primary game controls in the **bottom half** (thumb reach). Navigation and status at the top.

### 3. Typography (Dynamic Type)
- Use the text style tokens: `--fs-large-title`, `--fs-title1`, `--fs-title2`, `--fs-title3`,
  `--fs-body`, `--fs-callout`, `--fs-subheadline`, `--fs-footnote`, `--fs-caption1` and `--fs-caption2`.
  They are `rem`-based, and the root size comes from iOS Dynamic Type (`font: -apple-system-body`).
- **No fixed `px` font sizes in the shell or shared UI** (enforced by a test). Games may use `px` only for
  elements whose size is tied to the board or keys, and should cap scalable labels with
  `min(var(--fs-…), Npx)` so the fixed layout still fits.
- **Nothing below 11pt** (HIG minimum, enforced). Use `max(11px, …)` for computed sizes.
- Use the system font (`-apple-system`, SF Pro). Use tabular numbers for times and counters.
- Layouts must reflow at large text sizes (e.g. home tiles go to one column) rather than overflow.

### 4. Colour, Dark Mode and contrast
- **No app-specific light/dark setting.** The app follows the system (HIG: "Avoid offering an
  app-specific appearance setting"). Enforced by a test.
- Use the semantic tokens in `styles/base.css` (`--label`, `--label-2`, `--bg`, `--card`,
  `--separator`, `--accent`, `--red` and so on). They're the iOS system colours, with light and dark values
  and Increase Contrast variants. Never hard-code a grey.
- Text contrast **≥ 4.5:1** against its background in both appearances. Check custom colours,
  especially white text on coloured cards, by computing the ratio, not by eye.
- **Never use colour alone** to carry meaning. Pair it with shape or text: wrong digits are red
  *and* underlined, and the active Notes tool is tinted *and* filled.
- Support **Increase Contrast** (`prefers-contrast: more`) and **Reduce Transparency**
  (`prefers-reduced-transparency`). The tokens handle both.

### 5. Touch targets and controls
- Every tappable element is **at least 44×44pt** (enforced by `audit:ios`). Make the *hit area*
  bigger, not the visual: e.g. the stats chart scrubs anywhere along its width.
- About 8–12pt of spacing between bezelled buttons (keypads).
- Use the standard components in `ui/components`: inset-grouped `Section` + `Row`, `Toggle` (the native
  iOS switch, **only inside list rows**), `Segmented` (**≤ 5 segments**, text only), `Sheet`.
- Buttons react on touch-down (`:active` styles; `touchstart` listener in `main.tsx`).
- Allowed exceptions (listed in `ios-audit.mjs`): board cells in a dense game grid (the board as
  a whole is the target), playing cards on 8- and 10-column card tables (FreeCell, Spider: a tap
  moves a card to the best place, so the table works as one large target), the native switch (51×31pt inside a ≥ 44pt row), and segmented-control
  segments (standard 32pt control).

### 5b. Custom gestures (HIG Gestures)
A custom gesture (like Sudoku's *touch and hold a number*) is only allowed as a **shortcut on top
of standard taps**, and must:
- **Be taught in context:** an unobtrusive one-line tip near the control until the player has used it
  once (stored as a non-visible game setting, e.g. `numberLockTipSeen`).
- **Show its state and the way out:** a visible mode indicator (filled key plus status line) and a
  plain-tap exit ("tap 7 again to stop").
- **Have alternatives:** a keyboard shortcut, plus an accessible name and description on the control
  (`aria-describedby`), so VoiceOver users can discover it (double-tap and hold).
- Use the standard long-press duration (~400ms). Cancel on movement (> 10pt) and suppress the
  context menu.

### 6. Sheets and alerts
- Confirmations of an intentional action are **action sheets** (`Sheet` with actions + Cancel).
  The destructive option comes first and uses `style: 'destructive'`.
- Never use `alert()`, `confirm()` or `prompt()` (enforced). Never show a dialog at launch:
  use a non-modal banner (`Toast`) instead.
- Titles describe the situation ("Start a new game?"). Buttons are verbs ("Start New Game"), not "OK",
  except for purely informational messages.
- Don't confirm undoable or trivial actions. Only confirm data loss (abandoning a game,
  resetting stats, restoring a backup).

### 7. Haptics
- **Only for meaningful game events**, never for navigation, list rows, toggles, segmented controls or
  sheet buttons (native controls don't do that). Enforced: only `src/games/` may call `haptic()`.
- Consistent meaning across all games:

  | Event | Haptic |
  |---|---|
  | A move is accepted (piece placed, cell revealed) | `selection` |
  | Something completes (row/box/line, level) or the game is won | `success` |
  | A mistake, or the game is lost | `error` |
  | A game mode switched by a gesture (e.g. Sudoku number lock on, moved or off) | `selection` |

- iOS only plays haptics inside a real touch event. For long presses, fire the haptic on
  release (`pointerup`), not from the timer.
- Haptics complement visual feedback, never replace it. They can be turned off in Settings (`haptic()` respects this).

### 8. Motion
- Motion explains something: push/pop, sheet presentation, a completed row flashing, a wrong
  digit shaking. No decorative or looping animation.
- Everything respects **Reduce Motion** (global rule in `base.css`). Information must never be
  conveyed only by animation.

### 9. Launch, state and loading
- **Launch images are plain** backgrounds that match the first screen (no logo or text), in light and dark.
  Generated by `npm run icons`.
- **Restore state on relaunch:** iOS kills background apps freely, and the player should land exactly
  where they were. Game screens call `useRestorable(GAME_ID, 'resume')` and start **paused** when
  restored. Hubs are tracked by the shell.
- Save on every move and on backgrounding (`useGameClock`'s `onSuspend`).
- Show something immediately. Heavy work (puzzle generation) runs in a worker and is pre-warmed
  in `prefetch()`, with a spinner overlay only as a fallback.

### 10. Accessibility (VoiceOver and Switch Control)
- Every control has an accessible name (`aria-label` for icon buttons), and toggled tools set
  `aria-pressed`.
- Game boards expose cells with labels that include their state (e.g. "Row 3, column 5, 7, incorrect").
  Activation must work via **click** (VoiceOver, Switch Control and keyboards don't send pointer events).
- Charts have a visually hidden table (`.sr-only`) with the same data.
- Offer difficulty accommodations (difficulties, hints, an optional mistake limit).

### 11. Games specifically
- Pause button in the bar. Pausing hides the board (no peeking) and shows a large resume button.
- The timer stops when paused, when the app is backgrounded, and when another screen is on top.
- Win/lose uses `ResultSheet`: a big time readout, the next action first, then "Done".
- Assisted results (hints) never count as best times.

## Review checklist (for every PR and new game)

- [ ] `npm test` passes (includes `design.test.ts` and `architecture.test.ts`)
- [ ] `npm run audit:ios` passes: SE light, SE dark with large text, Pro Max
- [ ] Looked at every changed screen in light *and* dark on a 375pt-wide screen
- [ ] Large title on top-level screens, inline title on detail screens, back label = previous title
- [ ] Game screen fits without scrolling, controls in the bottom half
- [ ] No colour-only meaning. Contrast computed for custom colours
- [ ] Haptics only for game events, per the table above
- [ ] Leave mid-game, kill the app, relaunch: you're back in the game, paused
- [ ] VoiceOver can read and operate the main flow
- [ ] Confirmations use action sheets with a destructive first option and Cancel
- [ ] The game's How to Play (`rules.ts`) still matches its rules, modes and tools

## Review log

**2026-11 HIG review** of the whole app against Designing for iOS and the linked pages (Layout,
Typography, Color, Dark Mode, Buttons, Gestures, Playing haptics, Action sheets, Alerts, Segmented
controls, Toggles, Accessibility, Motion, Loading, Launching, Designing for games). Fixed:

| Finding | HIG page | Fix |
|---|---|---|
| App had its own Light/Dark/Auto setting | Dark Mode | Removed. Follows the system (settings store v1 → v2 migration) |
| Launch images showed the app icon | Launching | Plain background matching the home screen |
| Text did not follow Dynamic Type | Typography, Accessibility | rem-based iOS text styles from `-apple-system-body`; tiles reflow |
| Notes digits ~10pt, a 9pt "ON/OFF" badge | Typography (11pt minimum) | Notes ≥ 11pt. Badge removed (filled state instead) |
| Number keys 35pt wide | Buttons (44pt) | Two-row keypad (≥ 63pt wide). Erase moved into it |
| Stats bars ~16pt wide tap targets | Gestures ("bigger tap targets") | Scrub anywhere along the chart |
| Haptic on every row, tile, sheet and segment tap | Playing haptics ("avoid overusing") | Haptics only for game events |
| White text on orange/green cards at 2.1–2.6:1 | Color / Accessibility (4.5:1) | Darker gradients (5.0–5.7:1) |
| Wrong digits / Notes state shown by colour only | Accessibility | Underline / filled shape added |
| No large titles. Bar always translucent | Navigation bars | Collapsing large titles, scroll-edge bar |
| Relaunch always opened Home | Launching ("restore previous state") | Session store + restored navigation stack, game resumes paused |
| Board not operable with VoiceOver / Switch Control | Accessibility | Click activation, state in cell labels |
| No Increase Contrast / Reduce Transparency support | Accessibility, Materials | Token overrides via media queries |

**2026-11 Sudoku number lock.** New custom gesture (touch and hold a number, then tap cells),
designed to rule 5b: in-context tip, filled key plus status line with the exit, Shift+number on
keyboards, VoiceOver description. Filled keys use `--accent-fill` (white text ≥ 4.5:1; system blue is 4.0:1).

**2026-11 Numbers game.** Pick how many large numbers, then reach a three-digit target with + − × ÷.
Selected numbers and operations are filled, not only tinted. Invalid steps show the reason in text
and shake. Haptics: `selection` for a calculation, `success` for hitting the target, `error` for an
invalid step or a lost game. The tile gradient is 5.7:1 against white text. Also fixed in the shell: long back
labels now truncate instead of overlapping the title at large text sizes. The audit now covers every game.

**2026-11 Minesweeper.** Boards are always 8 columns wide, so every cell is ≥ 44pt on iPhone SE
(8×10, 8×16, 8×24). Taller boards scroll vertically inside the board area; the screen itself, the
status line and the tools never move. The spacing between tiles is part of each cell (a transparent
border), so there are no dead gaps. The game opens scrolled to the open area. A daily board starts with an open area. Every board can be
solved **without guessing**: layouts are generated from the first tap until a logic-only solver
(`solver.ts`) clears them, and hints open the next cell that can be proven safe. Tap opens, and
*touch and hold* flags. That custom gesture follows rule 5b: a one-line tip until the player has used it
(`holdTipSeen`), the Flag tool as the standard-tap alternative (filled when on, plus a status line
"Flag mode · tap to flag, hold to open"), and an `aria-describedby` hint for VoiceOver. Shapes carry
the meaning: closed cells are raised tiles, flags and mines are glyphs, wrong flags get a cross, and
the opened mine is a filled tile with an outline. Number colours are ≥ 4.5:1 in light and dark (see
`minesweeper.css`). Haptics: `selection` for opening or flagging, `success` for a cleared field,
`error` for a mine. After a loss, "Show Board" closes the sheet so the player can see where the mines were.

**2026-11 Solitaire.** Klondike with Draw 1, Draw 3 and a daily Draw 1 deal. Every deal is
**winnable**: random deals are tried until a solver (`state.ts`, `isWinnable`) finds a way to win.
Cards are sized from the available width and height, and the fan of a column squeezes so even the
longest possible column (6 face-down cards plus K to 2) fits on iPhone SE at the largest text size.
Tap moves a card to the best place it can go (its foundation first, then a column), and tapping the
stock draws. Dragging a card to a specific pile is a shortcut on top of that tap, built to rule 5b:
a one-line tip until the player has dragged once (`dragTipSeen`), and an `aria-describedby`
description for VoiceOver. Undo (also ⌘Z) and Hint count as assists. A hint outlines the cards to
move solidly and the destination with a dashed line, and the status line spells out the move. When
everything is face up, Finish puts the cards home. If no useful move is left, an action sheet
offers Undo, New Game, Keep Looking or Done. Suits are symbols (with the text variation selector, so
♥ and ♦ never turn into emoji) and ranks are text, so colour never carries meaning alone. Red is
5.4:1 on the light card face and 5.0:1 on the dark one. Haptics: `selection` for a move or a draw,
`success` for a finished suit and a won game, `error` for a card that can't go where it was sent
and for a game with no moves left.

**2026-11 Nonogram.** 5×5, 10×10, 15×15 and a daily 10×10. Every picture is generated and
accepted only if a line solver (`solver.ts`) solves it one row or column at a time, so it never
needs a guess and has exactly one solution. The board never scrolls: it is sized from the space
left over by the controls (`fitBoard` in `Board.tsx`), clue text scales with the cells but never
below 11pt. Cells are below 44pt on 10×10 and 15×15 (30pt and about 20pt on iPhone SE), so the
grid is one large target: a stroke starts anywhere on it and follows the finger along its row or
column, and the clues of the row and column under the finger are highlighted. Tapping a cell and
dragging are the same gesture (a tap is a one-cell stroke), and VoiceOver activates cells by click.
The drag is taught by a one-line tip until used once (`dragTipSeen`) and described with
`aria-describedby`. Fill and Cross are two tools (filled when active, plus a status line in cross
mode). Marks are shapes: filled squares and ×. Finished clues are struck through as well as
dimmed. Undo (also ⌘Z) is free; a hint corrects a wrong mark first, else marks a cell that follows
from one line, and counts as an assist. Haptics: `selection` for a stroke or a hint, `success` for
the solved picture. There is no `error`: nonograms don't reveal mistakes while playing. When solved,
the crosses and grid lines fade out so only the picture is left, and "Show Picture" closes the sheet.

**2026-11 How to Play.** Every game hub has a "How to Play" row (above Statistics) that pushes a
detail screen with an inline title and the back label of the game. The rules are text rows in
inset-grouped sections (Goal, Playing, Modes…), using `--fs-body` so they follow Dynamic Type. Each
game keeps its rules in `rules.ts`; a game without rules, or a hub without the row, fails
`npm test`. `audit:ios` checks the screen for every game.

**2026-11 Kakuro.** Easy 5 × 5, Medium 7 × 7, Hard 8 × 8 white cells (plus the clue row and
column, so the grid is 6, 8 or 9 cells wide), and a daily Medium. Built on the shared number pad and
`core/numberGrid` (notes, mistakes, undo, hints), like Killer Sudoku. Clue cells are dark with a
diagonal line: the across sum above it, the down sum below, at least 11pt. Selecting a cell
highlights its two runs, turns their sums into light pills (shape, not only colour) and spells
them out in the status line ("Across 12 (3 cells) · Down 4 (2 cells)"). Black cells can't be
selected, and arrow keys skip them. Clue ink on clue cells is 11.4:1 (light) and 21:1 (dark).

**2026-11 Nurikabe.** 6 × 6, 8 × 8, 10 × 10 and a daily 8 × 8. Tap cycles empty → shaded → dot,
and a drag gives every cell what the first one got (one undo step). Shaded cells are solid blue
squares (6.7:1 against white cells; in dark mode a lighter blue, 4.7:1 against the cells), dots
are dots. A 2 × 2 pool gets red stripes and a red inner border, and a wrong number a red ring; a
finished island's number fades. Haptics: `selection` for a move or hint, `error` for a move that
makes a pool or breaks a number, `success` for the solved puzzle. Generation can take a moment on
10 × 10, so it runs in a Web Worker (`core/puzzleSource`) with one puzzle per mode prepared while
the player browses; the spinner overlay only shows when none is ready.

**2026-11 Slitherlink.** 5 × 5, 7 × 7, 9 × 9 and a daily 7 × 7. The edges between dots are too
thin to be targets, so the board is one large target (like Bridges): a tap goes to the nearest
edge, and a drag from dot to dot draws lines (or erases, if it starts on a line). There is a third
of a cell of margin around the grid so the outer edges are as easy to hit as inner ones.
VoiceOver, Switch Control and keyboards use invisible edge buttons with labels ("Across from dot
at row 1, column 2 to row 1, column 3: line"), and the numbers are listed in a hidden text.
Lines are thick strokes, crosses small × marks. A number with too many lines (or too many crosses)
gets a red ring, a dot where lines branch a big red disc, and a satisfied number fades (a 0 only
once its four sides are crossed, or every 0 would look done at the start). Generated in a worker
like Nurikabe.

**2026-11 Spider daily.** 1 Suit deals and the new Daily Challenge (a 1 Suit deal) are proven
winnable before they are dealt: a best-first solver plays them through knowing every card. Hints
still don't use the solver, so they never give away face-down cards.

**2026-11 Home groups and Favorites.** With 25 games the home screen is grouped: Number Puzzles,
Logic Puzzles, Card Games and Board Games, each with a bold `--fs-title2` heading over the usual
tile grid. Each game declares its `category`; group titles and order live in the shell. A star
button in every game hub's navigation bar (outlined, filled when on, `aria-pressed`, label
"Favorite") pins the game to a Favorites group at the top of the home screen, in the order added.
It's a standard tap, so no custom gesture or tip is needed; while nothing is pinned, a footnote at
the end of the home screen points to the star. No haptic (standard control). Favorites are stored in
`games/app/favorites`; ids of hidden games are kept. The stale "More soon" tile was removed.
