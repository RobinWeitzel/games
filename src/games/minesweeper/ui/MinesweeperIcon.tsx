/** A mine next to a flag, used on the game tile. */
export function MinesweeperIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <g stroke="#fff" stroke-width="2.4" stroke-linecap="round">
        <path d="M15 11v20M5 21h20M8 14l14 14M22 14 8 28" />
      </g>
      <circle cx="15" cy="21" r="7" fill="#fff" />
      <circle cx="12.6" cy="18.6" r="1.8" fill="#3a4450" />
      <path d="M29 6v28" stroke="#fff" stroke-width="2.4" stroke-linecap="round" />
      <path d="M29 6l8 4.5-8 4.5Z" fill="#fff" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" />
      <path d="M24 34h10" stroke="#fff" stroke-width="2.4" stroke-linecap="round" />
    </svg>
  );
}
