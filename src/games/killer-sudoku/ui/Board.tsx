import { memo } from 'preact/compat';
import { useRef } from 'preact/hooks';
import { boxOf, colOf, rowOf } from '../engine';
import type { KillerGame } from '../state';

interface Props {
  game: KillerGame;
  flash: Set<number>;
  shake: number | null;
  hidden: boolean;
  won: boolean;
  onSelect: (cell: number) => void;
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
/** Inset of the dashed cage outline from the cell edge. */
const IN = '3px';

export const Board = memo(function Board({ game, flash, shake, hidden, won, onSelect }: Props) {
  const pointerTapped = useRef(false);
  const sel = game.selected;
  const selVal = sel != null ? game.values[sel] : 0;
  const cageIdx = new Array<number>(81);
  game.cages.forEach((c, k) => c.cells.forEach((cell) => (cageIdx[cell] = k)));
  const selCage = sel != null ? cageIdx[sel] : -1;
  const same = (a: number, b: number) => b >= 0 && b < 81 && cageIdx[a] === cageIdx[b];

  return (
    <div
      class={`ks-board ${hidden ? 'ks-hidden' : ''} ${won ? 'ks-won' : ''}`}
      role="grid"
      aria-label="Killer Sudoku board"
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
        const r = rowOf(i);
        const c = colOf(i);
        const cage = game.cages[cageIdx[i]];
        const wrong = v !== 0 && v !== game.solution[i];
        const related = sel != null && i !== sel && (rowOf(sel) === r || colOf(sel) === c || boxOf(sel) === boxOf(i));
        const sameVal = selVal !== 0 && v === selVal && i !== sel;
        // Dashed outline only on the sides where the cage ends.
        const top = !(r > 0 && same(i, i - 9));
        const bottom = !(r < 8 && same(i, i + 9));
        const left = !(c > 0 && same(i, i - 1));
        const right = !(c < 8 && same(i, i + 1));
        const cls = [
          'cell',
          v ? (wrong ? 'wrong' : 'filled') : '',
          i === sel ? 'selected' : '',
          related ? 'related' : '',
          sameVal ? 'same' : '',
          cageIdx[i] === selCage && i !== sel ? 'ks-in-cage' : '',
          flash.has(i) ? 'flash' : '',
          shake === i ? 'shake' : '',
          c % 3 === 2 && c < 8 ? 'ks-box-r' : '',
          r % 3 === 2 && r < 8 ? 'ks-box-b' : '',
        ].join(' ');
        const content = v
          ? `${v}${wrong ? ', incorrect' : ''}`
          : game.notes[i]
            ? `notes ${DIGITS.filter((d) => game.notes[i] & (1 << d)).join(' ')}`
            : 'empty';
        return (
          <div
            key={i}
            data-cell={i}
            class={cls}
            role="gridcell"
            aria-selected={i === sel}
            aria-label={`Row ${r + 1}, column ${c + 1}, ${content}, cage of ${cage.cells.length} adding up to ${cage.sum}`}
            style={{ '--d': `${(r + c) * 35}ms` }}
          >
            <span
              class="ks-cage"
              aria-hidden="true"
              style={{
                top: top ? IN : '-1px',
                bottom: bottom ? IN : '-1px',
                left: left ? IN : '-1px',
                right: right ? IN : '-1px',
                borderTopStyle: top ? 'dashed' : 'none',
                borderBottomStyle: bottom ? 'dashed' : 'none',
                borderLeftStyle: left ? 'dashed' : 'none',
                borderRightStyle: right ? 'dashed' : 'none',
              }}
            />
            {cage.cells[0] === i && (
              <span class="ks-sum" aria-hidden="true">
                {cage.sum}
              </span>
            )}
            {v ? (
              <span class="ks-value" aria-hidden="true">
                {v}
              </span>
            ) : game.notes[i] ? (
              <span class="ks-notes" aria-hidden="true">
                {DIGITS.map((d) => (
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
