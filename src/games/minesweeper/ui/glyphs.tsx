/** Board glyphs. Shapes carry the meaning (not colour alone): a flag, a mine, a cross for wrong flags. */
export const FlagGlyph = ({ size }: { size?: number }) => (
  <svg class="ms-glyph ms-flag" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path d="M8 3.5v17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
    <path d="M8.6 4 19 8.6l-10.4 4.6Z" fill="var(--ms-flag)" stroke="var(--ms-flag)" stroke-width="1.6" stroke-linejoin="round" />
    <path d="M4.5 20.5h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
    <path class="ms-cross" d="M4 4l16 16M20 4 4 20" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
  </svg>
);

export const MineGlyph = () => (
  <svg class="ms-glyph" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.5v19M2.5 12h19M5.3 5.3l13.4 13.4M18.7 5.3 5.3 18.7" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    <circle cx="12" cy="12" r="6.2" fill="currentColor" />
    <circle cx="9.8" cy="9.8" r="1.6" fill="var(--ms-mine-shine)" />
  </svg>
);
