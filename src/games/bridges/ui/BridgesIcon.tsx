/** Three islands joined by a single and a double bridge, used on the game tile. */
export function BridgesIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <path d="M10 10h20" stroke="#fff" stroke-width="2.2" />
      <path d="M7.5 12v18M12.5 12v18" stroke="#fff" stroke-width="2.2" />
      <circle cx="10" cy="10" r="6" fill="#fff" />
      <circle cx="30" cy="10" r="6" fill="#fff" />
      <circle cx="10" cy="30" r="6" fill="#fff" />
      <text x="10" y="13.2" text-anchor="middle" font-size="8.5" font-weight="700" fill="#155a99" font-family="-apple-system, system-ui, sans-serif">3</text>
      <text x="30" y="13.2" text-anchor="middle" font-size="8.5" font-weight="700" fill="#155a99" font-family="-apple-system, system-ui, sans-serif">1</text>
      <text x="10" y="33.2" text-anchor="middle" font-size="8.5" font-weight="700" fill="#155a99" font-family="-apple-system, system-ui, sans-serif">2</text>
    </svg>
  );
}
