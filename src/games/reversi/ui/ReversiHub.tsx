import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, HowToPlayRow, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { formatTime } from '../../../core/format';
import { RULES } from '../rules';
import { rvSave, rvStats } from '../storage';
import { discsPlaced, type ReversiMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, startGame } from '../session';
import { ReversiPlay } from './ReversiPlay';

const MODE_COLORS: Record<ReversiMode, string> = { easy: '#34c759', medium: '#ff9f0a', hard: '#ff453a' };

export function ReversiHub() {
  const nav = useNav();
  const saved = useStore(rvSave);
  const [confirm, setConfirm] = useState<ReversiMode | null>(null);
  const inProgress = saved && saved.status === 'playing' ? saved : null;

  const launch = (mode: ReversiMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<ReversiPlay />);
  };

  return (
    <Screen largeTitle="Reversi" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${discsPlaced(inProgress)} discs on the board · ${formatTime(inProgress.elapsedMs)}`}
          onClick={() => nav.push(<ReversiPlay />)}
        />
      )}
      <ModeList
        stats={rvStats}
        header="Play the Computer"
        modes={(['easy', 'medium', 'hard'] as const).map((m) => ({ id: m, label: MODE_LABEL[m], color: MODE_COLORS[m] }))}
        onSelect={(id) => (hasGameToAbandon() ? setConfirm(id as ReversiMode) : launch(id as ReversiMode))}
      />
      <HowToPlayRow rules={RULES} gameName="Reversi" />
      <StatsRow stats={rvStats} gameName="Reversi" />
      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
