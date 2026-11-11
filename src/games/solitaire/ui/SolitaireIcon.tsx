/** Two overlapping cards with a spade, used on the game tile. */
export function SolitaireIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <rect x="5" y="9" width="18" height="25" rx="3" fill="none" stroke="#fff" stroke-width="2.2" transform="rotate(-12 14 21.5)" />
      <rect x="16" y="6" width="19" height="27" rx="3" fill="#fff" />
      <path d="M25.5 12.5c-2.6 3-6 4.8-6 7.8 0 1.8 1.4 3 3 3 1 0 1.9-.5 2.4-1.2-.2 1.4-.8 2.6-1.8 3.6h4.8c-1-1-1.6-2.2-1.8-3.6.5.7 1.4 1.2 2.4 1.2 1.6 0 3-1.2 3-3 0-3-3.4-4.8-6-7.8Z" fill="#145c34" />
    </svg>
  );
}
