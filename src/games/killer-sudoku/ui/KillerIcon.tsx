/** A grid with a dashed cage and its sum, used on the game tile. */
export function KillerIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <rect x="5" y="5" width="30" height="30" rx="3" fill="none" stroke="#fff" stroke-width="2.4" />
      <path d="M15 5v30M25 5v30M5 15h30M5 25h30" stroke="#fff" stroke-width="1" opacity="0.5" />
      <rect x="7.5" y="7.5" width="15" height="5" rx="1" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="2 1.6" />
      <path d="M17.5 17.5h5v15h-5Z" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="2 1.6" />
      <text x="8.5" y="12" font-size="5.5" font-weight="700" fill="#fff" font-family="-apple-system, system-ui, sans-serif">11</text>
    </svg>
  );
}
