import { memo } from 'preact/compat';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useClickEcho } from '../../../ui/game/clickEcho';
import { DotsGame, YOU } from '../state';

interface Props {
  game: DotsGame;
  hidden: boolean;
  enabled: boolean;
  onDraw: (line: number) => void;
}

const Mark = ({ p }: { p: number }) =>
  p === YOU ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7" fill="none" stroke="#fff" stroke-width="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="#fff" stroke-width="3.2" stroke-linecap="round" />
    </svg>
  );

export const Board = memo(function Board({ game, hidden, enabled, onDraw }: Props) {
  const area = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const echo = useClickEcho();
  useLayoutEffect(() => {
    const el = area.current!;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { rows, cols } = game;
  const s = Math.floor(Math.min(size.w / (cols + 0.5), size.h / (rows + 0.5)));
  const ox = (size.w - s * cols) / 2;
  const oy = (size.h - s * rows) / 2;
  const nH = (rows + 1) * cols;
  /** Line geometry: start point and direction. */
  const lineAt = (l: number) => {
    if (l < nH) return { x: ox + (l % cols) * s, y: oy + Math.floor(l / cols) * s, h: true, r: Math.floor(l / cols), c: l % cols };
    const k = l - nH;
    return { x: ox + (k % (cols + 1)) * s, y: oy + Math.floor(k / (cols + 1)) * s, h: false, r: Math.floor(k / (cols + 1)), c: k % (cols + 1) };
  };
  /** The undrawn line closest to a point, within half a box. */
  const nearest = (x: number, y: number) => {
    let best = -1;
    let bestD = s * 0.5;
    game.lines.forEach((d, l) => {
      if (d) return;
      const L = lineAt(l);
      const cx = L.x + (L.h ? s / 2 : 0);
      const cy = L.y + (L.h ? 0 : s / 2);
      const dd = L.h ? Math.max(Math.abs(x - cx) - s / 2, 0) + Math.abs(y - cy) : Math.abs(x - cx) + Math.max(Math.abs(y - cy) - s / 2, 0);
      if (dd < bestD) (bestD = dd), (best = l);
    });
    return best;
  };
  const thick = Math.max(4, s * 0.09);

  return (
    <div
      ref={area}
      class={`db-board ${hidden ? 'db-hidden' : ''}`}
      role="group"
      aria-label="Dots and Boxes board"
      aria-describedby="db-board-hint"
      onPointerUp={(e) => {
        echo.touched();
        if (!enabled || hidden) return;
        const b = area.current!.getBoundingClientRect();
        const l = nearest(e.clientX - b.left, e.clientY - b.top);
        if (l >= 0) onDraw(l);
      }}
      onPointerCancel={() => echo.touched()}
      onClick={(e) => {
        if (echo.isEcho(e) || !enabled) return;
        const t = (e.target as HTMLElement).closest<HTMLElement>('[data-line]');
        if (t) onDraw(Number(t.dataset.line));
      }}
    >
      {s > 0 && (
        <>
          {game.owner.map((o, b) =>
            o ? (
              <span
                key={`b${b}`}
                class={`db-box db-p${o}`}
                style={{ left: `${ox + (b % cols) * s + thick / 2}px`, top: `${oy + Math.floor(b / cols) * s + thick / 2}px`, width: `${s - thick}px`, height: `${s - thick}px` }}
                aria-hidden="true"
              >
                <Mark p={o} />
              </span>
            ) : null,
          )}
          {game.lines.map((d, l) => {
            const L = lineAt(l);
            const style = L.h
              ? { left: `${L.x}px`, top: `${L.y - thick / 2}px`, width: `${s}px`, height: `${thick}px` }
              : { left: `${L.x - thick / 2}px`, top: `${L.y}px`, width: `${thick}px`, height: `${s}px` };
            if (d) return <span key={`l${l}`} class={`db-line ${game.last === l ? 'db-last' : ''}`} style={style} aria-hidden="true" />;
            // An invisible button per open line for VoiceOver (touches use the nearest line).
            const hit = L.h
              ? { left: `${L.x + thick}px`, top: `${L.y - s * 0.3}px`, width: `${s - 2 * thick}px`, height: `${s * 0.6}px` }
              : { left: `${L.x - s * 0.3}px`, top: `${L.y + thick}px`, width: `${s * 0.6}px`, height: `${s - 2 * thick}px` };
            return (
              <button
                key={`l${l}`}
                class="cell db-open"
                style={hit}
                data-line={l}
                disabled={!enabled}
                aria-label={`${L.h ? 'Horizontal' : 'Vertical'} line, row ${L.r + 1}, column ${L.c + 1}`}
              />
            );
          })}
          {Array.from({ length: (rows + 1) * (cols + 1) }, (_, k) => (
            <span
              key={`d${k}`}
              class="db-dot"
              style={{ left: `${ox + (k % (cols + 1)) * s - thick}px`, top: `${oy + Math.floor(k / (cols + 1)) * s - thick}px`, width: `${2 * thick}px`, height: `${2 * thick}px` }}
              aria-hidden="true"
            />
          ))}
        </>
      )}
    </div>
  );
});
