import { memo } from 'preact/compat';
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useClickEcho } from '../../../ui/game/clickEcho';
import type { Clues } from '../solver';
import { CROSS, FILL, NonogramGame, applyStroke, satisfiedLines, strokeCells, strokeValue } from '../state';

interface Props {
  game: NonogramGame;
  clues: Clues;
  hidden: boolean;
  /** Cell to outline (the last hint). */
  hinted: number | null;
  /** A finished stroke (a tap is a stroke of one cell). Called on pointerup / click, so haptics work. */
  onStroke: (cells: number[], value: number) => void;
}

/** Board metrics in px, computed from the space available (the board never scrolls). */
interface Metrics {
  cell: number;
  font: number;
  clueW: number;
  clueH: number;
}

/** Width of one row clue line ("2 10 1") in em: tabular digits ≈ 0.62em, ≈ 0.45em between numbers. */
const lineEm = (clue: number[]) => (clue.length ? clue.reduce((w, n) => w + String(n).length * 0.62 + 0.45, 0) : 1.07);

/**
 * The largest cell size for which clues plus grid fit the area. Clue text scales with the cell,
 * but never below 11pt (HIG minimum) and capped so 5×5 doesn't get huge numbers.
 */
export function fitBoard(w: number, h: number, rows: number, cols: number, clues: Clues): Metrics {
  const rowEm = Math.max(...clues.rows.map(lineEm));
  const colLines = Math.max(1, ...clues.cols.map((c) => c.length));
  let cell = 40;
  let m: Metrics = { cell, font: 11, clueW: 0, clueH: 0 };
  for (let i = 0; i < 6; i++) {
    const font = Math.min(20, Math.max(11, cell * 0.5));
    const clueW = Math.ceil(rowEm * font + 8);
    const clueH = Math.ceil(colLines * font * 1.15 + 6);
    cell = Math.max(8, Math.min(60, Math.floor(Math.min((w - clueW - 4) / cols, (h - clueH - 4) / rows))));
    m = { cell, font, clueW, clueH };
  }
  return m;
}

