import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, DailyCard, HowToPlayRow, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { todayKey } from '../../../core/daily';
import { formatTime } from '../../../core/format';
import { RULES } from '../rules';
import { tpSave, tpStats } from '../storage';
import { clearedCount, type TriPeaksMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, startGame } from '../session';
import { TriPeaksPlay } from './TriPeaksPlay';

export function TriPeaksHub() {
  const nav = useNav();
  const saved = useStore(tpSave);
  const [confirm, setConfirm] = useState<TriPeaksMode | null>(null);

  const today = todayKey();
  const inProgress = saved && saved.status === 'playing' ? saved : null;
  const dailyInProgress = inProgress?.mode === 'daily' && inProgress.date === today;

  const launch = (mode: TriPeaksMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<TriPeaksPlay />);
  };

  const request = (mode: TriPeaksMode) => {
    if (mode === 'daily' && dailyInProgress) return nav.push(<TriPeaksPlay />);
    if (hasGameToAbandon()) setConfirm(mode);
    else launch(mode);
  };

  return (
    <Screen largeTitle="TriPeaks" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${clearedCount(inProgress)} of 28 cards cleared · ${formatTime(inProgress.elapsedMs)}`}
          onClick={() => nav.push(<TriPeaksPlay />)}
        />
      )}
      <DailyCard stats={tpStats} badge="Winnable deal" inProgress={dailyInProgress} onPlay={() => request('daily')} />
      <ModeList stats={tpStats} modes={[{ id: 'classic', label: MODE_LABEL.classic, color: '#2f7d32' }]} onSelect={(id) => request(id as TriPeaksMode)} />
      <HowToPlayRow rules={RULES} gameName="TriPeaks" />
      <StatsRow stats={tpStats} gameName="TriPeaks" />

      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
