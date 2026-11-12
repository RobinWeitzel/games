import { memo } from 'preact/compat';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useClickEcho } from '../../../ui/game/clickEcho';
import { BOARDS } from '../engine';
import { Jump, PegGame, targets } from '../state';

interface Props {
  game: PegGame;
  hidden: boolean;
  hint: Jump | null;
  shake: number | null;
  onTap: (hole: number) => void;
  onJump: (from: number, to: number) => void;
}

const SLOP = 10;

export const Board = memo(function Board({ game, hidden, hint, shake, onTap, onJump }: Props) {
  const b = BOARDS[game.mode];
  const area = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const press = useRef<{ hole: number; x: number; y: number; moved: boolean } | null>(null);
  const [drag, setDrag] = useState<{ hole: number; dx: number; dy: number } | null>(null);
  const echo = useClickEcho();

  useLayoutEffect(() => {
    const el = area.current!;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // English: a square grid. Triangle: half-step columns and rows √3 apart (equilateral).
  const tri = b.id === 'triangle';
  const dy = tri ? Math.sqrt(3) : 1;
  const unit = Math.min(size.w / (b.cols + (tri ? 1 : 0)), size.h / ((b.rows - 1) * dy + (tri ? 2 : 1)));
  const cellW = tri ? 2 * unit : unit;
  const cellH = tri ? dy * unit : unit;
  const width = tri ? (b.cols + 1) * unit : b.cols * unit;
  const height = tri ? (b.rows - 1) * dy * unit + 2 * unit : b.rows * unit;
  const ox = (size.w - width) / 2;
  const oy = (size.h - height) / 2;
  const cx = (c: number) => ox + (tri ? (c + 1) * unit : (c + 0.5) * unit);
  const cy = (r: number) => oy + (tri ? r * dy * unit + unit : (r + 0.5) * unit);
  const hole = tri ? unit * 1.5 : unit * 0.78;
  const can = new Set(targets(game));

  const holeAt = (x: number, y: number) => {
    const r = area.current!.getBoundingClientRect();
    let best = -1;
    let bestD = Infinity;
    b.holes.forEach((h, i) => {
      const d = Math.hypot(cx(h.c) - (x - r.left), cy(h.r) - (y - r.top));
      if (d < bestD) (best = i), (bestD = d);
    });
    return bestD < Math.max(cellW, cellH) * 0.7 ? best : null;
  };

  return (
    <div
      ref={area}
      class={`pg-board ${hidden ? 'pg-hidden' : ''}`}
      style={{ '--hole': `${hole}px` }}
      role="group"
      aria-label="Peg solitaire board"
      aria-describedby="pg-board-hint"
      onPointerDown={(e) => {
        if (!e.isPrimary || hidden) return;
        const h = holeAt(e.clientX, e.clientY);
        if (h == null) return;
        press.current = { hole: h, x: e.clientX, y: e.clientY, moved: false };
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (!p || !game.pegs[p.hole]) return;
        const dx = e.clientX - p.x;
        const ddy = e.clientY - p.y;
        if (!p.moved && Math.hypot(dx, ddy) <= SLOP) return;
        p.moved = true;
        setDrag({ hole: p.hole, dx, dy: ddy });
      }}
      onPointerUp={(e) => {
        const p = press.current;
        press.current = null;
        setDrag(null);
        echo.touched();
        if (!p) return;
        if (p.moved) {
          const to = holeAt(e.clientX, e.clientY);
          if (to != null && to !== p.hole) onJump(p.hole, to);
        } else onTap(p.hole);
      }}
      onPointerCancel={() => {
        press.current = null;
        setDrag(null);
        echo.touched();
      }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (echo.isEcho(e)) return;
        const t = (e.target as HTMLElement).closest<HTMLElement>('[data-hole]');
        if (t) onTap(Number(t.dataset.hole));
      }}
    >
      {size.w > 0 &&
        b.holes.map((h, i) => {
          const peg = game.pegs[i];
          const selected = game.selected === i;
          const target = can.has(i);
          const hinted = hint && (hint[0] === i || hint[2] === i);
          const dragged = drag?.hole === i;
          const label = `Row ${h.r + 1}, ${tri ? `hole ${b.holes.filter((o) => o.r === h.r && o.c < h.c).length + 1}` : `column ${h.c + 1}`}: ${
            peg ? (selected ? 'peg, picked up' : 'peg') : target ? 'empty, can jump here' : 'empty'
          }`;
          return (
            <button
              key={i}
              class={`pg-hole ${peg ? 'pg-peg' : ''} ${selected ? 'pg-selected' : ''} ${target ? 'pg-target' : ''} ${hinted ? 'pg-hint' : ''} ${shake === i ? 'pg-shake' : ''} ${b.center === i ? 'pg-center' : ''}`}
              style={{ left: `${cx(h.c) - cellW / 2}px`, top: `${cy(h.r) - cellH / 2}px`, width: `${cellW}px`, height: `${cellH}px` }}
              data-hole={i}
              aria-label={label}
            >
              <span class="pg-dot" style={dragged ? { transform: `translate(${drag!.dx}px, ${drag!.dy}px)`, zIndex: 5 } : undefined} />
            </button>
          );
        })}
    </div>
  );
});
