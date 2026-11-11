/** A 3 × 3 grid with a cage label, used on the game tile. */
export function CalcudokuIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <rect x="5" y="5" width="30" height="30" rx="3" fill="none" stroke="#fff" stroke-width="2.4" />
      <path d="M15 5v30M25 5v30M5 15h30M5 25h30" stroke="#fff" stroke-width="1" opacity="0.6" />
      <path d="M5 15h20v20" fill="none" stroke="#fff" stroke-width="2.4" />
      <text x="7.5" y="13" font-size="7.5" font-weight="700" fill="#fff" font-family="-apple-system, system-ui, sans-serif">6+</text>
      <text x="26.5" y="33" font-size="9" font-weight="600" fill="#fff" font-family="-apple-system, system-ui, sans-serif">3</text>
    </svg>
  );
}
