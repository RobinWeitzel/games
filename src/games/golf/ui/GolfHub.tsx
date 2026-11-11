import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, DailyCard, HowToPlayRow, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { todayKey } from '../../../core/daily';
import { formatTime } from '../../../core/format';
import { RULES } from '../rules';
import { gfSave, gfStats } from '../storage';
import { cardsLeft, type GolfMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, startGame } from '../session';
import { GolfPlay } from './GolfPlay';

export function GolfHub() {
  const nav = useNav();
  const saved = useStore(gfSave);
  const [confirm, setConfirm] = useState<GolfMode | null>(null);

  const today = todayKey();
  const inProgress = saved && saved.status === 'playing' ? saved : null;
  const dailyInProgress = inProgress?.mode === 'daily' && inProgress.date === today;

  const launch = (mode: GolfMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<GolfPlay />);
  };

  const request = (mode: GolfMode) => {
    if (mode === 'daily' && dailyInProgress) return nav.push(<GolfPlay />);
    if (hasGameToAbandon()) setConfirm(mode);
    else launch(mode);
  };

  return (
    <Screen largeTitle="Golf" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${35 - cardsLeft(inProgress)} of 35 cards cleared · ${formatTime(inProgress.elapsedMs)}`}
          onClick={() => nav.push(<GolfPlay />)}
        />
      )}
      <DailyCard stats={gfStats} badge="Winnable deal" inProgress={dailyInProgress} onPlay={() => request('daily')} />
      <ModeList stats={gfStats} modes={[{ id: 'classic', label: MODE_LABEL.classic, color: '#8a6d1f' }]} onSelect={(id) => request(id as GolfMode)} />
      <HowToPlayRow rules={RULES} gameName="Golf" />
      <StatsRow stats={gfStats} gameName="Golf" />

      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
