/** A card with a heart beside four small cells, used on the game tile. */
export function FreeCellIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <rect x="4" y="6" width="9" height="12" rx="2" fill="none" stroke="#fff" stroke-width="2" />
      <rect x="4" y="22" width="9" height="12" rx="2" fill="none" stroke="#fff" stroke-width="2" />
      <rect x="17" y="6" width="19" height="28" rx="3" fill="#fff" />
      <path d="M26.5 27c-4-3.2-6.5-5.4-6.5-8.2 0-1.9 1.4-3.3 3.2-3.3 1.4 0 2.6.8 3.3 2 .7-1.2 1.9-2 3.3-2 1.8 0 3.2 1.4 3.2 3.3 0 2.8-2.5 5-6.5 8.2Z" fill="#0b5a66" />
    </svg>
  );
}
