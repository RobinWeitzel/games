import { memo } from 'preact/compat';
import { CardView, Slot, tableVars, useCardTable } from '../../../ui/cards';
import { Card, cardName } from '../../../core/cards';
import { COLUMNS, Move, Pile, RUNS, SpiderGame, canPickUp, dealsLeft } from '../state';

interface Props {
  game: SpiderGame;
  hidden: boolean;
  /** Cards moved by the last move (they settle in with a short pop). */
  fresh: Set<Card>;
  /** A card that couldn't move (it shakes). */
  shake: Card | null;
  hint: Move | null;
  /** Tap (or VoiceOver / Switch Control / keyboard activation) on a card, an empty column (index -1) or the stock. */
  onTap: (pile: Pile, index: number) => void;
  /** A drag ended over a column. */
  onDrop: (from: Pile, index: number, to: Pile) => void;
}

const ROW_GAP = 8;
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

/** The largest cards that fit 10 columns across, leaving room for long fanned columns. */
function computeLayout(w: number, h: number): Layout {
  const gap = w < 400 ? 2 : 5;
  const cw = Math.max(20, Math.floor(Math.min((w - (COLUMNS - 1) * gap) / COLUMNS, (h - ROW_GAP) / (RATIO * 5))));
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

/** Vertical offsets in a column: squeezed so the longest column still fits the height. */
function columnSteps(L: Layout, down: number, up: number) {
  const avail = L.height - L.tabTop - L.ch;
  let ds = Math.round(L.ch * 0.12);
  let us = Math.round(L.ch * 0.34);
  const need = () => down * ds + Math.max(0, up - 1) * us;
  // First face-down cards get closer, then face-up ones, as long as the rank stays readable…
  if (need() > avail && down > 0) ds = Math.max(3, (avail - Math.max(0, up - 1) * us) / down);
  if (need() > avail && up > 1) us = Math.max(L.font + 4, (avail - down * ds) / (up - 1));
  // …and if that's still too long, whatever fits.
  if (need() > avail && up > 1) us = Math.max(4, (avail - down * ds) / (up - 1));
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

function place(g: SpiderGame, L: Layout): Placed[] {
  const out: Placed[] = [];
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

/** The column under a point in board coordinates (nothing can be dropped on the top row). */
function pileAt(L: Layout, x: number, y: number): Pile | null {
  const i = Math.round((x - L.left - L.cw / 2) / (L.cw + L.gap));
  if (i < 0 || i >= COLUMNS || y < L.tabTop - ROW_GAP / 2) return null;
  return `t${i}`;
}

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
  const deals = dealsLeft(game);
  const hintTo = hint && hint.to !== 's' ? hint.to : null;
  const hintToTop = hintTo ? game.tableau[Number(hintTo.slice(1))].length - 1 : -1;
  // Completed runs: their kings, fanned from the left. The stock: one back per deal, fanned from the right.
  const fan = Math.round(L.cw * 0.4);

  return (
    <div
      ref={ref}
      class={`pc-table ${hidden ? 'pc-table-hidden' : ''}`}
      style={tableVars(L.cw, L.ch, L.font)}
      aria-label="Spider table"
      aria-describedby="sp-board-hint"
      {...handlers}
    >
      {size.w > 0 && (
        <>
          <div class="pc-slot sp-done" style={{ transform: `translate(${colX(L, 0)}px, 0px)` }} role="img" aria-label={`Completed runs, ${game.done.length} of ${RUNS}`} />
          {game.done.map((run, k) => (
            <CardView key={run[0]} card={run[0]} up pile="done" index={k} x={colX(L, 0) + k * fan} y={0} z={k + 1} role="img" label="" ariaHidden />
          ))}

          {Array.from({ length: Math.max(0, deals - 1) }, (_, k) => (
            <div key={`back${k}`} class="pc-slot pc-down" data-pile="s" data-index={-1} style={{ transform: `translate(${colX(L, COLUMNS - 1) - (deals - 1 - k) * fan}px, 0px)` }} aria-hidden="true" />
          ))}
          <Slot
            key="stock"
            pile="s"
            index={game.stock.length - 1}
            x={colX(L, COLUMNS - 1)}
            y={0}
            cls={`pc-stock ${deals ? 'pc-down' : ''} ${hint?.from === 's' ? 'pc-hint' : ''}`}
            role="button"
            label={deals ? `Stock, ${deals} deal${deals === 1 ? '' : 's'} left. Deal` : 'Stock, empty'}
          />

          {game.tableau.map((col, i) => (
            <Slot
              key={`slot-t${i}`}
              pile={`t${i}`}
              x={colX(L, i)}
              y={L.tabTop}
              cls={hintTo === `t${i}` && hintToTop < 0 ? 'pc-hint-target' : ''}
              label={col.length ? `Column ${i + 1}` : `Column ${i + 1}, empty`}
            />
          ))}

          {cards.map((c) => {
            const dragged = drag && c.pile === drag.from && c.index >= drag.index;
            const pickable = c.up && canPickUp(game, c.pile, c.index);
            const isTop = c.index === game.tableau[Number(c.pile.slice(1))].length - 1;
            const hinted = hint && hint.from === c.pile && c.index >= hint.index;
            const cls = [
              dragged ? 'pc-dragging' : '',
              fresh.has(c.card) ? 'pc-fresh' : '',
              shake === c.card ? 'pc-shake' : '',
              hinted ? 'pc-hint' : '',
              hintTo === c.pile && c.index === hintToTop ? 'pc-hint-target' : '',
            ].join(' ');
            const where = `column ${Number(c.pile.slice(1)) + 1}`;
            return (
              <CardView
                key={c.card}
                card={c.card}
                up={c.up}
                pile={c.pile}
                index={c.index}
                x={c.x + (dragged ? drag.dx : 0)}
                y={c.y + (dragged ? drag.dy : 0)}
                z={dragged ? 200 + c.z : c.z}
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
