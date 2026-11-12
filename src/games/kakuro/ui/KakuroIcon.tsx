/** A clue cell with its diagonal and two sums beside white cells, used on the game tile. */
export function KakuroIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="2" fill="#fff" />
      <path d="M6.5 6.5l11 11" stroke="#b03a2e" stroke-width="1.4" />
      <text x="17" y="11.5" font-size="6" font-weight="700" text-anchor="end" fill="#85291f" font-family="-apple-system, system-ui, sans-serif">16</text>
      <text x="6.5" y="17.5" font-size="6" font-weight="700" fill="#85291f" font-family="-apple-system, system-ui, sans-serif">3</text>
      <rect x="21" y="5" width="14" height="14" rx="2" fill="none" stroke="#fff" stroke-width="2" />
      <rect x="5" y="21" width="14" height="14" rx="2" fill="none" stroke="#fff" stroke-width="2" />
      <rect x="21" y="21" width="14" height="14" rx="2" fill="none" stroke="#fff" stroke-width="2" />
      <text x="28" y="16.5" font-size="10" font-weight="700" text-anchor="middle" fill="#fff" font-family="-apple-system, system-ui, sans-serif">7</text>
      <text x="12" y="32.5" font-size="10" font-weight="700" text-anchor="middle" fill="#fff" font-family="-apple-system, system-ui, sans-serif">2</text>
    </svg>
  );
}
