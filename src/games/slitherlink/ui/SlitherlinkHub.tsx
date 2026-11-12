import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, DailyCard, HowToPlayRow, LoadingOverlay, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { todayKey } from '../../../core/daily';
import { formatTime } from '../../../core/format';
import { RULES } from '../rules';
import { slSave, slStats } from '../storage';
import { progress, type SlitherlinkMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, sizeText, startGame } from '../session';
import { SlitherlinkPlay } from './SlitherlinkPlay';

const MODE_COLORS = { easy: '#34c759', medium: '#ff9f0a', hard: '#ff453a' };

export function SlitherlinkHub() {
  const nav = useNav();
  const saved = useStore(slSave);
  const [confirm, setConfirm] = useState<SlitherlinkMode | null>(null);
  const [loading, setLoading] = useState(false);
  const today = todayKey();
  const inProgress = saved && saved.status === 'playing' ? saved : null;
  const dailyInProgress = inProgress?.mode === 'daily' && inProgress.date === today;

  const launch = async (mode: SlitherlinkMode) => {
    setConfirm(null);
    setLoading(true);
    try {
      await startGame(mode);
      nav.push(<SlitherlinkPlay />);
    } finally {
      setLoading(false);
    }
  };
  const request = (mode: SlitherlinkMode) => {
    if (loading) return;
    if (mode === 'daily' && dailyInProgress) return nav.push(<SlitherlinkPlay />);
    if (hasGameToAbandon()) setConfirm(mode);
    else void launch(mode);
  };

  return (
    <Screen largeTitle="Slitherlink" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${formatTime(inProgress.elapsedMs)} · ${Math.round(progress(inProgress) * 100)}%`}
          onClick={() => nav.push(<SlitherlinkPlay />)}
        />
      )}
      <DailyCard stats={slStats} badge={`Medium · ${sizeText('medium')}`} inProgress={dailyInProgress} onPlay={() => request('daily')} />
      <ModeList
        stats={slStats}
        modes={(['easy', 'medium', 'hard'] as const).map((m) => ({ id: m, label: MODE_LABEL[m], color: MODE_COLORS[m] }))}
        onSelect={(id) => request(id as SlitherlinkMode)}
      />
      <HowToPlayRow rules={RULES} gameName="Slitherlink" />
      <StatsRow stats={slStats} gameName="Slitherlink" />
      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && void launch(confirm)} />
      <LoadingOverlay show={loading} label="Preparing puzzle…" />
    </Screen>
  );
}
