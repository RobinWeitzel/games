import { Row, Section, Toggle } from '../../../ui/components';
import { useStore } from '../../../core/storage';
import { sudokuSettings } from '../storage';

/** Sudoku's section in the app Settings screen. */
export function SudokuSettings() {
  const s = useStore(sudokuSettings);
  const set = (patch: Partial<typeof s>) => sudokuSettings.set((prev) => ({ ...prev, ...patch }));
  return (
    <Section header="Sudoku" footer="Assisted games (with hints) never count towards best times.">
      <Row title="Mistake limit" subtitle="Game over after 3 mistakes">
        <Toggle label="Mistake limit" checked={s.mistakeLimit} onChange={(v) => set({ mistakeLimit: v })} />
      </Row>
      <Row title="Highlight same numbers">
        <Toggle label="Highlight same numbers" checked={s.highlightSame} onChange={(v) => set({ highlightSame: v })} />
      </Row>
      <Row title="Auto-remove notes" subtitle="When a number is placed">
        <Toggle label="Auto-remove notes" checked={s.autoRemoveNotes} onChange={(v) => set({ autoRemoveNotes: v })} />
      </Row>
      <Row title="Fill single notes" subtitle="When a cell is left with one note">
        <Toggle label="Fill single notes" checked={s.autoFillSingles} onChange={(v) => set({ autoFillSingles: v })} />
      </Row>
    </Section>
  );
}
