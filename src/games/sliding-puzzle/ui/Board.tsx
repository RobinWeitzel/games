import { memo } from 'preact/compat';
import { useClickEcho } from '../../../ui/game/clickEcho';
import type { SlideGame } from '../state';

interface Props {
  game: SlideGame;
  shake: number | null;
  hidden: boolean;
  won: boolean;
  onTap: (cell: number) => void;
}

export const Board = memo(function Board({ game, shake, hidden, won, onTap }: Props) {
  const n = game.n;
  const echo = useClickEcho();
  const gap = game.tiles.indexOf(0);
  // Positions by tile number, so tiles keep their element and slide (CSS transition).
  const at = new Array<number>(n * n);
  game.tiles.forEach((t, i) => (at[t] = i));
  const cellOf = (e: Event) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]');
    return t ? Number(t.dataset.cell) : null;
  };

  return (
    <div
      class={`sp-board ${hidden ? 'sp-hidden' : ''} ${won ? 'sp-won' : ''}`}
      style={{ '--n': n }}
      role="group"
      aria-label="Sliding puzzle"
      aria-describedby="sp-board-hint"
      onPointerUp={(e) => {
        echo.touched();
        const c = cellOf(e);
        if (c != null && !hidden) onTap(c);
      }}
      onPointerCancel={() => echo.touched()}
      onClick={(e) => {
        if (echo.isEcho(e)) return;
        const c = cellOf(e);
        if (c != null) onTap(c);
      }}
    >
      {Array.from({ length: n * n - 1 }, (_, k) => {
        const t = k + 1;
        const i = at[t];
        const r = Math.floor(i / n);
        const c = i % n;
        const home = t === i + 1;
        const movable = Math.floor(i / n) === Math.floor(gap / n) || i % n === gap % n;
        return (
          <button
            key={t}
            class={`sp-tile ${home ? 'sp-home' : ''} ${shake === i ? 'sp-shake' : ''}`}
            style={{ transform: `translate(${c * 100}%, ${r * 100}%)` }}
            data-cell={i}
            aria-label={`${t}, row ${r + 1}, column ${c + 1}${home ? ', in place' : ''}${movable ? '' : ', can’t move'}`}
          >
            <span class="sp-num" aria-hidden="true">
              {t}
            </span>
          </button>
        );
      })}
    </div>
  );
});
