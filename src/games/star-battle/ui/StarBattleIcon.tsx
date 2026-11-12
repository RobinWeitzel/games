/** A star in a grid of regions, used on the game tile. */
export function StarBattleIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <rect x="5" y="5" width="30" height="30" rx="3" fill="none" stroke="#fff" stroke-width="2.4" />
      <path d="M5 20h15v15M20 5v8h15" fill="none" stroke="#fff" stroke-width="2.2" />
      <path d="M12.5 7.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5Z" fill="#fff" />
      <path d="M27.5 22.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5Z" fill="#fff" />
    </svg>
  );
}
