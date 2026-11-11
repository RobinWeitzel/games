/** A light bulb in a grid, used on the game tile. */
export function LightUpIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <rect x="4" y="4" width="10" height="10" rx="1.5" fill="#fff" />
      <rect x="26" y="26" width="10" height="10" rx="1.5" fill="#fff" />
      <path d="M20 9a7 7 0 0 0-4.2 12.6c.7.5 1 1.2 1 2V25h6.4v-1.4c0-.8.3-1.5 1-2A7 7 0 0 0 20 9Z" fill="#fff" />
      <path d="M17.5 28h5M18.5 31h3" stroke="#fff" stroke-width="2" stroke-linecap="round" />
    </svg>
  );
}
