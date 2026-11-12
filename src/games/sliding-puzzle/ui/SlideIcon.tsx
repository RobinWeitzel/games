/** A 3 × 3 tile board with one tile missing, used on the game tile. */
export function SlideIcon({ size = 40 }: { size?: number }) {
  const tiles = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      {tiles.map((k) => (
        <rect x={5 + (k % 3) * 10.5} y={5 + Math.floor(k / 3) * 10.5} width="9" height="9" rx="2" fill="#fff" />
      ))}
    </svg>
  );
}
