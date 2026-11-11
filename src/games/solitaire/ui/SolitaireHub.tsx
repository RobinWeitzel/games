import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, DailyCard, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { todayKey } from '../../../core/daily';
import { formatTime } from '../../../core/format';
import { solSave, solStats } from '../storage';
import { foundationCount, type SolitaireMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, startGame } from '../session';
import { SolitairePlay } from './SolitairePlay';

const MODE_COLORS = { draw1: '#34c759', draw3: '#ff9f0a' };

export function SolitaireHub() {
  const nav = useNav();
  const saved = useStore(solSave);
  const [confirm, setConfirm] = useState<SolitaireMode | null>(null);

  const today = todayKey();
  const inProgress = saved && saved.status === 'playing' ? saved : null;
  const dailyInProgress = inProgress?.mode === 'daily' && inProgress.date === today;

  const launch = (mode: SolitaireMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<SolitairePlay />);
  };

  const request = (mode: SolitaireMode) => {
    if (mode === 'daily' && dailyInProgress) return nav.push(<SolitairePlay />);
    if (hasGameToAbandon()) setConfirm(mode);
    else launch(mode);
  };

  return (
    <Screen largeTitle="Solitaire" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${foundationCount(inProgress)} of 52 cards home · ${formatTime(inProgress.elapsedMs)}`}
          onClick={() => nav.push(<SolitairePlay />)}
        />
      )}
      <DailyCard stats={solStats} badge="Draw 1 · winnable deal" inProgress={dailyInProgress} onPlay={() => request('daily')} />
      <ModeList
        stats={solStats}
        modes={(['draw1', 'draw3'] as const).map((m) => ({ id: m, label: MODE_LABEL[m], color: MODE_COLORS[m] }))}
        onSelect={(id) => request(id as SolitaireMode)}
      />
      <StatsRow stats={solStats} gameName="Solitaire" />

      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
