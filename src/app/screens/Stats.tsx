import { useState } from 'preact/hooks';
import { Screen } from '../nav';
import { Section, Segmented } from '../../ui/components';
import { useStore } from '../../core/store';
import { GameResult, getModeStats, statsStore } from '../../core/stats';
import { bestDailyStreak, dailyStore, dailyStreak } from '../../core/daily';
import { formatTime } from '../../core/format';
import type { GameDef } from '../../games/registry';
import { IconFlame } from '../../ui/icons';

export function Stats({ game, initialMode }: { game: GameDef; initialMode?: string }) {
  const data = useStore(statsStore);
  const daily = useStore(dailyStore);
  const [mode, setMode] = useState(initialMode ?? game.modes[0].id);
  const s = getModeStats(data, game.id, mode);
  const avg = s.won ? s.winTimeTotalMs / s.won : null;
  const isDaily = mode === 'daily';

  return (
    <Screen title="Statistics" back={game.name}>
      <div class="stats-picker">
        <Segmented value={mode} onChange={setMode} options={game.modes.map((m) => ({ value: m.id, label: m.label }))} />
      </div>

      {isDaily && (
        <div class="streak-banner">
          <IconFlame size={28} />
          <div>
            <div class="streak-value">{dailyStreak(daily[game.id])} day streak</div>
            <div class="streak-sub">Best: {bestDailyStreak(daily[game.id])} days</div>
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

/** Bar per recent win; tap a bar for its exact time. Single series → no legend. */
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

  return (
    <div class="chart">
      <div class="chart-readout">
        <span class="chart-readout-value">{formatTime(shown.timeMs)}</span>
        <span class="chart-readout-label">
          {new Date(shown.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {shown.assists > 0 ? ' · assisted' : ''}
          {active == null ? ' · latest' : ''}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 2}`} class="chart-svg" role="img" aria-label="Recent solve times">
        <line x1="0" x2={W} y1={H + 1} y2={H + 1} class="chart-baseline" />
        {wins.map((w, i) => {
          const h = Math.max(4, (w.timeMs / max) * H);
          const x = i * slot + (slot - barW) / 2;
          const r = Math.min(4, barW / 2);
          // Rounded top, square base anchored to the baseline.
          const d = `M${x},${H} V${H - h + r} q0,-${r} ${r},-${r} h${barW - 2 * r} q${r},0 ${r},${r} V${H} Z`;
          return (
            <g key={w.at} onClick={() => setActive(active === i ? null : i)}>
              <rect x={i * slot} y="0" width={slot} height={H} fill="transparent" />
              <path d={d} class={`chart-bar ${active === i ? 'active' : ''} ${w.assists ? 'assisted' : ''}`}>
                <title>{formatTime(w.timeMs)}</title>
              </path>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
