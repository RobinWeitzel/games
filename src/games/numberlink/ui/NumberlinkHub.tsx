import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, DailyCard, HowToPlayRow, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { todayKey } from '../../../core/daily';
import { formatTime } from '../../../core/format';
import { RULES } from '../rules';
import { nlSave, nlStats } from '../storage';
import { progress, type NumberlinkMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, startGame } from '../session';
import { NumberlinkPlay } from './NumberlinkPlay';

const MODE_COLORS = { small: '#34c759', medium: '#ff9f0a', large: '#ff453a' };

export function NumberlinkHub() {
  const nav = useNav();
  const saved = useStore(nlSave);
  const [confirm, setConfirm] = useState<NumberlinkMode | null>(null);
  const today = todayKey();
  const inProgress = saved && saved.status === 'playing' ? saved : null;
  const dailyInProgress = inProgress?.mode === 'daily' && inProgress.date === today;

  const launch = (mode: NumberlinkMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<NumberlinkPlay />);
  };
  const request = (mode: NumberlinkMode) => {
    if (mode === 'daily' && dailyInProgress) return nav.push(<NumberlinkPlay />);
    if (hasGameToAbandon()) setConfirm(mode);
    else launch(mode);
  };

  return (
    <Screen largeTitle="Numberlink" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${formatTime(inProgress.elapsedMs)} · ${Math.round(progress(inProgress) * 100)}% joined`}
          onClick={() => nav.push(<NumberlinkPlay />)}
        />
      )}
      <DailyCard stats={nlStats} badge="7 × 7" inProgress={dailyInProgress} onPlay={() => request('daily')} />
      <ModeList
        stats={nlStats}
        modes={(['small', 'medium', 'large'] as const).map((m) => ({ id: m, label: MODE_LABEL[m], color: MODE_COLORS[m] }))}
        onSelect={(id) => request(id as NumberlinkMode)}
      />
      <HowToPlayRow rules={RULES} gameName="Numberlink" />
      <StatsRow stats={nlStats} gameName="Numberlink" />
      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
