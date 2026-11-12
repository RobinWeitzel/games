import { memo } from 'preact/compat';
import { useRef } from 'preact/hooks';
import { useClickEcho } from '../../../ui/game/clickEcho';
import { isBlack } from '../engine';
import { BULB, DOT, LightUpGame, clashes, litCells, numberStates } from '../state';

interface Props {
  game: LightUpGame;
  flash: number | null;
  hidden: boolean;
  won: boolean;
  onTap: (cell: number) => void;
  onDot: (cells: number[]) => void;
}

const Bulb = () => (
  <svg class="lu-bulb" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.5a6.5 6.5 0 0 0-3.9 11.7c.6.5.9 1.1.9 1.8V17h6v-1c0-.7.3-1.3.9-1.8A6.5 6.5 0 0 0 12 2.5Z" />
    <path d="M9.5 19.5h5M10.5 21.5h3" fill="none" stroke-width="1.8" stroke-linecap="round" />
  </svg>
);

export const Board = memo(function Board({ game, flash, hidden, won, onTap, onDot }: Props) {
  const n = game.n;
  const drag = useRef<{ start: number; cells: number[] } | null>(null);
  const echo = useClickEcho();
  const lit = litCells(game);
  const bad = clashes(game);
  const nums = numberStates(game);
  const cellAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-cell]');
    return el ? Number(el.dataset.cell) : null;
  };

  return (
    <div
      class={`lu-board ${hidden ? 'lu-hidden' : ''} ${won ? 'lu-won' : ''}`}
      style={{ '--n': n }}
      role="grid"
      aria-label="Light Up board"
      aria-describedby="lu-board-hint"
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
        if (d.cells.length > 1) onDot(d.cells);
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
      {game.cells.map((v, i) => {
        const r = Math.floor(i / n);
        const c = i % n;
        const where = `Row ${r + 1}, column ${c + 1}`;
        if (isBlack(v)) {
          const st = nums.get(i);
          return (
            <div
              key={i}
              class={`cell lu-wall ${st ? `lu-${st}` : ''}`}
              role="gridcell"
              aria-label={`${where}, black${v >= 0 ? `, needs ${v} bulb${v === 1 ? '' : 's'}${st === 'ok' ? ', done' : st === 'over' ? ', too many' : ''}` : ''}`}
            >
              {v >= 0 && (
                <span class="lu-num" aria-hidden="true">
                  {v}
                </span>
              )}
            </div>
          );
        }
        const m = game.marks[i];
        const clash = m === BULB && bad.has(i);
        const what = m === BULB ? (clash ? 'bulb, lit by another bulb' : 'bulb') : m === DOT ? 'marked no bulb' : 'empty';
        return (
          <div
            key={i}
            data-cell={i}
            class={`cell lu-white ${lit.has(i) ? 'lu-lit' : ''} ${flash === i ? 'lu-flash' : ''}`}
            role="gridcell"
            aria-label={`${where}, ${what}${lit.has(i) ? ', lit' : ', dark'}`}
            style={{ '--d': `${(r + c) * 35}ms` }}
          >
            {m === BULB ? (
              <span class={`lu-mark ${clash ? 'lu-clash' : ''}`}>
                <Bulb />
              </span>
            ) : m === DOT ? (
              <span class="lu-dot" aria-hidden="true" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
});
