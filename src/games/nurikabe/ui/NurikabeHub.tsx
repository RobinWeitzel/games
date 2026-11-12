import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, DailyCard, HowToPlayRow, LoadingOverlay, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { todayKey } from '../../../core/daily';
import { formatTime } from '../../../core/format';
import { RULES } from '../rules';
import { nkSave, nkStats } from '../storage';
import { progress, type NurikabeMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, sizeText, startGame } from '../session';
import { NurikabePlay } from './NurikabePlay';

const MODE_COLORS = { easy: '#34c759', medium: '#ff9f0a', hard: '#ff453a' };

export function NurikabeHub() {
  const nav = useNav();
  const saved = useStore(nkSave);
  const [confirm, setConfirm] = useState<NurikabeMode | null>(null);
  const [loading, setLoading] = useState(false);
  const today = todayKey();
  const inProgress = saved && saved.status === 'playing' ? saved : null;
  const dailyInProgress = inProgress?.mode === 'daily' && inProgress.date === today;

  const launch = async (mode: NurikabeMode) => {
    setConfirm(null);
    setLoading(true);
    try {
      await startGame(mode);
      nav.push(<NurikabePlay />);
    } finally {
      setLoading(false);
    }
  };
  const request = (mode: NurikabeMode) => {
    if (loading) return;
    if (mode === 'daily' && dailyInProgress) return nav.push(<NurikabePlay />);
    if (hasGameToAbandon()) setConfirm(mode);
    else void launch(mode);
  };

  return (
    <Screen largeTitle="Nurikabe" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${formatTime(inProgress.elapsedMs)} · ${Math.round(progress(inProgress) * 100)}%`}
          onClick={() => nav.push(<NurikabePlay />)}
        />
      )}
      <DailyCard stats={nkStats} badge={`Medium · ${sizeText('medium')}`} inProgress={dailyInProgress} onPlay={() => request('daily')} />
      <ModeList
        stats={nkStats}
        modes={(['easy', 'medium', 'hard'] as const).map((m) => ({ id: m, label: MODE_LABEL[m], color: MODE_COLORS[m] }))}
        onSelect={(id) => request(id as NurikabeMode)}
      />
      <HowToPlayRow rules={RULES} gameName="Nurikabe" />
      <StatsRow stats={nkStats} gameName="Nurikabe" />
      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && void launch(confirm)} />
      <LoadingOverlay show={loading} label="Preparing puzzle…" />
    </Screen>
  );
}
