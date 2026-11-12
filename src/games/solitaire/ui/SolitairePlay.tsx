import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Screen, useIsTop, useNav, useScreenIndex } from '../../../ui/nav';
import { ResultSheet } from '../../../ui/game/hub';
import { useGameClock } from '../../../ui/game/useGameClock';
import { useRestorable } from '../../../ui/game/useRestorable';
import { haptic } from '../../../core/haptics';
import { useStore } from '../../../core/storage';
import { formatTime } from '../../../core/format';
import { IconBolt, IconBulb, IconPause, IconPlay, IconUndo } from '../../../ui/icons';
import { GAME_ID, solSave, solSettings, solStats } from '../storage';
import { Action, Card, Move, Pile, SolitaireGame, autoFinishMove, canAutoFinish, isStuck, pileCards, reduce } from '../state';
import { MODE_LABEL, assistsOf, createGame } from '../session';
import { Board } from './Board';
import { shortName } from '../../../ui/cards';

interface Result {
  timeMs: number;
  newBest: boolean;
}

/** "Move 7♥ onto 8♠" / "Draw from the stock", for hints. */
function describeMove(g: SolitaireGame, m: Move): string {
  if (m.from === 's') return g.stock.length ? 'Draw from the stock' : 'Turn the waste over';
  const card = pileCards(g, m.from)[m.index];
  if (m.to[0] === 'f') return `Move ${shortName(card)} to its foundation`;
  const to = pileCards(g, m.to);
  return to.length ? `Move ${shortName(card)} onto ${shortName(to[to.length - 1])}` : `Move ${shortName(card)} to the empty column`;
}

/** How long a finish step and a hint stay (ms). */
const FINISH_STEP = 110;
const HINT_MS = 3000;

