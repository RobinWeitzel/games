import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, DailyCard, HowToPlayRow, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { todayKey } from '../../../core/daily';
import { formatTime } from '../../../core/format';
import { RULES } from '../rules';
import { sbSave, sbStats } from '../storage';
import { progress, type StarBattleMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, startGame } from '../session';
import { StarBattlePlay } from './StarBattlePlay';

const MODE_COLORS = { small: '#34c759', medium: '#ff9f0a', large: '#ff453a' };

export function StarBattleHub() {
  const nav = useNav();
  const saved = useStore(sbSave);
  const [confirm, setConfirm] = useState<StarBattleMode | null>(null);
  const today = todayKey();
  const inProgress = saved && saved.status === 'playing' ? saved : null;
  const dailyInProgress = inProgress?.mode === 'daily' && inProgress.date === today;

  const launch = (mode: StarBattleMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<StarBattlePlay />);
  };
  const request = (mode: StarBattleMode) => {
    if (mode === 'daily' && dailyInProgress) return nav.push(<StarBattlePlay />);
    if (hasGameToAbandon()) setConfirm(mode);
    else launch(mode);
  };

  return (
    <Screen largeTitle="Star Battle" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${formatTime(inProgress.elapsedMs)} · ${Math.round(progress(inProgress) * 100)}% of stars`}
          onClick={() => nav.push(<StarBattlePlay />)}
        />
      )}
      <DailyCard stats={sbStats} badge="8 × 8" inProgress={dailyInProgress} onPlay={() => request('daily')} />
      <ModeList
        stats={sbStats}
        modes={(['small', 'medium', 'large'] as const).map((m) => ({ id: m, label: m === 'large' ? '10 × 10 · 2 stars' : MODE_LABEL[m], color: MODE_COLORS[m] }))}
        onSelect={(id) => request(id as StarBattleMode)}
      />
      <HowToPlayRow rules={RULES} gameName="Star Battle" />
      <StatsRow stats={sbStats} gameName="Star Battle" />
      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
