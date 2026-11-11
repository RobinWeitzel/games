/** A grid with four discs in a diagonal line, used on the game tile. */
export function FourIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <rect x="4" y="6" width="32" height="28" rx="4" fill="none" stroke="#fff" stroke-width="2" />
      {[0, 1, 2, 3].map((k) => (
        <circle cx={10 + k * 6.7} cy={28 - k * 6} r="3" fill="#fff" />
      ))}
    </svg>
  );
}
