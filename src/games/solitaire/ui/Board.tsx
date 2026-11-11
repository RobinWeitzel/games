import { memo } from 'preact/compat';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import {
  Card,
  Move,
  Pile,
  RANKS,
  SUITS,
  SUIT_NAMES,
  SolitaireGame,
  canPickUp,
  cardName,
  isRed,
  pileCards,
  rankOf,
  suitOf,
} from '../state';

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

/** Text presentation selector: keeps ♥ and ♦ from turning into emoji on iOS. */
export const TEXT = '︎';
export const suitText = (c: Card) => SUITS[suitOf(c)] + TEXT;

/** Movement before a press becomes a drag (HIG: cancel taps on movement). */
const SLOP = 10;
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
  const area = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [drag, setDrag] = useState<{ from: Pile; index: number; dx: number; dy: number } | null>(null);
  const press = useRef<{ pile: Pile; index: number; x: number; y: number; pickable: boolean; dragging: boolean } | null>(null);
  // Pointer taps are handled on pointerup; the click that follows must not count again.
  const pointerTapped = useRef(false);

  useLayoutEffect(() => {
    const el = area.current!;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const L = computeLayout(size.w, size.h);
  const cards = size.w ? place(game, L) : [];
  const posOf = (pile: Pile, index: number) => cards.find((c) => c.pile === pile && c.index === index);

  const targetOf = (e: Event): { pile: Pile; index: number } | null => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-pile]');
    return t ? { pile: t.dataset.pile as Pile, index: Number(t.dataset.index) } : null;
  };

  const hintFrom = hint && hint.from !== 's' ? hint : null;
  const hintTo = hint && hint.to !== 's' ? hint.to : null;
  const hintToTop = hintTo ? pileCards(game, hintTo).length - 1 : -1;

  const slot = (pile: Pile, x: number, y: number, label: string, content: preact.ComponentChildren = null, extra = '') => (
    <div
      key={`slot-${pile}`}
      class={`sol-slot ${extra} ${hintTo === pile && hintToTop < 0 ? 'sol-hint-target' : ''}`}
      style={{ transform: `translate(${x}px, ${y}px)` }}
      data-pile={pile}
      data-index={-1}
      role="img"
      aria-label={label}
    >
      {content}
    </div>
  );

  const stockLabel = game.stock.length
    ? `Stock, ${game.stock.length} card${game.stock.length === 1 ? '' : 's'}. Draw ${game.draw}`
    : game.waste.length
      ? 'Stock, empty. Turn the waste over'
      : 'Stock, empty';

  return (
    <div
      ref={area}
      class={`sol-board ${hidden ? 'sol-board-hidden' : ''}`}
      style={{ '--cw': `${L.cw}px`, '--ch': `${L.ch}px`, '--sol-font': `${L.font}px` }}
      aria-label="Solitaire table"
      aria-describedby="sol-board-hint"
      onPointerDown={(e) => {
        if (!e.isPrimary || hidden) return;
        const t = targetOf(e);
        if (!t) return;
        pointerTapped.current = true;
        press.current = { ...t, x: e.clientX, y: e.clientY, pickable: canPickUp(game, t.pile, t.index), dragging: false };
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (!p || !p.pickable) return;
        const dx = e.clientX - p.x;
        const dy = e.clientY - p.y;
        if (!p.dragging && Math.hypot(dx, dy) <= SLOP) return;
        p.dragging = true;
        setDrag({ from: p.pile, index: p.index, dx, dy });
      }}
      onPointerUp={(e) => {
        const p = press.current;
        press.current = null;
        if (p?.dragging) {
          setDrag(null);
          const start = posOf(p.pile, p.index);
          if (start) {
            const to = pileAt(L, start.x + (e.clientX - p.x) + L.cw / 2, start.y + (e.clientY - p.y) + L.ch / 3);
            if (to && to !== p.pile) onDrop(p.pile, p.index, to);
          }
        } else if (p) {
          onTap(p.pile, p.index);
        }
        // If no click follows (finger moved away), don't swallow a later VoiceOver activation.
        setTimeout(() => (pointerTapped.current = false), 500);
      }}
      onPointerCancel={() => {
        press.current = null;
        setDrag(null);
      }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (pointerTapped.current) {
          pointerTapped.current = false; // already handled on pointerup
          return;
        }
        const t = targetOf(e);
        if (t) onTap(t.pile, t.index);
      }}
    >
      {size.w > 0 && (
        <>
          {/* Stock: one button (the top card's back, or "turn over" when used up). */}
          <div
            key="stock"
            class={`sol-slot sol-stock ${game.stock.length ? 'sol-down' : ''} ${hint?.from === 's' ? 'sol-hint' : ''}`}
            style={{ transform: `translate(${colX(L, 0)}px, 0px)` }}
            data-pile="s"
            data-index={game.stock.length - 1}
            role="button"
            aria-label={stockLabel}
          >
            {!game.stock.length && game.waste.length > 0 && <RecycleGlyph />}
          </div>
          {[0, 1, 2, 3].map((f) =>
            slot(`f${f}`, colX(L, 3 + f), 0, `${SUIT_NAMES[f]} foundation, ${game.foundations[f] ? `up to ${RANKS[game.foundations[f] - 1]}` : 'empty'}`, (
              <span class="sol-slot-suit" aria-hidden="true">
                {SUITS[f] + TEXT}
              </span>
            )),
          )}
          {game.tableau.map((col, i) => slot(`t${i}`, colX(L, i), L.tabTop, col.length ? `Column ${i + 1}` : `Column ${i + 1}, empty`, null, 'sol-col-slot'))}

          {cards.map((c) => {
            const dragged = drag && c.pile === drag.from && c.index >= drag.index;
            const pickable = c.up && canPickUp(game, c.pile, c.index);
            const isTop = c.index === pileCards(game, c.pile).length - 1;
            const hinted = hintFrom && c.pile === hintFrom.from && c.index >= hintFrom.index;
            const cls = [
              'sol-card',
              c.up ? 'sol-up' : 'sol-down',
              c.up && isRed(c.card) ? 'sol-red' : '',
              dragged ? 'sol-dragging' : '',
              fresh.has(c.card) ? 'sol-fresh' : '',
              shake === c.card ? 'sol-shake' : '',
              hinted ? 'sol-hint' : '',
              hintTo === c.pile && c.index === hintToTop ? 'sol-hint-target' : '',
            ].join(' ');
            const x = c.x + (dragged ? drag.dx : 0);
            const y = c.y + (dragged ? drag.dy : 0);
            const where = c.pile[0] === 't' ? `column ${Number(c.pile.slice(1)) + 1}` : c.pile === 'w' ? 'waste' : 'foundation';
            return (
              <div
                key={c.card}
                class={cls}
                style={{ transform: `translate(${x}px, ${y}px)`, zIndex: dragged ? 100 + c.z : c.z }}
                data-pile={c.pile}
                data-index={c.index}
                role={pickable ? 'button' : 'img'}
                aria-label={c.up ? `${cardName(c.card)}, ${where}` : `Face-down card, ${where}`}
                aria-hidden={!c.up && !isTop ? 'true' : undefined}
              >
                {c.up && (
                  <>
                    <span class="sol-corner" aria-hidden="true">
                      {RANKS[rankOf(c.card) - 1]}
                      <span class="sol-corner-suit">{suitText(c.card)}</span>
                    </span>
                    <span class="sol-pip" aria-hidden="true">
                      {suitText(c.card)}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
});

const RecycleGlyph = () => (
  <svg class="sol-recycle" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M19 12a7 7 0 1 1-2.05-4.95" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
    <path d="M19.5 3.5v4.5H15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
);
