import { memo } from 'preact/compat';
import { CardView, Slot, SlotSuit, tableVars, useCardTable } from '../../../ui/cards';
import { Card, RANKS, SUIT_NAMES, cardName } from '../../../core/cards';
import { CELLS, COLUMNS, FreeCellGame, Move, Pile, canPickUp, pileCards } from '../state';

interface Props {
  game: FreeCellGame;
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

/** The largest cards that fit 8 columns across, leaving room for long fanned columns. */
function computeLayout(w: number, h: number): Layout {
  const gap = w < 400 ? 3 : 6;
  const cw = Math.max(20, Math.floor(Math.min((w - (COLUMNS - 1) * gap) / COLUMNS, (h - ROW_GAP) / (RATIO * 4.2))));
  const ch = Math.round(cw * RATIO);
  return {
    cw,
    ch,
    gap,
    left: Math.floor((w - (COLUMNS * cw + (COLUMNS - 1) * gap)) / 2),
    tabTop: ch + ROW_GAP,
    height: h,
    font: Math.max(11, Math.round(cw * 0.3)),
  };
}

const colX = (L: Layout, i: number) => L.left + i * (L.cw + L.gap);

/** Vertical offset between cards in a column: squeezed so the longest column still fits. */
function columnStep(L: Layout, n: number) {
  const step = Math.round(L.ch * 0.3);
  if (n < 2) return step;
  return Math.min(step, (L.height - L.tabTop - L.ch) / (n - 1));
}

interface Placed {
  card: Card;
  pile: Pile;
  index: number;
  x: number;
  y: number;
  z: number;
}

/** Where every visible card goes. */
function place(g: FreeCellGame, L: Layout): Placed[] {
  const out: Placed[] = [];
  g.cells.forEach((card, i) => {
    if (card != null) out.push({ card, pile: `c${i}`, index: 0, x: colX(L, i), y: 0, z: 1 });
  });
  for (let f = 0; f < 4; f++) {
    const n = g.foundations[f];
    for (let k = Math.max(0, n - 2); k < n; k++) out.push({ card: f * 13 + k, pile: `f${f}`, index: k, x: colX(L, CELLS + f), y: 0, z: k + 1 });
  }
  g.tableau.forEach((col, i) => {
    const step = columnStep(L, col.length);
    col.forEach((card, k) => out.push({ card, pile: `t${i}`, index: k, x: colX(L, i), y: L.tabTop + k * step, z: k + 1 }));
  });
  return out;
}

/** The pile under a point in board coordinates (top row: free cells, then foundations; below: columns). */
function pileAt(L: Layout, x: number, y: number): Pile | null {
  const i = Math.round((x - L.left - L.cw / 2) / (L.cw + L.gap));
  if (i < 0 || i >= COLUMNS) return null;
  if (y < L.tabTop - ROW_GAP / 2) return i < CELLS ? `c${i}` : `f${i - CELLS}`;
  return `t${i}`;
}

const where = (p: Pile) => (p[0] === 't' ? `column ${Number(p.slice(1)) + 1}` : p[0] === 'c' ? `free cell ${Number(p.slice(1)) + 1}` : 'foundation');

export const Board = memo(function Board({ game, hidden, fresh, shake, hint, onTap, onDrop }: Props) {
  const { ref, size, drag, handlers } = useCardTable<Pile>({
    hidden,
    canPickUp: (pile, index) => canPickUp(game, pile, index),
    onTap,
    onDragEnd: (pile, index, dx, dy) => {
      const start = cards.find((c) => c.pile === pile && c.index === index);
      if (!start) return;
      const to = pileAt(L, start.x + dx + L.cw / 2, start.y + dy + L.ch / 3);
      if (to && to !== pile) onDrop(pile, index, to);
    },
  });

  const L = computeLayout(size.w, size.h);
  const cards = size.w ? place(game, L) : [];

  const hintTo = hint?.to ?? null;
  const hintToTop = hintTo ? pileCards(game, hintTo).length - 1 : -1;
  const targetCls = (pile: Pile) => (hintTo === pile && hintToTop < 0 ? 'pc-hint-target' : '');

  return (
    <div
      ref={ref}
      class={`pc-table ${hidden ? 'pc-table-hidden' : ''}`}
      style={tableVars(L.cw, L.ch, L.font)}
      aria-label="FreeCell table"
      aria-describedby="fc-board-hint"
      {...handlers}
    >
      {size.w > 0 && (
        <>
          {game.cells.map((card, i) => (
            <Slot key={`slot-c${i}`} pile={`c${i}`} x={colX(L, i)} y={0} cls={`fc-cell ${targetCls(`c${i}`)}`} label={card == null ? `Free cell ${i + 1}, empty` : `Free cell ${i + 1}`} />
          ))}
          {[0, 1, 2, 3].map((f) => (
            <Slot
              key={`slot-f${f}`}
              pile={`f${f}`}
              x={colX(L, CELLS + f)}
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
            const pickable = c.pile[0] !== 'f' && canPickUp(game, c.pile, c.index);
            const hinted = hint && c.pile === hint.from && c.index >= hint.index;
            const cls = [
              dragged ? 'pc-dragging' : '',
              fresh.has(c.card) ? 'pc-fresh' : '',
              shake === c.card ? 'pc-shake' : '',
              hinted ? 'pc-hint' : '',
              hintTo === c.pile && c.index === hintToTop ? 'pc-hint-target' : '',
            ].join(' ');
            return (
              <CardView
                key={c.card}
                card={c.card}
                up
                pile={c.pile}
                index={c.index}
                x={c.x + (dragged ? drag.dx : 0)}
                y={c.y + (dragged ? drag.dy : 0)}
                z={dragged ? 100 + c.z : c.z}
                cls={cls}
                role={pickable ? 'button' : 'img'}
                label={`${cardName(c.card)}, ${where(c.pile)}`}
              />
            );
          })}
        </>
      )}
    </div>
  );
});
