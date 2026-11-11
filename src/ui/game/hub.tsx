import type { ComponentChildren } from 'preact';
import { useNav } from '../nav';
import { Row, Section, Sheet, SheetAction } from '../components';
import { useStore } from '../../core/storage';
import { dailyStreak, todayKey } from '../../core/daily';
import { formatDate, formatTime } from '../../core/format';
import type { GameStats } from '../../core/stats';
import { IconCalendar, IconChart, IconCheck, IconFlame, IconPlay } from '../icons';
import { StatsScreen } from './StatsScreen';
import './game.css';

/**
 * Building blocks for a game's hub screen. A typical hub is:
 *   <ContinueRow/> <DailyCard/> <ModeList/> <StatsRow/>
 * See src/games/sudoku/ui/SudokuHub.tsx.
 */

export function ContinueRow(props: { subtitle: string; onClick: () => void }) {
  return (
    <Section>
      <Row icon={<IconPlay size={16} />} iconBg="var(--accent)" title="Continue" subtitle={props.subtitle} chevron onClick={props.onClick} />
    </Section>
  );
}

/** Today's challenge, with streak and completion state from `stats.daily`. */
export function DailyCard(props: { stats: GameStats; badge: string; inProgress: boolean; onPlay: () => void }) {
  const daily = useStore(props.stats.daily!);
  const today = todayKey();
  const done = daily[today];
  const streak = dailyStreak(daily);
  return (
    <button
      class={`daily-card ${done ? 'done' : ''}`}
      onClick={() => !done && props.onPlay()}
      aria-disabled={!!done}
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
        <span class="pill">{props.badge}</span>
        {done ? (
          <span class="daily-status">
            <IconCheck size={18} /> Solved in {formatTime(done.timeMs)}
          </span>
        ) : (
          <span class="daily-status">{props.inProgress ? 'Continue' : 'Play'} ›</span>
        )}
      </div>
    </button>
  );
}

/** "New Game" list: one row per mode, with the best time on the right. */
export function ModeList(props: {
  stats: GameStats;
  modes: { id: string; label: string; color: string }[];
  header?: string;
  onSelect: (modeId: string) => void;
}) {
  useStore(props.stats.store);
  return (
    <Section header={props.header ?? 'New Game'}>
      {props.modes.map((m) => {
        const best = props.stats.get(m.id).bestTimeMs;
        return (
          <Row
            key={m.id}
            icon={<span class="diff-dot" />}
            iconBg={m.color}
            title={m.label}
            detail={best != null ? `Best ${formatTime(best)}` : undefined}
            chevron
            onClick={() => props.onSelect(m.id)}
          />
        );
      })}
    </Section>
  );
}

export function StatsRow(props: { stats: GameStats; gameName: string }) {
  const nav = useNav();
  return (
    <Section>
      <Row
        icon={<IconChart size={16} />}
        iconBg="#8e8e93"
        title="Statistics"
        chevron
        onClick={() => nav.push(<StatsScreen stats={props.stats} backLabel={props.gameName} />)}
      />
    </Section>
  );
}

export function ConfirmNewGameSheet(props: { open: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Sheet
      open={props.open}
      onClose={props.onCancel}
      title="Start a new game?"
      message="Your current game will be lost and counted as not finished."
      actions={[{ label: 'Start New Game', style: 'destructive', onClick: props.onConfirm }]}
    />
  );
}

export function LoadingOverlay(props: { show: boolean; label?: string }) {
  if (!props.show) return null;
  return (
    <div class="loading-overlay">
      <div class="spinner" />
      <span>{props.label ?? 'Preparing…'}</span>
    </div>
  );
}

/** End-of-game sheet with the big time readout. */
export function ResultSheet(props: {
  open: boolean;
  title: ComponentChildren;
  timeMs?: number;
  meta?: ComponentChildren;
  message?: ComponentChildren;
  actions: SheetAction[];
}) {
  return (
    <Sheet
      open={props.open}
      title={props.title}
      message={
        props.timeMs != null ? (
          <div class="result">
            <div class="result-time">{formatTime(props.timeMs)}</div>
            {props.meta && <div class="result-meta">{props.meta}</div>}
          </div>
        ) : (
          props.message
        )
      }
      actions={props.actions}
      cancel={false}
    />
  );
}
