# Project notes for Claude

iPhone-first PWA with small offline puzzle games (Vite + TypeScript + Preact), hosted on GitHub Pages.

- Read `docs/ARCHITECTURE.md` first. New games follow `docs/ADDING_A_GAME.md`.
- **Player data must never be lost.** Before changing anything persisted (any `defineStore`,
  `createGameSettings`, `createGameStats`, game ids, mode ids, key names) follow `docs/STORAGE.md`:
  bump the version + add a migration + add a test with literal old data, then update
  `src/core/storage/contract.test.ts`.
- Respect the module boundaries (`src/architecture.test.ts`): games never import `app/`, the registry or other games.
- Before committing: `npm test && npm run build`.
