import { useRef, useState } from 'preact/hooks';
import { Screen } from '../nav';
import { Row, Section, Segmented, Sheet, Toggle } from '../../ui/components';
import { Settings as S, ThemeSetting, settingsStore } from '../../core/settings';
import { useStore } from '../../core/store';
import { exportAll, importAll } from '../../core/storage';
import { resetStats, statsStore } from '../../core/stats';
import { dailyStore } from '../../core/daily';
import { savedGame } from '../../games/sudoku/saved';

const reloadAll = () => [settingsStore, statsStore, dailyStore, savedGame].forEach((s) => s.reload());

export function Settings() {
  const settings = useStore(settingsStore);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const setSudoku = (patch: Partial<S['sudoku']>) =>
    settingsStore.set((s) => ({ ...s, sudoku: { ...s.sudoku, ...patch } }));

  const doExport = async () => {
    const json = JSON.stringify(exportAll(), null, 2);
    const name = `games-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([json], name, { type: 'application/json' });
    // iOS: the share sheet offers "Save to Files", AirDrop, etc.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Games backup' });
      } catch {
        /* cancelled */
      }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const doImport = async (file: File) => {
    try {
      importAll(JSON.parse(await file.text()));
      reloadAll();
      setMessage('Backup restored.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not read this file.');
    }
  };

  return (
    <Screen title="Settings" back="Games">
      <Section header="Appearance">
        <Row title="Theme">
          <Segmented<ThemeSetting>
            value={settings.theme}
            onChange={(theme) => settingsStore.set((s) => ({ ...s, theme }))}
            options={[
              { value: 'system', label: 'Auto' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Row>
        <Row title="Haptics">
          <Toggle label="Haptics" checked={settings.haptics} onChange={(haptics) => settingsStore.set((s) => ({ ...s, haptics }))} />
        </Row>
      </Section>

      <Section header="Sudoku" footer="Assisted games (with hints) never count towards best times.">
        <Row title="Mistake limit" subtitle="Game over after 3 mistakes">
          <Toggle label="Mistake limit" checked={settings.sudoku.mistakeLimit} onChange={(v) => setSudoku({ mistakeLimit: v })} />
        </Row>
        <Row title="Highlight same numbers">
          <Toggle label="Highlight same numbers" checked={settings.sudoku.highlightSame} onChange={(v) => setSudoku({ highlightSame: v })} />
        </Row>
        <Row title="Auto-remove notes" subtitle="When a number is placed">
          <Toggle label="Auto-remove notes" checked={settings.sudoku.autoRemoveNotes} onChange={(v) => setSudoku({ autoRemoveNotes: v })} />
        </Row>
      </Section>

      <Section
        header="Data"
        footer="Statistics are stored only on this device. Deleting the app from your Home Screen deletes them too, so export a backup now and then."
      >
        <Row title="Export backup" chevron onClick={doExport} />
        <Row title="Import backup" chevron onClick={() => fileRef.current?.click()} />
        <Row title="Reset statistics" destructive onClick={() => setConfirmReset(true)} />
      </Section>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = (e.currentTarget as HTMLInputElement).files?.[0];
          if (f) void doImport(f);
          (e.currentTarget as HTMLInputElement).value = '';
        }}
      />

      <p class="about">Games {__APP_VERSION__} · Works offline · No accounts, no tracking</p>

      <Sheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all statistics?"
        message="Best times, streaks and daily history will be deleted. This can't be undone."
        actions={[
          {
            label: 'Reset Statistics',
            style: 'destructive',
            onClick: () => {
              resetStats();
              dailyStore.set({});
              setConfirmReset(false);
            },
          },
        ]}
      />
      <Sheet open={!!message} onClose={() => setMessage(null)} title={message} cancel="OK" />
    </Screen>
  );
}
