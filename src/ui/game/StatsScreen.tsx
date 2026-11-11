import { useState } from 'preact/hooks';
import { Screen } from '../nav';
import { Section, Segmented } from '../components';
import { useOptionalStore, useStore } from '../../core/storage';
import { GameResult, GameStats, emptyModeStats } from '../../core/stats';
import { DailyRecord, bestDailyStreak, dailyStreak } from '../../core/daily';
import { formatTime } from '../../core/format';
import { IconFlame } from '../icons';

const NO_DAILY: DailyRecord = {};

/** Generic statistics screen for any game, driven by its GameStats. */
export function StatsScreen({ stats, backLabel, initialMode }: { stats: GameStats; backLabel: string; initialMode?: string }) {
  const data = useStore(stats.store);
  const daily = useOptionalStore(stats.daily) ?? NO_DAILY;
  const [mode, setMode] = useState(initialMode ?? stats.modes[0].id);
  const s = data[mode] ?? emptyModeStats();
  const avg = s.won ? s.winTimeTotalMs / s.won : null;
  const isDaily = mode === 'daily' && !!stats.daily;

  return (
    <Screen title="Statistics" back={backLabel}>
      <div class="stats-picker">
        <Segmented value={mode} onChange={setMode} options={stats.modes.map((m) => ({ value: m.id, label: m.label }))} />
      </div>

      {isDaily && (
        <div class="streak-banner">
          <IconFlame size={28} />
          <div>
            <div class="streak-value">{dailyStreak(daily)} day streak</div>
            <div class="streak-sub">Best: {bestDailyStreak(daily)} days</div>
          </div>
        </div>
      )}

      <div class="stat-grid">
        <StatTile label="Played" value={s.played} />
        <StatTile label="Won" value={s.won} />
        <StatTile label="Win rate" value={s.played ? `${Math.round((s.won / s.played) * 100)}%` : '–'} />
        <StatTile label="Best time" value={s.bestTimeMs != null ? formatTime(s.bestTimeMs) : '–'} />
        <StatTile label="Average time" value={avg != null ? formatTime(avg) : '–'} />
        <StatTile label={isDaily ? 'Win streak' : 'Current streak'} value={s.currentStreak} />
        <StatTile label="Best streak" value={s.bestStreak} />
        <StatTile label="Assisted wins" value={s.history.filter((h) => h.outcome === 'won' && h.assists > 0).length} />
      </div>

      <Section header="Recent solve times">
        <TimesChart history={s.history} />
      </Section>
    </Screen>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div class="stat-tile">
      <div class="stat-value">{value}</div>
      <div class="stat-label">{label}</div>
    </div>
  );
}

/**
 * Bar per recent win. Touch anywhere on the chart and slide to scrub (like the Health app):
 * the whole chart is the hit area, so tiny bars never need precise taps (HIG hit targets).
 * Single series → no legend. A visually hidden table gives VoiceOver the same data.
 */
function TimesChart({ history }: { history: GameResult[] }) {
  const wins = history.filter((h) => h.outcome === 'won').slice(-20);
  const [active, setActive] = useState<number | null>(null);
  if (!wins.length) return <p class="chart-empty">Solve a puzzle to see your times here.</p>;

  const W = 320;
  const H = 120;
  const max = Math.max(...wins.map((w) => w.timeMs));
  const slot = W / 20;
  const barW = Math.max(4, slot - 4);
  const shown = active != null ? wins[active] : wins[wins.length - 1];
  const date = (w: GameResult) => new Date(w.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const scrub = (e: PointerEvent) => {
    const svg = e.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const i = Math.floor(((e.clientX - rect.left) / rect.width) * 20);
    setActive(Math.max(0, Math.min(wins.length - 1, i)));
  };

  return (
    <div class="chart">
      <div class="chart-readout" aria-live="polite">
        <span class="chart-readout-value">{formatTime(shown.timeMs)}</span>
        <span class="chart-readout-label">
          {date(shown)}
          {shown.assists > 0 ? ' · assisted' : ''}
          {active == null ? ' · latest' : ''}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H + 2}`}
        class="chart-svg"
        aria-hidden="true"
        onPointerDown={(e) => {
          (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
          scrub(e);
        }}
        onPointerMove={(e) => e.buttons && scrub(e)}
      >
        <line x1="0" x2={W} y1={H + 1} y2={H + 1} class="chart-baseline" />
        {wins.map((w, i) => {
          const h = Math.max(4, (w.timeMs / max) * H);
          const x = i * slot + (slot - barW) / 2;
          const r = Math.min(4, barW / 2);
          // Rounded top, square base anchored to the baseline.
          const d = `M${x},${H} V${H - h + r} q0,-${r} ${r},-${r} h${barW - 2 * r} q${r},0 ${r},${r} V${H} Z`;
          return <path key={w.at} d={d} class={`chart-bar ${active === i ? 'active' : ''} ${w.assists ? 'assisted' : ''}`} />;
        })}
      </svg>
      <table class="sr-only">
        <caption>Recent solve times</caption>
        <tbody>
          {wins.map((w) => (
            <tr key={w.at}>
              <td>{date(w)}</td>
              <td>{formatTime(w.timeMs)}</td>
              <td>{w.assists ? 'assisted' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
