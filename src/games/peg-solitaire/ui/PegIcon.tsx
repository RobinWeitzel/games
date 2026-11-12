/** A cross of pegs with the centre empty, used on the game tile. */
export function PegIcon({ size = 40 }: { size?: number }) {
  const dots: [number, number][] = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if ((r >= 1 && r <= 3) || (c >= 1 && c <= 3)) dots.push([r, c]);
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      {dots.map(([r, c]) =>
        r === 2 && c === 2 ? (
          <circle cx={8 + c * 6} cy={8 + r * 6} r="2.2" fill="none" stroke="#fff" stroke-width="1.4" />
        ) : (
          <circle cx={8 + c * 6} cy={8 + r * 6} r="2.5" fill="#fff" />
        ),
      )}
    </svg>
  );
}