export const Board = memo(function Board({ game, clues, hidden, hinted, onStroke }: Props) {
  const areaRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const echo = useClickEcho();

  // The board fits the area left over by the status line and tools, and follows rotations and
  // text size changes.
  useLayoutEffect(() => {
    const el = areaRef.current!;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** The stroke being drawn: shown live, committed when the finger lifts. */
  const [stroke, setStroke] = useState<{ cells: number[]; value: number } | null>(null);
  const press = useRef<{ start: number; value: number; axis: 'row' | 'col' | null; cells: number[] } | null>(null);

  const metrics = useMemo(() => (size ? fitBoard(size.w, size.h, game.rows, game.cols, clues) : null), [size, game.rows, game.cols, clues]);
  const cells = stroke ? applyStroke(game, stroke.cells, stroke.value) : game.cells;
  const done = useMemo(() => satisfiedLines({ ...game, cells }, clues), [cells, clues]);
  const finished = game.status !== 'playing';

  /** The cell under a point, clamped to the grid (so a drag past the edge stops at the edge). */
  const cellAt = (x: number, y: number) => {
    const r = gridRef.current!.getBoundingClientRect();
    const cx = Math.min(game.cols - 1, Math.max(0, Math.floor(((x - r.left) / r.width) * game.cols)));
    const cy = Math.min(game.rows - 1, Math.max(0, Math.floor(((y - r.top) / r.height) * game.rows)));
    return cy * game.cols + cx;
  };

  const highlight = press.current && stroke ? stroke.cells[stroke.cells.length - 1] : null;
  const hy = highlight != null ? Math.floor(highlight / game.cols) : -1;
  const hx = highlight != null ? highlight % game.cols : -1;

  const state = (s: number) => (s === FILL ? 'filled' : s === CROSS ? 'crossed out' : 'empty');

  return (
    <div class="ng-area" ref={areaRef}>
      {metrics && (
        <div
          class={`ng-board ${hidden ? 'ng-hidden' : ''} ${finished ? 'ng-won' : ''}`}
          style={{
            '--cell': `${metrics.cell}px`,
            '--clue-fs': `${metrics.font}px`,
            gridTemplateColumns: `${metrics.clueW}px ${metrics.cell * game.cols + 4}px`,
            gridTemplateRows: `${metrics.clueH}px ${metrics.cell * game.rows + 4}px`,
          }}
        >
          <div class="ng-corner" />
          <div class="ng-col-clues" aria-hidden={hidden}>
            {clues.cols.map((c, x) => (
              <div
                key={x}
                class={`ng-clue ng-col-clue ${done.cols[x] ? 'ng-done' : ''} ${x === hx ? 'ng-active' : ''}`}
                aria-label={`Column ${x + 1}: ${c.length ? c.join(' ') : '0'}${done.cols[x] ? ', done' : ''}`}
              >
                {(c.length ? c : [0]).map((n, i) => (
                  <span key={i}>{n}</span>
                ))}
              </div>
            ))}
          </div>
          <div class="ng-row-clues" aria-hidden={hidden}>
            {clues.rows.map((c, y) => (
              <div
                key={y}
                class={`ng-clue ng-row-clue ${done.rows[y] ? 'ng-done' : ''} ${y === hy ? 'ng-active' : ''}`}
                aria-label={`Row ${y + 1}: ${c.length ? c.join(' ') : '0'}${done.rows[y] ? ', done' : ''}`}
              >
                {(c.length ? c : [0]).map((n, i) => (
                  <span key={i}>{n}</span>
                ))}
              </div>
            ))}
          </div>
          <div
            ref={gridRef}
            class="ng-grid"
            style={{ gridTemplateColumns: `repeat(${game.cols}, var(--cell))` }}
            role="grid"
            aria-label="Picture"
            aria-describedby="ng-drag-hint"
            onPointerDown={(e) => {
              if (!e.isPrimary || finished || hidden) return;
              const start = cellAt(e.clientX, e.clientY);
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              const value = strokeValue(game, start);
              press.current = { start, value, axis: null, cells: [start] };
              setStroke({ cells: [start], value });
            }}
            onPointerMove={(e) => {
              const p = press.current;
              if (!p) return;
              const at = cellAt(e.clientX, e.clientY);
              if (at === p.cells[p.cells.length - 1] && p.axis) return;
              if (!p.axis) {
                if (at === p.start) return;
                // The first move decides: a stroke stays in its row or column.
                const dx = Math.abs((at % game.cols) - (p.start % game.cols));
                const dy = Math.abs(Math.floor(at / game.cols) - Math.floor(p.start / game.cols));
                p.axis = dx >= dy ? 'row' : 'col';
              }
              p.cells = strokeCells(game, p.start, at, p.axis);
              setStroke({ cells: p.cells, value: p.value });
            }}
            onPointerUp={() => {
              const p = press.current;
              press.current = null;
              setStroke(null);
              echo.touched();
              if (p) onStroke(p.cells, p.value);
            }}
            onPointerCancel={() => {
              press.current = null;
              setStroke(null);
              echo.touched();
            }}
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => {
              // VoiceOver, Switch Control and keyboards (touches were handled on pointerup).
              if (echo.isEcho(e) || finished || hidden) return;
              const t = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]');
              if (!t) return;
              const cell = Number(t.dataset.cell);
              onStroke([cell], strokeValue(game, cell));
            }}
          >
            {cells.map((s, i) => {
              const y = Math.floor(i / game.cols);
              const x = i % game.cols;
              const cls = [
                'ng-cell',
                s === FILL ? 'ng-fill' : s === CROSS ? 'ng-cross' : '',
                (x + 1) % 5 === 0 && x + 1 < game.cols ? 'ng-x5' : '',
                (y + 1) % 5 === 0 && y + 1 < game.rows ? 'ng-y5' : '',
                hinted === i ? 'ng-hinted' : '',
              ].join(' ');
              return (
                <div key={i} data-cell={i} class={cls} role="gridcell" aria-label={`Row ${y + 1}, column ${x + 1}, ${state(s)}`}>
                  {s === CROSS && (
                    <svg viewBox="0 0 10 10" aria-hidden="true">
                      <path d="M2 2l6 6M8 2 2 8" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
