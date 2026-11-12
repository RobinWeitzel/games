import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Screen, useIsTop, useNav, useScreenIndex } from '../../../ui/nav';
import { ResultSheet } from '../../../ui/game/hub';
import { useGameClock } from '../../../ui/game/useGameClock';
import { useRestorable } from '../../../ui/game/useRestorable';
import { NumberPad } from '../../../ui/game/numpad';
import { haptic } from '../../../core/haptics';
import { useStore } from '../../../core/storage';
import { formatTime } from '../../../core/format';
import { IconBolt, IconBulb, IconPause, IconPencil, IconPlay, IconUndo, IconWand } from '../../../ui/icons';
import { GAME_ID, savedGame, sudokuSettings, sudokuStats } from '../storage';
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
  // Relaunching the app comes straight back here (paused, so the player can get oriented).
  const restored = useRestorable(GAME_ID, 'resume');
  const settings = useStore(sudokuSettings);
  const [game, setGame] = useState<SudokuGame | null>(() => savedGame.get());
  const gameRef = useRef(game);
  gameRef.current = game;

  const [result, setResult] = useState<Result | null>(null);
  const [flash, setFlash] = useState<Set<number>>(new Set());
  const [pop, setPop] = useState<Set<number>>(new Set());
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
    startPaused: restored,
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

  /** `silent`: skip haptics (used when not inside a touch event, where iOS can't play them). */
  const dispatch = (action: Action, silent = false) => {
    const g = gameRef.current;
    if (!g || paused) return;
    const [next, ev] = reduce(g, action, sudokuSettings.get());
    if (next === g) return;
    gameRef.current = next;
    setGame(next);

    // Number lock switched on, moved or off: it's a game mode change, so a light tick.
    if ((next.lockedDigit ?? null) !== (g.lockedDigit ?? null)) {
      if (!silent && ev.kind === 'none') haptic('selection');
      if (next.lockedDigit && !sudokuSettings.get().numberLockTipSeen) {
        sudokuSettings.set((s) => ({ ...s, numberLockTipSeen: true }));
      }
    }

    switch (ev.kind) {
      case 'correct':
        if (ev.autoFilled?.length) {
          // Show what "Fill single notes" did, so a cascade never feels like magic.
          setPop(new Set(ev.autoFilled));
          setTimeout(() => setPop(new Set()), 700);
        }
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
      // Tools, notes and selection: no haptic (HIG: don't overuse; reserve for meaningful events).
    }
    // Save whenever the board or a mode changed: a cell tap is a move during number lock.
    const changed =
      next.values !== g.values ||
      next.notes !== g.notes ||
      next.notesMode !== g.notesMode ||
      !!next.autoFill !== !!g.autoFill ||
      (next.lockedDigit ?? null) !== (g.lockedDigit ?? null);
    if (changed) persist(next);
  };

  // Hardware keyboard (handy on desktop while developing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isTop) return;
      const digit = /^Digit[1-9]$/.test(e.code) ? Number(e.code.slice(5)) : 0;
      if (digit && e.shiftKey) dispatch({ type: 'lockDigit', digit }); // keyboard alternative to holding a key
      else if (digit) dispatch({ type: 'input', digit });
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
          onClick={() => setPaused((p) => !p)}
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

        {/* Takes all height left over by the controls; the board is the largest square that fits. */}
        <div class="board-area">
          <div class="board-wrap">
            <Board
              game={game}
              highlightSame={settings.highlightSame}
              lockedDigit={game.lockedDigit}
              flash={flash}
              pop={pop}
              shake={shake}
              hidden={showPause}
              won={result?.outcome === 'won'}
              onSelect={(cell) => dispatch({ type: 'select', cell })}
            />
            {showPause && (
              <button
                class="pause-overlay"
                onClick={() => setPaused(false)}
              >
                <span class="pause-play">
                  <IconPlay size={34} />
                </span>
                <span>Paused · tap to resume</span>
              </button>
            )}
          </div>
        </div>

        <div class="tools">
          <Tool label="Undo" onClick={() => dispatch({ type: 'undo' })} disabled={!game.undo.length}>
            <IconUndo />
          </Tool>
          <Tool label="Notes" onClick={() => dispatch({ type: 'toggleNotes' })} active={game.notesMode}>
            <IconPencil />
          </Tool>
          <Tool label="Auto notes" onClick={() => dispatch({ type: 'fillNotes' })}>
            <IconWand />
          </Tool>
          {/* Per game, off at the start: turn on for the end phase (it fills cells left with one note). */}
          <Tool label="Autofill" onClick={() => dispatch({ type: 'toggleAutoFill' })} active={!!game.autoFill}>
            <IconBolt />
          </Tool>
          <Tool label="Hint" onClick={() => dispatch({ type: 'hint' })}>
            <IconBulb />
          </Tool>
        </div>

        {/* One line, always reserved so the layout doesn't jump: teaches and explains number lock. */}
        <div class="lock-status" aria-live="polite">
          {game.lockedDigit ? (
            <span>
              <strong>
                {game.notesMode ? 'Noting' : 'Filling'} {game.lockedDigit}
              </strong>{' '}
              · tap {game.lockedDigit} again to stop
            </span>
          ) : game.autoFill ? (
            <span>
              <strong>Autofill on</strong> · cells left with one note are filled
            </span>
          ) : !settings.numberLockTipSeen ? (
            <span>Tip: hold a number to fill several cells</span>
          ) : null}
        </div>

        {/* Two rows so every key is at least 44pt wide (HIG minimum hit target). */}
        <NumberPad
          digits={[1, 2, 3, 4, 5, 6, 7, 8, 9]}
          left={counts.map((n) => 9 - n)}
          columns={5}
          notesMode={game.notesMode}
          locked={game.lockedDigit}
          eraseDisabled={selectedLocked}
          onDigit={(digit) => dispatch({ type: 'input', digit })}
          // Fires mid-touch (no haptics possible there); the haptic plays on release.
          onHold={(digit) => dispatch({ type: 'lockDigit', digit }, true)}
          onHoldEnd={() => haptic('selection')}
          onErase={() => dispatch({ type: 'erase' })}
        />
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
