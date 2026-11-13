import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Screen, useIsTop, useNav, useScreenIndex } from '../../../ui/nav';
import { ResultSheet, useRestart } from '../../../ui/game/hub';
import { useGameClock } from '../../../ui/game/useGameClock';
import { useRestorable } from '../../../ui/game/useRestorable';
import { haptic } from '../../../core/haptics';
import { formatTime } from '../../../core/format';
import { IconBulb, IconPause, IconPlay, IconUndo } from '../../../ui/icons';
import { GAME_ID, pgSave, pgStats } from '../storage';
import { Action, Jump, PegGame, isStuck, newGame, pegsLeft, reduce } from '../state';
import { MODE_LABEL, assistsOf } from '../session';
import { Board } from './Board';

interface Result {
  timeMs: number;
  newBest: boolean;
  perfect: boolean;
}

export function PegPlay() {
  const nav = useNav();
  const isTop = useIsTop();
  const screenIndex = useScreenIndex();
  const restored = useRestorable(GAME_ID, 'resume');
  const [game, setGame] = useState<PegGame | null>(() => pgSave.get());
  const gameRef = useRef(game);
  gameRef.current = game;
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<'won' | 'stuck' | null>(null);
  const [hint, setHint] = useState<Jump | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const givenUp = useRef(false);

  const persist = (g: PegGame | null = gameRef.current) => {
    if (!g || givenUp.current) return;
    pgSave.set(g.status === 'playing' ? { ...g, elapsedMs: clock.elapsed() } : null);
  };

  const clock = useGameClock({
    initialMs: game?.elapsedMs ?? 0,
    active: !!game && game.status === 'playing' && game.touched,
    startPaused: restored,
    onSuspend: () => persist(),
  });
  const { paused, setPaused } = clock;

  useEffect(() => {
    if (!game) nav.pop();
  }, []);

  const win = (g: PegGame, perfect: boolean) => {
    const timeMs = clock.stop();
    const { newBest } = pgStats.record(g.mode, { outcome: 'won', timeMs, assists: assistsOf(g) });
    pgSave.set(null);
    setResult({ timeMs, newBest, perfect });
    later(() => setSheet('won'), 400);
  };

  const dispatch = (action: Action) => {
    const g = gameRef.current;
    if (!g || paused) return;
    const [next, ev] = reduce(g, action);
    setMessage(null);
    if (ev.kind === 'invalid') {
      haptic('error');
      setShake(ev.hole);
      later(() => setShake(null), 350);
      setMessage(ev.reason);
      return;
    }
    if (ev.kind === 'hint') {
      setHint(ev.jump);
      if (!ev.jump) setMessage('No way to one peg from here · undo a few jumps');
      later(() => setHint((h) => (h === ev.jump ? null : h)), 3000);
    } else setHint(null);
    if (next === g) return;
    gameRef.current = next;
    setGame(next);
    if (ev.kind === 'won') {
      haptic('success');
      return win(next, ev.perfect);
    }
    persist(next);
    if (ev.kind === 'jumped') {
      if (isStuck(next)) {
        haptic('error');
        later(() => setSheet('stuck'), 500);
      } else haptic('selection');
    }
  };

  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const onTap = useCallback((hole: number) => dispatchRef.current({ type: 'tap', hole }), []);
  const onJump = useCallback((from: number, to: number) => dispatchRef.current({ type: 'jump', from, to }), []);

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

  const giveUp = () => {
    const g = gameRef.current;
    if (g && g.status === 'playing') pgStats.record(g.mode, { outcome: 'lost', timeMs: clock.stop(), assists: assistsOf(g) });
    pgSave.set(null);
    givenUp.current = true;
  };

  const playAgain = () => {
    const g = gameRef.current;
    if (!g) return;
    if (g.status === 'playing') giveUp();
    pgSave.set(newGame(g.mode));
    nav.replace(<PegPlay />);
  };

  /** The board is always the same, so starting again is a new game: the current one counts as lost. */
  const restartCtl = useRestart({
    disabled: !game || paused || game.status !== 'playing' || !game.touched,
    title: 'Start this game again?',
    message: 'Your current game counts as lost.',
    label: 'Start Again',
    onRestart: () => playAgain(),
  });

  if (!game) return <Screen title="Peg Solitaire">{null}</Screen>;

  const title = MODE_LABEL[game.mode];
  const showPause = paused && game.status === 'playing';
  const finished = game.status !== 'playing';
  const assists = assistsOf(game);
  const status =
    message ??
    (finished
      ? result?.perfect && game.mode === 'english'
        ? 'Perfect: the last peg is in the centre'
        : 'One peg left'
      : game.selected != null
        ? 'Tap a hole with a dashed ring to jump there'
        : !game.touched
          ? 'Tap a peg, then the hole to jump to'
          : '');

  return (
    <Screen
      title={title}
      back={screenIndex > 1 ? 'Peg Solitaire' : 'Games'}
      fixed
      class="play"
      right={
        <>
          {restartCtl.button}
          <button class="nav-icon" aria-label={paused ? 'Resume' : 'Pause'} disabled={finished} onClick={() => setPaused((p) => !p)}>
            {paused ? <IconPlay size={22} /> : <IconPause size={22} />}
          </button>
        </>
      }
    >
      <div class="play-layout">
        <div class="play-info">
          <span class="pc-moves">Pegs {pegsLeft(game)}</span>
          <span class="timer" aria-label="Time">
            {formatTime(result ? result.timeMs : clock.elapsed())}
          </span>
          <span class="hints" aria-label={assists ? `${game.hints} hints and ${game.undos} undos used` : undefined}>
            {assists ? `Assists ${assists}` : ''}
          </span>
        </div>

        <div class="pg-area">
          <Board game={game} hidden={showPause} hint={hint} shake={shake} onTap={onTap} onJump={onJump} />
          {showPause && (
            <button class="pause-overlay" onClick={() => setPaused(false)}>
              <span class="pause-play">
                <IconPlay size={34} />
              </span>
              <span>Paused · tap to resume</span>
            </button>
          )}
        </div>

        <div class="pg-status" aria-live="polite">
          <span id="pg-board-hint" class="sr-only">
            Tap a peg to pick it up, then an empty hole two steps away, behind a neighbouring peg, to jump there.
          </span>
          {status}
        </div>

        <div class="tools pg-tools">
          <Tool label="Undo" onClick={() => dispatch({ type: 'undo' })} disabled={finished || !game.history.length}>
            <IconUndo />
          </Tool>
          <Tool label="Hint" onClick={() => dispatch({ type: 'hint' })} disabled={finished}>
            <IconBulb />
          </Tool>
        </div>
      </div>

      {restartCtl.sheet}
      <ResultSheet
        open={sheet === 'won'}
        title={result?.perfect && game.mode === 'english' ? 'Perfect! 🎉' : result?.newBest ? 'New best time! 🎉' : 'One peg left! 🎉'}
        timeMs={result?.timeMs}
        meta={
          <>
            {title} · {game.moves} jumps
            {game.undos ? ` · ${game.undos} undo${game.undos === 1 ? '' : 's'}` : ''}
            {game.hints ? ` · ${game.hints} hint${game.hints === 1 ? '' : 's'}` : ''}
          </>
        }
        actions={[
          { label: 'Play Again', style: 'primary', onClick: playAgain },
          { label: 'Done', onClick: () => nav.pop() },
        ]}
      />
      <ResultSheet
        open={sheet === 'stuck'}
        title="No more jumps"
        message={`${pegsLeft(game)} pegs are left. Undo a few jumps to try another way, or start again.`}
        actions={[
          { label: 'Undo Last Jump', style: 'primary', onClick: () => (setSheet(null), dispatch({ type: 'undo' })) },
          { label: 'Start Again', onClick: playAgain },
          {
            label: 'Done',
            onClick: () => {
              giveUp();
              nav.pop();
            },
          },
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
