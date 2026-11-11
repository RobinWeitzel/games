import { memo } from 'preact/compat';
import { useRef } from 'preact/hooks';
import { boxOf, colOf, rowOf } from '../engine/board';
import type { SudokuGame } from '../state';

interface Props {
  game: SudokuGame;
  highlightSame: boolean;
  /** Number lock: always highlight this digit (overrides the selected cell's digit). */
  lockedDigit?: number | null;
  /** Cells currently playing the "unit completed" flash. */
  flash: Set<number>;
  shake: number | null;
  hidden: boolean;
  won: boolean;
  onSelect: (cell: number) => void;
}

const NOTE_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const Board = memo(function Board({ game, highlightSame, lockedDigit, flash, shake, hidden, won, onSelect }: Props) {
  const pointerTapped = useRef(false);
  const sel = game.selected;
  // Digit to highlight across the board: the locked one, else the selected cell's (if enabled).
  const selVal = lockedDigit || (highlightSame && sel != null ? game.values[sel] : 0);

  return (
    <div
      class={`board ${hidden ? 'board-hidden' : ''} ${won ? 'board-won' : ''}`}
      role="grid"
      aria-label="Sudoku board"
      // pointerdown: selection feels instant on touch. click: VoiceOver / Switch Control /
      // keyboard activation (they don't send pointer events). Selecting twice is harmless.
      // Each tap must select exactly once: in number lock, a tap enters (or toggles) a digit.
      onPointerDown={(e) => {
        const t = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]');
        if (!t) return;
        pointerTapped.current = true;
        onSelect(Number(t.dataset.cell));
      }}
      onClick={(e) => {
        if (pointerTapped.current) {
          pointerTapped.current = false; // already handled on pointerdown
          return;
        }
        const t = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]');
        if (t) onSelect(Number(t.dataset.cell));
      }}
    >
      {game.values.map((v, i) => {
        const r = rowOf(i);
        const c = colOf(i);
        const given = game.puzzle[i] !== 0;
        const wrong = v !== 0 && v !== game.solution[i];
        const related =
          sel != null && i !== sel && (rowOf(sel) === r || colOf(sel) === c || boxOf(sel) === boxOf(i));
        const same = selVal !== 0 && v === selVal && i !== sel;
        const cls = [
          'cell',
          given ? 'given' : v ? 'user' : '',
          wrong ? 'wrong' : '',
          i === sel ? 'selected' : '',
          related ? 'related' : '',
          same ? 'same' : '',
          flash.has(i) ? 'flash' : '',
          shake === i ? 'shake' : '',
          c % 3 === 2 && c < 8 ? 'box-r' : '',
          r % 3 === 2 && r < 8 ? 'box-b' : '',
        ].join(' ');
        return (
          <div
            key={i}
            data-cell={i}
            class={cls}
            role="gridcell"
            aria-selected={i === sel}
            aria-label={`Row ${r + 1}, column ${c + 1}, ${
              v ? `${v}${wrong ? ', incorrect' : given ? ', given' : ''}` : game.notes[i] ? `notes ${NOTE_DIGITS.filter((d) => game.notes[i] & (1 << d)).join(' ')}` : 'empty'
            }`}
            style={{ '--d': `${(r + c) * 35}ms` }}
          >
            {v ? (
              <span class="cell-value">{v}</span>
            ) : game.notes[i] ? (
              <span class="notes">
                {NOTE_DIGITS.map((d) => (
                  <span class={d === selVal ? 'note-hl' : ''}>{game.notes[i] & (1 << d) ? d : ''}</span>
                ))}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
});