export function SolitairePlay() {
  const nav = useNav();
  const isTop = useIsTop();
  const screenIndex = useScreenIndex();
  // Relaunching the app comes straight back here (paused, so the player can get oriented).
  const restored = useRestorable(GAME_ID, 'resume');
  const settings = useStore(solSettings);
  const [game, setGame] = useState<SolitaireGame | null>(() => solSave.get());
  const gameRef = useRef(game);
  gameRef.current = game;

  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<'won' | 'stuck' | null>(null);
  const [fresh, setFresh] = useState<Set<Card>>(new Set());
  const [shake, setShake] = useState<Card | null>(null);
  const [hint, setHint] = useState<{ move: Move | null; text: string } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /**
   * The player gave up a stuck game. The clock saves when this screen closes (onSuspend), which
   * must not put that game back (over a new deal, or as "Continue" after Done).
   */
  const givenUp = useRef(false);

  /** Save the game in progress (with the current time); finished games are removed. */
  const persist = (g: SolitaireGame | null = gameRef.current) => {
    if (!g || givenUp.current) return;
    solSave.set(g.status === 'playing' ? { ...g, elapsedMs: clock.elapsed() } : null);
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

  const win = (g: SolitaireGame) => {
    const timeMs = clock.stop();
    const assists = assistsOf(g);
    const { newBest } = solStats.record(g.mode, { outcome: 'won', timeMs, assists });
    if (g.mode === 'daily' && g.date) solStats.markDaily(g.date, { timeMs, assists });
    solSave.set(null);
    setResult({ timeMs, newBest });
    later(() => setSheet('won'), 600);
  };

  /** Apply a move and play its haptic (called inside the tap, as iOS requires). */
  const dispatch = (action: Action) => {
    const g = gameRef.current;
    if (!g || paused || finishing) return;
    const [next, ev] = reduce(g, action);
    if (ev.kind === 'invalid') {
      const card = pileCards(g, ev.pile)[ev.index];
      setShake(card);
      setHint({ move: null, text: `${shortName(card)} can’t go there` });
      later(() => setShake(null), 400);
      haptic('error');
      return;
    }
    if (ev.kind === 'hint') {
      setHint({ move: ev.move, text: ev.move ? `Hint: ${describeMove(g, ev.move)}` : 'No more moves · undo or start a new game' });
      later(() => setHint((h) => (h?.move === ev.move ? null : h)), HINT_MS);
    } else {
      setHint(null);
    }
    if (next === g) return;
    gameRef.current = next;
    setGame(next);

    if (ev.kind === 'moved') {
      setFresh(new Set(pileCards(next, ev.to).slice(-ev.n)));
      later(() => setFresh(new Set()), 300);
      if (action.type === 'move' && !solSettings.get().dragTipSeen) solSettings.set((s) => ({ ...s, dragTipSeen: true }));
    }
    if (ev.kind === 'won') {
      haptic('success');
      return win(next);
    }
    persist(next);
    if (ev.kind === 'moved' || ev.kind === 'drew') {
      if (isStuck(next)) {
        haptic('error');
        later(() => setSheet('stuck'), 500);
      } else {
        // A finished suit is something completed (docs/DESIGN.md §7).
        haptic(ev.kind === 'moved' && ev.foundation && next.foundations[Number(ev.to.slice(1))] === 13 ? 'success' : 'selection');
      }
    }
  };

  // Stable callbacks for the memoized board (it would otherwise re-render with every clock tick).
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const onTap = useCallback((pile: Pile, index: number) => dispatchRef.current({ type: 'tap', pile, index }), []);
  const onDrop = useCallback((from: Pile, index: number, to: Pile) => dispatchRef.current({ type: 'move', from, index, to }), []);

  /** Everything is face up: put the cards home one by one. */
  const finish = () => {
    const g = gameRef.current;
    if (!g || !canAutoFinish(g) || paused) return;
    haptic('success');
    setFinishing(true);
    setHint(null);
    const step = () => {
      const cur = gameRef.current!;
      const m = autoFinishMove(cur);
      if (!m) return setFinishing(false);
      const [next, ev] = reduce(cur, { type: 'move', ...m });
      gameRef.current = next;
      setGame(next);
      setFresh(new Set([pileCards(cur, m.from)[m.index]]));
      if (ev.kind === 'won') {
        setFinishing(false);
        win(next);
      } else {
        persist(next);
        later(step, FINISH_STEP);
      }
    };
    step();
  };

  // Hardware keyboard: ⌘Z / Ctrl+Z undoes.
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

  /** Leave a stuck game: it counts as lost. */
  const giveUp = () => {
    const g = gameRef.current;
    if (g && g.status === 'playing') solStats.record(g.mode, { outcome: 'lost', timeMs: clock.stop(), assists: assistsOf(g) });
    solSave.set(null);
    givenUp.current = true;
  };

  /** Next game of the same mode; the daily deal is the same again (another try). */
  const playAgain = () => {
    const g = gameRef.current;
    if (!g) return;
    if (g.status === 'playing') giveUp();
    solSave.set(createGame(g.mode));
    nav.replace(<SolitairePlay />);
  };

  if (!game) return <Screen title="Solitaire">{null}</Screen>;

  const title = MODE_LABEL[game.mode];
  const showPause = paused && game.status === 'playing';
  const finished = game.status !== 'playing';
  const assists = assistsOf(game);
  const status = hint?.text ?? (finished ? 'All suits complete' : canAutoFinish(game) ? 'Everything is face up · tap Finish' : !settings.dragTipSeen ? 'Tip: tap a card to move it, or drag it' : '');

  return (
    <Screen
      title={title}
      back={screenIndex > 1 ? 'Solitaire' : 'Games'}
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
          <span class="pc-moves">Moves {game.moves}</span>
          <span class="timer" aria-label="Time">
            {formatTime(result ? result.timeMs : clock.elapsed())}
          </span>
          <span class="hints" aria-label={assists ? `${game.hints} hints and ${game.undos} undos used` : undefined}>
            {assists ? `Assists ${assists}` : ''}
          </span>
        </div>

        {/* Takes all height left over by the controls; the cards are sized to fit it. */}
        <div class="pc-area">
          <Board game={game} hidden={showPause} fresh={fresh} shake={shake} hint={hint?.move ?? null} onTap={onTap} onDrop={onDrop} />
          {showPause && (
            <button class="pause-overlay" onClick={() => setPaused(false)}>
              <span class="pause-play">
                <IconPlay size={34} />
              </span>
              <span>Paused · tap to resume</span>
            </button>
          )}
        </div>

        {/* One line, always reserved so the layout doesn't jump: hints, tips and what to do next. */}
        <div class="pc-status" aria-live="polite">
          <span id="sol-board-hint" class="sr-only">
            Tap a card to move it to the best place it can go. Drag a card to choose where it goes. Tap the stock to draw.
          </span>
          {status}
        </div>

        <div class="tools pc-tools">
          <Tool label="Undo" onClick={() => dispatch({ type: 'undo' })} disabled={finished || finishing || !game.history.length}>
            <IconUndo />
          </Tool>
          <Tool label="Hint" onClick={() => dispatch({ type: 'hint' })} disabled={finished || finishing}>
            <IconBulb />
          </Tool>
          <Tool label="Finish" onClick={finish} disabled={finishing || !canAutoFinish(game)}>
            <IconBolt />
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
          { label: 'Keep Looking', onClick: () => setSheet(null) },
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
