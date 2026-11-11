/** Tool glyphs: a filled square for Fill, a cross for Cross (the same marks as on the board). */
export const FillGlyph = () => (
  <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="2.5" fill="currentColor" />
  </svg>
);

export const CrossGlyph = () => (
  <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6" />
    <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
  </svg>
);
