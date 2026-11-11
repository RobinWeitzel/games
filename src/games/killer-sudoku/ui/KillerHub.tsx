import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, DailyCard, HowToPlayRow, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { todayKey } from '../../../core/daily';
import { formatTime } from '../../../core/format';
import { RULES } from '../rules';
import { ksSave, ksStats } from '../storage';
import { progress, type KillerMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, startGame } from '../session';
import { KillerPlay } from './KillerPlay';

const MODE_COLORS = { easy: '#34c759', medium: '#ff9f0a', hard: '#ff453a' };

export function KillerHub() {
  const nav = useNav();
  const saved = useStore(ksSave);
  const [confirm, setConfirm] = useState<KillerMode | null>(null);
  const today = todayKey();
  const inProgress = saved && saved.status === 'playing' ? saved : null;
  const dailyInProgress = inProgress?.mode === 'daily' && inProgress.date === today;

  const launch = (mode: KillerMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<KillerPlay />);
  };
  const request = (mode: KillerMode) => {
    if (mode === 'daily' && dailyInProgress) return nav.push(<KillerPlay />);
    if (hasGameToAbandon()) setConfirm(mode);
    else launch(mode);
  };

  return (
    <Screen largeTitle="Killer Sudoku" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${formatTime(inProgress.elapsedMs)} · ${Math.round(progress(inProgress) * 100)}%`}
          onClick={() => nav.push(<KillerPlay />)}
        />
      )}
      <DailyCard stats={ksStats} badge="Medium" inProgress={dailyInProgress} onPlay={() => request('daily')} />
      <ModeList
        stats={ksStats}
        modes={(['easy', 'medium', 'hard'] as const).map((m) => ({ id: m, label: MODE_LABEL[m], color: MODE_COLORS[m] }))}
        onSelect={(id) => request(id as KillerMode)}
      />
      <HowToPlayRow rules={RULES} gameName="Killer Sudoku" />
      <StatsRow stats={ksStats} gameName="Killer Sudoku" />
      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
