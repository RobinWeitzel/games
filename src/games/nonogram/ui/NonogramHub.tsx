import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, DailyCard, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { todayKey } from '../../../core/daily';
import { formatTime } from '../../../core/format';
import { ngSave, ngStats } from '../storage';
import { progress, type NonogramMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, sizeLabel, startGame } from '../session';
import { NonogramPlay } from './NonogramPlay';

const MODE_COLORS = { small: '#34c759', medium: '#ff9f0a', large: '#ff453a' };

export function NonogramHub() {
  const nav = useNav();
  const saved = useStore(ngSave);
  const [confirm, setConfirm] = useState<NonogramMode | null>(null);

  const today = todayKey();
  const inProgress = saved && saved.status === 'playing' ? saved : null;
  const dailyInProgress = inProgress?.mode === 'daily' && inProgress.date === today;

  const launch = (mode: NonogramMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<NonogramPlay />);
  };

  const request = (mode: NonogramMode) => {
    if (mode === 'daily' && dailyInProgress) return nav.push(<NonogramPlay />);
    if (hasGameToAbandon()) setConfirm(mode);
    else launch(mode);
  };

  return (
    <Screen largeTitle="Nonogram" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${Math.round(progress(inProgress) * 100)}% · ${formatTime(inProgress.elapsedMs)}`}
          onClick={() => nav.push(<NonogramPlay />)}
        />
      )}
      <DailyCard stats={ngStats} badge={sizeLabel('daily')} inProgress={dailyInProgress} onPlay={() => request('daily')} />
      <ModeList
        stats={ngStats}
        modes={(['small', 'medium', 'large'] as const).map((m) => ({ id: m, label: MODE_LABEL[m], color: MODE_COLORS[m] }))}
        onSelect={(id) => request(id as NonogramMode)}
      />
      <StatsRow stats={ngStats} gameName="Nonogram" />

      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
