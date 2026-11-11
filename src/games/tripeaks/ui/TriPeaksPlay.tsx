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
import { GAME_ID, tpSave, tpStats } from '../storage';
import { Action, PEAK_CARDS, TriPeaksGame, clearedCount, isStuck, reduce } from '../state';
import { MODE_LABEL, assistsOf, createGame } from '../session';
import { Board } from './Board';

interface Result {
  timeMs: number;
  newBest: boolean;
}

const HINT_MS = 3000;

export function TriPeaksPlay() {
  const nav = useNav();
  const isTop = useIsTop();
  const screenIndex = useScreenIndex();
  const restored = useRestorable(GAME_ID, 'resume');
  const [game, setGame] = useState<TriPeaksGame | null>(() => tpSave.get());
  const gameRef = useRef(game);
  gameRef.current = game;
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<'won' | 'stuck' | null>(null);
  const [fresh, setFresh] = useState<Card | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const [hint, setHint] = useState<{ i: number | null; text: string } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const givenUp = useRef(false);

  const persist = (g: TriPeaksGame | null = gameRef.current) => {
    if (!g || givenUp.current) return;
    tpSave.set(g.status === 'playing' ? { ...g, elapsedMs: clock.elapsed() } : null);
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

  const win = (g: TriPeaksGame) => {
    const timeMs = clock.stop();
    const assists = assistsOf(g);
    const { newBest } = tpStats.record(g.mode, { outcome: 'won', timeMs, assists });
    if (g.mode === 'daily' && g.date) tpStats.markDaily(g.date, { timeMs, assists });
    tpSave.set(null);
    setResult({ timeMs, newBest });
    later(() => setSheet('won'), 500);
  };

  const dispatch = (action: Action) => {
    const g = gameRef.current;
    if (!g || paused) return;
    const [next, ev] = reduce(g, action);
    if (ev.kind === 'invalid') {
      setShake(ev.i);
      setHint({ i: null, text: ev.reason });
      later(() => setShake(null), 400);
      haptic('error');
      return;
    }
    if (ev.kind === 'hint') {
      const text = ev.i == null ? 'No more moves · undo or start a new game' : ev.i < 0 ? 'Hint: turn over a stock card' : `Hint: play ${shortName(g.peaks[ev.i])}`;
      setHint({ i: ev.i, text });
      later(() => setHint((h) => (h?.i === ev.i ? null : h)), HINT_MS);
    } else setHint(null);
    if (next === g) return;
    gameRef.current = next;
    setGame(next);
    if (ev.kind === 'played' || ev.kind === 'drew') {
      setFresh(next.waste[next.waste.length - 1]);
      later(() => setFresh(null), 300);
    }
    if (ev.kind === 'won') {
      haptic('success');
      return win(next);
    }
    persist(next);
    if (ev.kind === 'played' || ev.kind === 'drew') {
      if (isStuck(next)) {
        haptic('error');
        later(() => setSheet('stuck'), 500);
      } else haptic(ev.kind === 'played' && ev.peak ? 'success' : 'selection');
    }
  };

  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const onTap = useCallback((i: number) => dispatchRef.current(i < 0 ? { type: 'draw' } : { type: 'play', i }), []);

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
    if (g && g.status === 'playing') tpStats.record(g.mode, { outcome: 'lost', timeMs: clock.stop(), assists: assistsOf(g) });
    tpSave.set(null);
    givenUp.current = true;
  };

  const playAgain = () => {
    const g = gameRef.current;
    if (!g) return;
    if (g.status === 'playing') giveUp();
    tpSave.set(createGame(g.mode));
    nav.replace(<TriPeaksPlay />);
  };

  if (!game) return <Screen title="TriPeaks">{null}</Screen>;

  const title = MODE_LABEL[game.mode];
  const showPause = paused && game.status === 'playing';
  const finished = game.status !== 'playing';
  const assists = assistsOf(game);
  const left = PEAK_CARDS - clearedCount(game);
  const status =
    hint?.text ??
    (finished ? 'All peaks cleared' : !game.touched ? 'Tip: tap a card one higher or lower than the waste card' : game.streak > 1 ? `Streak ${game.streak}` : '');

  return (
    <Screen
      title={title}
      back={screenIndex > 1 ? 'TriPeaks' : 'Games'}
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
          <span class="pc-moves" aria-label={`${left} cards left in the peaks`}>
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
          <Board game={game} hidden={showPause} fresh={fresh} shake={shake} hint={hint?.i ?? null} onTap={onTap} />
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
          <span id="tp-board-hint" class="sr-only">
            Tap a free card that is one rank higher or lower than the waste card. Tap the stock for a new waste card.
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
          <Tool label="Draw" aria={`Draw, ${game.stock.length} left`} onClick={() => dispatch({ type: 'draw' })} disabled={finished || !game.stock.length}>
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
            {title} · longest streak {game.longestStreak}
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
