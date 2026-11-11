import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Screen, useIsTop, useNav, useScreenIndex } from '../../../ui/nav';
import { Sheet } from '../../../ui/components';
import { ResultSheet } from '../../../ui/game/hub';
import { useGameClock } from '../../../ui/game/useGameClock';
import { useRestorable } from '../../../ui/game/useRestorable';
import { haptic } from '../../../core/haptics';
import { formatTime } from '../../../core/format';
import { createRng, randomSeed } from '../../../core/random';
import { IconBulb, IconPause, IconPlay, IconUndo } from '../../../ui/icons';
import { GAME_ID, numbersSave, numbersStats } from '../storage';
import {
  Action,
  MAX_LARGE,
  NumbersGame,
  OPS,
  OP_NAME,
  OP_SYMBOL,
  Op,
  TIME_LIMIT_MS,
  distance,
  formatStep,
  points,
  reduce,
  solution,
} from '../state';
import { MODE_LABEL, startGame } from '../session';

interface Result {
  outcome: 'won' | 'lost';
  timeMs: number;
  newBest: boolean;
  timeUp: boolean;
}

export function NumbersPlay() {
  const nav = useNav();
  const isTop = useIsTop();
  const screenIndex = useScreenIndex();
  // Relaunching the app comes straight back here (paused, so the player can get oriented).
  const restored = useRestorable(GAME_ID, 'resume');
  const [game, setGame] = useState<NumbersGame | null>(() => numbersSave.get());
  const gameRef = useRef(game);
  gameRef.current = game;

  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const [pop, setPop] = useState<number | null>(null);
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);

  /** Save the game in progress (with the current time); finished games are removed. */
  const persist = (g: NumbersGame | null = gameRef.current) => {
    if (!g) return;
    numbersSave.set(g.status === 'playing' || g.status === 'picking' ? { ...g, elapsedMs: clock.elapsed() } : null);
  };

  const clock = useGameClock({
    initialMs: game?.elapsedMs ?? 0,
    active: !!game && game.status === 'playing',
    startPaused: restored && game?.status === 'playing',
    onSuspend: () => persist(),
  });
  const { paused, setPaused } = clock;

  // Nothing to play (e.g. finished in another screen): go back.
  useEffect(() => {
    if (!game) nav.pop();
  }, []);

  const finish = (g: NumbersGame, outcome: 'won' | 'lost', timeUp = false) => {
    const stopped = clock.stop();
    const timeMs = timeUp ? TIME_LIMIT_MS : stopped;
    const { newBest } = numbersStats.record(g.mode, { outcome, timeMs, assists: g.hints });
    if (outcome === 'won' && g.mode === 'daily' && g.date) numbersStats.markDaily(g.date, { timeMs, assists: g.hints });
    numbersSave.set(null);
    setResult({ outcome, timeMs, newBest, timeUp });
  };

  /** `silent`: skip haptics (used when not inside a touch event, where iOS can't play them). */
  const dispatch = (action: Action, silent = false) => {
    const g = gameRef.current;
    if (!g || (paused && g.status === 'playing')) return;
    const [next, ev] = reduce(g, action);
    if (ev.kind === 'invalid') {
      if (!silent) haptic('error');
      setMessage({ text: ev.reason, error: true });
      setShake(ev.slot);
      setTimeout(() => setShake(null), 400);
      return;
    }
    if (ev.kind === 'hint') setMessage({ text: ev.message, error: false });
    else if (next !== g) setMessage(null);
    if (next === g) return;
    gameRef.current = next;
    setGame(next);

    switch (ev.kind) {
      case 'move':
        if (!silent) haptic('selection');
        setPop(ev.slot);
        setTimeout(() => setPop(null), 450);
        break;
      case 'won':
        if (!silent) haptic('success');
        setTimeout(() => finish(next, 'won'), 50);
        return;
      case 'lost':
        if (!silent) haptic('error');
        finish(next, 'lost', action.type === 'timeUp');
        return;
    }
    if (action.type === 'pick') setPaused(false);
    // Selecting a number or an operation isn't worth a write; calculations, undo and hints are.
    if (next.slots !== g.slots || next.hints !== g.hints || next.status !== g.status) persist(next);
  };

  // 30-second mode: the clock running out ends the game.
  const timed = game?.mode === 'timed';
  const remainingMs = timed ? Math.max(0, TIME_LIMIT_MS - clock.elapsed()) : 0;
  useEffect(() => {
    if (timed && game?.status === 'playing' && !paused && isTop && remainingMs <= 0) dispatch({ type: 'timeUp' }, true);
  });

  // Hardware keyboard (handy on desktop while developing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isTop) return;
      const g = gameRef.current;
      if (!g) return;
      if (g.status === 'picking' && /^Digit[0-4]$/.test(e.code)) {
        dispatch({ type: 'pick', large: Number(e.code.slice(5)), rng: createRng(randomSeed()) });
      } else if (/^Digit[1-6]$/.test(e.code)) dispatch({ type: 'tapSlot', slot: Number(e.code.slice(5)) - 1 });
      else if ('+-*/'.includes(e.key) && e.key) dispatch({ type: 'tapOp', op: e.key as Op });
      else if (e.key === 'x') dispatch({ type: 'tapOp', op: '*' });
      else if (e.key === 'Backspace' || (e.key === 'z' && (e.metaKey || e.ctrlKey))) dispatch({ type: 'undo' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const newGame = () => {
    const g = gameRef.current;
    if (!g) return;
    startGame(g.mode);
    nav.replace(<NumbersPlay />);
  };

  if (!game) return <Screen title="Numbers">{null}</Screen>;

  const picking = game.status === 'picking';
  const showPause = paused && game.status === 'playing';
  const title = game.mode === 'daily' ? 'Daily' : MODE_LABEL[game.mode];
  const time = result ? result.timeMs : clock.elapsed();
  const d = distance(game);
  const sol = result?.outcome === 'lost' ? solution(game) : [];

  return (
    <Screen
      title={title}
      back={screenIndex > 1 ? 'Numbers' : 'Games'}
      fixed
      class="play nb-play"
      right={
        <button class="nav-icon" aria-label={paused ? 'Resume' : 'Pause'} disabled={game.status !== 'playing'} onClick={() => setPaused((p) => !p)}>
          {paused ? <IconPlay size={22} /> : <IconPause size={22} />}
        </button>
      }
    >
      <div class="play-layout nb-layout">
        <div class="play-info">
          <span>{!picking && game.closest != null ? `Closest ${game.closest}` : ''}</span>
          <span class="timer" aria-label={timed ? 'Time left' : 'Time'}>
            {timed ? formatTime(result?.timeUp ? 0 : picking ? TIME_LIMIT_MS : Math.ceil(remainingMs / 1000) * 1000) : formatTime(time)}
          </span>
          <span class="hints">{game.hints ? `Hints ${game.hints}` : ''}</span>
        </div>

        <div class={`nb-main ${showPause ? 'nb-hidden' : ''}`}>
          <div class="nb-target" aria-label={picking ? 'Target not drawn yet' : `Target ${game.target}`}>
            <span class="nb-target-label">Target</span>
            <span class="nb-target-value" aria-hidden="true">
              {picking ? '???' : game.target}
            </span>
            {timed && (
              <span class="nb-timebar" aria-hidden="true">
                <span style={{ transform: `scaleX(${picking ? 1 : remainingMs / TIME_LIMIT_MS})` }} />
              </span>
            )}
          </div>

          <div class="nb-steps">
            {picking ? (
              <p class="nb-help">
                Six numbers are drawn: the large ones from 25, 50, 75 and 100, the rest from 1 to 10. Combine them with + − × ÷ to hit the
                target. Each number can be used once{timed ? ', and you have 30 seconds' : ''}.
              </p>
            ) : game.moves.length ? (
              <ol aria-label="Calculations">
                {game.moves.map((m, i) => (
                  <li key={i}>{formatStep(m)}</li>
                ))}
              </ol>
            ) : (
              <p class="nb-help">Tap a number, an operation, then another number.</p>
            )}
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

        <div class={`nb-message ${message?.error ? 'error' : ''}`} aria-live="polite">
          {message?.text ?? ''}
        </div>

        {picking ? (
          <div class="nb-picker">
            <div class="nb-picker-title" id="nb-pick-title">
              How many large numbers?
            </div>
            <div class="nb-picker-keys" role="group" aria-labelledby="nb-pick-title">
              {Array.from({ length: MAX_LARGE + 1 }, (_, n) => (
                <button
                  key={n}
                  class="nb-key"
                  aria-label={`${n} large, ${6 - n} small`}
                  data-audit-next={n === 1 ? '' : undefined}
                  onClick={() => dispatch({ type: 'pick', large: n, rng: createRng(randomSeed()) })}
                >
                  {n}
                </button>
              ))}
            </div>
            <div class="nb-picker-note" aria-hidden="true">
              Large: 25, 50, 75, 100 · small: 1–10
            </div>
          </div>
        ) : (
          <>
            <div class={`nb-slots ${showPause ? 'nb-hidden' : ''}`}>
              {game.slots.map((v, i) =>
                v == null ? (
                  <span key={i} class="nb-slot empty" aria-hidden="true" />
                ) : (
                  <button
                    key={i}
                    class={`nb-slot ${game.selected === i ? 'selected' : ''} ${shake === i ? 'shake' : ''} ${pop === i ? 'pop' : ''} ${String(v).length > 5 ? 'len-l' : String(v).length > 3 ? 'len-m' : ''}`}
                    aria-pressed={game.selected === i}
                    aria-label={`${v}${game.selected === i ? ', selected' : ''}`}
                    disabled={showPause || game.status !== 'playing'}
                    onClick={() => dispatch({ type: 'tapSlot', slot: i })}
                  >
                    {showPause ? '' : v}
                  </button>
                ),
              )}
            </div>
            <div class="nb-ops">
              {OPS.map((op) => (
                <button
                  key={op}
                  class={`nb-op ${game.op === op ? 'active' : ''}`}
                  aria-label={OP_NAME[op]}
                  aria-pressed={game.op === op}
                  disabled={showPause || game.status !== 'playing' || game.selected == null}
                  onClick={() => dispatch({ type: 'tapOp', op })}
                >
                  {OP_SYMBOL[op]}
                </button>
              ))}
            </div>
          </>
        )}

        <div class="tools nb-tools">
          <Tool label="Undo" onClick={() => dispatch({ type: 'undo' })} disabled={picking || showPause || (!game.moves.length && game.selected == null)}>
            <IconUndo />
          </Tool>
          <Tool label="Reset" onClick={() => dispatch({ type: 'reset' })} disabled={picking || showPause || !game.moves.length}>
            <IconReset />
          </Tool>
          <Tool label="Hint" onClick={() => dispatch({ type: 'hint' })} disabled={picking || showPause}>
            <IconBulb />
          </Tool>
          <Tool label="Give Up" onClick={() => setConfirmGiveUp(true)} disabled={picking || showPause || game.status !== 'playing'}>
            <IconFlag />
          </Tool>
        </div>
      </div>

      <Sheet
        open={confirmGiveUp}
        onClose={() => setConfirmGiveUp(false)}
        title="Give up?"
        message="The game counts as lost, and a solution is shown."
        actions={[
          {
            label: 'Show Solution',
            style: 'destructive',
            onClick: () => {
              setConfirmGiveUp(false);
              dispatch({ type: 'giveUp' });
            },
          },
        ]}
      />
      <ResultSheet
        open={result?.outcome === 'won'}
        title={result?.newBest ? 'New best time! 🎉' : 'Spot on! 🎉'}
        timeMs={result?.timeMs}
        meta={
          <>
            {title} · Target {game.target} · {game.moves.length} step{game.moves.length === 1 ? '' : 's'}
            {game.hints ? ` · ${game.hints} hint${game.hints === 1 ? '' : 's'}` : ''}
          </>
        }
        actions={[
          ...(game.mode === 'daily' ? [] : [{ label: 'New Game', style: 'primary' as const, onClick: newGame }]),
          { label: 'Done', onClick: () => nav.pop() },
        ]}
      />
      <ResultSheet
        open={result?.outcome === 'lost'}
        title={result?.timeUp ? "Time's up" : 'Solution'}
        message={
          <div class="nb-result">
            {d != null && (
              <p>
                {d === 0 ? 'You had it!' : `Your closest: ${game.closest}, ${d} away`} · {points(game)} point{points(game) === 1 ? '' : 's'}
              </p>
            )}
            <p class="nb-result-label">One way to make {game.target}:</p>
            <ol aria-label="Solution">
              {sol.map((s, i) => (
                <li key={i}>{formatStep(s)}</li>
              ))}
            </ol>
          </div>
        }
        actions={[
          ...(game.mode === 'daily' ? [] : [{ label: 'New Game', style: 'primary' as const, onClick: newGame }]),
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

const IconReset = ({ size = 24 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
);

const IconFlag = ({ size = 24 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M5 21V4" />
    <path d="M5 4h11l-2 4 2 4H5" />
  </svg>
);
