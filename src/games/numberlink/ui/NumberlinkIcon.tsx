/** Two numbered dots joined by a bent path, used on the game tile. */
export function NumberlinkIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <path d="M10 10v20h20V16" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="10" cy="10" r="6" fill="#fff" />
      <circle cx="30" cy="14" r="6" fill="#fff" />
      <text x="10" y="13" text-anchor="middle" font-size="8.5" font-weight="700" fill="#00525a" font-family="-apple-system, system-ui, sans-serif">1</text>
      <text x="30" y="17" text-anchor="middle" font-size="8.5" font-weight="700" fill="#00525a" font-family="-apple-system, system-ui, sans-serif">1</text>
    </svg>
  );
}
