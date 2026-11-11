import { useState } from 'preact/hooks';
import { Screen, useNav } from '../../../app/nav';
import { Row, Section, Sheet } from '../../../ui/components';
import { useStore } from '../../../core/store';
import { getModeStats, statsStore } from '../../../core/stats';
import { dailyStore, dailyStreak, todayKey } from '../../../core/daily';
import { formatDate, formatTime } from '../../../core/format';
import { haptic } from '../../../core/haptics';
import { IconCalendar, IconChart, IconCheck, IconFlame, IconPlay } from '../../../ui/icons';
import { DIFFICULTIES } from '../engine/generator';
import { GAME_ID, savedGame } from '../saved';
import { progress } from '../state';
import { dailyDifficulty } from '../puzzles';
import { StartKind, hasGameToAbandon, startGame } from '../start';
import { DIFFICULTY_LABEL } from './labels';
import { SudokuPlay } from './SudokuPlay';
import { Stats } from '../../../app/screens/Stats';
import { GAMES } from '../../registry';

const DIFF_COLORS = { easy: '#34c759', medium: '#ff9f0a', hard: '#ff453a', expert: '#bf5af2' };

export function SudokuHome() {
  const nav = useNav();
  const saved = useStore(savedGame);
  const stats = useStore(statsStore);
  const daily = useStore(dailyStore);
  const [confirm, setConfirm] = useState<StartKind | null>(null);
  const [loading, setLoading] = useState(false);

  const today = todayKey();
  const todayDone = daily[GAME_ID]?.[today];
  const streak = dailyStreak(daily[GAME_ID]);
  const inProgress = saved && saved.status === 'playing' ? saved : null;
  const dailyInProgress = inProgress?.mode === 'daily' && inProgress.date === today;

  const launch = async (kind: StartKind) => {
    setConfirm(null);
    setLoading(true);
    try {
      await startGame(kind);
      nav.push(<SudokuPlay />);
    } finally {
      setLoading(false);
    }
  };

  const request = (kind: StartKind) => {
    if (kind === 'daily' && dailyInProgress) return nav.push(<SudokuPlay />);
    if (hasGameToAbandon()) setConfirm(kind);
    else void launch(kind);
  };

  return (
    <Screen title="Sudoku" back="Games">
      {inProgress && (
        <Section>
          <Row
            icon={<IconPlay size={16} />}
            iconBg="var(--accent)"
            title="Continue"
            subtitle={`${inProgress.mode === 'daily' ? 'Daily · ' : ''}${DIFFICULTY_LABEL[inProgress.difficulty]} · ${formatTime(inProgress.elapsedMs)} · ${Math.round(progress(inProgress) * 100)}%`}
            chevron
            onClick={() => nav.push(<SudokuPlay />)}
          />
        </Section>
      )}

      <button
        class={`daily-card ${todayDone ? 'done' : ''}`}
        onClick={() => {
          if (todayDone) return;
          haptic('selection');
          request('daily');
        }}
      >
        <div class="daily-top">
          <IconCalendar size={22} />
          <span class="daily-kicker">Daily Challenge</span>
          {streak > 0 && (
            <span class="daily-streak">
              <IconFlame size={16} /> {streak}
            </span>
          )}
        </div>
        <div class="daily-date">{formatDate(today)}</div>
        <div class="daily-bottom">
          <span class="pill">{DIFFICULTY_LABEL[dailyDifficulty(today)]}</span>
          {todayDone ? (
            <span class="daily-status">
              <IconCheck size={18} /> Solved in {formatTime(todayDone.timeMs)}
            </span>
          ) : (
            <span class="daily-status">{dailyInProgress ? 'Continue' : 'Play'} ›</span>
          )}
        </div>
      </button>

      <Section header="New Game">
        {DIFFICULTIES.map((d) => {
          const best = getModeStats(stats, GAME_ID, d).bestTimeMs;
          return (
            <Row
              key={d}
              icon={<span class="diff-dot" />}
              iconBg={DIFF_COLORS[d]}
              title={DIFFICULTY_LABEL[d]}
              detail={best != null ? `Best ${formatTime(best)}` : undefined}
              chevron
              onClick={() => request(d)}
            />
          );
        })}
      </Section>

      <Section>
        <Row
          icon={<IconChart size={16} />}
          iconBg="#8e8e93"
          title="Statistics"
          chevron
          onClick={() => nav.push(<Stats game={GAMES.find((g) => g.id === GAME_ID)!} />)}
        />
      </Section>

      <Sheet
        open={confirm != null}
        onClose={() => setConfirm(null)}
        title="Start a new game?"
        message="Your current game will be lost and counted as not finished."
        actions={[{ label: 'Start New Game', style: 'destructive', onClick: () => confirm && void launch(confirm) }]}
      />
      {loading && (
        <div class="loading-overlay">
          <div class="spinner" />
          <span>Preparing puzzle…</span>
        </div>
      )}
    </Screen>
  );
}
