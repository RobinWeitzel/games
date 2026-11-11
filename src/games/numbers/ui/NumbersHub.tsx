import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, DailyCard, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { todayKey } from '../../../core/daily';
import { formatTime } from '../../../core/format';
import { numbersSave, numbersStats } from '../storage';
import type { NumbersMode } from '../state';
import { MODE_LABEL, dailyDeal, hasGameToAbandon, startGame } from '../session';
import { NumbersPlay } from './NumbersPlay';

const MODE_COLORS = { relaxed: '#34c759', timed: '#ff9f0a' };

export function NumbersHub() {
  const nav = useNav();
  const saved = useStore(numbersSave);
  const [confirm, setConfirm] = useState<NumbersMode | null>(null);

  const today = todayKey();
  const inProgress = saved && (saved.status === 'playing' || saved.status === 'picking') ? saved : null;
  const dailyInProgress = inProgress?.mode === 'daily' && inProgress.date === today;

  const launch = (mode: NumbersMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<NumbersPlay />);
  };

  const request = (mode: NumbersMode) => {
    if (mode === 'daily' && dailyInProgress) return nav.push(<NumbersPlay />);
    if (hasGameToAbandon()) setConfirm(mode);
    else launch(mode);
  };

  const large = dailyDeal(today).large;

  return (
    <Screen largeTitle="Numbers" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={
            inProgress.status === 'picking'
              ? MODE_LABEL[inProgress.mode]
              : `${MODE_LABEL[inProgress.mode]} · Target ${inProgress.target} · ${formatTime(inProgress.elapsedMs)}`
          }
          onClick={() => nav.push(<NumbersPlay />)}
        />
      )}
      <DailyCard stats={numbersStats} badge={large ? `${large} large` : 'Small numbers only'} inProgress={dailyInProgress} onPlay={() => request('daily')} />
      <ModeList
        stats={numbersStats}
        modes={(['relaxed', 'timed'] as const).map((m) => ({ id: m, label: MODE_LABEL[m], color: MODE_COLORS[m] }))}
        onSelect={(id) => request(id as NumbersMode)}
      />
      <StatsRow stats={numbersStats} gameName="Numbers" />

      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
