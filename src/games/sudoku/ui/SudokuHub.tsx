import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, DailyCard, LoadingOverlay, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { todayKey } from '../../../core/daily';
import { formatTime } from '../../../core/format';
import { DIFFICULTIES } from '../engine/generator';
import { savedGame, sudokuStats } from '../storage';
import { progress } from '../state';
import { dailyDifficulty } from '../puzzles';
import { StartKind, hasGameToAbandon, startGame } from '../session';
import { DIFFICULTY_LABEL } from './labels';
import { SudokuPlay } from './SudokuPlay';

const DIFF_COLORS = { easy: '#34c759', medium: '#ff9f0a', hard: '#ff453a', expert: '#bf5af2' };

export function SudokuHub() {
  const nav = useNav();
  const saved = useStore(savedGame);
  const [confirm, setConfirm] = useState<StartKind | null>(null);
  const [loading, setLoading] = useState(false);

  const today = todayKey();
  const inProgress = saved && saved.status === 'playing' ? saved : null;
  const dailyInProgress = inProgress?.mode === 'daily' && inProgress.date === today;

  const launch = async (kind: StartKind) => {
    setConfirm(null);
    setLoading(true);
    try {
      await startGame(kind);
      nav.push(<SudokuPlay />);
    } finally {
      setLoading(false);
    }
  };

  const request = (kind: StartKind) => {
    if (kind === 'daily' && dailyInProgress) return nav.push(<SudokuPlay />);
    if (hasGameToAbandon()) setConfirm(kind);
    else void launch(kind);
  };

  return (
    <Screen largeTitle="Sudoku" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${inProgress.mode === 'daily' ? 'Daily · ' : ''}${DIFFICULTY_LABEL[inProgress.difficulty]} · ${formatTime(inProgress.elapsedMs)} · ${Math.round(progress(inProgress) * 100)}%`}
          onClick={() => nav.push(<SudokuPlay />)}
        />
      )}
      <DailyCard
        stats={sudokuStats}
        badge={DIFFICULTY_LABEL[dailyDifficulty(today)]}
        inProgress={dailyInProgress}
        onPlay={() => request('daily')}
      />
      <ModeList
        stats={sudokuStats}
        modes={DIFFICULTIES.map((d) => ({ id: d, label: DIFFICULTY_LABEL[d], color: DIFF_COLORS[d] }))}
        onSelect={(id) => request(id as StartKind)}
      />
      <StatsRow stats={sudokuStats} gameName="Sudoku" />

      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && void launch(confirm)} />
      <LoadingOverlay show={loading} label="Preparing puzzle…" />
    </Screen>
  );
}
