import { useEffect, useRef, useState } from 'preact/hooks';
import { Screen, useNav, useScreenIndex } from '../../../ui/nav';
import { ResultSheet } from '../../../ui/game/hub';
import { useGameClock } from '../../../ui/game/useGameClock';
import { useRestorable } from '../../../ui/game/useRestorable';
import { haptic } from '../../../core/haptics';
import { formatTime } from '../../../core/format';
import { IconPause, IconPlay, IconUndo } from '../../../ui/icons';
import { GAME_ID, dbSave, dbStats } from '../storage';
import { Action, CPU, DotsGame, YOU, reduce, score } from '../state';
import { Board } from './Board';
import { MODE_LABEL, createGame } from '../session';

/** The computer waits a moment, so its move is easy to follow. */
const CPU_DELAY = 450;

export function DotsPlay() {
  const nav = useNav();
  const screenIndex = useScreenIndex();
  const restored = useRestorable(GAME_ID, 'resume');
  const [game, setGame] = useState<DotsGame | null>(() => dbSave.get());
  const gameRef = useRef(game);
  gameRef.current = game;
  const [result, setResult] = useState<{ timeMs: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  const persist = (g: DotsGame | null = gameRef.current) => {
    if (!g) return;
    dbSave.set(g.status === 'playing' ? { ...g, elapsedMs: clock.elapsed() } : null);
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

  const finish = (g: DotsGame) => {
    const timeMs = clock.stop();
    // A draw is recorded as not won (the statistics know won and lost).
    dbStats.record(g.mode, { outcome: g.status === 'won' ? 'won' : 'lost', timeMs, assists: g.undos });
    dbSave.set(null);
    setResult({ timeMs });
  };

  const apply = (action: Action, fromTap: boolean) => {
    const g = gameRef.current;
    if (!g) return;
    const [next, ev] = reduce(g, action);
    if (next === g) return;
    gameRef.current = next;
    setGame(next);
    if (ev.kind === 'won' || ev.kind === 'lost' || ev.kind === 'draw') {
      // Haptics need a touch: the result of your own move plays one; the computer's win shows the sheet.
      if (fromTap) haptic(ev.kind === 'won' ? 'success' : ev.kind === 'lost' ? 'error' : 'selection');
      setTimeout(() => finish(next), 900);
      return;
    }
    if (fromTap && ev.kind === 'drawn') haptic(ev.boxes.length ? 'success' : 'selection');
    persist(next);
  };

  // The computer's turn: after a short pause, and not while paused.
  useEffect(() => {
    if (!game || game.status !== 'playing' || game.turn !== CPU || paused) return;
    timer.current = setTimeout(() => apply({ type: 'cpu' }, false), CPU_DELAY);
    return () => clearTimeout(timer.current);
  }, [game, paused]);

  const playAgain = () => {
    const g = gameRef.current;
    if (!g) return;
    dbSave.set(createGame(g.mode));
    nav.replace(<DotsPlay />);
  };

  if (!game) return <Screen title="Dots and Boxes">{null}</Screen>;

  const showPause = paused && game.status === 'playing';
  const finished = game.status !== 'playing';
  const yourTurn = game.turn === YOU && !finished;
  const mine = score(game, YOU);
  const theirs = score(game, CPU);
  const status = finished
    ? game.status === 'won'
      ? `You win, ${mine} to ${theirs}`
      : game.status === 'lost'
        ? `The computer wins, ${theirs} to ${mine}`
        : `A draw, ${mine} each`
    : yourTurn
      ? game.lines.some(Boolean)
        ? 'Your turn'
        : 'You start: tap between two dots'
      : 'The computer is drawing…';

  return (
    <Screen
      title={MODE_LABEL[game.mode].split(' · ')[0]}
      back={screenIndex > 1 ? 'Dots and Boxes' : 'Games'}
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
          <span class="pc-moves" aria-label={`You ${mine} boxes, computer ${theirs}`}>
            You {mine} · Them {theirs}
          </span>
          <span class="timer" aria-label="Time">
            {formatTime(result ? result.timeMs : clock.elapsed())}
          </span>
          <span class="hints">{game.undos ? `Undos ${game.undos}` : ''}</span>
        </div>

        <div class="db-area">
          <Board game={game} hidden={showPause} enabled={yourTurn && !paused} onDraw={(line) => apply({ type: 'draw', line }, true)} />
          {showPause && (
            <button class="pause-overlay" onClick={() => setPaused(false)}>
              <span class="pause-play">
                <IconPlay size={34} />
              </span>
              <span>Paused · tap to resume</span>
            </button>
          )}
        </div>

        <div class="db-status" aria-live="polite">
          <span id="db-board-hint" class="sr-only">
            Tap between two neighbouring dots to draw a line. The fourth side of a box wins it.
          </span>
          {status}
        </div>

        <div class="tools db-tools">
          <button class="tool" onClick={() => apply({ type: 'undo' }, true)} disabled={finished || !yourTurn || !game.history.length}>
            <span class="tool-icon">
              <IconUndo />
            </span>
            <span class="tool-label">Undo</span>
          </button>
        </div>
      </div>

      <ResultSheet
        open={!!result}
        title={game.status === 'won' ? 'You won! 🎉' : game.status === 'lost' ? 'The computer won' : 'A draw'}
        timeMs={result?.timeMs}
        meta={
          <>
            {MODE_LABEL[game.mode]} · {mine} to {theirs}
            {game.undos ? ` · ${game.undos} undo${game.undos === 1 ? '' : 's'}` : ''}
          </>
        }
        actions={[
          { label: 'Play Again', style: 'primary', onClick: playAgain },
          { label: 'Done', onClick: () => nav.pop() },
        ]}
      />
    </Screen>
  );
}
