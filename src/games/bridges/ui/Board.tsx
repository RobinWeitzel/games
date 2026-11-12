import { memo } from 'preact/compat';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useClickEcho } from '../../../ui/game/clickEcho';
import { isHorizontal } from '../engine';
import { BridgesGame, bridgeCounts, edgeFrom } from '../state';

interface Props {
  game: BridgesGame;
  hidden: boolean;
  /** An edge to point out (just changed by a hint, or blocked). */
  flash: number | null;
  /** An edge whose bridge couldn't be built (it shakes). */
  shake: number | null;
  onCycle: (edge: number) => void;
  /** A tap that hit no edge (on an island, or far from any): the screen explains what to do. */
  onMiss: () => void;
}

/** Movement before a press on an island becomes a drag. */
const SLOP = 10;

export const Board = memo(function Board({ game, hidden, flash, shake, onCycle, onMiss }: Props) {
  const area = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const press = useRef<{ x: number; y: number; island: number | null } | null>(null);
  const echo = useClickEcho();

  useLayoutEffect(() => {
    const el = area.current!;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const s = Math.floor(Math.min(size.w / game.w, size.h / game.h));
  const left = Math.floor((size.w - s * game.w) / 2);
  const top = Math.floor((size.h - s * game.h) / 2);
  const cx = (c: number) => left + (c + 0.5) * s;
  const cy = (r: number) => top + (r + 0.5) * s;
  const rad = s * 0.42;
  const counts = bridgeCounts(game);

  /** Board coordinates of a pointer event. */
  const local = (e: PointerEvent) => {
    const b = area.current!.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  const islandAt = (x: number, y: number) => {
    const i = game.islands.findIndex((isl) => Math.hypot(cx(isl.c) - x, cy(isl.r) - y) < s * 0.5);
    return i >= 0 ? i : null;
  };
  /** The edge whose line passes closest to the point (within half a cell), between its islands. */
  const edgeAt = (x: number, y: number) => {
    let best: number | null = null;
    let bestD = s * 0.5;
    game.edges.forEach((e, k) => {
      const A = game.islands[e.a];
      const B = game.islands[e.b];
      const h = isHorizontal(game.islands, e);
      const along = h ? x : y;
      const lo = h ? Math.min(cx(A.c), cx(B.c)) : Math.min(cy(A.r), cy(B.r));
      const hi = h ? Math.max(cx(A.c), cx(B.c)) : Math.max(cy(A.r), cy(B.r));
      if (along < lo + rad * 0.6 || along > hi - rad * 0.6) return;
      const d = Math.abs(h ? y - cy(A.r) : x - cx(A.c));
      // Prefer an edge with bridges when two lines are equally close (where lines cross).
      if (d < bestD || (d === bestD && game.bridges[k] > 0)) {
        best = k;
        bestD = d;
      }
    });
    return best;
  };

  const edgeLabel = (k: number) => {
    const e = game.edges[k];
    const A = game.islands[e.a];
    const B = game.islands[e.b];
    const n = game.bridges[k];
    return `Between ${A.n} at row ${A.r + 1}, column ${A.c + 1} and ${B.n} at row ${B.r + 1}, column ${B.c + 1}: ${n ? `${n} bridge${n > 1 ? 's' : ''}` : 'no bridge'}`;
  };

  return (
    <div
      ref={area}
      class={`br-board ${hidden ? 'br-hidden' : ''}`}
      style={{ '--s': `${s}px` }}
      role="group"
      aria-label="Bridges board"
      aria-describedby="br-board-hint"
      onPointerDown={(e) => {
        if (!e.isPrimary || hidden) return;
        const p = local(e);
        press.current = { ...p, island: islandAt(p.x, p.y) };
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerUp={(e) => {
        const start = press.current;
        press.current = null;
        echo.touched();
        if (!start) return;
        const p = local(e);
        const dx = p.x - start.x;
        const dy = p.y - start.y;
        if (start.island != null && Math.hypot(dx, dy) > SLOP) {
          // Drag from an island: the neighbour in that direction.
          const [dr, dc] = Math.abs(dx) > Math.abs(dy) ? [0, Math.sign(dx)] : [Math.sign(dy), 0];
          const k = edgeFrom(game, start.island, dr, dc);
          return k != null ? onCycle(k) : onMiss();
        }
        if (Math.hypot(dx, dy) > s * 0.5) return; // a swipe over the water: nothing
        const k = start.island == null ? edgeAt(p.x, p.y) : null;
        if (k != null) onCycle(k);
        else onMiss();
      }}
      onPointerCancel={() => {
        press.current = null;
        echo.touched();
      }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (echo.isEcho(e)) return;
        // VoiceOver / Switch Control / keyboard activate the edge buttons.
        const t = (e.target as HTMLElement).closest<HTMLElement>('[data-edge]');
        if (t) onCycle(Number(t.dataset.edge));
      }}
    >
      {s > 0 && (
        <>
          <svg class="br-lines" width={size.w} height={size.h} aria-hidden="true">
            {game.edges.map((e, k) => {
              const n = game.bridges[k];
              if (!n && flash !== k && shake !== k) return null;
              const A = game.islands[e.a];
              const B = game.islands[e.b];
              const h = isHorizontal(game.islands, e);
              const off = s * 0.11;
              const offsets = n === 2 ? [-off, off] : [0];
              const cls = `br-bridge ${flash === k ? 'br-flash' : ''} ${shake === k ? 'br-blocked' : ''} ${!n ? 'br-ghost' : ''}`;
              return offsets.map((o) =>
                h ? (
                  <line class={cls} x1={cx(A.c) + rad} x2={cx(B.c) - rad} y1={cy(A.r) + o} y2={cy(A.r) + o} />
                ) : (
                  <line class={cls} x1={cx(A.c) + o} x2={cx(A.c) + o} y1={cy(A.r) + rad} y2={cy(B.r) - rad} />
                ),
              );
            })}
          </svg>
          {game.edges.map((e, k) => {
            const A = game.islands[e.a];
            const B = game.islands[e.b];
            const h = isHorizontal(game.islands, e);
            const style = h
              ? { left: `${cx(A.c) + rad}px`, top: `${cy(A.r) - s * 0.4}px`, width: `${cx(B.c) - cx(A.c) - 2 * rad}px`, height: `${s * 0.8}px` }
              : { left: `${cx(A.c) - s * 0.4}px`, top: `${cy(A.r) + rad}px`, width: `${s * 0.8}px`, height: `${cy(B.r) - cy(A.r) - 2 * rad}px` };
            return <button key={`e${k}`} class="cell br-edge" style={style} data-edge={k} aria-label={edgeLabel(k)} />;
          })}
          {game.islands.map((isl, i) => {
            const state = counts[i] === isl.n ? 'done' : counts[i] > isl.n ? 'over' : '';
            return (
              <div
                key={`i${i}`}
                class={`br-island ${state ? `br-${state}` : ''}`}
                style={{ transform: `translate(${cx(isl.c) - rad}px, ${cy(isl.r) - rad}px)`, width: `${2 * rad}px`, height: `${2 * rad}px` }}
                role="img"
                aria-label={`Island ${isl.n}, row ${isl.r + 1}, column ${isl.c + 1}: ${counts[i]} of ${isl.n} bridges${state === 'over' ? ', too many' : state === 'done' ? ', complete' : ''}`}
              >
                <span aria-hidden="true">{isl.n}</span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
});
