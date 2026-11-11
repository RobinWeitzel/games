import { memo } from 'preact/compat';
import { CardView, RecycleGlyph, Slot, tableVars, useCardTable } from '../../../ui/cards';
import { Card, cardName } from '../../../core/cards';
import { PASSES, POS, PyramidGame, WASTE, isFree } from '../state';

interface Props {
  game: PyramidGame;
  hidden: boolean;
  shake: number | null;
  /** Spots to point out (a hint), or 's' for the stock. */
  hint: number[] | 's' | null;
  fresh: Card | null;
  /** A pyramid card (0–27), the waste (-1) or the stock (-2). */
  onTap: (spot: number) => void;
}

type Pile = 'p' | 'w' | 's';
const RATIO = 1.42;

function computeLayout(w: number, h: number) {
  const gap = w < 400 ? 4 : 6;
  const cw = Math.floor(Math.min((w - 6 * gap) / 7, (h - 30) / (RATIO * 5.2)));
  const ch = Math.round(cw * RATIO);
  const baseY = h - ch - 22;
  const rowStep = Math.max(ch * 0.45, Math.min(ch * 0.6, (baseY - 20 - ch) / 6));
  return { cw, ch, gap, baseY, rowStep, font: Math.max(11, Math.round(cw * 0.3)) };
}

export const Board = memo(function Board({ game, hidden, shake, hint, fresh, onTap }: Props) {
  const { ref, size, handlers } = useCardTable<Pile>({
    hidden,
    canPickUp: () => false,
    onTap: (pile, index) => onTap(pile === 'p' ? index : pile === 'w' ? WASTE : -2),
    onDragEnd: () => {},
  });
  const L = computeLayout(size.w, size.h);
  const step = L.cw + L.gap;
  const x = (i: number) => size.w / 2 + (POS[i].k - POS[i].row / 2) * step - L.cw / 2;
  const y = (i: number) => POS[i].row * L.rowStep;
  const stockX = Math.round(size.w / 2 - L.cw - 12);
  const wasteX = Math.round(size.w / 2 + 12);
  const sel = game.selected;
  const hinted = (s: number) => Array.isArray(hint) && hint.includes(s);
  const stockLabel = game.stock.length
    ? `Stock, ${game.stock.length} cards. Turn over a card`
    : game.waste.length && game.pass < PASSES
      ? `Stock, empty. Go through the waste again (${PASSES - game.pass} left)`
      : 'Stock, empty';

  return (
    <div
      ref={ref}
      class={`pc-table ${hidden ? 'pc-table-hidden' : ''}`}
      style={tableVars(L.cw, L.ch, L.font)}
      aria-label="Pyramid table"
      aria-describedby="py-board-hint"
      {...handlers}
    >
      {size.w > 0 && (
        <>
          {game.peaks.map((card, i) => {
            if (game.cleared[i]) return null;
            const free = isFree(game, i);
            return (
              <CardView
                key={card}
                card={card}
                up
                pile="p"
                index={i}
                x={x(i)}
                y={y(i)}
                z={POS[i].row + 1}
                cls={`${free ? '' : 'pc-nopip'} ${sel === i ? 'pc-selected' : ''} ${shake === i ? 'pc-shake' : ''} ${hinted(i) ? 'pc-hint' : ''}`}
                role={free ? 'button' : 'img'}
                label={`${cardName(card)}${free ? (sel === i ? ', picked up' : '') : ', covered'}`}
              />
            );
          })}
          <Slot
            key="stock"
            pile="s"
            index={game.stock.length - 1}
            x={stockX}
            y={L.baseY}
            cls={`pc-stock ${game.stock.length ? 'pc-down' : ''} ${hint === 's' ? 'pc-hint' : ''}`}
            role="button"
            label={stockLabel}
          >
            {!game.stock.length && game.waste.length > 0 && game.pass < PASSES && <RecycleGlyph />}
          </Slot>
          <span class="py-count" style={{ transform: `translate(${stockX}px, ${L.baseY + L.ch + 2}px)`, width: `${L.cw}px` }} aria-hidden="true">
            {game.stock.length} · pass {game.pass}/{PASSES}
          </span>
          <Slot key="waste-slot" pile="w" x={wasteX} y={L.baseY} label="Waste, empty" />
          {game.waste.slice(-2).map((card, k, arr) => {
            const top = k === arr.length - 1;
            return (
              <CardView
                key={card}
                card={card}
                up
                pile="w"
                index={game.waste.length - arr.length + k}
                x={wasteX}
                y={L.baseY}
                z={50 + k}
                cls={`${top && sel === WASTE ? 'pc-selected' : ''} ${top && hinted(WASTE) ? 'pc-hint' : ''} ${card === fresh ? 'pc-fresh' : ''} ${top && shake === WASTE ? 'pc-shake' : ''}`}
                role={top ? 'button' : 'img'}
                label={`Waste, ${cardName(card)}${top && sel === WASTE ? ', picked up' : ''}`}
                ariaHidden={!top}
              />
            );
          })}
        </>
      )}
    </div>
  );
});
