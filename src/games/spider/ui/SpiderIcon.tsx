/** A fanned column of three cards, used on the game tile. */
export function SpiderIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <rect x="10" y="3" width="20" height="16" rx="3" fill="none" stroke="#fff" stroke-width="2" />
      <rect x="10" y="10" width="20" height="16" rx="3" fill="#4b2f99" stroke="#fff" stroke-width="2" />
      <rect x="10" y="17" width="20" height="20" rx="3" fill="#fff" />
      <path d="M20 21.5c-2.2 2.5-5 4-5 6.5 0 1.5 1.2 2.5 2.5 2.5.8 0 1.6-.4 2-1-.2 1.2-.7 2.2-1.5 3h4c-.8-.8-1.3-1.8-1.5-3 .4.6 1.2 1 2 1 1.3 0 2.5-1 2.5-2.5 0-2.5-2.8-4-5-6.5Z" fill="#4b2f99" />
    </svg>
  );
}
