import { useEffect, useRef, useState } from 'preact/hooks';
import { Screen, useNav, useScreenIndex } from '../../../ui/nav';
import { ResultSheet } from '../../../ui/game/hub';
import { useGameClock } from '../../../ui/game/useGameClock';
import { useRestorable } from '../../../ui/game/useRestorable';
import { haptic } from '../../../core/haptics';
import { formatTime } from '../../../core/format';
import { IconPause, IconPlay, IconUndo } from '../../../ui/icons';
import { N, count, legalMoves } from '../engine';
import { GAME_ID, rvSave, rvStats } from '../storage';
import { Action, CPU, ReversiGame, YOU, reduce } from '../state';
import { MODE_LABEL, createGame } from '../session';

const Mark = ({ p }: { p: number }) =>
  p === YOU ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="#fff" stroke-width="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="#1c1c1e" stroke-width="3.2" stroke-linecap="round" />
    </svg>
  );

const CPU_DELAY = 550;

export function ReversiPlay() {
  const nav = useNav();
  const screenIndex = useScreenIndex();
  const restored = useRestorable(GAME_ID, 'resume');
  const [game, setGame] = useState<ReversiGame | null>(() => rvSave.get());
  const gameRef = useRef(game);
  gameRef.current = game;
  const [result, setResult] = useState<{ timeMs: number } | null>(null);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  const persist = (g: ReversiGame | null = gameRef.current) => {
    if (!g) return;
    rvSave.set(g.status === 'playing' ? { ...g, elapsedMs: clock.elapsed() } : null);
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

  const finish = (g: ReversiGame) => {
    const timeMs = clock.stop();
    rvStats.record(g.mode, { outcome: g.status === 'won' ? 'won' : 'lost', timeMs, assists: g.undos });
    rvSave.set(null);
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
    // Discs that changed colour turn over.
    const changed = new Set(next.board.map((v, i) => (g.board[i] && v !== g.board[i] ? i : -1)).filter((i) => i >= 0));
    setFlipped(changed);
    setTimeout(() => setFlipped(new Set()), 320);
    if (ev.kind === 'won' || ev.kind === 'lost' || ev.kind === 'draw') {
      if (fromTap) haptic(ev.kind === 'won' ? 'success' : ev.kind === 'lost' ? 'error' : 'selection');
      setTimeout(() => finish(next), 900);
      return;
    }
    if (fromTap && ev.kind === 'placed') haptic('selection');
    persist(next);
  };

  useEffect(() => {
    if (!game || game.status !== 'playing' || game.turn !== CPU || paused) return;
    timer.current = setTimeout(() => apply({ type: 'cpu' }, false), CPU_DELAY);
    return () => clearTimeout(timer.current);
  }, [game, paused]);

  const playAgain = () => {
    const g = gameRef.current;
    if (!g) return;
    rvSave.set(createGame(g.mode));
    nav.replace(<ReversiPlay />);
  };

  if (!game) return <Screen title="Reversi">{null}</Screen>;

  const showPause = paused && game.status === 'playing';
  const finished = game.status !== 'playing';
  const yourTurn = game.turn === YOU && !finished;
  const legal = new Set(yourTurn ? legalMoves(game.board, YOU) : []);
  const mine = count(game.board, YOU);
  const theirs = count(game.board, CPU);
  const status = finished
    ? game.status === 'won'
      ? `You win, ${mine} to ${theirs}`
      : game.status === 'lost'
        ? `The computer wins, ${theirs} to ${mine}`
        : `A draw, ${mine} each`
    : yourTurn
      ? game.passed === CPU
        ? 'The computer can’t move: your turn again'
        : 'Your turn: tap a dot'
      : game.passed === YOU
        ? 'You can’t move: the computer plays again'
        : 'The computer is thinking…';

  return (
    <Screen
      title={MODE_LABEL[game.mode]}
      back={screenIndex > 1 ? 'Reversi' : 'Games'}
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
          <span class="pc-moves" aria-label={`You ${mine}, computer ${theirs}`}>
            You {mine} · Them {theirs}
          </span>
          <span class="timer" aria-label="Time">
            {formatTime(result ? result.timeMs : clock.elapsed())}
          </span>
          <span class="hints">{game.undos ? `Undos ${game.undos}` : ''}</span>
        </div>

        <div class="rv-area">
          <div class={`rv-board ${showPause ? 'rv-hidden' : ''}`} role="grid" aria-label="Reversi board">
            {game.board.map((v, i) => {
              const r = Math.floor(i / N);
              const c = i % N;
              const can = legal.has(i);
              const label = `Row ${r + 1}, column ${c + 1}: ${v === YOU ? 'your disc' : v === CPU ? 'computer’s disc' : can ? 'empty, you can play here' : 'empty'}${game.last === i ? ', last move' : ''}`;
              return can && !paused ? (
                <button key={i} class="cell rv-legal" aria-label={label} onClick={() => apply({ type: 'place', cell: i }, true)} />
              ) : (
                <div key={i} class={`cell ${game.last === i ? 'rv-last' : ''}`} role="gridcell" aria-label={label}>
                  {v !== 0 && (
                    <span class={`rv-disc rv-p${v} ${flipped.has(i) ? 'rv-flip' : ''}`}>
                      <Mark p={v} />
                    </span>
                  )}
                </div>
              );
            })}
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

        <div class="rv-status" aria-live="polite">
          {status}
        </div>

        <div class="tools rv-tools">
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
