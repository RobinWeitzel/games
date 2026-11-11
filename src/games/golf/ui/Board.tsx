import { memo } from 'preact/compat';
import { CardView, RecycleGlyph, Slot, tableVars, useCardTable } from '../../../ui/cards';
import { Card, cardName } from '../../../core/cards';
import { COLUMNS, GolfGame, canPlay } from '../state';

interface Props {
  game: GolfGame;
  hidden: boolean;
  fresh: Card | null;
  shake: number | null;
  /** A column to play, -1 for the stock. */
  hint: number | null;
  /** A column (0–6) or the stock (-1). */
  onTap: (col: number) => void;
}

type Pile = `t${number}` | 's' | 'w';
const RATIO = 1.42;

function computeLayout(w: number, h: number) {
  const gap = w < 400 ? 4 : 6;
  const cw = Math.floor(Math.min((w - (COLUMNS - 1) * gap) / COLUMNS, (h - 30) / (RATIO * 3.6)));
  const ch = Math.round(cw * RATIO);
  // The stock and waste sit low, within thumb reach (with room for the stock count under them).
  const baseY = h - ch - 22;
  const step = Math.min(ch * 0.42, (baseY - 20 - ch) / 4);
  return { cw, ch, gap, left: Math.floor((w - (COLUMNS * cw + (COLUMNS - 1) * gap)) / 2), baseY, step, font: Math.max(11, Math.round(cw * 0.3)) };
}

export const Board = memo(function Board({ game, hidden, fresh, shake, hint, onTap }: Props) {
  const { ref, size, handlers } = useCardTable<Pile>({
    hidden,
    canPickUp: () => false,
    // Any card of a column (or its empty place) plays the column's top card.
    onTap: (pile) => (pile === 's' ? onTap(-1) : pile[0] === 't' ? onTap(Number(pile.slice(1))) : undefined),
    onDragEnd: () => {},
  });
  const L = computeLayout(size.w, size.h);
  const colX = (i: number) => L.left + i * (L.cw + L.gap);
  const stockX = Math.round(size.w / 2 - L.cw - 12);
  const wasteX = Math.round(size.w / 2 + 12);

  return (
    <div
      ref={ref}
      class={`pc-table ${hidden ? 'pc-table-hidden' : ''}`}
      style={tableVars(L.cw, L.ch, L.font)}
      aria-label="Golf table"
      aria-describedby="gf-board-hint"
      {...handlers}
    >
      {size.w > 0 && (
        <>
          {game.columns.map((col, i) => (
            <Slot key={`slot-t${i}`} pile={`t${i}`} x={colX(i)} y={0} label={col.length ? `Column ${i + 1}` : `Column ${i + 1}, cleared`} />
          ))}
          {game.columns.map((col, i) =>
            col.map((card, k) => {
              const top = k === col.length - 1;
              return (
                <CardView
                  key={card}
                  card={card}
                  up
                  pile={`t${i}`}
                  index={k}
                  x={colX(i)}
                  y={k * L.step}
                  z={k + 1}
                  cls={`${top && shake === i ? 'pc-shake' : ''} ${top && hint === i ? 'pc-hint' : ''}`}
                  role={top ? 'button' : 'img'}
                  label={`${cardName(card)}, column ${i + 1}${top ? (canPlay(game, i) ? ', can be played' : '') : ''}`}
                  ariaHidden={!top}
                />
              );
            }),
          )}

          <Slot
            key="stock"
            pile="s"
            index={game.stock.length - 1}
            x={stockX}
            y={L.baseY}
            cls={`pc-stock ${game.stock.length ? 'pc-down' : ''} ${hint === -1 ? 'pc-hint' : ''}`}
            role="button"
            label={game.stock.length ? `Stock, ${game.stock.length} card${game.stock.length === 1 ? '' : 's'}. Turn over a card` : 'Stock, empty'}
          >
            {!game.stock.length && <RecycleGlyph />}
          </Slot>
          {game.stock.length > 0 && (
            <span class="gf-count" style={{ transform: `translate(${stockX}px, ${L.baseY + L.ch + 2}px)`, width: `${L.cw}px` }} aria-hidden="true">
              {game.stock.length}
            </span>
          )}
          <Slot key="waste-slot" pile="w" x={wasteX} y={L.baseY} label="Waste" />
          {game.waste.slice(-2).map((card, k, arr) => (
            <CardView
              key={card}
              card={card}
              up
              pile="w"
              index={game.waste.length - arr.length + k}
              x={wasteX}
              y={L.baseY}
              z={50 + k}
              cls={card === fresh ? 'pc-fresh' : ''}
              role="img"
              label={`Waste, ${cardName(card)}`}
              ariaHidden={k < arr.length - 1}
            />
          ))}
        </>
      )}
    </div>
  );
});
