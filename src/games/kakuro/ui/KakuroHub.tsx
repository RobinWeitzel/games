import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, DailyCard, HowToPlayRow, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { todayKey } from '../../../core/daily';
import { formatTime } from '../../../core/format';
import { RULES } from '../rules';
import { kkSave, kkStats } from '../storage';
import { progress, type KakuroMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, sizeText, startGame } from '../session';
import { KakuroPlay } from './KakuroPlay';

const MODE_COLORS = { easy: '#34c759', medium: '#ff9f0a', hard: '#ff453a' };

export function KakuroHub() {
  const nav = useNav();
  const saved = useStore(kkSave);
  const [confirm, setConfirm] = useState<KakuroMode | null>(null);
  const today = todayKey();
  const inProgress = saved && saved.status === 'playing' ? saved : null;
  const dailyInProgress = inProgress?.mode === 'daily' && inProgress.date === today;

  const launch = (mode: KakuroMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<KakuroPlay />);
  };
  const request = (mode: KakuroMode) => {
    if (mode === 'daily' && dailyInProgress) return nav.push(<KakuroPlay />);
    if (hasGameToAbandon()) setConfirm(mode);
    else launch(mode);
  };

  return (
    <Screen largeTitle="Kakuro" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${formatTime(inProgress.elapsedMs)} · ${Math.round(progress(inProgress) * 100)}%`}
          onClick={() => nav.push(<KakuroPlay />)}
        />
      )}
      <DailyCard stats={kkStats} badge={`Medium · ${sizeText('medium')}`} inProgress={dailyInProgress} onPlay={() => request('daily')} />
      <ModeList
        stats={kkStats}
        modes={(['easy', 'medium', 'hard'] as const).map((m) => ({ id: m, label: MODE_LABEL[m], color: MODE_COLORS[m] }))}
        onSelect={(id) => request(id as KakuroMode)}
      />
      <HowToPlayRow rules={RULES} gameName="Kakuro" />
      <StatsRow stats={kkStats} gameName="Kakuro" />
      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
