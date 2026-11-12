import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Screen, useIsTop, useNav, useScreenIndex } from '../../../ui/nav';
import { LoadingOverlay, ResultSheet } from '../../../ui/game/hub';
import { useGameClock } from '../../../ui/game/useGameClock';
import { useRestorable } from '../../../ui/game/useRestorable';
import { haptic } from '../../../core/haptics';
import { formatTime } from '../../../core/format';
import { IconBulb, IconPause, IconPlay, IconUndo } from '../../../ui/icons';
import { GAME_ID, nkSave, nkStats } from '../storage';
import { Action, NurikabeGame, SEA, numberStates, pools, reduce } from '../state';
import { MODE_LABEL, assistsOf, createGame } from '../session';
import { Board } from './Board';

interface Result {
  timeMs: number;
  newBest: boolean;
}

export function NurikabePlay() {
  const nav = useNav();
  const isTop = useIsTop();
  const screenIndex = useScreenIndex();
  const restored = useRestorable(GAME_ID, 'resume');
  const [game, setGame] = useState<NurikabeGame | null>(() => nkSave.get());
  const gameRef = useRef(game);
  gameRef.current = game;
  const [result, setResult] = useState<Result | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const persist = (g: NurikabeGame | null = gameRef.current) => {
    if (!g) return;
    nkSave.set(g.status === 'playing' ? { ...g, elapsedMs: clock.elapsed() } : null);
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

  const win = (g: NurikabeGame) => {
    const timeMs = clock.stop();
    const assists = assistsOf(g);
    const { newBest } = nkStats.record(g.mode, { outcome: 'won', timeMs, assists });
    if (g.mode === 'daily' && g.date) nkStats.markDaily(g.date, { timeMs, assists });
    nkSave.set(null);
    setResult({ timeMs, newBest });
  };

  const dispatch = (action: Action) => {
    const g = gameRef.current;
    if (!g || paused) return;
    const [next, ev] = reduce(g, action);
    setMessage(null);
    if (ev.kind === 'hint') {
      if (ev.cell == null) setMessage('Every shaded cell is in place');
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
    if (ev.kind === 'changed' && ev.mistake) haptic('error');
    else if (ev.kind === 'changed' || (ev.kind === 'hint' && ev.cell != null)) haptic('selection');
    persist(next);
  };

  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const onTap = useCallback((cell: number) => dispatchRef.current({ type: 'tap', cell }), []);
  const onPaint = useCallback((cells: number[], value: number) => dispatchRef.current({ type: 'paint', cells, value }), []);

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

  const [loading, setLoading] = useState(false);
  const playAgain = async () => {
    const g = gameRef.current;
    if (!g || loading) return;
    setLoading(true);
    try {
      nkSave.set(await createGame(g.mode));
      nav.replace(<NurikabePlay />);
    } finally {
      setLoading(false);
    }
  };

  if (!game) return <Screen title="Nurikabe">{null}</Screen>;

  const title = game.mode === 'daily' ? `Daily · ${MODE_LABEL[game.difficulty]}` : MODE_LABEL[game.mode];
  const showPause = paused && game.status === 'playing';
  const finished = game.status !== 'playing';
  const assists = assistsOf(game);
  const pooled = pools(game).size > 0;
  const bad = [...numberStates(game).values()].includes('bad');
  const status =
    message ??
    (finished
      ? 'The sea is complete'
      : pooled
        ? 'The sea may not have 2 × 2 pools'
        : bad
          ? 'An island has the wrong size or two numbers'
          : !game.touched
            ? 'Tap a cell to shade it, again to mark an island'
            : '');
  const shaded = game.marks.filter((m) => m === SEA).length;

  return (
    <Screen
      title={title}
      back={screenIndex > 1 ? 'Nurikabe' : 'Games'}
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
          <span class="pc-moves" aria-label={`${shaded} cells shaded`}>Shaded {shaded}</span>
          <span class="timer" aria-label="Time">
            {formatTime(result ? result.timeMs : clock.elapsed())}
          </span>
          <span class="hints" aria-label={assists ? `${game.hints} hints and ${game.undos} undos used` : undefined}>
            {assists ? `Assists ${assists}` : ''}
          </span>
        </div>

        <div class="nk-area">
          <div class="nk-wrap">
            <Board game={game} flash={flash} hidden={showPause} won={!!result} onTap={onTap} onPaint={onPaint} />
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

        <div class="nk-status" aria-live="polite">
          <span id="nk-board-hint" class="sr-only">
            Tap a cell once to shade it, twice to mark it as island, three times to clear it. Drag to give several cells what the first one got.
          </span>
          {status}
        </div>

        <div class="tools nk-tools">
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
          ...(game.mode === 'daily' ? [] : [{ label: 'New Game', style: 'primary' as const, onClick: () => void playAgain() }]),
          { label: 'Done', onClick: () => nav.pop() },
        ]}
      />
      <LoadingOverlay show={loading} label="Preparing puzzle…" />
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
