import { memo } from 'preact/compat';
import { useRef } from 'preact/hooks';
import { KakuroGame, isWhite, runsOf } from '../state';

interface Props {
  game: KakuroGame;
  flash: Set<number>;
  shake: number | null;
  hidden: boolean;
  won: boolean;
  onSelect: (cell: number) => void;
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const cellsText = (k: number) => `${k} cell${k === 1 ? '' : 's'}`;

export const Board = memo(function Board({ game, flash, shake, hidden, won, onSelect }: Props) {
  const pointerTapped = useRef(false);
  const n = game.n;
  const sel = game.selected != null && isWhite(game, game.selected) ? game.selected : null;
  const selVal = sel != null ? game.values[sel] : 0;
  const selRuns = sel != null ? runsOf(game, sel) : null;
  const related = new Set([...(selRuns?.across?.cells ?? []), ...(selRuns?.down?.cells ?? [])]);

  return (
    <div
      class={`kk-board ${hidden ? 'kk-hidden' : ''} ${won ? 'kk-won' : ''}`}
      style={{ '--n': n }}
      role="grid"
      aria-label="Kakuro board"
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
        const where = `Row ${r + 1}, column ${c + 1}`;
        if (!isWhite(game, i)) {
          const a = game.across[i];
          const d = game.down[i];
          const runs = [a ? `across ${a}` : '', d ? `down ${d}` : ''].filter(Boolean).join(', ');
          return (
            <div key={i} class={`cell kk-clue ${a || d ? 'kk-has' : ''}`} role="gridcell" aria-label={`${where}, black${runs ? `, sums ${runs}` : ''}`}>
              {a > 0 && (
                <span class={`kk-sum kk-a ${selRuns?.across?.clue === i ? 'on' : ''}`} aria-hidden="true">
                  {a}
                </span>
              )}
              {d > 0 && (
                <span class={`kk-sum kk-d ${selRuns?.down?.clue === i ? 'on' : ''}`} aria-hidden="true">
                  {d}
                </span>
              )}
            </div>
          );
        }
        const wrong = v !== 0 && v !== game.solution[i];
        const sameVal = selVal !== 0 && v === selVal && i !== sel;
        const cls = [
          'cell',
          'kk-white',
          v ? (wrong ? 'wrong' : 'filled') : '',
          i === sel ? 'selected' : '',
          related.has(i) && i !== sel ? 'related' : '',
          sameVal ? 'same' : '',
          flash.has(i) ? 'flash' : '',
          shake === i ? 'shake' : '',
        ].join(' ');
        const content = v
          ? `${v}${wrong ? ', incorrect' : ''}`
          : game.notes[i]
            ? `notes ${DIGITS.filter((d) => game.notes[i] & (1 << d)).join(' ')}`
            : 'empty';
        const runs = runsOf(game, i);
        const sums = [
          runs.across ? `across ${runs.across.sum} in ${cellsText(runs.across.cells.length)}` : '',
          runs.down ? `down ${runs.down.sum} in ${cellsText(runs.down.cells.length)}` : '',
        ]
          .filter(Boolean)
          .join(', ');
        return (
          <div
            key={i}
            data-cell={i}
            class={cls}
            role="gridcell"
            aria-selected={i === sel}
            aria-label={`${where}, ${content}, ${sums}`}
            style={{ '--d': `${(r + c) * 35}ms` }}
          >
            {v ? (
              <span class="kk-value" aria-hidden="true">
                {v}
              </span>
            ) : game.notes[i] ? (
              <span class="kk-notes" aria-hidden="true">
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
