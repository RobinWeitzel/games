import { useRef } from 'preact/hooks';
import { IconErase } from '../icons';
import './numpad.css';

/**
 * The number pad of number puzzles (Sudoku, Calcudoku…): one key per digit plus Erase.
 *
 * Tap a key: enter the digit. Touch and hold (400ms, optional `onHold`): number lock, for
 * entering the same digit into several cells. Keys show how many of their digit are left
 * (optional) and switch to a lighter look in notes mode (shape and weight, not only colour).
 *
 * Haptics belong to the game (CLAUDE.md §7): `onHoldEnd` fires on release after a hold, inside a
 * user gesture, so the game can play its `selection` haptic there.
 */
export function NumberPad(props: {
  digits: number[];
  /** How many of each digit are still to place (index = digit); keys at 0 are disabled. */
  left?: number[];
  notesMode: boolean;
  locked?: number | null;
  /** Keys per row (default: all digits plus Erase in one row). */
  columns?: number;
  eraseDisabled: boolean;
  onDigit: (d: number) => void;
  onHold?: (d: number) => void;
  onHoldEnd?: () => void;
  onErase: () => void;
}) {
  const cols = props.columns ?? props.digits.length + 1;
  return (
    <div
      class={`numpad ${props.notesMode ? 'notes-mode' : ''}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      aria-label={props.notesMode ? 'Notes keypad' : 'Number keypad'}
    >
      {props.onHold && (
        <span id="numlock-hint" class="sr-only">
          Touch and hold a number to fill several cells with it.
        </span>
      )}
      {props.digits.map((d) => (
        <NumKey
          key={d}
          digit={d}
          left={props.left?.[d]}
          notesMode={props.notesMode}
          locked={props.locked === d}
          onTap={() => props.onDigit(d)}
          onHold={props.onHold && (() => props.onHold!(d))}
          onHoldEnd={props.onHoldEnd}
        />
      ))}
      <button class="num num-erase" aria-label="Erase" disabled={props.eraseDisabled} onClick={props.onErase}>
        <IconErase size={26} />
      </button>
    </div>
  );
}

/**
 * Number key. Tap: enter the digit (or, during number lock, switch/stop the lock).
 * Touch and hold (400ms): lock the digit for entering it into several cells.
 */
function NumKey(props: {
  digit: number;
  left?: number;
  notesMode: boolean;
  locked: boolean;
  onTap: () => void;
  onHold?: () => void;
  onHoldEnd?: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const held = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const cancel = () => clearTimeout(timer.current);
  const { digit: d, left } = props;
  const label = props.notesMode ? `Note ${d}` : left != null ? `${d}, ${left} left` : `${d}`;
  return (
    <button
      class={`num ${props.locked ? 'locked' : ''}`}
      disabled={left === 0}
      aria-pressed={props.onHold ? props.locked : undefined}
      aria-describedby={props.onHold ? 'numlock-hint' : undefined}
      aria-label={`${label}${props.locked ? ', locked' : ''}`}
      onPointerDown={(e) => {
        held.current = false;
        if (!props.onHold) return;
        start.current = { x: e.clientX, y: e.clientY };
        cancel();
        timer.current = setTimeout(() => {
          held.current = true;
          props.onHold!();
        }, 400);
      }}
      onPointerMove={(e) => {
        if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) cancel();
      }}
      onPointerUp={() => {
        cancel();
        if (held.current) props.onHoldEnd?.(); // pointerup is a user gesture, so iOS can play a haptic
      }}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        // A long press already locked the digit; don't also treat it as a tap.
        if (held.current) {
          held.current = false;
          return;
        }
        props.onTap();
      }}
    >
      <span class="num-digit">{d}</span>
      {left != null && <span class="num-left">{left ? left : ''}</span>}
    </button>
  );
}
