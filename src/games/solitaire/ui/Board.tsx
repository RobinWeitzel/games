import { memo } from 'preact/compat';
import { CardView, RecycleGlyph, Slot, SlotSuit, tableVars, useCardTable } from '../../../ui/cards';
import { Card, Move, Pile, RANKS, SUIT_NAMES, SolitaireGame, canPickUp, cardName, pileCards } from '../state';

interface Props {
  game: SolitaireGame;
  hidden: boolean;
  /** Cards moved by the last move (they settle in with a short pop). */
  fresh: Set<Card>;
  /** A card that couldn't move (it shakes). */
  shake: Card | null;
  hint: Move | null;
  /** Tap (or VoiceOver / Switch Control / keyboard activation) on a card or an empty pile (index -1). */
  onTap: (pile: Pile, index: number) => void;
  /** A drag ended over a pile. */
  onDrop: (from: Pile, index: number, to: Pile) => void;
}

const ROW_GAP = 10;
/** Card height / width. */
const RATIO = 1.42;

interface Layout {
  cw: number;
  ch: number;
  gap: number;
  left: number;
  tabTop: number;
  height: number;
  font: number;
}

/** The largest cards that fit 7 columns across, leaving room for a fanned tableau. */
function computeLayout(w: number, h: number): Layout {
  const gap = w < 400 ? 4 : 6;
  const cw = Math.max(20, Math.floor(Math.min((w - 6 * gap) / 7, (h - ROW_GAP) / (RATIO * 3.2))));
  const ch = Math.round(cw * RATIO);
  return {
    cw,
    ch,
    gap,
    left: Math.floor((w - (7 * cw + 6 * gap)) / 2),
    tabTop: ch + ROW_GAP,
    height: h,
    font: Math.max(11, Math.round(cw * 0.3)),
  };
}

const colX = (L: Layout, i: number) => L.left + i * (L.cw + L.gap);

/** Vertical offsets in a column: squeezed so the longest column still fits the height. */
function columnSteps(L: Layout, down: number, up: number) {
  const avail = L.height - L.tabTop - L.ch;
  let ds = Math.round(L.ch * 0.12);
  let us = Math.round(L.ch * 0.3);
  const need = () => down * ds + Math.max(0, up - 1) * us;
  if (need() > avail && up > 1) us = Math.max(L.font + 6, (avail - down * ds) / (up - 1));
  if (need() > avail && down > 0) ds = Math.max(3, (avail - Math.max(0, up - 1) * us) / down);
  return { ds, us };
}

interface Placed {
  card: Card;
  pile: Pile;
  index: number;
  x: number;
  y: number;
  z: number;
  up: boolean;
}

/** Where every visible card goes. */
function place(g: SolitaireGame, L: Layout): Placed[] {
  const out: Placed[] = [];
  // Waste: Draw 3 fans the last three cards; Draw 1 keeps the one under the top visible for drags.
  const showW = g.draw === 3 ? 3 : 2;
  const wStart = Math.max(0, g.waste.length - showW);
  const fan = g.draw === 3 ? Math.round(L.cw * 0.3) : 0;
  g.waste.slice(wStart).forEach((card, k) => {
    out.push({ card, pile: 'w', index: wStart + k, x: colX(L, 1) + k * fan, y: 0, z: k + 1, up: true });
  });
  for (let f = 0; f < 4; f++) {
    const n = g.foundations[f];
    for (let k = Math.max(0, n - 2); k < n; k++) out.push({ card: f * 13 + k, pile: `f${f}`, index: k, x: colX(L, 3 + f), y: 0, z: k + 1, up: true });
  }
  g.tableau.forEach((col, i) => {
    const down = g.faceDown[i];
    const { ds, us } = columnSteps(L, down, col.length - down);
    let y = L.tabTop;
    col.forEach((card, k) => {
      out.push({ card, pile: `t${i}`, index: k, x: colX(L, i), y, z: k + 1, up: k >= down });
      y += k < down ? ds : us;
    });
  });
  return out;
}

/** The pile under a point in board coordinates (the top row: foundations; below: columns). */
function pileAt(L: Layout, x: number, y: number): Pile | null {
  const i = Math.round((x - L.left - L.cw / 2) / (L.cw + L.gap));
  if (i < 0 || i > 6) return null;
  if (y < L.tabTop - ROW_GAP / 2) return i >= 3 ? `f${i - 3}` : null;
  return `t${i}`;
}

