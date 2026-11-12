/** Three peaks of cards, used on the game tile. */
export function TriPeaksIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <path d="M3 32 10 12l7 20M14 32l6-20 7 20M23 32l7-20 7 20" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round" />
      <rect x="14" y="26" width="12" height="10" rx="2" fill="#fff" />
    </svg>
  );
}
