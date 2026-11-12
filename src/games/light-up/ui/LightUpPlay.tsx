import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Screen, useIsTop, useNav, useScreenIndex } from '../../../ui/nav';
import { ResultSheet } from '../../../ui/game/hub';
import { useGameClock } from '../../../ui/game/useGameClock';
import { useRestorable } from '../../../ui/game/useRestorable';
import { haptic } from '../../../core/haptics';
import { formatTime } from '../../../core/format';
import { IconBulb, IconPause, IconPlay, IconUndo } from '../../../ui/icons';
import { GAME_ID, luSave, luStats } from '../storage';
import { Action, BULB, LightUpGame, clashes, litCells, numberStates, reduce } from '../state';
import { isBlack } from '../engine';
import { MODE_LABEL, assistsOf, createGame } from '../session';
import { Board } from './Board';

interface Result {
  timeMs: number;
  newBest: boolean;
}

export function LightUpPlay() {
  const nav = useNav();
  const isTop = useIsTop();
  const screenIndex = useScreenIndex();
  const restored = useRestorable(GAME_ID, 'resume');
  const [game, setGame] = useState<LightUpGame | null>(() => luSave.get());
  const gameRef = useRef(game);
  gameRef.current = game;
  const [result, setResult] = useState<Result | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const persist = (g: LightUpGame | null = gameRef.current) => {
    if (!g) return;
    luSave.set(g.status === 'playing' ? { ...g, elapsedMs: clock.elapsed() } : null);
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

  const win = (g: LightUpGame) => {
    const timeMs = clock.stop();
    const assists = assistsOf(g);
    const { newBest } = luStats.record(g.mode, { outcome: 'won', timeMs, assists });
    if (g.mode === 'daily' && g.date) luStats.markDaily(g.date, { timeMs, assists });
    luSave.set(null);
    setResult({ timeMs, newBest });
  };

  const dispatch = (action: Action) => {
    const g = gameRef.current;
    if (!g || paused) return;
    const [next, ev] = reduce(g, action);
    setMessage(null);
    if (ev.kind === 'hint') {
      if (ev.cell == null) setMessage('Every bulb is in place');
      else {
        setFlash(ev.cell);
        later(() => setFlash(null), 500);
      }
    }
    if (next === g) return;
    gameRef.current = next;
    setGame(next);
    if (ev.kind === 'won') {
      haptic('success');
      later(() => win(next), 500);
      return;
    }
    if (ev.kind === 'changed' && ev.conflict) haptic('error');
    else if ((ev.kind === 'changed' && ev.bulb) || (ev.kind === 'hint' && ev.cell != null)) haptic('selection');
    persist(next);
  };

  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const onTap = useCallback((cell: number) => dispatchRef.current({ type: 'tap', cell }), []);
  const onDot = useCallback((cells: number[]) => dispatchRef.current({ type: 'dot', cells }), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTop && e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        dispatch({ type: 'undo' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const playAgain = () => {
    const g = gameRef.current;
    if (!g) return;
    luSave.set(createGame(g.mode));
    nav.replace(<LightUpPlay />);
  };

  if (!game) return <Screen title="Light Up">{null}</Screen>;

  const title = game.mode === 'daily' ? `Daily · ${MODE_LABEL[game.difficulty]}` : MODE_LABEL[game.mode];
  const showPause = paused && game.status === 'playing';
  const finished = game.status !== 'playing';
  const assists = assistsOf(game);
  const lit = litCells(game);
  const whites = game.cells.filter((v) => !isBlack(v)).length;
  const bulbs = game.marks.filter((m) => m === BULB).length;
  const clash = clashes(game).size > 0;
  const over = [...numberStates(game).values()].includes('over');
  const status =
    message ??
    (finished
      ? 'Every cell is lit'
      : clash
        ? 'Two bulbs light each other'
        : over
          ? 'A number has too many bulbs around it'
          : !game.touched
            ? 'Tap a cell for a bulb, again to mark it empty'
            : lit.size === whites
              ? 'Everything is lit, but a number still needs bulbs'
              : '');

  return (
    <Screen
      title={title}
      back={screenIndex > 1 ? 'Light Up' : 'Games'}
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
          <span class="pc-moves" aria-label={`${lit.size} of ${whites} cells lit, ${bulbs} bulbs`}>
            Lit {Math.round((lit.size / whites) * 100)}%
          </span>
          <span class="timer" aria-label="Time">
            {formatTime(result ? result.timeMs : clock.elapsed())}
          </span>
          <span class="hints" aria-label={assists ? `${game.hints} hints and ${game.undos} undos used` : undefined}>
            {assists ? `Assists ${assists}` : ''}
          </span>
        </div>

        <div class="lu-area">
          <div class="lu-wrap">
            <Board game={game} flash={flash} hidden={showPause} won={!!result} onTap={onTap} onDot={onDot} />
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

        <div class="lu-status" aria-live="polite">
          <span id="lu-board-hint" class="sr-only">
            Tap a white cell once for a bulb, twice to mark it as empty, three times to clear it. Drag to mark several cells as empty.
          </span>
          {status}
        </div>

        <div class="tools lu-tools">
          <Tool label="Undo" onClick={() => dispatch({ type: 'undo' })} disabled={finished || !game.history.length}>
            <IconUndo />
          </Tool>
          <Tool label="Hint" onClick={() => dispatch({ type: 'hint' })} disabled={finished}>
            <IconBulb />
          </Tool>
        </div>
      </div>

      <ResultSheet
        open={!!result}
        title={result?.newBest ? 'New best time! 🎉' : 'Solved! 🎉'}
        timeMs={result?.timeMs}
        meta={
          <>
            {title}
            {game.undos ? ` · ${game.undos} undo${game.undos === 1 ? '' : 's'}` : ''}
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

function Tool(props: { label: string; onClick: () => void; disabled?: boolean; children: ComponentChildren }) {
  return (
    <button class="tool" onClick={props.onClick} disabled={props.disabled}>
      <span class="tool-icon">{props.children}</span>
      <span class="tool-label">{props.label}</span>
    </button>
  );
}
