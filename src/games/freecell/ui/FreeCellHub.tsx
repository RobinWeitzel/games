import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, DailyCard, HowToPlayRow, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { todayKey } from '../../../core/daily';
import { formatTime } from '../../../core/format';
import { RULES } from '../rules';
import { fcSave, fcStats } from '../storage';
import { foundationCount, type FreeCellMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, startGame } from '../session';
import { FreeCellPlay } from './FreeCellPlay';

export function FreeCellHub() {
  const nav = useNav();
  const saved = useStore(fcSave);
  const [confirm, setConfirm] = useState<FreeCellMode | null>(null);

  const today = todayKey();
  const inProgress = saved && saved.status === 'playing' ? saved : null;
  const dailyInProgress = inProgress?.mode === 'daily' && inProgress.date === today;

  const launch = (mode: FreeCellMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<FreeCellPlay />);
  };

  const request = (mode: FreeCellMode) => {
    if (mode === 'daily' && dailyInProgress) return nav.push(<FreeCellPlay />);
    if (hasGameToAbandon()) setConfirm(mode);
    else launch(mode);
  };

  return (
    <Screen largeTitle="FreeCell" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${foundationCount(inProgress)} of 52 cards home · ${formatTime(inProgress.elapsedMs)}`}
          onClick={() => nav.push(<FreeCellPlay />)}
        />
      )}
      <DailyCard stats={fcStats} badge="Winnable deal" inProgress={dailyInProgress} onPlay={() => request('daily')} />
      <ModeList stats={fcStats} modes={[{ id: 'classic', label: MODE_LABEL.classic, color: '#0f7b8a' }]} onSelect={(id) => request(id as FreeCellMode)} />
      <HowToPlayRow rules={RULES} gameName="FreeCell" />
      <StatsRow stats={fcStats} gameName="FreeCell" />

      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
