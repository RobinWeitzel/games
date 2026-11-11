/** Small 3×3 grid glyph used on the game tile. */
export function SudokuIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <rect x="3" y="3" width="34" height="34" rx="6" fill="none" stroke="#fff" stroke-width="2.5" />
      <path d="M14.3 3v34M25.7 3v34M3 14.3h34M3 25.7h34" stroke="#fff" stroke-width="1.5" opacity=".7" />
      <g fill="#fff" font-family="-apple-system, system-ui, sans-serif" font-weight="700" font-size="8.5" text-anchor="middle">
        <text x="8.7" y="11.8">5</text>
        <text x="20" y="23.2">3</text>
        <text x="31.3" y="34.6">9</text>
        <text x="31.3" y="11.8">7</text>
      </g>
    </svg>
  );
}
