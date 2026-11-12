/** A shaded sea around an island of two cells with its number, used on the game tile. */
export function NurikabeIcon({ size = 40 }: { size?: number }) {
  // A 3 × 3 grid of 10-unit cells from (5, 5); the middle row's left two cells are the island.
  const sea = [
    [5, 5],
    [15, 5],
    [25, 5],
    [25, 15],
    [5, 25],
    [15, 25],
    [25, 25],
  ];
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <rect x="5" y="5" width="30" height="30" rx="2" fill="none" stroke="#fff" stroke-width="2" />
      {sea.map(([x, y]) => (
        <rect x={x} y={y} width="10" height="10" fill="#fff" />
      ))}
      <text x="10" y="23.5" font-size="9" font-weight="700" text-anchor="middle" fill="#fff" font-family="-apple-system, system-ui, sans-serif">
        2
      </text>
      <circle cx="20" cy="20" r="1.6" fill="#fff" />
    </svg>
  );
}
