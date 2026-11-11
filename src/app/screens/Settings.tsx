import { useRef, useState } from 'preact/hooks';
import { Screen } from '../../ui/nav';
import { Row, Section, Segmented, Sheet, Toggle } from '../../ui/components';
import { ThemeSetting, settingsStore } from '../../core/settings';
import { createBackup, restoreBackup, useStore } from '../../core/storage';
import { GAMES } from '../../games/registry';

export function Settings() {
  const settings = useStore(settingsStore);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingImport, setPendingImport] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);

  const doExport = async () => {
    const json = JSON.stringify(createBackup(), null, 2);
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

  const readImport = async (file: File) => {
    try {
      setPendingImport(JSON.parse(await file.text()));
    } catch {
      setMessage('Could not read this file.');
    }
  };

  const doImport = () => {
    try {
      restoreBackup(pendingImport);
      // Reload so every store re-reads (and migrates) the restored data.
      location.reload();
    } catch (e) {
      setPendingImport(null);
      setMessage(e instanceof Error ? e.message : 'Could not restore this backup.');
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

      {GAMES.map((g) => g.SettingsSection && <g.SettingsSection key={g.id} />)}

      <Section
        header="Data"
        footer="Your games and statistics are stored only on this device. Deleting the app from your Home Screen deletes them too, so export a backup now and then."
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
          if (f) void readImport(f);
          (e.currentTarget as HTMLInputElement).value = '';
        }}
      />

      <p class="about">Games {__APP_VERSION__} · Works offline · No accounts, no tracking</p>

      <Sheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all statistics?"
        message="Best times, streaks and daily history of all games will be deleted. This can't be undone."
        actions={[
          {
            label: 'Reset Statistics',
            style: 'destructive',
            onClick: () => {
              GAMES.forEach((g) => g.stats.reset());
              setConfirmReset(false);
            },
          },
        ]}
      />
      <Sheet
        open={pendingImport != null}
        onClose={() => setPendingImport(null)}
        title="Restore this backup?"
        message="All current games, statistics and settings on this device will be replaced."
        actions={[{ label: 'Restore Backup', style: 'destructive', onClick: doImport }]}
      />
      <Sheet open={!!message} onClose={() => setMessage(null)} title={message} cancel="OK" />
    </Screen>
  );
}
