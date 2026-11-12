import { memo } from 'preact/compat';
import { useRef } from 'preact/hooks';
import { useClickEcho } from '../../../ui/game/clickEcho';
import { DOT, NurikabeGame, SEA, nextMark, numberStates, pools } from '../state';

interface Props {
  game: NurikabeGame;
  flash: number | null;
  hidden: boolean;
  won: boolean;
  onTap: (cell: number) => void;
  onPaint: (cells: number[], value: number) => void;
}

export const Board = memo(function Board({ game, flash, hidden, won, onTap, onPaint }: Props) {
  const n = game.n;
  const drag = useRef<{ start: number; cells: number[] } | null>(null);
  const echo = useClickEcho();
  const pool = pools(game);
  const nums = numberStates(game);
  const cellAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-cell]');
    return el ? Number(el.dataset.cell) : null;
  };

  return (
    <div
      class={`nk-board ${hidden ? 'nk-hidden' : ''} ${won ? 'nk-won' : ''}`}
      style={{ '--n': n }}
      role="grid"
      aria-label="Nurikabe board"
      aria-describedby="nk-board-hint"
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
        if (d.cells.length > 1) onPaint(d.cells, nextMark(game.marks[d.start]));
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
      {game.clues.map((v, i) => {
        const r = Math.floor(i / n);
        const c = i % n;
        const where = `Row ${r + 1}, column ${c + 1}`;
        if (v) {
          const st = nums.get(i);
          return (
            <div
              key={i}
              data-cell={i}
              class={`cell nk-num nk-${st}`}
              role="gridcell"
              aria-label={`${where}, island of ${v}${st === 'ok' ? ', done' : st === 'bad' ? ', wrong' : ''}`}
            >
              <span aria-hidden="true">{v}</span>
            </div>
          );
        }
        const m = game.marks[i];
        const inPool = pool.has(i);
        const what = m === SEA ? `shaded${inPool ? ', part of a 2 by 2 pool' : ''}` : m === DOT ? 'island' : 'empty';
        return (
          <div
            key={i}
            data-cell={i}
            class={`cell ${m === SEA ? 'nk-sea' : ''} ${inPool ? 'nk-pool' : ''} ${flash === i ? 'nk-flash' : ''}`}
            role="gridcell"
            aria-label={`${where}, ${what}`}
            style={{ '--d': `${(r + c) * 35}ms` }}
          >
            {m === DOT && <span class="nk-dot" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
});
