import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Screen, useIsTop, useNav, useScreenIndex } from '../../../ui/nav';
import { ResultSheet } from '../../../ui/game/hub';
import { useGameClock } from '../../../ui/game/useGameClock';
import { useRestorable } from '../../../ui/game/useRestorable';
import { type HapticKind, haptic } from '../../../core/haptics';
import { useStore } from '../../../core/storage';
import { formatTime } from '../../../core/format';
import { IconBulb, IconPause, IconPlay, IconUndo } from '../../../ui/icons';
import { GAME_ID, ngSave, ngSettings, ngStats } from '../storage';
import { Action, Event, NonogramGame, clues as cluesOf, reduce } from '../state';
import { MODE_LABEL, createGame } from '../session';
import { Board } from './Board';
import { CrossGlyph, FillGlyph } from './glyphs';

interface Result {
  timeMs: number;
  newBest: boolean;
}

/** Haptic per game event (docs/DESIGN.md §7): move accepted, won. Nonograms have no "mistake" event. */
const HAPTIC: Partial<Record<Event['kind'], HapticKind>> = { painted: 'selection', hint: 'selection', won: 'success' };

export function NonogramPlay() {
  const nav = useNav();
  const isTop = useIsTop();
  const screenIndex = useScreenIndex();
  // Relaunching the app comes straight back here (paused, so the player can get oriented).
  const restored = useRestorable(GAME_ID, 'resume');
  const settings = useStore(ngSettings);
  const [game, setGame] = useState<NonogramGame | null>(() => ngSave.get());
  const gameRef = useRef(game);
  gameRef.current = game;
  const clues = useMemo(() => (game ? cluesOf(game) : { rows: [], cols: [] }), [game?.solution]);

  const [result, setResult] = useState<Result | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [hint, setHint] = useState<{ cell: number; text: string } | null>(null);

  /** Save the game in progress (with the current time); finished games are removed. */
  const persist = (g: NonogramGame | null = gameRef.current) => {
    if (!g) return;
    ngSave.set(g.status === 'playing' ? { ...g, elapsedMs: clock.elapsed() } : null);
  };

  const clock = useGameClock({
    initialMs: game?.elapsedMs ?? 0,
    // The clock starts with the first move.
    active: !!game && game.status === 'playing' && game.touched,
    startPaused: restored,
    onSuspend: () => persist(),
  });
  const { paused, setPaused } = clock;

  // Nothing to play (e.g. finished in another screen): go back.
  useEffect(() => {
    if (!game) nav.pop();
  }, []);

  const finish = (g: NonogramGame) => {
    const timeMs = clock.stop();
    const { newBest } = ngStats.record(g.mode, { outcome: 'won', timeMs, assists: g.hints });
    if (g.mode === 'daily' && g.date) ngStats.markDaily(g.date, { timeMs, assists: g.hints });
    ngSave.set(null);
    setResult({ timeMs, newBest });
    // Let the player see the finished picture first.
    setTimeout(() => setSheetOpen(true), 900);
  };

  const dispatch = (action: Action) => {
    const g = gameRef.current;
    if (!g || paused) return;
    const [next, ev] = reduce(g, action);
    if (next === g) return;
    gameRef.current = next;
    setGame(next);

    if (ev.kind === 'hint') {
      const y = Math.floor(ev.cell / g.cols) + 1;
      const x = (ev.cell % g.cols) + 1;
      setHint({
        cell: ev.cell,
        text: ev.fixed ? `Row ${y}, column ${x} was wrong` : `Row ${y}, column ${x} is ${g.solution[ev.cell] ? 'filled' : 'empty'}`,
      });
    } else if (action.type !== 'toggleCrossMode') setHint(null);

    const h = HAPTIC[ev.kind];
    if (h) haptic(h);
    if (ev.kind === 'won') finish(next);
    else persist(next);
  };

  // Stable callback for the memoized board (it would otherwise re-render with every clock tick).
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const onStroke = useCallback((cells: number[], value: number) => {
    if (cells.length > 1 && !ngSettings.get().dragTipSeen) ngSettings.set((s) => ({ ...s, dragTipSeen: true }));
    dispatchRef.current({ type: 'paint', cells, value });
  }, []);

  // Hardware keyboard: X toggles cross mode, ⌘Z / Ctrl+Z undoes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isTop) return;
      if (e.key === 'x' && !e.metaKey && !e.ctrlKey) dispatch({ type: 'toggleCrossMode' });
      if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        dispatch({ type: 'undo' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** Next game of the same mode. */
  const playAgain = () => {
    const g = gameRef.current;
    if (!g) return;
    ngSave.set(createGame(g.mode));
    nav.replace(<NonogramPlay />);
  };

  if (!game) return <Screen title="Nonogram">{null}</Screen>;

  const title = MODE_LABEL[game.mode];
  const finished = game.status !== 'playing';
  const showPause = paused && !finished;
  const setMode = (cross: boolean) => game.crossMode !== cross && dispatch({ type: 'toggleCrossMode' });

  return (
    <Screen
      title={title}
      back={screenIndex > 1 ? 'Nonogram' : 'Games'}
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
          <span>{game.mode === 'daily' ? `${game.rows} × ${game.cols}` : ''}</span>
          <span class="timer" aria-label="Time">
            {formatTime(result ? result.timeMs : clock.elapsed())}
          </span>
          <span class="hints">{game.hints ? `Hints ${game.hints}` : ''}</span>
        </div>

        {/* All height left over by the controls; the board is sized to fit it (never scrolls). */}
        <div class="ng-board-area">
          <Board game={game} clues={clues} hidden={showPause} hinted={hint?.cell ?? null} onStroke={onStroke} />
          {showPause && (
            <button class="pause-overlay" onClick={() => setPaused(false)}>
              <span class="pause-play">
                <IconPlay size={34} />
              </span>
              <span>Paused · tap to resume</span>
            </button>
          )}
        </div>

        {/* One line, always reserved so the layout doesn't jump. */}
        <div class="ng-status" aria-live="polite">
          <span id="ng-drag-hint" class="sr-only">
            Tap a cell to {game.crossMode ? 'cross it out' : 'fill it'}, or drag along a row or column to mark several. Clues of finished lines are crossed through.
          </span>
          {finished ? (
            <span>
              <strong>Picture complete</strong>
            </span>
          ) : hint ? (
            <span>
              <strong>Hint</strong> · {hint.text}
            </span>
          ) : game.crossMode ? (
            <span>
              <strong>Cross mode</strong> · mark cells that stay empty
            </span>
          ) : !settings.dragTipSeen ? (
            <span>Tip: drag along a row or column to fill several cells</span>
          ) : null}
        </div>

        <div class="tools">
          {finished ? (
            game.mode === 'daily' ? null : (
              <Tool label="New Game" onClick={playAgain}>
                <IconPlay />
              </Tool>
            )
          ) : (
            <>
              <Tool label="Fill" onClick={() => setMode(false)} active={!game.crossMode}>
                <FillGlyph />
              </Tool>
              <Tool label="Cross" onClick={() => setMode(true)} active={game.crossMode}>
                <CrossGlyph />
              </Tool>
              <Tool label="Undo" onClick={() => dispatch({ type: 'undo' })} disabled={!game.history.length}>
                <IconUndo />
              </Tool>
              <Tool label="Hint" onClick={() => dispatch({ type: 'hint' })}>
                <IconBulb />
              </Tool>
            </>
          )}
        </div>
      </div>

      <ResultSheet
        open={sheetOpen}
        title={result?.newBest ? 'New best time! 🎉' : 'Solved! 🎉'}
        timeMs={result?.timeMs}
        meta={
          <>
            {title}
            {game.mode === 'daily' ? ` · ${game.rows} × ${game.cols}` : ''}
            {game.hints ? ` · ${game.hints} hint${game.hints === 1 ? '' : 's'}` : ''}
          </>
        }
        actions={[
          ...(game.mode === 'daily' ? [] : [{ label: 'New Game', style: 'primary' as const, onClick: playAgain }]),
          { label: 'Show Picture', onClick: () => setSheetOpen(false) },
          { label: 'Done', onClick: () => nav.pop() },
        ]}
      />
    </Screen>
  );
}

function Tool(props: { label: string; onClick: () => void; active?: boolean; disabled?: boolean; children: ComponentChildren }) {
  return (
    <button
      class={`tool ${props.active ? 'active' : ''}`}
      onClick={props.onClick}
      aria-pressed={props.active == null ? undefined : props.active}
      disabled={props.disabled}
    >
      <span class="tool-icon">{props.children}</span>
      <span class="tool-label">{props.label}</span>
    </button>
  );
}
