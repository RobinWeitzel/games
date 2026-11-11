import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, DailyCard, HowToPlayRow, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { todayKey } from '../../../core/daily';
import { formatTime } from '../../../core/format';
import { RULES } from '../rules';
import { luSave, luStats } from '../storage';
import { progress, type LightUpMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, startGame } from '../session';
import { LightUpPlay } from './LightUpPlay';

const MODE_COLORS = { easy: '#34c759', medium: '#ff9f0a', hard: '#ff453a' };

export function LightUpHub() {
  const nav = useNav();
  const saved = useStore(luSave);
  const [confirm, setConfirm] = useState<LightUpMode | null>(null);
  const today = todayKey();
  const inProgress = saved && saved.status === 'playing' ? saved : null;
  const dailyInProgress = inProgress?.mode === 'daily' && inProgress.date === today;

  const launch = (mode: LightUpMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<LightUpPlay />);
  };
  const request = (mode: LightUpMode) => {
    if (mode === 'daily' && dailyInProgress) return nav.push(<LightUpPlay />);
    if (hasGameToAbandon()) setConfirm(mode);
    else launch(mode);
  };

  return (
    <Screen largeTitle="Light Up" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${formatTime(inProgress.elapsedMs)} · ${Math.round(progress(inProgress) * 100)}% lit`}
          onClick={() => nav.push(<LightUpPlay />)}
        />
      )}
      <DailyCard stats={luStats} badge="Medium · 10 × 10" inProgress={dailyInProgress} onPlay={() => request('daily')} />
      <ModeList
        stats={luStats}
        modes={(['easy', 'medium', 'hard'] as const).map((m) => ({ id: m, label: MODE_LABEL[m], color: MODE_COLORS[m] }))}
        onSelect={(id) => request(id as LightUpMode)}
      />
      <HowToPlayRow rules={RULES} gameName="Light Up" />
      <StatsRow stats={luStats} gameName="Light Up" />
      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
