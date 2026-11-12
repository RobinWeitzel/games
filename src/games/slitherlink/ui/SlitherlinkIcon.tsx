/** Dots, a loop and two numbers, used on the game tile. */
export function SlitherlinkIcon({ size = 40 }: { size?: number }) {
  const dots: number[] = [7, 20, 33];
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <path d="M7 7H33V20H20V33H7Z" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round" />
      {dots.map((x) => dots.map((y) => <circle cx={x} cy={y} r="2" fill="#fff" />))}
      <text x="26.5" y="17" font-size="8" font-weight="700" text-anchor="middle" fill="#fff" font-family="-apple-system, system-ui, sans-serif">
        3
      </text>
      <text x="13.5" y="30" font-size="8" font-weight="700" text-anchor="middle" fill="#fff" font-family="-apple-system, system-ui, sans-serif">
        3
      </text>
    </svg>
  );
}
