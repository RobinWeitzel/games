import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, HowToPlayRow, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { formatTime } from '../../../core/format';
import { RULES } from '../rules';
import { pgSave, pgStats } from '../storage';
import { pegsLeft, type PegMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, startGame } from '../session';
import { PegPlay } from './PegPlay';

const MODE_COLORS: Record<PegMode, string> = { english: '#ff9f0a', triangle: '#34c759' };

export function PegHub() {
  const nav = useNav();
  const saved = useStore(pgSave);
  const [confirm, setConfirm] = useState<PegMode | null>(null);
  const inProgress = saved && saved.status === 'playing' ? saved : null;

  const launch = (mode: PegMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<PegPlay />);
  };

  return (
    <Screen largeTitle="Peg Solitaire" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${pegsLeft(inProgress)} pegs left · ${formatTime(inProgress.elapsedMs)}`}
          onClick={() => nav.push(<PegPlay />)}
        />
      )}
      <ModeList
        stats={pgStats}
        modes={(['triangle', 'english'] as const).map((m) => ({ id: m, label: MODE_LABEL[m], color: MODE_COLORS[m] }))}
        onSelect={(id) => (hasGameToAbandon() ? setConfirm(id as PegMode) : launch(id as PegMode))}
      />
      <HowToPlayRow rules={RULES} gameName="Peg Solitaire" />
      <StatsRow stats={pgStats} gameName="Peg Solitaire" />
      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
