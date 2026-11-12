import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, DailyCard, HowToPlayRow, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { todayKey } from '../../../core/daily';
import { formatTime } from '../../../core/format';
import { RULES } from '../rules';
import { pySave, pyStats } from '../storage';
import { clearedCount, type PyramidMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, startGame } from '../session';
import { PyramidPlay } from './PyramidPlay';

export function PyramidHub() {
  const nav = useNav();
  const saved = useStore(pySave);
  const [confirm, setConfirm] = useState<PyramidMode | null>(null);

  const today = todayKey();
  const inProgress = saved && saved.status === 'playing' ? saved : null;
  const dailyInProgress = inProgress?.mode === 'daily' && inProgress.date === today;

  const launch = (mode: PyramidMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<PyramidPlay />);
  };

  const request = (mode: PyramidMode) => {
    if (mode === 'daily' && dailyInProgress) return nav.push(<PyramidPlay />);
    if (hasGameToAbandon()) setConfirm(mode);
    else launch(mode);
  };

  return (
    <Screen largeTitle="Pyramid" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${clearedCount(inProgress)} of 28 cards cleared · ${formatTime(inProgress.elapsedMs)}`}
          onClick={() => nav.push(<PyramidPlay />)}
        />
      )}
      <DailyCard stats={pyStats} badge="Winnable deal" inProgress={dailyInProgress} onPlay={() => request('daily')} />
      <ModeList stats={pyStats} modes={[{ id: 'classic', label: MODE_LABEL.classic, color: '#7a2f8a' }]} onSelect={(id) => request(id as PyramidMode)} />
      <HowToPlayRow rules={RULES} gameName="Pyramid" />
      <StatsRow stats={pyStats} gameName="Pyramid" />

      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