export const Board = memo(function Board({ game, hidden, fresh, shake, hint, onTap, onDrop }: Props) {
  const { ref, size, drag, handlers } = useCardTable<Pile>({
    hidden,
    canPickUp: (pile, index) => canPickUp(game, pile, index),
    onTap,
    onDragEnd: (pile, index, dx, dy) => {
      const start = posOf(pile, index);
      if (!start) return;
      const to = pileAt(L, start.x + dx + L.cw / 2, start.y + dy + L.ch / 3);
      if (to && to !== pile) onDrop(pile, index, to);
    },
  });

  const L = computeLayout(size.w, size.h);
  const cards = size.w ? place(game, L) : [];
  const posOf = (pile: Pile, index: number) => cards.find((c) => c.pile === pile && c.index === index);

  const hintFrom = hint && hint.from !== 's' ? hint : null;
  const hintTo = hint && hint.to !== 's' ? hint.to : null;
  const hintToTop = hintTo ? pileCards(game, hintTo).length - 1 : -1;
  const targetCls = (pile: Pile) => (hintTo === pile && hintToTop < 0 ? 'pc-hint-target' : '');

  const stockLabel = game.stock.length
    ? `Stock, ${game.stock.length} card${game.stock.length === 1 ? '' : 's'}. Draw ${game.draw}`
    : game.waste.length
      ? 'Stock, empty. Turn the waste over'
      : 'Stock, empty';

  return (
    <div
      ref={ref}
      class={`pc-table ${hidden ? 'pc-table-hidden' : ''}`}
      style={tableVars(L.cw, L.ch, L.font)}
      aria-label="Solitaire table"
      aria-describedby="sol-board-hint"
      {...handlers}
    >
      {size.w > 0 && (
        <>
          {/* Stock: one button (the top card's back, or "turn over" when used up). */}
          <Slot
            key="stock"
            pile="s"
            index={game.stock.length - 1}
            x={colX(L, 0)}
            y={0}
            cls={`pc-stock ${game.stock.length ? 'pc-down' : ''} ${hint?.from === 's' ? 'pc-hint' : ''}`}
            role="button"
            label={stockLabel}
          >
            {!game.stock.length && game.waste.length > 0 && <RecycleGlyph />}
          </Slot>
          {[0, 1, 2, 3].map((f) => (
            <Slot
              key={`slot-f${f}`}
              pile={`f${f}`}
              x={colX(L, 3 + f)}
              y={0}
              cls={targetCls(`f${f}`)}
              label={`${SUIT_NAMES[f]} foundation, ${game.foundations[f] ? `up to ${RANKS[game.foundations[f] - 1]}` : 'empty'}`}
            >
              <SlotSuit suit={f} />
            </Slot>
          ))}
          {game.tableau.map((col, i) => (
            <Slot key={`slot-t${i}`} pile={`t${i}`} x={colX(L, i)} y={L.tabTop} cls={targetCls(`t${i}`)} label={col.length ? `Column ${i + 1}` : `Column ${i + 1}, empty`} />
          ))}

          {cards.map((c) => {
            const dragged = drag && c.pile === drag.from && c.index >= drag.index;
            const pickable = c.up && canPickUp(game, c.pile, c.index);
            const isTop = c.index === pileCards(game, c.pile).length - 1;
            const hinted = hintFrom && c.pile === hintFrom.from && c.index >= hintFrom.index;
            const cls = [
              dragged ? 'pc-dragging' : '',
              fresh.has(c.card) ? 'pc-fresh' : '',
              shake === c.card ? 'pc-shake' : '',
              hinted ? 'pc-hint' : '',
              hintTo === c.pile && c.index === hintToTop ? 'pc-hint-target' : '',
            ].join(' ');
            const where = c.pile[0] === 't' ? `column ${Number(c.pile.slice(1)) + 1}` : c.pile === 'w' ? 'waste' : 'foundation';
            return (
              <CardView
                key={c.card}
                card={c.card}
                up={c.up}
                pile={c.pile}
                index={c.index}
                x={c.x + (dragged ? drag.dx : 0)}
                y={c.y + (dragged ? drag.dy : 0)}
                z={dragged ? 100 + c.z : c.z}
                cls={cls}
                role={pickable ? 'button' : 'img'}
                label={c.up ? `${cardName(c.card)}, ${where}` : `Face-down card, ${where}`}
                ariaHidden={!c.up && !isTop}
              />
            );
          })}
        </>
      )}
    </div>
  );
});
