import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Screen, useIsTop, useNav, useScreenIndex } from '../../../ui/nav';
import { ResultSheet } from '../../../ui/game/hub';
import { useGameClock } from '../../../ui/game/useGameClock';
import { useRestorable } from '../../../ui/game/useRestorable';
import { NumberPad } from '../../../ui/game/numpad';
import { haptic } from '../../../core/haptics';
import { formatTime } from '../../../core/format';
import { IconBulb, IconPause, IconPencil, IconPlay, IconUndo } from '../../../ui/icons';
import { GAME_ID, ksSave, ksStats } from '../storage';
import { Action, KillerGame, cageOf, digitCounts, isEditable, reduce } from '../state';
import { MODE_LABEL, createGame } from '../session';
import { Board } from './Board';

interface Result {
  timeMs: number;
  newBest: boolean;
}

export function KillerPlay() {
  const nav = useNav();
  const isTop = useIsTop();
  const screenIndex = useScreenIndex();
  const restored = useRestorable(GAME_ID, 'resume');
  const [game, setGame] = useState<KillerGame | null>(() => ksSave.get());
  const gameRef = useRef(game);
  gameRef.current = game;
  const [result, setResult] = useState<Result | null>(null);
  const [flash, setFlash] = useState<Set<number>>(new Set());
  const [shake, setShake] = useState<number | null>(null);

  const persist = (g: KillerGame | null = gameRef.current) => {
    if (!g) return;
    ksSave.set(g.status === 'playing' ? { ...g, elapsedMs: clock.elapsed() } : null);
  };

  const clock = useGameClock({
    initialMs: game?.elapsedMs ?? 0,
    active: !!game && game.status === 'playing',
    startPaused: restored,
    onSuspend: () => persist(),
  });
  const { paused, setPaused } = clock;

  useEffect(() => {
    if (!game) nav.pop();
  }, []);

  const win = (g: KillerGame) => {
    const timeMs = clock.stop();
    const { newBest } = ksStats.record(g.mode, { outcome: 'won', timeMs, assists: g.hints });
    if (g.mode === 'daily' && g.date) ksStats.markDaily(g.date, { timeMs, assists: g.hints });
    ksSave.set(null);
    setResult({ timeMs, newBest });
  };

  const dispatch = (action: Action) => {
    const g = gameRef.current;
    if (!g || paused) return;
    const [next, ev] = reduce(g, action);
    if (next === g) return;
    gameRef.current = next;
    setGame(next);
    switch (ev.kind) {
      case 'correct':
        if (ev.groupDone) {
          haptic('success');
          setFlash(new Set(ev.groupDone));
          setTimeout(() => setFlash(new Set()), 650);
        } else haptic('selection');
        break;
      case 'mistake':
        haptic('error');
        setShake(ev.cell);
        setTimeout(() => setShake(null), 400);
        break;
      case 'won':
        haptic('success');
        setTimeout(() => win(next), 50);
        return;
    }
    if (next.values !== g.values || next.notes !== g.notes || next.notesMode !== g.notesMode) persist(next);
  };

  // Hardware keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isTop) return;
      const digit = /^Digit[1-9]$/.test(e.code) ? Number(e.code.slice(5)) : 0;
      if (digit) dispatch({ type: 'input', digit });
      else if (e.key === 'Backspace' || e.key === 'Delete') dispatch({ type: 'erase' });
      else if (e.key === 'n') dispatch({ type: 'toggleNotes' });
      else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) dispatch({ type: 'undo' });
      else {
        const dir = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
        if (dir) {
          e.preventDefault();
          dispatch({ type: 'move', dr: dir[0], dc: dir[1] });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const playAgain = () => {
    const g = gameRef.current;
    if (!g) return;
    ksSave.set(createGame(g.mode));
    nav.replace(<KillerPlay />);
  };

  if (!game) return <Screen title="Killer Sudoku">{null}</Screen>;

  const n = game.size;
  const counts = digitCounts(game);
  const title = game.mode === 'daily' ? `Daily · ${MODE_LABEL[game.difficulty]}` : MODE_LABEL[game.mode];
  const showPause = paused && game.status === 'playing';
  const finished = game.status !== 'playing';
  const sel = game.selected;
  const selCage = sel != null ? cageOf(game, sel) : null;
  const status =
    sel == null
      ? 'Tap a cell, then a number'
      : `Cage of ${selCage!.cells.length} adding up to ${selCage!.sum}`;

  return (
    <Screen
      title={title}
      back={screenIndex > 1 ? 'Killer Sudoku' : 'Games'}
      fixed
      class="play"
      right={
        <button class="nav-icon" aria-label={paused ? 'Resume' : 'Pause'} disabled={finished} onClick={() => setPaused((p) => !p)}>
          {paused ? <IconPlay size={22} /> : <IconPause size={22} />}
        </button>
      }
    >
      <div class="play-layout">
        <div class="play-info">
          <span class={game.mistakes ? 'ks-mistakes has' : 'ks-mistakes'}>Mistakes {game.mistakes}</span>
          <span class="timer" aria-label="Time">
            {formatTime(result ? result.timeMs : clock.elapsed())}
          </span>
          <span class="hints">{game.hints ? `Hints ${game.hints}` : ''}</span>
        </div>

        <div class="ks-area">
          <div class="ks-wrap">
            <Board game={game} flash={flash} shake={shake} hidden={showPause} won={!!result} onSelect={(cell) => dispatch({ type: 'select', cell })} />
            {showPause && (
              <button class="pause-overlay" onClick={() => setPaused(false)}>
                <span class="pause-play">
                  <IconPlay size={34} />
                </span>
                <span>Paused · tap to resume</span>
              </button>
            )}
          </div>
        </div>

        <div class="tools">
          <Tool label="Undo" onClick={() => dispatch({ type: 'undo' })} disabled={finished || !game.undo.length}>
            <IconUndo />
          </Tool>
          <Tool label="Notes" onClick={() => dispatch({ type: 'toggleNotes' })} active={game.notesMode} disabled={finished}>
            <IconPencil />
          </Tool>
          <Tool label="Hint" onClick={() => dispatch({ type: 'hint' })} disabled={finished}>
            <IconBulb />
          </Tool>
        </div>

        <div class="ks-status" aria-live="polite">
          {status}
        </div>

        <NumberPad
          digits={Array.from({ length: n }, (_, k) => k + 1)}
          left={counts.map((c) => n - c)}
          // Two rows so every key is at least 44pt wide.
          columns={5}
          notesMode={game.notesMode}
          eraseDisabled={sel == null || !isEditable(game, sel) || (!game.values[sel] && !game.notes[sel])}
          onDigit={(digit) => dispatch({ type: 'input', digit })}
          onErase={() => dispatch({ type: 'erase' })}
        />
      </div>

      <ResultSheet
        open={!!result}
        title={result?.newBest ? 'New best time! 🎉' : 'Solved! 🎉'}
        timeMs={result?.timeMs}
        meta={
          <>
            {title} · {game.mistakes} mistake{game.mistakes === 1 ? '' : 's'}
            {game.hints ? ` · ${game.hints} hint${game.hints === 1 ? '' : 's'}` : ''}
          </>
        }
        actions={[
          ...(game.mode === 'daily' ? [] : [{ label: 'New Game', style: 'primary' as const, onClick: playAgain }]),
          { label: 'Done', onClick: () => nav.pop() },
        ]}
      />
    </Screen>
  );
}

function Tool(props: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; children: ComponentChildren }) {
  return (
    <button class={`tool ${props.active ? 'active' : ''}`} onClick={props.onClick} disabled={props.disabled} aria-pressed={props.active}>
      <span class="tool-icon">{props.children}</span>
      <span class="tool-label">{props.label}</span>
    </button>
  );
}
