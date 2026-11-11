import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useClickEcho } from '../game/clickEcho';
import { Card, RANKS, SUITS, isRed, rankOf, suitOf } from '../../core/cards';
import './cards.css';

/**
 * Shared table for card games (Solitaire, FreeCell, Spider): card faces and backs, empty pile
 * slots, and the touch handling (tap a card, or drag it onto another pile). Each game keeps its
 * own layout (where piles and cards go) and its own rules; this only draws and reports touches.
 *
 * Every card and slot carries `data-pile` and `data-index` (-1 for an empty pile), which is how
 * touches find what they hit.
 */

/** Text presentation selector: keeps ♥ and ♦ from turning into emoji on iOS. */
export const TEXT = '︎';
export const suitText = (c: Card) => SUITS[suitOf(c)] + TEXT;
/** "7♥" for status lines. */
export const shortName = (c: Card) => `${RANKS[rankOf(c) - 1]}${suitText(c)}`;

/** Movement before a press becomes a drag (HIG: cancel taps on movement). */
const SLOP = 10;

export interface Drag<P extends string> {
  from: P;
  index: number;
  dx: number;
  dy: number;
}

interface TableOptions<P extends string> {
  /** Paused: touches are ignored. */
  hidden: boolean;
  /** Can the cards from `index` up be dragged? */
  canPickUp: (pile: P, index: number) => boolean;
  /** Tap (or VoiceOver / Switch Control / keyboard activation) on a card or an empty pile (index -1). */
  onTap: (pile: P, index: number) => void;
  /** A drag ended: the card at `index` (and those on it) moved by (dx, dy). */
  onDragEnd: (pile: P, index: number, dx: number, dy: number) => void;
}

/**
 * The touch handling of a card table. Spread `handlers` on the table element and give it `ref`;
 * `size` is its measured size (0 until laid out), `drag` the cards being dragged.
 */
export function useCardTable<P extends string>({ hidden, canPickUp, onTap, onDragEnd }: TableOptions<P>) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [drag, setDrag] = useState<Drag<P> | null>(null);
  const press = useRef<{ pile: P; index: number; x: number; y: number; pickable: boolean; dragging: boolean } | null>(null);
  // Pointer taps are handled on pointerup; the click that follows must not count again.
  const echo = useClickEcho();

  useLayoutEffect(() => {
    const el = ref.current!;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const targetOf = (e: Event): { pile: P; index: number } | null => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-pile]');
    return t ? { pile: t.dataset.pile as P, index: Number(t.dataset.index) } : null;
  };

  const handlers = {
    onPointerDown(e: PointerEvent) {
      if (!e.isPrimary || hidden) return;
      const t = targetOf(e);
      if (!t) return;
      press.current = { ...t, x: e.clientX, y: e.clientY, pickable: canPickUp(t.pile, t.index), dragging: false };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    onPointerMove(e: PointerEvent) {
      const p = press.current;
      if (!p || !p.pickable) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (!p.dragging && Math.hypot(dx, dy) <= SLOP) return;
      p.dragging = true;
      setDrag({ from: p.pile, index: p.index, dx, dy });
    },
    onPointerUp(e: PointerEvent) {
      const p = press.current;
      press.current = null;
      if (p?.dragging) {
        setDrag(null);
        onDragEnd(p.pile, p.index, e.clientX - p.x, e.clientY - p.y);
      } else if (p) {
        onTap(p.pile, p.index);
      }
      echo.touched();
    },
    onPointerCancel() {
      press.current = null;
      setDrag(null);
      echo.touched();
    },
    onContextMenu(e: Event) {
      e.preventDefault();
    },
    onClick(e: MouseEvent) {
      if (echo.isEcho(e)) return; // already handled on pointerup
      const t = targetOf(e);
      if (t) onTap(t.pile, t.index);
    },
  };

  return { ref, size, drag, handlers };
}

/** CSS variables for the table element: card width and height, corner text size (px). */
export const tableVars = (cw: number, ch: number, font: number) => ({ '--cw': `${cw}px`, '--ch': `${ch}px`, '--pc-font': `${font}px` });

interface CardViewProps {
  card: Card;
  up: boolean;
  x: number;
  y: number;
  z: number;
  pile: string;
  index: number;
  /** Extra classes: pc-dragging, pc-fresh, pc-shake, pc-hint, pc-hint-target… */
  cls?: string;
  /** 'button' when the card can be moved, else 'img'. */
  role: 'button' | 'img';
  label: string;
  /** Hidden from VoiceOver (e.g. face-down cards under the top one). */
  ariaHidden?: boolean;
}

/** One card on the table: a face with rank and suit (never colour alone), or a patterned back. */
export function CardView({ card, up, x, y, z, pile, index, cls = '', role, label, ariaHidden }: CardViewProps) {
  return (
    <div
      class={`pc-card ${up ? 'pc-up' : 'pc-down'} ${up && isRed(card) ? 'pc-red' : ''} ${cls}`}
      style={{ transform: `translate(${x}px, ${y}px)`, zIndex: z }}
      data-pile={pile}
      data-index={index}
      role={role}
      aria-label={label}
      aria-hidden={ariaHidden ? 'true' : undefined}
    >
      {up && (
        <>
          <span class="pc-corner" aria-hidden="true">
            {RANKS[rankOf(card) - 1]}
            <span class="pc-corner-suit">{suitText(card)}</span>
          </span>
          <span class="pc-pip" aria-hidden="true">
            {suitText(card)}
          </span>
        </>
      )}
    </div>
  );
}

interface SlotProps {
  pile: string;
  x: number;
  y: number;
  label: string;
  /** Extra classes (pc-hint-target, pc-down for a stock with cards…). */
  cls?: string;
  role?: 'button' | 'img';
  /** data-index; -1 (an empty pile) by default. */
  index?: number;
  children?: ComponentChildren;
}

/** The place of a pile (shown when it's empty, under its cards otherwise). */
export function Slot({ pile, x, y, label, cls = '', role = 'img', index = -1, children }: SlotProps) {
  return (
    <div class={`pc-slot ${cls}`} style={{ transform: `translate(${x}px, ${y}px)` }} data-pile={pile} data-index={index} role={role} aria-label={label}>
      {children}
    </div>
  );
}

/** A big suit symbol for an empty foundation slot. */
export const SlotSuit = ({ suit }: { suit: number }) => (
  <span class="pc-slot-suit" aria-hidden="true">
    {SUITS[suit] + TEXT}
  </span>
);

/** "Turn the waste over" on an empty stock. */
export const RecycleGlyph = () => (
  <svg class="pc-recycle" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M19 12a7 7 0 1 1-2.05-4.95" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
    <path d="M19.5 3.5v4.5H15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
);
