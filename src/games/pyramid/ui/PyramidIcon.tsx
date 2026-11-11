/** A pyramid of cards, used on the game tile. */
export function PyramidIcon({ size = 40 }: { size?: number }) {
  const cards: [number, number][] = [
    [17, 6],
    [12, 15],
    [22, 15],
    [7, 24],
    [17, 24],
    [27, 24],
  ];
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      {cards.map(([x, y]) => (
        <rect x={x - 1} y={y} width="8" height="11" rx="1.5" fill="#fff" stroke="#5a1f66" stroke-width="1" />
      ))}
    </svg>
  );
}
