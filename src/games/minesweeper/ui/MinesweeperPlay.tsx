import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Screen, useIsTop, useNav, useScreenIndex } from '../../../ui/nav';
import { ResultSheet } from '../../../ui/game/hub';
import { useGameClock } from '../../../ui/game/useGameClock';
import { useRestorable } from '../../../ui/game/useRestorable';
import { type HapticKind, haptic } from '../../../core/haptics';
import { useStore } from '../../../core/storage';
import { formatTime } from '../../../core/format';
import { IconBulb, IconPause, IconPlay } from '../../../ui/icons';
import { GAME_ID, msSave, msSettings, msStats } from '../storage';
import { Action, Event, MinesweeperGame, minesLeft, reduce } from '../state';
import { MODE_LABEL, createGame } from '../session';
import { Board } from './Board';
import { FlagGlyph } from './glyphs';

interface Result {
  outcome: 'won' | 'lost';
  timeMs: number;
  newBest: boolean;
}

/** Haptic per game event (docs/DESIGN.md §7): move accepted, won, lost. */
const HAPTIC: Partial<Record<Event['kind'], HapticKind>> = { opened: 'selection', flagged: 'selection', won: 'success', lost: 'error' };

export function MinesweeperPlay() {
  const nav = useNav();
  const isTop = useIsTop();
  const screenIndex = useScreenIndex();
  // Relaunching the app comes straight back here (paused, so the player can get oriented).
  const restored = useRestorable(GAME_ID, 'resume');
  const settings = useStore(msSettings);
  const [game, setGame] = useState<MinesweeperGame | null>(() => msSave.get());
  const gameRef = useRef(game);
  gameRef.current = game;

  const [result, setResult] = useState<Result | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  /** Haptic of a touch-and-hold move, played when the finger lifts (iOS needs a touch event). */
  const heldHaptic = useRef<HapticKind | null>(null);

  /** Save the game in progress (with the current time); finished games are removed. */
  const persist = (g: MinesweeperGame | null = gameRef.current) => {
    if (!g) return;
    msSave.set(g.status === 'playing' ? { ...g, elapsedMs: clock.elapsed() } : null);
  };

  const clock = useGameClock({
    initialMs: game?.elapsedMs ?? 0,
    // The clock starts with the first move, like the classic game.
    active: !!game && game.status === 'playing' && game.touched,
    startPaused: restored,
    onSuspend: () => persist(),
  });
  const { paused, setPaused } = clock;

  // Nothing to play (e.g. finished in another screen): go back.
  useEffect(() => {
    if (!game) nav.pop();
  }, []);

  const finish = (g: MinesweeperGame, outcome: 'won' | 'lost') => {
    const timeMs = clock.stop();
    const { newBest } = msStats.record(g.mode, { outcome, timeMs, assists: g.hints });
    if (outcome === 'won' && g.mode === 'daily' && g.date) msStats.markDaily(g.date, { timeMs, assists: g.hints });
    msSave.set(null);
    setResult({ outcome, timeMs, newBest });
    // Let the player see the board first: a lost board shows where the mines were.
    setTimeout(() => setSheetOpen(true), outcome === 'lost' ? 900 : 500);
  };

  /** Apply a move. Returns the haptic it calls for; plays it unless `silent` (not inside a touch event). */
  const dispatch = (action: Action, silent = false): HapticKind | null => {
    const g = gameRef.current;
    if (!g || paused) return null;
    const [next, ev] = reduce(g, action);
    if (next === g) return null;
    gameRef.current = next;
    setGame(next);

    if (ev.kind === 'opened' && ev.cells.length > 1) {
      setFresh(new Set(ev.cells));
      setTimeout(() => setFresh(new Set()), 400);
    }
    if (ev.kind === 'flagged' && silent && !msSettings.get().holdTipSeen) msSettings.set((s) => ({ ...s, holdTipSeen: true }));

    const h = HAPTIC[ev.kind] ?? null;
    if (h && !silent) haptic(h);
    if (ev.kind === 'won' || ev.kind === 'lost') finish(next, ev.kind);
    else persist(next);
    return h;
  };

  // Stable callbacks for the memoized board (it would otherwise re-render with every clock tick).
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const onTap = useCallback((cell: number) => void dispatchRef.current({ type: 'tap', cell }), []);
  const onHold = useCallback((cell: number) => (heldHaptic.current = dispatchRef.current({ type: 'alt', cell }, true)), []);
  const onRelease = useCallback(() => {
    if (heldHaptic.current) haptic(heldHaptic.current);
    heldHaptic.current = null;
  }, []);

  // Hardware keyboard: F toggles flag mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTop && e.key === 'f' && !e.metaKey && !e.ctrlKey) dispatch({ type: 'toggleFlagMode' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** Next game of the same mode; the daily board is the same again (another try). */
  const playAgain = () => {
    const g = gameRef.current;
    if (!g) return;
    msSave.set(createGame(g.mode));
    nav.replace(<MinesweeperPlay />);
  };

  if (!game) return <Screen title="Minesweeper">{null}</Screen>;

  const title = MODE_LABEL[game.mode];
  const showPause = paused && game.status === 'playing';
  const finished = game.status !== 'playing';
  const dailyWon = game.mode === 'daily' && game.status === 'won';
  const againLabel = game.mode === 'daily' ? 'Try Again' : 'New Game';

  return (
    <Screen
      title={title}
      back={screenIndex > 1 ? 'Minesweeper' : 'Games'}
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
          <span class="ms-left" aria-label={`${minesLeft(game)} mines left`}>
            <FlagGlyph size={16} /> {minesLeft(game)}
          </span>
          <span class="timer" aria-label="Time">
            {formatTime(result ? result.timeMs : clock.elapsed())}
          </span>
          <span class="hints">{game.hints ? `Hints ${game.hints}` : ''}</span>
        </div>

        {/* Takes all height left over by the controls; the board is the largest rectangle that fits. */}
        <div class="ms-board-area">
          <div class="ms-board-wrap" style={{ '--cols': String(game.cols), '--rows': String(game.rows) }}>
            <Board game={game} fresh={fresh} hidden={showPause} onTap={onTap} onHold={onHold} onRelease={onRelease} />
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

        {/* One line, always reserved so the layout doesn't jump: teaches touch and hold, explains flag mode. */}
        <div class="ms-status" aria-live="polite">
          <span id="ms-hold-hint" class="sr-only">
            Touch and hold a cell to {game.flagMode ? 'open' : 'flag'} it. Tap an open number to open the cells around it when all its mines are flagged.
          </span>
          {finished ? (
            game.status === 'won' ? (
              <span>
                <strong>Field cleared</strong>
              </span>
            ) : (
              <span>
                <strong>Mine hit</strong> · flags with a cross were wrong
              </span>
            )
          ) : game.flagMode ? (
            <span>
              <strong>Flag mode</strong> · tap to flag, hold to open
            </span>
          ) : !settings.holdTipSeen ? (
            <span>Tip: touch and hold a cell to flag it</span>
          ) : null}
        </div>

        <div class="tools ms-tools">
          {finished ? (
            // Shown after "Show Board" on a lost game. The daily can't be played again once won.
            dailyWon ? null : (
              <Tool label={againLabel} onClick={playAgain}>
                <IconPlay />
              </Tool>
            )
          ) : (
            <>
              <Tool label="Flag" onClick={() => dispatch({ type: 'toggleFlagMode' })} active={game.flagMode}>
                <FlagGlyph size={24} />
              </Tool>
              <Tool label="Hint" onClick={() => dispatch({ type: 'hint' })}>
                <IconBulb />
              </Tool>
            </>
          )}
        </div>
      </div>

      <ResultSheet
        open={sheetOpen && result?.outcome === 'won'}
        title={result?.newBest ? 'New best time! 🎉' : 'Cleared! 🎉'}
        timeMs={result?.timeMs}
        meta={
          <>
            {title} · {game.cols} × {game.rows} · {game.mineCount} mines
            {game.hints ? ` · ${game.hints} hint${game.hints === 1 ? '' : 's'}` : ''}
          </>
        }
        actions={[
          ...(game.mode === 'daily' ? [] : [{ label: 'New Game', style: 'primary' as const, onClick: playAgain }]),
          { label: 'Done', onClick: () => nav.pop() },
        ]}
      />
      <ResultSheet
        open={sheetOpen && result?.outcome === 'lost'}
        title="Game over"
        message="You opened a mine."
        actions={[
          { label: againLabel, style: 'primary', onClick: playAgain },
          { label: 'Show Board', onClick: () => setSheetOpen(false) },
          { label: 'Done', onClick: () => nav.pop() },
        ]}
      />
    </Screen>
  );
}

function Tool(props: { label: string; onClick: () => void; active?: boolean; children: ComponentChildren }) {
  return (
    <button class={`tool ${props.active ? 'active' : ''}`} onClick={props.onClick} aria-pressed={props.active}>
      <span class="tool-icon">{props.children}</span>
      <span class="tool-label">{props.label}</span>
    </button>
  );
}
