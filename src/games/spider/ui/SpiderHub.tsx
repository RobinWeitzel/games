import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../ui/nav';
import { ConfirmNewGameSheet, ContinueRow, HowToPlayRow, ModeList, StatsRow } from '../../../ui/game/hub';
import { useStore } from '../../../core/storage';
import { formatTime } from '../../../core/format';
import { RULES } from '../rules';
import { spSave, spStats } from '../storage';
import { RUNS, type SpiderMode } from '../state';
import { MODE_LABEL, hasGameToAbandon, startGame } from '../session';
import { SpiderPlay } from './SpiderPlay';

const MODE_COLORS: Record<SpiderMode, string> = { suit1: '#34c759', suit2: '#ff9f0a', suit4: '#ff3b30' };

export function SpiderHub() {
  const nav = useNav();
  const saved = useStore(spSave);
  const [confirm, setConfirm] = useState<SpiderMode | null>(null);
  const inProgress = saved && saved.status === 'playing' ? saved : null;

  const launch = (mode: SpiderMode) => {
    setConfirm(null);
    startGame(mode);
    nav.push(<SpiderPlay />);
  };

  return (
    <Screen largeTitle="Spider" back="Games">
      {inProgress && (
        <ContinueRow
          subtitle={`${MODE_LABEL[inProgress.mode]} · ${inProgress.done.length} of ${RUNS} runs · ${formatTime(inProgress.elapsedMs)}`}
          onClick={() => nav.push(<SpiderPlay />)}
        />
      )}
      <ModeList
        stats={spStats}
        modes={(['suit1', 'suit2', 'suit4'] as const).map((m) => ({ id: m, label: MODE_LABEL[m], color: MODE_COLORS[m] }))}
        onSelect={(id) => (hasGameToAbandon() ? setConfirm(id as SpiderMode) : launch(id as SpiderMode))}
      />
      <HowToPlayRow rules={RULES} gameName="Spider" />
      <StatsRow stats={spStats} gameName="Spider" />

      <ConfirmNewGameSheet open={confirm != null} onCancel={() => setConfirm(null)} onConfirm={() => confirm && launch(confirm)} />
    </Screen>
  );
}
