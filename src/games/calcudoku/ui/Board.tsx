import { memo } from 'preact/compat';
import { useRef } from 'preact/hooks';
import { cageLabel } from '../engine';
import type { CalcudokuGame } from '../state';

interface Props {
  game: CalcudokuGame;
  /** Cells playing the "cage completed" flash. */
  flash: Set<number>;
  shake: number | null;
  hidden: boolean;
  won: boolean;
  onSelect: (cell: number) => void;
}

const OP_NAMES: Record<string, string> = { '+': 'sum', '−': 'difference', '×': 'product', '÷': 'quotient' };

export const Board = memo(function Board({ game, flash, shake, hidden, won, onSelect }: Props) {
  const pointerTapped = useRef(false);
  const n = game.size;
  const sel = game.selected;
  const selVal = sel != null ? game.values[sel] : 0;
  // Cage index of every cell, for the thick borders between cages.
  const cageIdx = new Array<number>(n * n);
  game.cages.forEach((c, k) => c.cells.forEach((cell) => (cageIdx[cell] = k)));
  const digits = Array.from({ length: n }, (_, k) => k + 1);

  return (
    <div
      class={`cd-board ${hidden ? 'cd-hidden' : ''} ${won ? 'cd-won' : ''}`}
      style={{ '--n': n }}
      role="grid"
      aria-label="Calcudoku board"
      // pointerdown: selection feels instant on touch. click: VoiceOver / Switch Control / keyboard.
      onPointerDown={(e) => {
        const t = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]');
        if (!t) return;
        pointerTapped.current = true;
        onSelect(Number(t.dataset.cell));
      }}
      onClick={(e) => {
        if (pointerTapped.current) {
          pointerTapped.current = false;
          return;
        }
        const t = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]');
        if (t) onSelect(Number(t.dataset.cell));
      }}
    >
      {game.values.map((v, i) => {
        const r = Math.floor(i / n);
        const c = i % n;
        const cage = game.cages[cageIdx[i]];
        const wrong = v !== 0 && v !== game.solution[i];
        const related = sel != null && i !== sel && (Math.floor(sel / n) === r || sel % n === c);
        const same = selVal !== 0 && v === selVal && i !== sel;
        const cls = [
          'cell',
          v ? (wrong ? 'wrong' : 'filled') : '',
          i === sel ? 'selected' : '',
          related ? 'related' : '',
          same ? 'same' : '',
          flash.has(i) ? 'flash' : '',
          shake === i ? 'shake' : '',
          c < n - 1 && cageIdx[i + 1] !== cageIdx[i] ? 'cd-r' : '',
          r < n - 1 && cageIdx[i + n] !== cageIdx[i] ? 'cd-b' : '',
        ].join(' ');
        const isLabelCell = cage.cells[0] === i;
        const cageText =
          cage.op === '=' ? `cage of one, ${cage.target}` : `cage of ${cage.cells.length}, ${OP_NAMES[cage.op]} ${cage.target}`;
        const content = v
          ? `${v}${wrong ? ', incorrect' : ''}`
          : game.notes[i]
            ? `notes ${digits.filter((d) => game.notes[i] & (1 << d)).join(' ')}`
            : 'empty';
        return (
          <div
            key={i}
            data-cell={i}
            class={cls}
            role="gridcell"
            aria-selected={i === sel}
            aria-label={`Row ${r + 1}, column ${c + 1}, ${content}, ${cageText}`}
            style={{ '--d': `${(r + c) * 40}ms` }}
          >
            {isLabelCell && (
              <span class="cd-cage" aria-hidden="true">
                {cageLabel(cage)}
              </span>
            )}
            {v ? (
              <span class="cd-value" aria-hidden="true">
                {v}
              </span>
            ) : game.notes[i] ? (
              <span class="cd-notes" aria-hidden="true">
                {digits.map((d) => (
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
