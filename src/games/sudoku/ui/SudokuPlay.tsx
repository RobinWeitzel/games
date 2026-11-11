import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Screen, useIsTop, useNav, useScreenIndex } from '../../../ui/nav';
import { ResultSheet } from '../../../ui/game/hub';
import { useGameClock } from '../../../ui/game/useGameClock';
import { haptic } from '../../../core/haptics';
import { useStore } from '../../../core/storage';
import { formatTime } from '../../../core/format';
import { IconBulb, IconErase, IconPause, IconPencil, IconPlay, IconUndo, IconWand } from '../../../ui/icons';
import { savedGame, sudokuSettings, sudokuStats } from '../storage';
import { Action, MAX_MISTAKES, SudokuGame, digitCounts, reduce } from '../state';
import { createGame } from '../session';
import { Board } from './Board';
import { DIFFICULTY_LABEL } from './labels';

interface Result {
  outcome: 'won' | 'lost';
  timeMs: number;
  newBest: boolean;
}

export function SudokuPlay() {
  const nav = useNav();
  const isTop = useIsTop();
  const screenIndex = useScreenIndex();
  const settings = useStore(sudokuSettings);
  const [game, setGame] = useState<SudokuGame | null>(() => savedGame.get());
  const gameRef = useRef(game);
  gameRef.current = game;

  const [result, setResult] = useState<Result | null>(null);
  const [flash, setFlash] = useState<Set<number>>(new Set());
  const [shake, setShake] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  /** Save the game in progress (with the current time); finished games are removed. */
  const persist = (g: SudokuGame | null = gameRef.current) => {
    if (!g) return;
    savedGame.set(g.status === 'playing' ? { ...g, elapsedMs: clock.elapsed() } : null);
  };

  const clock = useGameClock({
    initialMs: game?.elapsedMs ?? 0,
    active: !!game && game.status === 'playing',
    onSuspend: () => persist(),
  });
  const { paused, setPaused } = clock;

  // Nothing to play (e.g. finished in another screen): go back.
  useEffect(() => {
    if (!game) nav.pop();
  }, []);

  const finish = (g: SudokuGame, outcome: 'won' | 'lost') => {
    const timeMs = clock.stop();
    const { newBest } = sudokuStats.record(g.mode, { outcome, timeMs, assists: g.hints });
    if (outcome === 'won' && g.mode === 'daily' && g.date) sudokuStats.markDaily(g.date, { timeMs, assists: g.hints });
    savedGame.set(null);
    setResult({ outcome, timeMs, newBest });
  };

  const dispatch = (action: Action) => {
    const g = gameRef.current;
    if (!g || paused) return;
    const [next, ev] = reduce(g, action, sudokuSettings.get());
    if (next === g) return;
    gameRef.current = next;
    setGame(next);

    switch (ev.kind) {
      case 'correct':
        if (ev.completedUnits.length) {
          haptic('success');
          setFlash(new Set(ev.completedUnits.flat()));
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
        setTimeout(() => finish(next, 'won'), 50);
        return;
      case 'lost':
        haptic('error');
        finish(next, 'lost');
        return;
      default:
        if (action.type !== 'select' && action.type !== 'move') haptic('selection');
    }
    if (action.type !== 'select' && action.type !== 'move' && action.type !== 'toggleNotes') persist(next);
  };

  // Hardware keyboard (handy on desktop while developing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isTop) return;
      if (e.key >= '1' && e.key <= '9') dispatch({ type: 'input', digit: Number(e.key) });
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

  const newGame = async () => {
    const g = gameRef.current;
    if (!g) return;
    setStarting(true);
    const next = await createGame(g.mode === 'daily' ? g.difficulty : g.mode);
    savedGame.set(next);
    nav.replace(<SudokuPlay />);
  };

  const restart = () => {
    const g = gameRef.current;
    if (!g) return;
    const [next] = reduce(g, { type: 'restart' }, sudokuSettings.get());
    clock.reset(0);
    setResult(null);
    gameRef.current = next;
    setGame(next);
    savedGame.set(next);
  };

  if (!game) return <Screen title="Sudoku">{null}</Screen>;

  const counts = digitCounts(game);
  const title = game.mode === 'daily' ? `Daily · ${DIFFICULTY_LABEL[game.difficulty]}` : DIFFICULTY_LABEL[game.difficulty];
  const showPause = paused && game.status === 'playing';
  const selectedLocked =
    game.selected == null || game.puzzle[game.selected] !== 0 || game.values[game.selected] === game.solution[game.selected];

  return (
    <Screen
      title={title}
      back={screenIndex > 1 ? 'Sudoku' : 'Games'}
      fixed
      class="play"
      right={
        <button
          class="nav-icon"
          aria-label={paused ? 'Resume' : 'Pause'}
          disabled={game.status !== 'playing'}
          onClick={() => {
            haptic('selection');
            setPaused((p) => !p);
          }}
        >
          {paused ? <IconPlay size={22} /> : <IconPause size={22} />}
        </button>
      }
    >
      <div class="play-layout">
        <div class="play-info">
          <span class={game.mistakes ? 'mistakes has' : 'mistakes'}>
            Mistakes {game.mistakes}
            {settings.mistakeLimit ? `/${MAX_MISTAKES}` : ''}
          </span>
          <span class="timer" aria-label="Time">
            {formatTime(result ? result.timeMs : clock.elapsed())}
          </span>
          <span class="hints">{game.hints ? `Hints ${game.hints}` : ''}</span>
        </div>

        <div class="board-wrap">
          <Board
            game={game}
            highlightSame={settings.highlightSame}
            flash={flash}
            shake={shake}
            hidden={showPause}
            won={result?.outcome === 'won'}
            onSelect={(cell) => dispatch({ type: 'select', cell })}
          />
          {showPause && (
            <button
              class="pause-overlay"
              onClick={() => {
                haptic('selection');
                setPaused(false);
              }}
            >
              <span class="pause-play">
                <IconPlay size={34} />
              </span>
              <span>Paused · tap to resume</span>
            </button>
          )}
        </div>

        <div class="tools">
          <Tool label="Undo" onClick={() => dispatch({ type: 'undo' })} disabled={!game.undo.length}>
            <IconUndo />
          </Tool>
          <Tool label="Erase" onClick={() => dispatch({ type: 'erase' })} disabled={selectedLocked}>
            <IconErase />
          </Tool>
          <Tool label="Notes" onClick={() => dispatch({ type: 'toggleNotes' })} active={game.notesMode}>
            <IconPencil />
            <span class="tool-badge">{game.notesMode ? 'ON' : 'OFF'}</span>
          </Tool>
          <Tool label="Auto notes" onClick={() => dispatch({ type: 'fillNotes' })}>
            <IconWand />
          </Tool>
          <Tool label="Hint" onClick={() => dispatch({ type: 'hint' })}>
            <IconBulb />
          </Tool>
        </div>

        <div class={`numpad ${game.notesMode ? 'notes-mode' : ''}`}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
            const left = 9 - counts[d];
            return (
              <button
                key={d}
                class="num"
                style={{ visibility: left ? 'visible' : 'hidden' }}
                aria-label={`${d}, ${left} left`}
                onClick={() => dispatch({ type: 'input', digit: d })}
              >
                <span class="num-digit">{d}</span>
                <span class="num-left">{left}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ResultSheet
        open={result?.outcome === 'won'}
        title={result?.newBest ? 'New best time! 🎉' : 'Solved! 🎉'}
        timeMs={result?.timeMs}
        meta={
          <>
            {title} · {game.mistakes} mistake{game.mistakes === 1 ? '' : 's'}
            {game.hints ? ` · ${game.hints} hint${game.hints === 1 ? '' : 's'}` : ''}
          </>
        }
        actions={[
          ...(game.mode === 'daily' ? [] : [{ label: starting ? 'Preparing…' : 'New Game', style: 'primary' as const, onClick: newGame }]),
          { label: 'Done', onClick: () => nav.pop() },
        ]}
      />
      <ResultSheet
        open={result?.outcome === 'lost'}
        title="Game over"
        message={`You made ${MAX_MISTAKES} mistakes. The mistake limit can be turned off in Settings.`}
        actions={[
          { label: 'Restart this puzzle', style: 'primary', onClick: restart },
          ...(game.mode === 'daily' ? [] : [{ label: starting ? 'Preparing…' : 'New Game', onClick: newGame }]),
          { label: 'Done', onClick: () => nav.pop() },
        ]}
      />
    </Screen>
  );
}

function Tool(props: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: ComponentChildren;
}) {
  return (
    <button
      class={`tool ${props.active ? 'active' : ''}`}
      onClick={props.onClick}
      disabled={props.disabled}
      aria-pressed={props.active}
    >
      <span class="tool-icon">{props.children}</span>
      <span class="tool-label">{props.label}</span>
    </button>
  );
}
