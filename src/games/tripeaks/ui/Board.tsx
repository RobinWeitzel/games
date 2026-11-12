import { memo } from 'preact/compat';
import { CardView, RecycleGlyph, Slot, tableVars, useCardTable } from '../../../ui/cards';
import { Card, cardName } from '../../../core/cards';
import { COVERED_BY, PEAK_CARDS, POSITIONS, TriPeaksGame, isFree } from '../state';

interface Props {
  game: TriPeaksGame;
  hidden: boolean;
  fresh: Card | null;
  shake: number | null;
  /** A card to play, -1 for the stock. */
  hint: number | null;
  /** A peak card (0–27) or the stock (-1). */
  onTap: (i: number) => void;
}

type Pile = 'p' | 's' | 'w';

/** Cards in the bottom row overlap their neighbour by this much of their width (the corner stays visible). */
const STEP = 0.86;
const RATIO = 1.42;

function computeLayout(w: number, h: number) {
  // Ten overlapping cards across; the peaks take 2.65 card heights, the stock row one more.
  const cw = Math.floor(Math.min(w / (9 * STEP + 1), (h - 24) / (RATIO * 3.9)));
  const ch = Math.round(cw * RATIO);
  const left = Math.floor((w - cw * (9 * STEP + 1)) / 2);
  // The stock and waste sit low, within thumb reach (with room for the stock count under them).
  const baseY = h - ch - 22;
  // Rows of the peaks spread out to use the height above, up to 80% of a card apart.
  const rowStep = Math.max(ch * 0.5, Math.min(ch * 0.8, (baseY - 24 - ch) / 3));
  return { cw, ch, left, baseY, rowStep, font: Math.max(11, Math.round(cw * 0.3)) };
}

export const Board = memo(function Board({ game, hidden, fresh, shake, hint, onTap }: Props) {
  const { ref, size, handlers } = useCardTable<Pile>({
    hidden,
    canPickUp: () => false,
    onTap: (pile, index) => {
      if (pile === 'p') onTap(index);
      else if (pile === 's') onTap(-1);
    },
    onDragEnd: () => {},
  });
  const L = computeLayout(size.w, size.h);
  const x = (i: number) => L.left + POSITIONS[i].x * L.cw * STEP;
  const y = (i: number) => POSITIONS[i].row * L.rowStep;
  const stockX = Math.round(size.w / 2 - L.cw - 12);
  const wasteX = Math.round(size.w / 2 + 12);

  return (
    <div
      ref={ref}
      class={`pc-table ${hidden ? 'pc-table-hidden' : ''}`}
      style={tableVars(L.cw, L.ch, L.font)}
      aria-label="TriPeaks table"
      aria-describedby="tp-board-hint"
      {...handlers}
    >
      {size.w > 0 && (
        <>
          {game.peaks.map((card, i) => {
            if (game.cleared[i]) return null;
            const up = COVERED_BY[i].every((j) => game.cleared[j]);
            const free = isFree(game, i);
            return (
              <CardView
                key={card}
                card={card}
                up={up}
                pile="p"
                index={i}
                x={x(i)}
                y={y(i)}
                z={POSITIONS[i].row * 20 + Math.round(POSITIONS[i].x * 2)}
                cls={`${shake === i ? 'pc-shake' : ''} ${hint === i ? 'pc-hint' : ''}`}
                role={free ? 'button' : 'img'}
                label={up ? `${cardName(card)}${free ? '' : ', covered'}` : 'Face-down card'}
                ariaHidden={!up}
              />
            );
          })}

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
            <span class="tp-count" style={{ transform: `translate(${stockX}px, ${L.baseY + L.ch + 2}px)`, width: `${L.cw}px` }} aria-hidden="true">
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
          <span class="sr-only">{PEAK_CARDS - game.cleared.filter(Boolean).length} cards left in the peaks</span>
        </>
      )}
    </div>
  );
});
