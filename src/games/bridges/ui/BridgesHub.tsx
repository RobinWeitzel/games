import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, DailyCard, HowToPlayRow, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { todayKey } from '../../../core/daily';
import { formatTime } from '../../../core/format';
import { RULES } from '../rules';
import { brSave, brStats } from '../storage';
import { progress, type BridgesMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, startGame } from '../session';
import { BridgesPlay } from './BridgesPlay';

const MODE_COLORS = { easy: '#34c759', medium: '#ff9f0a', hard: '#ff453a' };

export function BridgesHub() {
  const nav = useNav();
  const saved = useStore(brSave);
  const [confirm, setConfirm] = useState<BridgesMode | null>(null);
  const today = todayKey();
  const inProgress = saved && saved.status === 'playing' ? saved : null;
  const dailyInProgress = inProgress?.mode === 'daily' && inProgress.date === today;

  const launch = (mode: BridgesMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<BridgesPlay />);
  };
  const request = (mode: BridgesMode) => {
    if (mode === 'daily' && dailyInProgress) return nav.push(<BridgesPlay />);
    if (hasGameToAbandon()) setConfirm(mode);
    else launch(mode);
  };

  return (
    <Screen largeTitle="Bridges" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${formatTime(inProgress.elapsedMs)} · ${Math.round(progress(inProgress) * 100)}%`}
          onClick={() => nav.push(<BridgesPlay />)}
        />
      )}
      <DailyCard stats={brStats} badge="9 × 9" inProgress={dailyInProgress} onPlay={() => request('daily')} />
      <ModeList
        stats={brStats}
        modes={(['easy', 'medium', 'hard'] as const).map((m) => ({ id: m, label: MODE_LABEL[m], color: MODE_COLORS[m] }))}
        onSelect={(id) => request(id as BridgesMode)}
      />
      <HowToPlayRow rules={RULES} gameName="Bridges" />
      <StatsRow stats={brStats} gameName="Bridges" />
      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
