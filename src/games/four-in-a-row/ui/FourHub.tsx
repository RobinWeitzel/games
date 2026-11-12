import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, HowToPlayRow, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { formatTime } from '../../../core/format';
import { RULES } from '../rules';
import { frSave, frStats } from '../storage';
import { discs, type FourMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, startGame } from '../session';
import { FourPlay } from './FourPlay';

const MODE_COLORS: Record<FourMode, string> = { easy: '#34c759', medium: '#ff9f0a', hard: '#ff453a' };

export function FourHub() {
  const nav = useNav();
  const saved = useStore(frSave);
  const [confirm, setConfirm] = useState<FourMode | null>(null);
  const inProgress = saved && saved.status === 'playing' ? saved : null;

  const launch = (mode: FourMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<FourPlay />);
  };

  return (
    <Screen largeTitle="Four in a Row" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${discs(inProgress)} discs played · ${formatTime(inProgress.elapsedMs)}`}
          onClick={() => nav.push(<FourPlay />)}
        />
      )}
      <ModeList
        stats={frStats}
        header="Play the Computer"
        modes={(['easy', 'medium', 'hard'] as const).map((m) => ({ id: m, label: MODE_LABEL[m], color: MODE_COLORS[m] }))}
        onSelect={(id) => (hasGameToAbandon() ? setConfirm(id as FourMode) : launch(id as FourMode))}
      />
      <HowToPlayRow rules={RULES} gameName="Four in a Row" />
      <StatsRow stats={frStats} gameName="Four in a Row" />
      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
