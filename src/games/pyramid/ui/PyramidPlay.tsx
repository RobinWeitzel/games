import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Screen, useIsTop, useNav, useScreenIndex } from '../../../ui/nav';
import { ResultSheet } from '../../../ui/game/hub';
import { useGameClock } from '../../../ui/game/useGameClock';
import { useRestorable } from '../../../ui/game/useRestorable';
import { shortName } from '../../../ui/cards';
import { haptic } from '../../../core/haptics';
import { formatTime } from '../../../core/format';
import type { Card } from '../../../core/cards';
import { IconBulb, IconDeal, IconPause, IconPlay, IconUndo } from '../../../ui/icons';
import { GAME_ID, pySave, pyStats } from '../storage';
import { Action, PEAK, PyramidGame, canDraw, clearedCount, isStuck, reduce } from '../state';
import { MODE_LABEL, assistsOf, createGame } from '../session';
import { Board } from './Board';

interface Result {
  timeMs: number;
  newBest: boolean;
}

const HINT_MS = 3000;

export function PyramidPlay() {
  const nav = useNav();
  const isTop = useIsTop();
  const screenIndex = useScreenIndex();
  const restored = useRestorable(GAME_ID, 'resume');
  const [game, setGame] = useState<PyramidGame | null>(() => pySave.get());
  const gameRef = useRef(game);
  gameRef.current = game;
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<'won' | 'stuck' | null>(null);
  const [fresh, setFresh] = useState<Card | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const [hint, setHint] = useState<{ spots: number[] | 's' | null; text: string } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const givenUp = useRef(false);

  const persist = (g: PyramidGame | null = gameRef.current) => {
    if (!g || givenUp.current) return;
    pySave.set(g.status === 'playing' ? { ...g, elapsedMs: clock.elapsed() } : null);
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

  const win = (g: PyramidGame) => {
    const timeMs = clock.stop();
    const assists = assistsOf(g);
    const { newBest } = pyStats.record(g.mode, { outcome: 'won', timeMs, assists });
    if (g.mode === 'daily' && g.date) pyStats.markDaily(g.date, { timeMs, assists });
    pySave.set(null);
    setResult({ timeMs, newBest });
    later(() => setSheet('won'), 500);
  };

  const dispatch = (action: Action) => {
    const g = gameRef.current;
    if (!g || paused) return;
    const [next, ev] = reduce(g, action);
    if (ev.kind === 'invalid') {
      setShake(ev.spot);
      setHint({ spots: null, text: ev.reason });
      later(() => setShake(null), 400);
      haptic('error');
      return;
    }
    if (ev.kind === 'hint') {
      const h = ev.hint;
      const name = (s: number) => shortName(s < 0 ? g.waste[g.waste.length - 1] : g.peaks[s]);
      const text = !h ? 'No sure way to win from here · undo a few moves' : 'draw' in h ? 'Hint: tap the stock' : `Hint: remove ${h.spots.map(name).join(' and ')}`;
      const spots = !h ? null : 'draw' in h ? ('s' as const) : h.spots;
      setHint({ spots, text });
      later(() => setHint((cur) => (cur?.spots === spots ? null : cur)), HINT_MS);
    } else setHint(null);
    if (next === g) return;
    gameRef.current = next;
    setGame(next);
    if (ev.kind === 'drew') {
      setFresh(next.waste[next.waste.length - 1] ?? null);
      later(() => setFresh(null), 300);
    }
    if (ev.kind === 'won') {
      haptic('success');
      return win(next);
    }
    persist(next);
    if (ev.kind === 'removed' || ev.kind === 'drew') {
      if (isStuck(next)) {
        haptic('error');
        later(() => setSheet('stuck'), 500);
      } else if (ev.kind === 'removed') haptic('selection');
    }
  };

  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const onTap = useCallback((spot: number) => dispatchRef.current(spot === -2 ? { type: 'draw' } : { type: 'tap', spot }), []);

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
    if (g && g.status === 'playing') pyStats.record(g.mode, { outcome: 'lost', timeMs: clock.stop(), assists: assistsOf(g) });
    pySave.set(null);
    givenUp.current = true;
  };

  const playAgain = () => {
    const g = gameRef.current;
    if (!g) return;
    if (g.status === 'playing') giveUp();
    pySave.set(createGame(g.mode));
    nav.replace(<PyramidPlay />);
  };

  if (!game) return <Screen title="Pyramid">{null}</Screen>;

  const title = MODE_LABEL[game.mode];
  const showPause = paused && game.status === 'playing';
  const finished = game.status !== 'playing';
  const assists = assistsOf(game);
  const left = PEAK - clearedCount(game);
  const status =
    hint?.text ??
    (finished ? 'The pyramid is cleared' : game.selected != null ? 'Now tap a card that adds up to 13 with it' : !game.touched ? 'Tip: tap two free cards that add up to 13' : '');

  return (
    <Screen
      title={title}
      back={screenIndex > 1 ? 'Pyramid' : 'Games'}
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
          <span class="pc-moves" aria-label={`${left} cards left in the pyramid`}>
            Left {left}
          </span>
          <span class="timer" aria-label="Time">
            {formatTime(result ? result.timeMs : clock.elapsed())}
          </span>
          <span class="hints" aria-label={assists ? `${game.hints} hints and ${game.undos} undos used` : undefined}>
            {assists ? `Assists ${assists}` : ''}
          </span>
        </div>

        <div class="pc-area">
          <Board game={game} hidden={showPause} fresh={fresh} shake={shake} hint={hint?.spots ?? null} onTap={onTap} />
          {showPause && (
            <button class="pause-overlay" onClick={() => setPaused(false)}>
              <span class="pause-play">
                <IconPlay size={34} />
              </span>
              <span>Paused · tap to resume</span>
            </button>
          )}
        </div>

        <div class="pc-status" aria-live="polite">
          <span id="py-board-hint" class="sr-only">
            Tap two free cards that add up to 13, or a king on its own. Tap the stock for a new waste card.
          </span>
          {status}
        </div>

        <div class="tools pc-tools">
          <Tool label="Undo" onClick={() => dispatch({ type: 'undo' })} disabled={finished || !game.history.length}>
            <IconUndo />
          </Tool>
          <Tool label="Hint" onClick={() => dispatch({ type: 'hint' })} disabled={finished}>
            <IconBulb />
          </Tool>
          <Tool label="Draw" aria={`Draw, ${game.stock.length} left`} onClick={() => dispatch({ type: 'draw' })} disabled={finished || !canDraw(game)}>
            <IconDeal />
          </Tool>
        </div>
      </div>

      <ResultSheet
        open={sheet === 'won'}
        title={result?.newBest ? 'New best time! 🎉' : 'You won! 🎉'}
        timeMs={result?.timeMs}
        meta={
          <>
            {title} · {game.moves} moves
            {game.undos ? ` · ${game.undos} undo${game.undos === 1 ? '' : 's'}` : ''}
            {game.hints ? ` · ${game.hints} hint${game.hints === 1 ? '' : 's'}` : ''}
          </>
        }
        actions={[
          ...(game.mode === 'daily' ? [] : [{ label: 'New Game', style: 'primary' as const, onClick: playAgain }]),
          { label: 'Done', onClick: () => nav.pop() },
        ]}
      />
      <ResultSheet
        open={sheet === 'stuck'}
        title="No more moves"
        message="Undo a few moves to try another way, or deal a new game."
        actions={[
          { label: 'Undo Last Move', style: 'primary', onClick: () => (setSheet(null), dispatch({ type: 'undo' })) },
          { label: game.mode === 'daily' ? 'Start Over' : 'New Game', onClick: playAgain },
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

function Tool(props: { label: string; aria?: string; onClick: () => void; disabled?: boolean; children: ComponentChildren }) {
  return (
    <button class="tool" onClick={props.onClick} disabled={props.disabled} aria-label={props.aria}>
      <span class="tool-icon">{props.children}</span>
      <span class="tool-label">{props.label}</span>
    </button>
  );
}
