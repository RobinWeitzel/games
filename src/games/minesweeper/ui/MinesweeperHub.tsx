import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, DailyCard, ModeList, HowToPlayRow, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { RULES } from '../rules';
import { todayKey } from '../../../core/daily';
import { formatTime } from '../../../core/format';
import { msSave, msStats } from '../storage';
import { minesLeft, type MinesweeperMode } from '../state';
import { MODE_LABEL, boardLabel, hasGameToAbandon, startGame } from '../session';
import { MinesweeperPlay } from './MinesweeperPlay';

const MODE_COLORS = { easy: '#34c759', medium: '#ff9f0a', hard: '#ff453a' };

export function MinesweeperHub() {
  const nav = useNav();
  const saved = useStore(msSave);
  const [confirm, setConfirm] = useState<MinesweeperMode | null>(null);

  const today = todayKey();
  const inProgress = saved && saved.status === 'playing' ? saved : null;
  const dailyInProgress = inProgress?.mode === 'daily' && inProgress.date === today;

  const launch = (mode: MinesweeperMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<MinesweeperPlay />);
  };

  const request = (mode: MinesweeperMode) => {
    if (mode === 'daily' && dailyInProgress) return nav.push(<MinesweeperPlay />);
    if (hasGameToAbandon()) setConfirm(mode);
    else launch(mode);
  };

  return (
    <Screen largeTitle="Minesweeper" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${minesLeft(inProgress)} mines left · ${formatTime(inProgress.elapsedMs)}`}
          onClick={() => nav.push(<MinesweeperPlay />)}
        />
      )}
      <DailyCard stats={msStats} badge={boardLabel('daily')} inProgress={dailyInProgress} onPlay={() => request('daily')} />
      <ModeList
        stats={msStats}
        modes={(['easy', 'medium', 'hard'] as const).map((m) => ({ id: m, label: MODE_LABEL[m], color: MODE_COLORS[m] }))}
        onSelect={(id) => request(id as MinesweeperMode)}
      />
      <HowToPlayRow rules={RULES} gameName="Minesweeper" />
      <StatsRow stats={msStats} gameName="Minesweeper" />

      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
