import { useEffect, useRef, useState } from 'preact/hooks';
import { Screen, useIsTop, useNav, useScreenIndex } from '../../../ui/nav';
import { ResultSheet } from '../../../ui/game/hub';
import { useGameClock } from '../../../ui/game/useGameClock';
import { useRestorable } from '../../../ui/game/useRestorable';
import { haptic } from '../../../core/haptics';
import { formatTime } from '../../../core/format';
import { IconBulb, IconErase, IconPause, IconPlay } from '../../../ui/icons';
import { GAME_ID, cbSave, cbStats } from '../storage';
import { Action, CodebreakerGame, reduce } from '../state';
import { MODE_LABEL, createGame } from '../session';
import { Feedback, Peg, SYMBOL_NAMES } from './Peg';

interface Result {
  outcome: 'won' | 'lost';
  timeMs: number;
  newBest: boolean;
}

const feedbackText = (exact: number, partial: number) =>
  exact === 0 && partial === 0 ? 'nothing matches' : `${exact} in the right place, ${partial} in another place`;

export function CodebreakerPlay() {
  const nav = useNav();
  const isTop = useIsTop();
  const screenIndex = useScreenIndex();
  const restored = useRestorable(GAME_ID, 'resume');
  const [game, setGame] = useState<CodebreakerGame | null>(() => cbSave.get());
  const gameRef = useRef(game);
  gameRef.current = game;
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const persist = (g: CodebreakerGame | null = gameRef.current) => {
    if (!g) return;
    cbSave.set(g.status === 'playing' ? { ...g, elapsedMs: clock.elapsed() } : null);
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

  const finish = (g: CodebreakerGame, outcome: 'won' | 'lost') => {
    const timeMs = clock.stop();
    const { newBest } = cbStats.record(g.mode, { outcome, timeMs, assists: g.hints });
    if (outcome === 'won' && g.mode === 'daily' && g.date) cbStats.markDaily(g.date, { timeMs, assists: g.hints });
    cbSave.set(null);
    setResult({ outcome, timeMs, newBest });
  };

  const dispatch = (action: Action) => {
    const g = gameRef.current;
    if (!g || paused) return;
    const [next, ev] = reduce(g, action);
    if (next === g) return;
    gameRef.current = next;
    setGame(next);
    switch (ev.kind) {
      case 'scored':
        haptic('selection');
        setMessage(`Guess ${next.guesses.length}: ${feedbackText(ev.guess.exact, ev.guess.partial)}`);
        break;
      case 'hint':
        setMessage(`Hint: position ${ev.slot + 1} is the ${SYMBOL_NAMES[next.code[ev.slot]]}`);
        break;
      case 'won':
        haptic('success');
        finish(next, 'won');
        return;
      case 'lost':
        haptic('error');
        finish(next, 'lost');
        return;
    }
    persist(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!isTop || !g) return;
      const d = /^Digit[1-8]$/.test(e.code) ? Number(e.code.slice(5)) : 0;
      if (d && d <= g.symbols) dispatch({ type: 'add', symbol: d - 1 });
      else if (e.key === 'Backspace') dispatch({ type: 'backspace' });
      else if (e.key === 'Enter') dispatch({ type: 'submit' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const playAgain = () => {
    const g = gameRef.current;
    if (!g) return;
    cbSave.set(createGame(g.mode));
    nav.replace(<CodebreakerPlay />);
  };

  if (!game) return <Screen title="Codebreaker">{null}</Screen>;

  const title = MODE_LABEL[game.mode];
  const showPause = paused && game.status === 'playing';
  const finished = game.status !== 'playing';
  const full = game.current.every((s) => s != null);
  const nextSlot = game.current.indexOf(null);
  const keyCols = Math.ceil((game.symbols + 2) / 2);
  const status =
    message ??
    (!game.touched
      ? `Find the code: ${game.pegs} symbols, repeats allowed`
      : full
        ? 'Tap Check to try this code'
        : '');

  return (
    <Screen
      title={title}
      back={screenIndex > 1 ? 'Codebreaker' : 'Games'}
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
          <span class="pc-moves">
            Guess {Math.min(game.guesses.length + 1, game.maxGuesses)}/{game.maxGuesses}
          </span>
          <span class="timer" aria-label="Time">
            {formatTime(result ? result.timeMs : clock.elapsed())}
          </span>
          <span class="hints">{game.hints ? `Hints ${game.hints}` : ''}</span>
        </div>

        <div class={`cb-area ${showPause ? 'cb-hidden' : ''}`} role="list" aria-label="Guesses">
          {Array.from({ length: game.maxGuesses }, (_, k) => {
            const guess = game.guesses[k];
            return (
              <div
                key={k}
                class={`cb-row ${guess ? 'cb-done' : ''}`}
                role="listitem"
                aria-label={guess ? `Guess ${k + 1}: ${guess.pegs.map((s) => SYMBOL_NAMES[s]).join(', ')}. ${feedbackText(guess.exact, guess.partial)}` : `Guess ${k + 1}, not used yet`}
              >
                <span class="cb-num" aria-hidden="true">
                  {k + 1}
                </span>
                <span class="cb-pegs" aria-hidden="true">
                  {guess ? guess.pegs.map((s) => <Peg symbol={s} />) : Array.from({ length: game.pegs }, () => <span class="cb-empty" />)}
                </span>
                {guess ? <Feedback exact={guess.exact} partial={guess.partial} pegs={game.pegs} /> : <span />}
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

        <div class="cb-status" aria-live="polite">
          {status}
        </div>

        <div class="cb-input" style={{ gridTemplateColumns: `repeat(${game.pegs}, minmax(0, 1fr))` }} aria-label="Your guess">
          {game.current.map((s, i) => {
            const locked = game.revealed.includes(i);
            return (
              <button
                key={i}
                class={`cb-slot ${i === nextSlot ? 'cb-next' : ''} ${locked ? 'cb-locked' : ''}`}
                disabled={finished || paused || s == null || locked}
                aria-label={`Position ${i + 1}: ${s == null ? 'empty' : `${SYMBOL_NAMES[s]}${locked ? ', revealed by a hint' : ', tap to remove'}`}`}
                onClick={() => dispatch({ type: 'clear', slot: i })}
              >
                {s != null && !showPause && <Peg symbol={s} />}
              </button>
            );
          })}
        </div>

        <div class="cb-keys" style={{ gridTemplateColumns: `repeat(${keyCols}, minmax(0, 1fr))` }}>
          {Array.from({ length: game.symbols }, (_, s) => (
            <button key={s} class="cb-key" aria-label={SYMBOL_NAMES[s]} disabled={finished || paused || full} onClick={() => dispatch({ type: 'add', symbol: s })}>
              <Peg symbol={s} />
            </button>
          ))}
          <button class="cb-key" aria-label="Delete" disabled={finished || paused || !game.current.some((s, i) => s != null && !game.revealed.includes(i))} onClick={() => dispatch({ type: 'backspace' })}>
            <IconErase size={24} />
          </button>
          <button class="cb-key cb-check" disabled={finished || paused || !full} onClick={() => dispatch({ type: 'submit' })}>
            Check
          </button>
        </div>

        <div class="tools">
          <button class="tool" onClick={() => dispatch({ type: 'hint' })} disabled={finished || game.revealed.length >= game.pegs - 1}>
            <span class="tool-icon">
              <IconBulb />
            </span>
            <span class="tool-label">Hint</span>
          </button>
        </div>
      </div>

      <ResultSheet
        open={result?.outcome === 'won'}
        title={result?.newBest ? 'New best time! 🎉' : 'Code cracked! 🎉'}
        timeMs={result?.timeMs}
        meta={
          <>
            {title} · {game.guesses.length} guess{game.guesses.length === 1 ? '' : 'es'}
            {game.hints ? ` · ${game.hints} hint${game.hints === 1 ? '' : 's'}` : ''}
          </>
        }
        actions={[
          ...(game.mode === 'daily' ? [] : [{ label: 'New Game', style: 'primary' as const, onClick: playAgain }]),
          { label: 'Done', onClick: () => nav.pop() },
        ]}
      />
      <ResultSheet
        open={result?.outcome === 'lost'}
        title="Out of guesses"
        message={`The code was: ${game.code.map((s) => SYMBOL_NAMES[s]).join(', ')}.`}
        actions={[
          ...(game.mode === 'daily' ? [] : [{ label: 'New Game', style: 'primary' as const, onClick: playAgain }]),
          { label: 'Done', onClick: () => nav.pop() },
        ]}
      />
    </Screen>
  );
}
