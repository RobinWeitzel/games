import { memo } from 'preact/compat';
import { useRef } from 'preact/hooks';
import { useClickEcho } from '../../../ui/game/clickEcho';
import { FLAG, HIDDEN, MinesweeperGame, OPEN, count } from '../state';
import { FlagGlyph, MineGlyph } from './glyphs';

interface Props {
  game: MinesweeperGame;
  /** Cells opened by the last move (they fade in). */
  fresh: Set<number>;
  hidden: boolean;
  /** Tap (or VoiceOver / Switch Control / keyboard activation). */
  onTap: (cell: number) => void;
  /** Touch and hold (400ms). Fires mid-touch; the board calls `onRelease` when the finger lifts. */
  onHold: (cell: number) => void;
  /** Finger lifted after a hold: iOS can play haptics here. */
  onRelease: () => void;
  /** True while the board is still scrolling: a touch then only stops the scroll (as in any iOS list). */
  isScrolling?: () => boolean;
}

/** Touch-and-hold duration and movement tolerance (HIG: standard long press, cancel on movement). */
const HOLD_MS = 400;
const SLOP = 10;

export const Board = memo(function Board({ game, fresh, hidden, onTap, onHold, onRelease, isScrolling }: Props) {
  const press = useRef<{ cell: number | null; x: number; y: number; held: boolean; timer?: ReturnType<typeof setTimeout> }>({
    cell: null,
    x: 0,
    y: 0,
    held: false,
  });
  // Pointer taps are handled on pointerup; the click that follows must not count again.
  const echo = useClickEcho();
  const finished = game.status !== 'playing';

  /** The press became a scroll (or was interrupted): it's neither a tap nor a hold. */
  const cancel = () => {
    clearTimeout(press.current.timer);
    press.current.cell = null;
  };
  const cellOf = (e: Event) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]');
    return t ? Number(t.dataset.cell) : null;
  };

  return (
    <div
      class={`ms-board ${hidden ? 'ms-board-hidden' : ''} ${game.status === 'won' ? 'ms-board-won' : ''}`}
      style={{ '--cols': String(game.cols), '--rows': String(game.rows) }}
      role="grid"
      aria-label="Minefield"
      aria-describedby="ms-hold-hint"
      onPointerDown={(e) => {
        if (!e.isPrimary) return;
        const cell = cellOf(e);
        clearTimeout(press.current.timer);
        // A touch that stops a flick-scroll must never open a cell.
        if (cell == null || isScrolling?.()) {
          press.current.cell = null;
          return;
        }
        press.current = {
          cell,
          x: e.clientX,
          y: e.clientY,
          held: false,
          timer: setTimeout(() => {
            press.current.held = true;
            onHold(cell);
          }, HOLD_MS),
        };
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (p.cell != null && !p.held && Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP) cancel();
      }}
      onPointerUp={() => {
        const p = press.current;
        clearTimeout(p.timer);
        if (p.cell != null) {
          if (p.held) onRelease();
          else onTap(p.cell);
        }
        p.cell = null;
        echo.touched();
      }}
      // The browser took over the touch to scroll the board.
      onPointerCancel={() => {
        cancel();
        echo.touched();
      }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (echo.isEcho(e)) return; // already handled on pointerup
        const cell = cellOf(e);
        if (cell != null) onTap(cell);
      }}
    >
      {game.cells.map((s, i) => {
        const mine = !!game.mines[i];
        const n = s === OPEN && !mine ? count(game, i) : 0;
        // After a loss every mine is shown, and flags on cells without a mine are marked wrong.
        const showMine = mine && (s === OPEN || (finished && s === HIDDEN));
        const wrongFlag = finished && s === FLAG && !mine;
        const exploded = game.exploded === i;
        const cls = [
          'ms-cell',
          s === OPEN ? 'ms-open' : 'ms-closed',
          n ? `ms-n${n}` : '',
          showMine ? 'ms-mine' : '',
          exploded ? 'ms-exploded' : '',
          wrongFlag ? 'ms-wrong' : '',
          fresh.has(i) ? 'ms-fresh' : '',
        ].join(' ');
        const r = Math.floor(i / game.cols);
        const c = i % game.cols;
        const state = exploded
          ? 'exploded mine'
          : showMine
            ? 'mine'
            : wrongFlag
              ? 'flagged, incorrect'
              : s === FLAG
                ? 'flagged'
                : s === HIDDEN
                  ? 'hidden'
                  : n
                    ? `${n} mine${n === 1 ? '' : 's'} around`
                    : 'clear';
        return (
          <div key={i} data-cell={i} class={cls} role="gridcell" aria-label={`Row ${r + 1}, column ${c + 1}, ${state}`}>
            {showMine ? <MineGlyph /> : s === FLAG ? <FlagGlyph /> : n ? <span class="ms-num">{n}</span> : null}
          </div>
        );
      })}
    </div>
  );
});
