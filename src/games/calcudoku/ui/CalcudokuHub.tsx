import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, DailyCard, HowToPlayRow, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { todayKey } from '../../../core/daily';
import { formatTime } from '../../../core/format';
import { RULES } from '../rules';
import { cdSave, cdStats } from '../storage';
import { progress, type CalcudokuMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, startGame } from '../session';
import { CalcudokuPlay } from './CalcudokuPlay';

const MODE_COLORS = { size4: '#34c759', size5: '#ff9f0a', size6: '#ff453a', size7: '#bf5af2' };

export function CalcudokuHub() {
  const nav = useNav();
  const saved = useStore(cdSave);
  const [confirm, setConfirm] = useState<CalcudokuMode | null>(null);
  const today = todayKey();
  const inProgress = saved && saved.status === 'playing' ? saved : null;
  const dailyInProgress = inProgress?.mode === 'daily' && inProgress.date === today;

  const launch = (mode: CalcudokuMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<CalcudokuPlay />);
  };
  const request = (mode: CalcudokuMode) => {
    if (mode === 'daily' && dailyInProgress) return nav.push(<CalcudokuPlay />);
    if (hasGameToAbandon()) setConfirm(mode);
    else launch(mode);
  };

  return (
    <Screen largeTitle="Calcudoku" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${formatTime(inProgress.elapsedMs)} · ${Math.round(progress(inProgress) * 100)}%`}
          onClick={() => nav.push(<CalcudokuPlay />)}
        />
      )}
      <DailyCard stats={cdStats} badge="6 × 6" inProgress={dailyInProgress} onPlay={() => request('daily')} />
      <ModeList
        stats={cdStats}
        modes={(['size4', 'size5', 'size6', 'size7'] as const).map((m) => ({ id: m, label: MODE_LABEL[m], color: MODE_COLORS[m] }))}
        onSelect={(id) => request(id as CalcudokuMode)}
      />
      <HowToPlayRow rules={RULES} gameName="Calcudoku" />
      <StatsRow stats={cdStats} gameName="Calcudoku" />
      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
