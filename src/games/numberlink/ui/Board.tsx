import { memo } from 'preact/compat';
import { useRef, useState } from 'preact/hooks';
import { useClickEcho } from '../../../ui/game/clickEcho';
import { NumberlinkGame, endpointOf, extend, isJoined, owners, startAt } from '../state';

interface Props {
  game: NumberlinkGame;
  hidden: boolean;
  won: boolean;
  flash: number | null;
  /** New paths after a drag or tap. */
  onCommit: (paths: number[][]) => void;
}

/**
 * Pair colours. Endpoint numbers are white on these (all ≥ 4.5:1); the number, not the colour,
 * says which endpoints belong together.
 */
export const COLORS = ['#d70015', '#b25000', '#7a6400', '#1a7f37', '#00727a', '#0060c7', '#5b3fc4', '#9a2eb2', '#b0236a', '#6b4e2e', '#3f6212', '#4b5563', '#8a3b00', '#005f99'];

/** Movement before a press becomes a drag. */
const SLOP = 6;

export const Board = memo(function Board({ game, hidden, won, flash, onCommit }: Props) {
  const n = game.n;
  const ref = useRef<HTMLDivElement>(null);
  const echo = useClickEcho();
  const [draft, setDraftState] = useState<{ paths: number[][]; pair: number } | null>(null);
  // Pointer events can come faster than renders: keep the latest draft in a ref too.
  const draftRef = useRef(draft);
  const setDraft = (d: { paths: number[][]; pair: number } | null) => {
    draftRef.current = d;
    setDraftState(d);
  };
  const press = useRef<{ x: number; y: number; cell: number; moved: boolean } | null>(null);
  /** The pair a tap extends (VoiceOver, Switch Control and plain taps). */
  const active = useRef<number | null>(null);
  const paths = draft?.paths ?? game.paths;
  const own = owners(n, game.ends, paths);

  const cellAt = (x: number, y: number) => {
    const b = ref.current!.getBoundingClientRect();
    const c = Math.floor(((x - b.left) / b.width) * n);
    const r = Math.floor(((y - b.top) / b.height) * n);
    return r >= 0 && r < n && c >= 0 && c < n ? r * n + c : null;
  };

  /** Walk the draft's head towards `cell`, one neighbouring cell at a time. */
  const walkTo = (d: { paths: number[][]; pair: number }, cell: number) => {
    let cur = d.paths;
    for (let guard = 0; guard < 2 * n; guard++) {
      const p = cur[d.pair];
      const head = p[p.length - 1];
      if (head === cell) break;
      const dr = Math.floor(cell / n) - Math.floor(head / n);
      const dc = (cell % n) - (head % n);
      const step = Math.abs(dr) >= Math.abs(dc) ? head + Math.sign(dr) * n : head + Math.sign(dc);
      const next = extend(n, game.ends, cur, d.pair, step);
      if (!next) break;
      cur = next;
    }
    return cur;
  };

  /** A tap (also VoiceOver activation) on a cell. */
  const tap = (cell: number) => {
    const e = endpointOf(game.ends, cell);
    const k = active.current;
    if (e < 0 && k != null) {
      const next = extend(n, game.ends, game.paths, k, cell);
      if (next) return onCommit(next);
    }
    if (e >= 0) {
      active.current = e;
      const p = game.paths[e];
      // Tapping the endpoint a path starts from (or ends at) keeps it; the other starts afresh.
      if (p.length && (p[0] === cell || p[p.length - 1] === cell)) {
        if (p[0] !== cell) onCommit(game.paths.map((q, m) => (m === e ? q.slice().reverse() : q)));
        return;
      }
      return onCommit(game.paths.map((q, m) => (m === e ? [cell] : q)));
    }
    const s = startAt(n, game.ends, game.paths, cell);
    if (s) {
      active.current = s.pair;
      onCommit(s.paths);
    }
  };

  const cx = (i: number) => (i % n) + 0.5;
  const cy = (i: number) => Math.floor(i / n) + 0.5;

  return (
    <div
      ref={ref}
      class={`nl-board ${hidden ? 'nl-hidden' : ''} ${won ? 'nl-won' : ''}`}
      style={{ '--n': n }}
      role="grid"
      aria-label="Numberlink board"
      aria-describedby="nl-board-hint"
      onPointerDown={(e) => {
        if (!e.isPrimary || hidden) return;
        const cell = cellAt(e.clientX, e.clientY);
        if (cell == null) return;
        press.current = { x: e.clientX, y: e.clientY, cell, moved: false };
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (!p) return;
        if (!p.moved) {
          if (Math.hypot(e.clientX - p.x, e.clientY - p.y) <= SLOP) return;
          const s = startAt(n, game.ends, game.paths, p.cell);
          if (!s) {
            press.current = null;
            return;
          }
          p.moved = true;
          active.current = s.pair;
          setDraft(s);
          return;
        }
        const cell = cellAt(e.clientX, e.clientY);
        const d = draftRef.current;
        if (cell == null || !d) return;
        const next = walkTo(d, cell);
        if (next !== d.paths) setDraft({ paths: next, pair: d.pair });
      }}
      onPointerUp={() => {
        const p = press.current;
        press.current = null;
        echo.touched();
        if (!p) return;
        const d = draftRef.current;
        if (p.moved && d) {
          setDraft(null);
          onCommit(d.paths);
        } else if (!p.moved) tap(p.cell);
      }}
      onPointerCancel={() => {
        press.current = null;
        setDraft(null);
        echo.touched();
      }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (echo.isEcho(e)) return;
        const t = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]');
        if (t) tap(Number(t.dataset.cell));
      }}
    >
      {own.map((o, i) => {
        const r = Math.floor(i / n);
        const c = i % n;
        const e = endpointOf(game.ends, i);
        const what = e >= 0 ? `endpoint ${e + 1}${isJoined({ ends: game.ends, paths }, e) ? ', joined' : ''}` : o >= 0 ? `path ${o + 1}` : 'empty';
        return (
          <div
            key={i}
            data-cell={i}
            class={`cell ${o >= 0 ? 'nl-used' : ''}`}
            style={o >= 0 ? { '--c': COLORS[o % COLORS.length] } : undefined}
            role="gridcell"
            aria-label={`Row ${r + 1}, column ${c + 1}, ${what}`}
          />
        );
      })}
      <svg class="nl-lines" viewBox={`0 0 ${n} ${n}`} aria-hidden="true">
        {paths.map((p, k) =>
          p.length > 1 ? (
            <polyline
              key={k}
              class={`nl-line ${flash === k ? 'nl-flash' : ''}`}
              style={{ '--c': COLORS[k % COLORS.length] }}
              points={p.map((i) => `${cx(i)},${cy(i)}`).join(' ')}
            />
          ) : null,
        )}
      </svg>
      {game.ends.map(([a, b], k) =>
        [a, b].map((i) => (
          <span
            key={`${k}-${i}`}
            class={`nl-end ${isJoined({ ends: game.ends, paths }, k) ? 'nl-joined' : ''}`}
            style={{ '--c': COLORS[k % COLORS.length], left: `${((i % n) / n) * 100}%`, top: `${(Math.floor(i / n) / n) * 100}%` }}
            aria-hidden="true"
          >
            <span>{k + 1}</span>
          </span>
        )),
      )}
    </div>
  );
});
