/** Four discs in the starting square, used on the game tile. */
export function ReversiIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <circle cx="13" cy="13" r="7" fill="#fff" />
      <circle cx="27" cy="27" r="7" fill="#fff" />
      <circle cx="27" cy="13" r="6" fill="none" stroke="#fff" stroke-width="2" />
      <circle cx="13" cy="27" r="6" fill="none" stroke="#fff" stroke-width="2" />
    </svg>
  );
}
