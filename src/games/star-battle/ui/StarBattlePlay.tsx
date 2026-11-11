import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Screen, useIsTop, useNav, useScreenIndex } from '../../../ui/nav';
import { ResultSheet } from '../../../ui/game/hub';
import { useGameClock } from '../../../ui/game/useGameClock';
import { useRestorable } from '../../../ui/game/useRestorable';
import { haptic } from '../../../core/haptics';
import { formatTime } from '../../../core/format';
import { IconBulb, IconPause, IconPlay, IconUndo } from '../../../ui/icons';
import { GAME_ID, sbSave, sbStats } from '../storage';
import { Action, StarBattleGame, conflictReason, conflicts, reduce, starCount } from '../state';
import { MODE_LABEL, assistsOf, createGame } from '../session';
import { Board } from './Board';

interface Result {
  timeMs: number;
  newBest: boolean;
}

export function StarBattlePlay() {
  const nav = useNav();
  const isTop = useIsTop();
  const screenIndex = useScreenIndex();
  const restored = useRestorable(GAME_ID, 'resume');
  const [game, setGame] = useState<StarBattleGame | null>(() => sbSave.get());
  const gameRef = useRef(game);
  gameRef.current = game;
  const [result, setResult] = useState<Result | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const persist = (g: StarBattleGame | null = gameRef.current) => {
    if (!g) return;
    sbSave.set(g.status === 'playing' ? { ...g, elapsedMs: clock.elapsed() } : null);
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

  const win = (g: StarBattleGame) => {
    const timeMs = clock.stop();
    const assists = assistsOf(g);
    const { newBest } = sbStats.record(g.mode, { outcome: 'won', timeMs, assists });
    if (g.mode === 'daily' && g.date) sbStats.markDaily(g.date, { timeMs, assists });
    sbSave.set(null);
    setResult({ timeMs, newBest });
  };

  const dispatch = (action: Action) => {
    const g = gameRef.current;
    if (!g || paused) return;
    const [next, ev] = reduce(g, action);
    setMessage(null);
    if (ev.kind === 'hint') {
      if (ev.cell == null) setMessage('Every star is in place');
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
    if (ev.kind === 'changed' && ev.conflict) haptic('error');
    else if ((ev.kind === 'changed' && ev.star) || (ev.kind === 'hint' && ev.cell != null)) haptic('selection');
    persist(next);
  };

  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const onTap = useCallback((cell: number) => dispatchRef.current({ type: 'tap', cell }), []);
  const onCross = useCallback((cells: number[]) => dispatchRef.current({ type: 'cross', cells }), []);

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
    sbSave.set(createGame(g.mode));
    nav.replace(<StarBattlePlay />);
  };

  if (!game) return <Screen title="Star Battle">{null}</Screen>;

  const title = game.mode === 'daily' ? 'Daily · 8 × 8' : game.k > 1 ? `${MODE_LABEL[game.mode]} · ${game.k} stars` : MODE_LABEL[game.mode];
  const showPause = paused && game.status === 'playing';
  const finished = game.status !== 'playing';
  const bad = conflicts(game);
  const firstBad = [...bad][0];
  const assists = assistsOf(game);
  const need = game.n * game.k;
  const status =
    message ??
    (finished
      ? 'All stars placed'
      : firstBad != null
        ? `This star ${conflictReason(game, firstBad)}`
        : !game.touched
          ? `${game.k === 1 ? 'One star' : `${game.k} stars`} per row, column and region · tap twice for a star`
          : '');

  return (
    <Screen
      title={title}
      back={screenIndex > 1 ? 'Star Battle' : 'Games'}
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
          <span class="pc-moves" aria-label={`${starCount(game)} of ${need} stars placed`}>
            ★ {starCount(game)}/{need}
          </span>
          <span class="timer" aria-label="Time">
            {formatTime(result ? result.timeMs : clock.elapsed())}
          </span>
          <span class="hints" aria-label={assists ? `${game.hints} hints and ${game.undos} undos used` : undefined}>
            {assists ? `Assists ${assists}` : ''}
          </span>
        </div>

        <div class="sb-area">
          <div class="sb-wrap">
            <Board game={game} conflicts={bad} flash={flash} hidden={showPause} won={!!result} onTap={onTap} onCross={onCross} />
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

        <div class="sb-status" aria-live="polite">
          <span id="sb-board-hint" class="sr-only">
            Tap a cell once for a cross, twice for a star, three times to clear it. Drag to cross out several cells.
          </span>
          {status}
        </div>

        <div class="tools sb-tools">
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
