import { memo } from 'preact/compat';
import { boxOf, colOf, rowOf } from '../engine/board';
import type { SudokuGame } from '../state';

interface Props {
  game: SudokuGame;
  highlightSame: boolean;
  /** Cells currently playing the "unit completed" flash. */
  flash: Set<number>;
  shake: number | null;
  hidden: boolean;
  won: boolean;
  onSelect: (cell: number) => void;
}

const NOTE_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const Board = memo(function Board({ game, highlightSame, flash, shake, hidden, won, onSelect }: Props) {
  const sel = game.selected;
  const selVal = sel != null ? game.values[sel] : 0;

  return (
    <div
      class={`board ${hidden ? 'board-hidden' : ''} ${won ? 'board-won' : ''}`}
      role="grid"
      aria-label="Sudoku board"
      // pointerdown: selection should feel instant.
      onPointerDown={(e) => {
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
        const same = highlightSame && selVal !== 0 && v === selVal && i !== sel;
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
            aria-label={`Row ${r + 1}, column ${c + 1}${v ? `, ${v}` : ', empty'}`}
            style={{ '--d': `${(r + c) * 35}ms` }}
          >
            {v ? (
              <span class="cell-value">{v}</span>
            ) : game.notes[i] ? (
              <span class="notes">
                {NOTE_DIGITS.map((d) => (
                  <span class={highlightSame && d === selVal ? 'note-hl' : ''}>{game.notes[i] & (1 << d) ? d : ''}</span>
                ))}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
});
