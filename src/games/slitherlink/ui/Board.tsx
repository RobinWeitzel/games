import { memo } from 'preact/compat';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useClickEcho } from '../../../ui/game/clickEcho';
import { geometry, isHorizontal } from '../engine';
import { CROSS, EMPTY, LINE, SlitherlinkGame, branches, clueStates } from '../state';

interface Props {
  game: SlitherlinkGame;
  flash: number | null;
  hidden: boolean;
  won: boolean;
  onTap: (edge: number) => void;
  onPaint: (edges: number[], value: number) => void;
}

/** Movement (in cells) before a press becomes a drag. */
const SLOP = 0.25;

export const Board = memo(function Board({ game, flash, hidden, won, onTap, onPaint }: Props) {
  const n = game.n;
  const geo = geometry(n);
  const H = (n + 1) * n;
  const area = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const press = useRef<{ x: number; y: number; dot: number | null; edges: number[]; moved: boolean } | null>(null);
  const echo = useClickEcho();

  useLayoutEffect(() => {
    const el = area.current!;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cell size, with a third of a cell around the grid so the outer lines are easy to hit.
  const s = Math.floor(Math.min(size.w, size.h) / (n + 0.7));
  const left = Math.floor((size.w - s * n) / 2);
  const top = Math.floor((size.h - s * n) / 2);
  const px = (c: number) => left + c * s;
  const py = (r: number) => top + r * s;
  const clues = clueStates(game);
  const branched = branches(game);

  /** Grid coordinates (in cells) of a pointer event. */
  const local = (e: PointerEvent) => {
    const b = area.current!.getBoundingClientRect();
    return { x: (e.clientX - b.left - left) / s, y: (e.clientY - b.top - top) / s };
  };
  /** The edge closest to a point. */
  const edgeAt = (x: number, y: number): number | null => {
    const rh = Math.round(y);
    const ch = Math.floor(x);
    const dh = Math.abs(y - rh) + (ch < 0 || ch >= n || rh < 0 || rh > n ? 9 : 0);
    const cv = Math.round(x);
    const rv = Math.floor(y);
    const dv = Math.abs(x - cv) + (rv < 0 || rv >= n || cv < 0 || cv > n ? 9 : 0);
    if (Math.min(dh, dv) > 0.6) return null;
    return dh <= dv ? rh * n + ch : H + rv * (n + 1) + cv;
  };
  /** The dot under a point, if it's close to one. */
  const dotAt = (x: number, y: number): number | null => {
    const r = Math.round(y);
    const c = Math.round(x);
    if (r < 0 || r > n || c < 0 || c > n || Math.hypot(x - c, y - r) > 0.35) return null;
    return r * (n + 1) + c;
  };
  const edgeBetween = (a: number, b: number) => geo.dotEdges[a].find((e) => geo.edgeDots[e].includes(b)) ?? null;

  const edgeLabel = (e: number) => {
    const [a, b] = geo.edgeDots[e];
    const at = (d: number) => `row ${Math.floor(d / (n + 1)) + 1}, column ${(d % (n + 1)) + 1}`;
    const m = game.edges[e];
    return `${isHorizontal(n, e) ? 'Across' : 'Down'} from dot at ${at(a)} to ${at(b)}: ${m === LINE ? 'line' : m === CROSS ? 'cross' : 'empty'}`;
  };

  const lineW = Math.max(3, s * 0.11);
  const x0 = s * 0.12;

  return (
    <div
      ref={area}
      class={`sl-board ${hidden ? 'sl-hidden' : ''} ${won ? 'sl-won' : ''}`}
      role="group"
      aria-label="Slitherlink board"
      aria-describedby="sl-board-hint"
      onPointerDown={(e) => {
        if (!e.isPrimary || hidden || !s) return;
        const p = local(e);
        press.current = { ...p, dot: dotAt(p.x, p.y), edges: [], moved: false };
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        const pr = press.current;
        if (!pr) return;
        const p = local(e);
        if (!pr.moved && Math.hypot(p.x - pr.x, p.y - pr.y) < SLOP) return;
        pr.moved = true;
        const d = dotAt(p.x, p.y);
        if (d == null || d === pr.dot) return;
        if (pr.dot != null) {
          const edge = edgeBetween(pr.dot, d);
          if (edge != null && !pr.edges.includes(edge)) pr.edges.push(edge);
        }
        pr.dot = d;
      }}
      onPointerUp={(e) => {
        const pr = press.current;
        press.current = null;
        echo.touched();
        if (!pr) return;
        if (pr.edges.length) {
          // A drag draws lines; one that starts on a line erases.
          onPaint(pr.edges, game.edges[pr.edges[0]] === LINE ? EMPTY : LINE);
          return;
        }
        if (pr.moved) return;
        const p = local(e);
        const edge = edgeAt(p.x, p.y);
        if (edge != null) onTap(edge);
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
        if (t) onTap(Number(t.dataset.edge));
      }}
    >
      {s > 0 && (
        <>
          <svg class="sl-svg" width={size.w} height={size.h} aria-hidden="true">
            {game.clues.map((v, c) => {
              if (v < 0) return null;
              const st = clues.get(c);
              const cx = px((c % n) + 0.5);
              const cy = py(Math.floor(c / n) + 0.5);
              return (
                <g key={`c${c}`} class={`sl-clue sl-${st}`}>
                  {st === 'bad' && <circle class="sl-ring" cx={cx} cy={cy} r={s * 0.3} />}
                  <text x={cx} y={cy} font-size={Math.max(11, s * 0.48)} text-anchor="middle" dominant-baseline="central">
                    {v}
                  </text>
                </g>
              );
            })}
            {game.edges.map((m, e) => {
              if (m === EMPTY && flash !== e) return null;
              const [a, b] = geo.edgeDots[e];
              const ax = px(a % (n + 1));
              const ay = py(Math.floor(a / (n + 1)));
              const bx = px(b % (n + 1));
              const by = py(Math.floor(b / (n + 1)));
              if (m === CROSS) {
                const mx = (ax + bx) / 2;
                const my = (ay + by) / 2;
                return <path key={`e${e}`} class="sl-cross" d={`M${mx - x0} ${my - x0}L${mx + x0} ${my + x0}M${mx + x0} ${my - x0}L${mx - x0} ${my + x0}`} />;
              }
              return <line key={`e${e}`} class={`sl-line ${flash === e ? 'sl-flash' : ''}`} x1={ax} y1={ay} x2={bx} y2={by} stroke-width={lineW} />;
            })}
            {geo.dotEdges.map((_, d) => (
              <circle
                key={`d${d}`}
                class={`sl-dot ${branched.has(d) ? 'sl-branch' : ''}`}
                cx={px(d % (n + 1))}
                cy={py(Math.floor(d / (n + 1)))}
                r={branched.has(d) ? lineW * 1.3 : Math.max(2, s * 0.07)}
              />
            ))}
          </svg>
          {game.edges.map((_, e) => {
            const [a, b] = geo.edgeDots[e];
            const ax = px(a % (n + 1));
            const ay = py(Math.floor(a / (n + 1)));
            const style = isHorizontal(n, e)
              ? { left: `${ax}px`, top: `${ay - s * 0.25}px`, width: `${px(b % (n + 1)) - ax}px`, height: `${s * 0.5}px` }
              : { left: `${ax - s * 0.25}px`, top: `${ay}px`, width: `${s * 0.5}px`, height: `${py(Math.floor(b / (n + 1))) - ay}px` };
            return <button key={`b${e}`} class="cell sl-edge" style={style} data-edge={e} aria-label={edgeLabel(e)} />;
          })}
          <span class="sr-only">
            {game.clues
              .map((v, c) => (v >= 0 ? `Row ${Math.floor(c / n) + 1}, column ${(c % n) + 1}: ${v}${clues.get(c) === 'ok' ? ', done' : clues.get(c) === 'bad' ? ', too many' : ''}` : ''))
              .filter(Boolean)
              .join('. ')}
          </span>
        </>
      )}
    </div>
  );
});
