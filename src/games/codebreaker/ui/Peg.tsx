/**
 * The code symbols. Each has its own shape (the meaning) and colour (a help), drawn with an
 * outline in the label colour so every one stands out in light and dark mode.
 */
export const SYMBOL_NAMES = ['red circle', 'orange triangle', 'yellow square', 'green diamond', 'cyan star', 'blue hexagon', 'purple heart', 'pink cross'];

const PATHS = [
  'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17Z',
  'M12 3 21.5 20h-19Z',
  'M4 4h16v16H4Z',
  'M12 2.5 21.5 12 12 21.5 2.5 12Z',
  'M12 2.5l2.8 6 6.6.7-5 4.4 1.5 6.5L12 16.7l-5.9 3.4 1.5-6.5-5-4.4 6.6-.7Z',
  'M7 3.5h10l5 8.5-5 8.5H7l-5-8.5Z',
  'M12 20.5c-5.5-4.2-9-7.2-9-11a4.6 4.6 0 0 1 9-1.6 4.6 4.6 0 0 1 9 1.6c0 3.8-3.5 6.8-9 11Z',
  'M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z',
];

export function Peg({ symbol, size }: { symbol: number; size?: number | string }) {
  return (
    <svg class={`cb-peg cb-s${symbol}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={PATHS[symbol]} stroke-linejoin="round" />
    </svg>
  );
}

/** Feedback for a guess: filled dots for right place, rings for right symbol in another place. */
export function Feedback({ exact, partial, pegs }: { exact: number; partial: number; pegs: number }) {
  const marks = [...Array(exact).fill('exact'), ...Array(partial).fill('partial'), ...Array(pegs - exact - partial).fill('none')];
  return (
    <span class="cb-feedback" style={{ gridTemplateColumns: `repeat(${Math.ceil(pegs / 2)}, 1fr)` }} aria-hidden="true">
      {marks.map((m) => (
        <span class={`cb-mark cb-${m}`} />
      ))}
    </span>
  );
}
