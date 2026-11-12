import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, DailyCard, HowToPlayRow, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { todayKey } from '../../../core/daily';
import { formatTime } from '../../../core/format';
import { RULES } from '../rules';
import { cbSave, cbStats } from '../storage';
import type { CodebreakerMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, startGame } from '../session';
import { CodebreakerPlay } from './CodebreakerPlay';

const MODE_COLORS = { classic: '#34c759', hard: '#ff453a' };

export function CodebreakerHub() {
  const nav = useNav();
  const saved = useStore(cbSave);
  const [confirm, setConfirm] = useState<CodebreakerMode | null>(null);
  const today = todayKey();
  const inProgress = saved && saved.status === 'playing' ? saved : null;
  const dailyInProgress = inProgress?.mode === 'daily' && inProgress.date === today;

  const launch = (mode: CodebreakerMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<CodebreakerPlay />);
  };
  const request = (mode: CodebreakerMode) => {
    if (mode === 'daily' && dailyInProgress) return nav.push(<CodebreakerPlay />);
    if (hasGameToAbandon()) setConfirm(mode);
    else launch(mode);
  };

  return (
    <Screen largeTitle="Codebreaker" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${inProgress.guesses.length} of ${inProgress.maxGuesses} guesses · ${formatTime(inProgress.elapsedMs)}`}
          onClick={() => nav.push(<CodebreakerPlay />)}
        />
      )}
      <DailyCard stats={cbStats} badge="4 of 6" inProgress={dailyInProgress} onPlay={() => request('daily')} />
      <ModeList
        stats={cbStats}
        modes={(['classic', 'hard'] as const).map((m) => ({ id: m, label: MODE_LABEL[m], color: MODE_COLORS[m] }))}
        onSelect={(id) => request(id as CodebreakerMode)}
      />
      <HowToPlayRow rules={RULES} gameName="Codebreaker" />
      <StatsRow stats={cbStats} gameName="Codebreaker" />
      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
