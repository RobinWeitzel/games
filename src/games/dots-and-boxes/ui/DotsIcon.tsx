/** A 2 × 2 grid of dots with one closed box, used on the game tile. */
export function DotsIcon({ size = 40 }: { size?: number }) {
  const dots = [8, 20, 32];
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" fill="#fff" opacity="0.45" />
      <path d="M8 8h24M8 8v12h12V8M20 20h12" stroke="#fff" stroke-width="2.4" fill="none" />
      {dots.map((x) => dots.map((y) => <circle cx={x} cy={y} r="2.6" fill="#fff" />))}
    </svg>
  );
}
