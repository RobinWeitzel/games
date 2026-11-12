import { memo } from 'preact/compat';
import { useMemo, useRef } from 'preact/hooks';
import { useClickEcho } from '../../../ui/game/clickEcho';
import { CROSS, STAR, StarBattleGame, conflictReason } from '../state';

interface Props {
  game: StarBattleGame;
  conflicts: Set<number>;
  /** A cell just set by a hint (it pops). */
  flash: number | null;
  hidden: boolean;
  won: boolean;
  onTap: (cell: number) => void;
  onCross: (cells: number[]) => void;
}

/** A tint for every region, never the same as a neighbouring region's (greedy map colouring). */
function regionTints(n: number, regions: number[]): number[] {
  const near: Set<number>[] = Array.from({ length: n }, () => new Set());
  regions.forEach((g, i) => {
    const right = i % n < n - 1 ? regions[i + 1] : g;
    const below = i + n < regions.length ? regions[i + n] : g;
    for (const h of [right, below]) if (h !== g) near[g].add(h), near[h].add(g);
  });
  const tint = new Array<number>(n).fill(-1);
  for (let g = 0; g < n; g++) {
    const used = new Set([...near[g]].map((h) => tint[h]));
    // Start from the region's own number so tints spread over the whole palette.
    for (let k = 0; k < 10; k++) {
      const t = (g + k) % 10;
      if (!used.has(t)) {
        tint[g] = t;
        break;
      }
    }
  }
  return tint;
}

export const Board = memo(function Board({ game, conflicts, flash, hidden, won, onTap, onCross }: Props) {
  const n = game.n;
  const drag = useRef<{ start: number; cells: number[] } | null>(null);
  const tints = useMemo(() => regionTints(n, game.regions), [game.regions]);
  const echo = useClickEcho();
  const cellAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-cell]');
    return el ? Number(el.dataset.cell) : null;
  };

  return (
    <div
      class={`sb-board ${hidden ? 'sb-hidden' : ''} ${won ? 'sb-won' : ''}`}
      style={{ '--n': n }}
      role="grid"
      aria-label="Star Battle board"
      aria-describedby="sb-board-hint"
      onPointerDown={(e) => {
        if (!e.isPrimary || hidden) return;
        const c = cellAt(e.clientX, e.clientY);
        if (c == null) return;
        drag.current = { start: c, cells: [c] };
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const c = cellAt(e.clientX, e.clientY);
        if (c != null && !d.cells.includes(c)) d.cells.push(c);
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        echo.touched();
        if (!d) return;
        if (d.cells.length > 1) onCross(d.cells);
        else onTap(d.start);
      }}
      onPointerCancel={() => {
        drag.current = null;
        echo.touched();
      }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (echo.isEcho(e)) return;
        const t = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]');
        if (t) onTap(Number(t.dataset.cell));
      }}
    >
      {game.marks.map((m, i) => {
        const r = Math.floor(i / n);
        const c = i % n;
        const g = game.regions[i];
        const bad = m === STAR && conflicts.has(i);
        const cls = [
          'cell',
          `sb-g${tints[g]}`,
          c < n - 1 && game.regions[i + 1] !== g ? 'sb-r' : '',
          r < n - 1 && game.regions[i + n] !== g ? 'sb-b' : '',
          flash === i ? 'sb-flash' : '',
        ].join(' ');
        const what = m === STAR ? (bad ? `star, conflict: ${conflictReason(game, i)}` : 'star') : m === CROSS ? 'crossed out' : 'empty';
        return (
          <div
            key={i}
            data-cell={i}
            class={cls}
            role="gridcell"
            aria-label={`Row ${r + 1}, column ${c + 1}, region ${g + 1}, ${what}`}
            style={{ '--d': `${(r + c) * 35}ms` }}
          >
            {m === STAR ? (
              <span class={`sb-star ${bad ? 'sb-bad' : ''}`} aria-hidden="true">
                ★
              </span>
            ) : m === CROSS ? (
              <span class="sb-cross" aria-hidden="true">
                ×
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
});
