/** A flag on a green over a row of cards, used on the game tile. */
export function GolfIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <path d="M20 6v18" stroke="#fff" stroke-width="2.2" stroke-linecap="round" />
      <path d="M20 6l10 4-10 4Z" fill="#fff" />
      <rect x="5" y="25" width="9" height="12" rx="2" fill="#fff" />
      <rect x="15.5" y="25" width="9" height="12" rx="2" fill="#fff" />
      <rect x="26" y="25" width="9" height="12" rx="2" fill="none" stroke="#fff" stroke-width="2" />
    </svg>
  );
}
