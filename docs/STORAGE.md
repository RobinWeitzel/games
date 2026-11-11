# Storage: how player data is kept safe across updates

Everything players have (games in progress, statistics, streaks, settings) lives **only in their
browser's `localStorage`**. There is no server copy. A bad update that loses or corrupts this data
cannot be undone, so the storage system is built around one promise:

> **An update may never lose a player's data.** Data written by any earlier release must be readable
> by every later release.

This document explains how that's enforced and what to do when you change stored data.

## Key layout

All keys start with `games/`. They are built with the helpers in `src/core/storage/keys.ts`:
never write key strings by hand.

| Key | Helper | Contents | In backups |
|---|---|---|---|
| `games/meta` | n/a | `{ "layout": 2 }`: layout version of everything below | n/a |
| `games/app/<name>` | `appKey(name)` | App-wide data, e.g. `games/app/settings` | yes |
| `games/game/<gameId>/<name>` | `gameKey(id, name)` | Data owned by one game: `save`, `stats`, `daily`, `settings`, … | yes |
| `games/cache/<gameId>/<name>` | `cacheKey(id, name)` | Disposable data (pre-generated puzzles). Safe to delete any time | no |
| `games/backup/<name>` | n/a | Automatic safety copies taken before migrations and imports | no |

Rules:

- **A game only touches its own namespace** (`games/game/<its id>/…`, `games/cache/<its id>/…`).
- **Game ids and key names are permanent.** They are lowercase letters, digits and dashes
  (validated at runtime). Renaming a game id or a key orphans the data, so it needs a migration.
- **Mode ids are stored too** (e.g. difficulty `"hard"` in stats). Labels can change freely;
  ids cannot.

## Two levels of versioning

### 1. Per-key schema version (the common case)

Every value is stored in an envelope:

```json
{ "v": 1, "data": { "...": "..." } }
```

Stores are declared with `defineStore`:

```ts
export const savedGame = defineStore<SudokuGame | null>({
  key: gameKey(GAME_ID, 'save'),
  version: 1,          // schema version of `data`
  initial: null,       // used when nothing is stored yet
  migrations: {},      // migrations[n]: data at v{n} → data at v{n+1}
  normalize: (d) => d, // optional: fill defaults after loading
});
```

When a store loads:

1. Nothing stored: it uses `initial`.
2. `v` is lower than `version`: it runs `migrations[v]`, `migrations[v+1]` and so on, up to the
   current version, then writes the upgraded value back.
3. `v` is higher than `version` (written by a newer release, e.g. while an old service worker is
   still cached): the value is **left untouched**, and the app goes **read-only** (see below).
4. The data can't be read, or a migration throws: a copy is kept at
   `games/backup/unreadable/<key>`, the original is left untouched, and the app goes read-only.

### 2. Layout version (rare)

`games/meta.layout` describes the *overall key structure*. A layout migration is needed only when
keys are **moved, renamed, split or merged**. Layout migrations live in
`src/core/storage/layout.ts` and run **once at startup, before any store is read**
(`initStorage()` in `main.tsx`).

| Layout | Release | Structure |
|---|---|---|
| 1 | first release | flat `games:v1:<name>` keys, raw JSON, one shared `stats` and `daily` blob for all games |
| 2 | current | namespaced per-game keys with versioned envelopes (table above) |

Safety net:
- A full copy of the old data is written to `games/backup/layout-<from>` before migrating.
- If any step throws, everything is restored exactly as it was and the app runs read-only for
  that session. A buggy migration can therefore never destroy data, and the fix can ship in the
  next update.

### Read-only mode

When the app can't safely write, `enterReadOnly()` is triggered. The app keeps working in memory
but **never overwrites stored data**, and a banner says "Progress isn't being saved". This is the
fallback for every situation we can't handle: losing one session's progress is acceptable, but
destroying saved data is not.

## Changing stored data: decision table

| You want to… | Do this |
|---|---|
| Add a new optional field / setting | Add it with a default. Use `normalize` (settings already merge defaults). **No version bump.** |
| Add a new key | Declare it in the game's `storage.ts`, add it to the contract list. |
| Rename a field, change a type, restructure a value | Bump that store's `version` and add `migrations[old]`. Add a test with a stored old value. |
| Move / rename / split / merge keys | Add a layout migration, bump `CURRENT_LAYOUT`, add a fixture test (see `layout.test.ts`). |
| Change a cache's format | Bump the cache's version number: old caches are simply ignored. |
| Remove a game or a key | **Don't delete the data.** Hide the game (remove it from the registry). Its data stays and is still exported in backups. |
| Rename a game id or a mode id | Treat it as a key move: layout migration (game id) or store migration (mode id). |

### Writing migrations

- **Migrations are frozen.** Once released, a migration describes what data looked like *at that
  time*. Don't import current types into it; copy the shapes you need.
- **Pure and defensive:** `(oldData) => newData`. Expect missing fields and old garbage.
- **One step per version:** `migrations[1]` goes from v1 to v2, `migrations[2]` from v2 to v3.
  Never edit a released step; add a new one.
- **Test it** with a literal stored value from the old release (see
  `src/test/fixtures/layout1.ts` and `src/core/storage/layout.test.ts`).

Example: in a later release, Sudoku's save renames `hints` to `assists`:

```ts
export const savedGame = defineStore<SudokuGame | null>({
  key: gameKey(GAME_ID, 'save'),
  version: 2,
  initial: null,
  migrations: {
    1: (g) => (g ? { ...g, assists: g.hints ?? 0, hints: undefined } : g),
  },
});
```

## The storage contract test

`src/core/storage/contract.test.ts` loads every game's `storage.ts` and compares the full list of
declared keys and versions with a committed list. **If you change any key or version, this test
fails** until you update the list. That's on purpose: it makes every change to persisted data an
explicit decision, and a reminder to add the migration that goes with it.

## Backups

Settings → Data → Export creates a JSON file (format 2) containing `games/meta.layout` and the raw
stored value of every data key. Caches and safety copies are left out. Import:

1. validates the file (and refuses backups from a *newer* layout)
2. saves the current data to `games/backup/before-import`
3. replaces all data keys with the backup's values
4. runs the normal layout migrations, then reloads the app, so every store migrates its own keys.

So **a backup from any older release can be restored into any newer one.** Backups from the first
release (`{ app, version: 1, data }`) are supported too.

## Checklist before shipping a change that touches storage

- [ ] `npm test` passes, including the storage contract test
- [ ] Every changed store has a version bump and a migration, or the change is purely additive
- [ ] Every migration has a test that starts from a literal old value
- [ ] No key, game id or mode id was renamed without a migration
- [ ] No data was deleted (hide, don't delete)
