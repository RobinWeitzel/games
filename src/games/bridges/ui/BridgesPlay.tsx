import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Screen, useIsTop, useNav, useScreenIndex } from '../../../ui/nav';
import { ResultSheet, useRestart } from '../../../ui/game/hub';
import { useGameClock } from '../../../ui/game/useGameClock';
import { useRestorable } from '../../../ui/game/useRestorable';
import { haptic } from '../../../core/haptics';
import { formatTime } from '../../../core/format';
import { IconBulb, IconPause, IconPlay, IconUndo } from '../../../ui/icons';
import { GAME_ID, brSave, brStats } from '../storage';
import { Action, BridgesGame, bridgeCounts, reduce, restart } from '../state';
import { MODE_LABEL, SIZE, assistsOf, createGame } from '../session';
import { Board } from './Board';

interface Result {
  timeMs: number;
  newBest: boolean;
}

export function BridgesPlay() {
  const nav = useNav();
  const isTop = useIsTop();
  const screenIndex = useScreenIndex();
  const restored = useRestorable(GAME_ID, 'resume');
  const [game, setGame] = useState<BridgesGame | null>(() => brSave.get());
  const gameRef = useRef(game);
  gameRef.current = game;
  const [result, setResult] = useState<Result | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const persist = (g: BridgesGame | null = gameRef.current) => {
    if (!g) return;
    brSave.set(g.status === 'playing' ? { ...g, elapsedMs: clock.elapsed() } : null);
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

  const win = (g: BridgesGame) => {
    const timeMs = clock.stop();
    const assists = assistsOf(g);
    const { newBest } = brStats.record(g.mode, { outcome: 'won', timeMs, assists });
    if (g.mode === 'daily' && g.date) brStats.markDaily(g.date, { timeMs, assists });
    brSave.set(null);
    setResult({ timeMs, newBest });
  };

  const say = (text: string) => {
    setMessage(text);
    later(() => setMessage((m) => (m === text ? null : m)), 2500);
  };

  const dispatch = (action: Action) => {
    const g = gameRef.current;
    if (!g || paused) return;
    const [next, ev] = reduce(g, action);
    if (ev.kind === 'invalid') {
      haptic('error');
      setShake(ev.edge);
      later(() => setShake(null), 400);
      say(ev.reason);
      return;
    }
    if (ev.kind === 'hint') {
      if (ev.edge == null) say('Everything built so far is right');
      else {
        setFlash(ev.edge);
        later(() => setFlash(null), 900);
        say('Hint: one bridge fixed');
      }
    } else setMessage(null);
    if (next === g) return;
    gameRef.current = next;
    setGame(next);
    if (ev.kind === 'won') {
      haptic('success');
      later(() => win(next), 400);
      return;
    }
    if (ev.kind === 'changed' || (ev.kind === 'hint' && ev.edge != null)) haptic('selection');
    persist(next);
  };

  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const onCycle = useCallback((edge: number) => dispatchRef.current({ type: 'cycle', edge }), []);
  const onMiss = useCallback(() => say('Tap the water between two islands'), []);

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
    brSave.set(createGame(g.mode));
    nav.replace(<BridgesPlay />);
  };

  /** Clear the board and start the same puzzle over (time and assists are kept). */
  const restartCtl = useRestart({
    disabled: !game || paused || restart(game) === game,
    message: 'Everything you’ve entered is cleared. The timer keeps running, and the restart counts as an undo.',
    onRestart: () => {
      const g = gameRef.current;
      if (!g) return;
      const next = restart(g);
      gameRef.current = next;
      setGame(next);
      setMessage(null);
      persist(next);
    },
  });

  if (!game) return <Screen title="Bridges">{null}</Screen>;

  const title = game.mode === 'daily' ? `Daily · ${SIZE.daily} × ${SIZE.daily}` : `${MODE_LABEL[game.mode]} · ${game.w} × ${game.h}`;
  const showPause = paused && game.status === 'playing';
  const finished = game.status !== 'playing';
  const counts = bridgeCounts(game);
  const done = game.islands.filter((isl, i) => counts[i] === isl.n).length;
  const over = game.islands.some((isl, i) => counts[i] > isl.n);
  const assists = assistsOf(game);
  const status =
    message ??
    (finished
      ? 'All islands connected'
      : !game.touched
        ? 'Tip: tap between two islands, or drag from one'
        : over
          ? 'An island has too many bridges'
          : done === game.islands.length
            ? 'Every island is complete, but not all are connected'
            : '');

  return (
    <Screen
      title={title}
      back={screenIndex > 1 ? 'Bridges' : 'Games'}
      fixed
      class="play"
      right={
        <>
          {restartCtl.button}
          <button class="nav-icon" aria-label={paused ? 'Resume' : 'Pause'} disabled={finished} onClick={() => setPaused((p) => !p)}>
            {paused ? <IconPlay size={22} /> : <IconPause size={22} />}
          </button>
        </>
      }
    >
      <div class="play-layout">
        <div class="play-info">
          <span class="pc-moves" aria-label={`${done} of ${game.islands.length} islands complete`}>
            Islands {done}/{game.islands.length}
          </span>
          <span class="timer" aria-label="Time">
            {formatTime(result ? result.timeMs : clock.elapsed())}
          </span>
          <span class="hints" aria-label={assists ? `${game.hints} hints and ${game.undos} undos used` : undefined}>
            {assists ? `Assists ${assists}` : ''}
          </span>
        </div>

        <div class="br-area">
          <Board game={game} hidden={showPause} flash={flash} shake={shake} onCycle={onCycle} onMiss={onMiss} />
          {showPause && (
            <button class="pause-overlay" onClick={() => setPaused(false)}>
              <span class="pause-play">
                <IconPlay size={34} />
              </span>
              <span>Paused · tap to resume</span>
            </button>
          )}
        </div>

        <div class="br-status" aria-live="polite">
          <span id="br-board-hint" class="sr-only">
            Tap between two islands to add a bridge, again for a second one, and again to remove them. Or drag from an island towards a neighbour.
          </span>
          {status}
        </div>

        <div class="tools br-tools">
          <Tool label="Undo" onClick={() => dispatch({ type: 'undo' })} disabled={finished || !game.history.length}>
            <IconUndo />
          </Tool>
          <Tool label="Hint" onClick={() => dispatch({ type: 'hint' })} disabled={finished}>
            <IconBulb />
          </Tool>
        </div>
      </div>

      {restartCtl.sheet}
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
