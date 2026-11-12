import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Screen, useIsTop, useNav, useScreenIndex } from '../../../ui/nav';
import { ResultSheet } from '../../../ui/game/hub';
import { useGameClock } from '../../../ui/game/useGameClock';
import { useRestorable } from '../../../ui/game/useRestorable';
import { haptic } from '../../../core/haptics';
import { formatTime } from '../../../core/format';
import { IconPause, IconPlay, IconUndo } from '../../../ui/icons';
import { GAME_ID, slSave, slStats } from '../storage';
import { Action, SlideGame, inPlace, reduce } from '../state';
import { MODE_LABEL, createGame } from '../session';
import { Board } from './Board';

interface Result {
  timeMs: number;
  newBest: boolean;
}

export function SlidePlay() {
  const nav = useNav();
  const isTop = useIsTop();
  const screenIndex = useScreenIndex();
  const restored = useRestorable(GAME_ID, 'resume');
  const [game, setGame] = useState<SlideGame | null>(() => slSave.get());
  const gameRef = useRef(game);
  gameRef.current = game;
  const [result, setResult] = useState<Result | null>(null);
  const [shake, setShake] = useState<number | null>(null);

  const persist = (g: SlideGame | null = gameRef.current) => {
    if (!g) return;
    slSave.set(g.status === 'playing' ? { ...g, elapsedMs: clock.elapsed() } : null);
  };

  const clock = useGameClock({
    initialMs: game?.elapsedMs ?? 0,
    // The clock starts with the first move.
    active: !!game && game.status === 'playing' && game.touched,
    startPaused: restored,
    onSuspend: () => persist(),
  });
  const { paused, setPaused } = clock;

  useEffect(() => {
    if (!game) nav.pop();
  }, []);

  const win = (g: SlideGame) => {
    const timeMs = clock.stop();
    const { newBest } = slStats.record(g.mode, { outcome: 'won', timeMs, assists: g.undos });
    if (g.mode === 'daily' && g.date) slStats.markDaily(g.date, { timeMs, assists: g.undos });
    slSave.set(null);
    setResult({ timeMs, newBest });
  };

  const dispatch = (action: Action) => {
    const g = gameRef.current;
    if (!g || paused) return;
    const [next, ev] = reduce(g, action);
    if (ev.kind === 'invalid') {
      haptic('error');
      setShake(ev.cell);
      setTimeout(() => setShake(null), 350);
      return;
    }
    if (next === g) return;
    gameRef.current = next;
    setGame(next);
    if (ev.kind === 'won') {
      haptic('success');
      setTimeout(() => win(next), 250);
      return;
    }
    if (ev.kind === 'moved') haptic('selection');
    persist(next);
  };

  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const onTap = useCallback((cell: number) => dispatchRef.current({ type: 'tap', cell }), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!isTop || !g) return;
      if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        return dispatch({ type: 'undo' });
      }
      // Arrow keys move the tile on that side of the gap into it.
      const gap = g.tiles.indexOf(0);
      const n = g.n;
      const from = { ArrowUp: gap + n, ArrowDown: gap - n, ArrowLeft: gap % n < n - 1 ? gap + 1 : -1, ArrowRight: gap % n > 0 ? gap - 1 : -1 }[e.key];
      if (from != null && from >= 0 && from < n * n) {
        e.preventDefault();
        dispatch({ type: 'tap', cell: from });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const playAgain = () => {
    const g = gameRef.current;
    if (!g) return;
    slSave.set(createGame(g.mode));
    nav.replace(<SlidePlay />);
  };

  if (!game) return <Screen title="Sliding Puzzle">{null}</Screen>;

  const title = game.mode === 'daily' ? 'Daily · 4 × 4' : MODE_LABEL[game.mode];
  const showPause = paused && game.status === 'playing';
  const finished = game.status !== 'playing';
  const total = game.n * game.n - 1;

  return (
    <Screen
      title={title}
      back={screenIndex > 1 ? 'Sliding Puzzle' : 'Games'}
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
          <span class="pc-moves">Moves {game.moves}</span>
          <span class="timer" aria-label="Time">
            {formatTime(result ? result.timeMs : clock.elapsed())}
          </span>
          <span class="hints">{game.undos ? `Undos ${game.undos}` : ''}</span>
        </div>

        <div class="sp-area">
          <div class="sp-wrap">
            <Board game={game} shake={shake} hidden={showPause} won={!!result} onTap={onTap} />
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

        <div class="sp-status" aria-live="polite">
          <span id="sp-board-hint" class="sr-only">
            Tap a tile in the same row or column as the empty space to slide it there.
          </span>
          {finished ? 'In order!' : !game.touched ? 'Tap a tile in the empty space’s row or column' : `${inPlace(game.tiles)} of ${total} tiles in place`}
        </div>

        <div class="tools sp-tools">
          <button class="tool" onClick={() => dispatch({ type: 'undo' })} disabled={finished || !game.history.length}>
            <span class="tool-icon">
              <IconUndo />
            </span>
            <span class="tool-label">Undo</span>
          </button>
        </div>
      </div>

      <ResultSheet
        open={!!result}
        title={result?.newBest ? 'New best time! 🎉' : 'Solved! 🎉'}
        timeMs={result?.timeMs}
        meta={
          <>
            {title} · {game.moves} moves
            {game.undos ? ` · ${game.undos} undo${game.undos === 1 ? '' : 's'}` : ''}
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
