/** The four operations in a 2×2 grid, used on the game tile. */
export function NumbersIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <g fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round">
        <path d="M11 5v12M5 11h12" />
        <path d="M23 11h12" />
        <path d="M6.8 24.8l8.4 8.4M15.2 24.8l-8.4 8.4" />
        <path d="M23 29h12" />
      </g>
      <g fill="#fff">
        <circle cx="29" cy="24.2" r="1.8" />
        <circle cx="29" cy="33.8" r="1.8" />
      </g>
    </svg>
  );
}
