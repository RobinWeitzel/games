/** A row of code symbols with feedback marks, used on the game tile. */
export function CodebreakerIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <circle cx="9" cy="14" r="4.5" fill="#fff" />
      <path d="M20 9.5l5 9h-10Z" fill="#fff" />
      <rect x="27" y="10" width="8" height="8" rx="1" fill="#fff" />
      <circle cx="13" cy="28" r="3" fill="#fff" />
      <circle cx="21" cy="28" r="3" fill="#fff" />
      <circle cx="29" cy="28" r="2.4" fill="none" stroke="#fff" stroke-width="1.6" />
    </svg>
  );
}
