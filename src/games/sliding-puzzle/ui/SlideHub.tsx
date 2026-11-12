import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, DailyCard, HowToPlayRow, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { todayKey } from '../../../core/daily';
import { formatTime } from '../../../core/format';
import { RULES } from '../rules';
import { slSave, slStats } from '../storage';
import { progress, type SlideMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, startGame } from '../session';
import { SlidePlay } from './SlidePlay';

const MODE_COLORS = { size3: '#34c759', size4: '#ff9f0a', size5: '#ff453a' };

export function SlideHub() {
  const nav = useNav();
  const saved = useStore(slSave);
  const [confirm, setConfirm] = useState<SlideMode | null>(null);
  const today = todayKey();
  const inProgress = saved && saved.status === 'playing' ? saved : null;
  const dailyInProgress = inProgress?.mode === 'daily' && inProgress.date === today;

  const launch = (mode: SlideMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<SlidePlay />);
  };
  const request = (mode: SlideMode) => {
    if (mode === 'daily' && dailyInProgress) return nav.push(<SlidePlay />);
    if (hasGameToAbandon()) setConfirm(mode);
    else launch(mode);
  };

  return (
    <Screen largeTitle="Sliding Puzzle" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${formatTime(inProgress.elapsedMs)} · ${Math.round(progress(inProgress) * 100)}% in place`}
          onClick={() => nav.push(<SlidePlay />)}
        />
      )}
      <DailyCard stats={slStats} badge="4 × 4" inProgress={dailyInProgress} onPlay={() => request('daily')} />
      <ModeList
        stats={slStats}
        modes={(['size3', 'size4', 'size5'] as const).map((m) => ({ id: m, label: MODE_LABEL[m], color: MODE_COLORS[m] }))}
        onSelect={(id) => request(id as SlideMode)}
      />
      <HowToPlayRow rules={RULES} gameName="Sliding Puzzle" />
      <StatsRow stats={slStats} gameName="Sliding Puzzle" />
      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
