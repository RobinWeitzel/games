import { useEffect, useRef, useState } from 'preact/hooks';
import { Screen, useNav, useScreenIndex } from '../../../ui/nav';
import { ResultSheet } from '../../../ui/game/hub';
import { useGameClock } from '../../../ui/game/useGameClock';
import { useRestorable } from '../../../ui/game/useRestorable';
import { haptic } from '../../../core/haptics';
import { formatTime } from '../../../core/format';
import { IconPause, IconPlay, IconUndo } from '../../../ui/icons';
import { COLS, ROWS, dropRow } from '../engine';
import { GAME_ID, frSave, frStats } from '../storage';
import { Action, CPU, FourGame, YOU, reduce } from '../state';
import { MODE_LABEL, createGame } from '../session';

/** A white ring (you) or cross (computer) on the disc. */
const Mark = ({ p }: { p: number }) =>
  p === YOU ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="#fff" stroke-width="3.2" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="#fff" stroke-width="3.4" stroke-linecap="round" />
    </svg>
  );

/** The computer waits a moment, so its move is easy to follow. */
const CPU_DELAY = 450;

export function FourPlay() {
  const nav = useNav();
  const screenIndex = useScreenIndex();
  const restored = useRestorable(GAME_ID, 'resume');
  const [game, setGame] = useState<FourGame | null>(() => frSave.get());
  const gameRef = useRef(game);
  gameRef.current = game;
  const [result, setResult] = useState<{ timeMs: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  const persist = (g: FourGame | null = gameRef.current) => {
    if (!g) return;
    frSave.set(g.status === 'playing' ? { ...g, elapsedMs: clock.elapsed() } : null);
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

  const finish = (g: FourGame) => {
    const timeMs = clock.stop();
    // A draw is recorded as not won (the statistics know won and lost).
    frStats.record(g.mode, { outcome: g.status === 'won' ? 'won' : 'lost', timeMs, assists: g.undos });
    frSave.set(null);
    setResult({ timeMs });
  };

  const apply = (action: Action, fromTap: boolean) => {
    const g = gameRef.current;
    if (!g) return;
    const [next, ev] = reduce(g, action);
    if (ev.kind === 'invalid') {
      if (fromTap) haptic('error');
      return;
    }
    if (next === g) return;
    gameRef.current = next;
    setGame(next);
    if (ev.kind === 'won' || ev.kind === 'lost' || ev.kind === 'draw') {
      // Haptics need a touch: the result of your own move plays one; the computer's win shows the sheet.
      if (fromTap) haptic(ev.kind === 'won' ? 'success' : ev.kind === 'lost' ? 'error' : 'selection');
      setTimeout(() => finish(next), 900);
      return;
    }
    if (fromTap && ev.kind === 'dropped') haptic('selection');
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
    frSave.set(createGame(g.mode));
    nav.replace(<FourPlay />);
  };

  if (!game) return <Screen title="Four in a Row">{null}</Screen>;

  const showPause = paused && game.status === 'playing';
  const finished = game.status !== 'playing';
  const last = game.history[game.history.length - 1];
  const yourTurn = game.turn === YOU && !finished;
  const status = finished
    ? game.status === 'won'
      ? 'Four in a row: you win'
      : game.status === 'lost'
        ? 'The computer made four in a row'
        : 'The board is full: a draw'
    : yourTurn
      ? game.history.length
        ? 'Your turn'
        : 'You start: tap a column'
      : 'The computer is thinking…';

  return (
    <Screen
      title={MODE_LABEL[game.mode]}
      back={screenIndex > 1 ? 'Four in a Row' : 'Games'}
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
          <span class="pc-moves">Discs {game.history.length}</span>
          <span class="timer" aria-label="Time">
            {formatTime(result ? result.timeMs : clock.elapsed())}
          </span>
          <span class="hints">{game.undos ? `Undos ${game.undos}` : ''}</span>
        </div>

        <div class="fr-area">
          <div class={`fr-board ${showPause ? 'fr-hidden' : ''}`}>
            {game.board.map((v, i) => {
              const r = Math.floor(i / COLS);
              return (
                <div key={i} class="fr-cell">
                  {v !== 0 && (
                    <span
                      key={`${i}-${game.history.indexOf(i)}`}
                      class={`fr-disc fr-p${v} ${i === last ? 'fr-new' : ''} ${game.line?.includes(i) ? 'fr-line' : ''}`}
                      style={{ '--fall': r + 1 }}
                    >
                      <Mark p={v} />
                    </span>
                  )}
                </div>
              );
            })}
            <div class="fr-cols">
              {Array.from({ length: COLS }, (_, c) => {
                const free = dropRow(game.board, c);
                const mine = game.board.filter((v, i) => i % COLS === c && v === YOU).length;
                const theirs = game.board.filter((v, i) => i % COLS === c && v === CPU).length;
                return (
                  <button
                    key={c}
                    class="fr-col"
                    disabled={!yourTurn || paused || free < 0}
                    aria-label={`Column ${c + 1}: ${free < 0 ? 'full' : `${ROWS - 1 - free} discs`}${mine || theirs ? `, ${mine} yours, ${theirs} the computer’s` : ''}`}
                    onClick={() => apply({ type: 'drop', col: c }, true)}
                  />
                );
              })}
            </div>
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

        <div class="fr-status" aria-live="polite">
          {status}
        </div>

        <div class="tools fr-tools">
          <button class="tool" onClick={() => apply({ type: 'undo' }, true)} disabled={finished || !yourTurn || !game.history.some((c) => game.board[c] === YOU)}>
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
            {MODE_LABEL[game.mode]} · {game.history.length} discs
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
