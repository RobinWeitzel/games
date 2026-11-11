# Agent instructions

iPhone-first PWA with small offline single-player games (Vite + TypeScript + Preact), hosted on
GitHub Pages without a backend. The goal of every change: **it must feel like a native iOS app**,
and **players must never lose their local data**.

Read before working:
- `docs/ARCHITECTURE.md`: structure and module boundaries
- `docs/DESIGN.md`: **mandatory** iOS design rules (Apple Human Interface Guidelines)
- `docs/STORAGE.md`: **mandatory** rules for anything that is persisted
- `docs/ADDING_A_GAME.md`: step-by-step guide for new games

## Non-negotiable rules

### Native iOS feel (Apple HIG, details in docs/DESIGN.md)
1. **Follow the system.** No app-specific light/dark setting. Use the semantic colour tokens from
   `src/styles/base.css`, never hard-coded greys. Test light *and* dark.
2. **Dynamic Type.** Text uses the `--fs-*` text style tokens (rem). No fixed `px` font sizes in
   shell or shared UI. **Never below 11pt.** Layouts reflow at large text sizes.
3. **44×44pt minimum hit targets** (only the exceptions listed in `scripts/ios-audit.mjs`).
   Enlarge hit areas rather than visuals. 8–12pt between bezelled buttons.
4. **Standard patterns only:** `Screen` (large title on top-level screens, inline title on detail
   screens, back label = previous title, edge swipe-back), inset-grouped `Section`/`Row` lists,
   the native switch `Toggle` inside list rows only, `Segmented` with ≤ 5 text segments, action
   `Sheet`s with the destructive option first plus Cancel. Never `alert()`/`confirm()`, never a
   dialog at launch.
5. **Thumb reach:** game controls in the bottom half. Game screens fit **without scrolling** on
   iPhone SE (375×667pt) in portrait.
6. **Contrast ≥ 4.5:1** (compute it for custom colours), and **never colour alone** to carry meaning.
7. **Haptics only for game events:** `selection` = move accepted, `success` = something
   completed or won, `error` = mistake or lost. Never on navigation or standard controls. Only
   `src/games/` calls `haptic()`.
8. **Motion with a purpose,** and respect Reduce Motion. No decorative or looping animation.
9. **Restore state:** game screens call `useRestorable(GAME_ID, 'resume')`, start paused when
   restored, save on every move and on backgrounding (`useGameClock` `onSuspend`).
10. **Accessible:** labels on icon buttons, state in labels (e.g. "incorrect"), click activation
    for VoiceOver/Switch Control, a hidden table for charts.
11. **Launch images stay plain** (no logo or text). Portrait-only is an intentional product decision.

### Data safety (details in docs/STORAGE.md)
- Before changing anything persisted (`defineStore`, `createGameSettings`, `createGameStats`, game
  ids, mode ids, key names): bump the version, add a migration, add a test with literal old data, and
  update `src/core/storage/contract.test.ts`. Never delete player data. Hide, don't delete.

### Code structure
- Respect the module boundaries (`src/architecture.test.ts`): games never import `app/`, the
  registry, or other games. Shared things go to `core/` (logic) or `ui/` (components).

## Before committing

```sh
npm test            # unit, storage contract, architecture, design lint
npm run audit:ios   # HIG audit on rendered screens (needs Playwright + Chromium)
```

For UI changes, also go through the review checklist in `docs/DESIGN.md`.
