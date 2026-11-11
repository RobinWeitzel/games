/** A small grid with a filled heart-like picture, used on the game tile. */
const PICTURE = ['01010', '11111', '11111', '01110', '00100'];

export function NonogramIcon({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      {PICTURE.flatMap((row, y) =>
        [...row].map((v, x) => (
          <rect
            key={`${x}-${y}`}
            x={6 + x * 5.8}
            y={6 + y * 5.8}
            width="5"
            height="5"
            rx="1"
            fill="#fff"
            fill-opacity={v === '1' ? 1 : 0.28}
          />
        )),
      )}
    </svg>
  );
}
