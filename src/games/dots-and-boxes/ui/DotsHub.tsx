import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, HowToPlayRow, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { formatTime } from '../../../core/format';
import { RULES } from '../rules';
import { dbSave, dbStats } from '../storage';
import { score, type DotsMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, startGame } from '../session';
import { DotsPlay } from './DotsPlay';

const MODE_COLORS: Record<DotsMode, string> = { easy: '#34c759', medium: '#ff9f0a', hard: '#ff453a' };

export function DotsHub() {
  const nav = useNav();
  const saved = useStore(dbSave);
  const [confirm, setConfirm] = useState<DotsMode | null>(null);
  const inProgress = saved && saved.status === 'playing' ? saved : null;

  const launch = (mode: DotsMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<DotsPlay />);
  };

  return (
    <Screen largeTitle="Dots and Boxes" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · You ${score(inProgress, 1)} · Them ${score(inProgress, 2)} · ${formatTime(inProgress.elapsedMs)}`}
          onClick={() => nav.push(<DotsPlay />)}
        />
      )}
      <ModeList
        stats={dbStats}
        header="Play the Computer"
        modes={(['easy', 'medium', 'hard'] as const).map((m) => ({ id: m, label: MODE_LABEL[m], color: MODE_COLORS[m] }))}
        onSelect={(id) => (hasGameToAbandon() ? setConfirm(id as DotsMode) : launch(id as DotsMode))}
      />
      <HowToPlayRow rules={RULES} gameName="Dots and Boxes" />
      <StatsRow stats={dbStats} gameName="Dots and Boxes" />
      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
