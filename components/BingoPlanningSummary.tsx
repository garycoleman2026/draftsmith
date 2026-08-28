import { summarizeBingoPlanning } from '../lib/bingo-planning';
import { formatExpectedHours } from '../lib/bingo-rules';
import type { BingoTaskDefinition } from '../lib/bingo-types';

const FIT_LABELS = {
  no_deadline: ['Open-ended event', 'Add an end date when you want a capacity check.'],
  missing_dates: ['Dates need attention', 'Set a valid start and end time to compare capacity.'],
  roomy: ['Roomy plan', 'The estimated full-board workload uses at most half of available team-hours.'],
  balanced: ['Balanced plan', 'The estimated workload uses most of the event window with some margin.'],
  tight: ['Tight plan', 'Expected workload is close to total capacity; RNG or downtime may decide it.'],
  over_capacity: ['Over capacity', 'The expected full-board workload exceeds the available team-hours.'],
} as const;

export function BingoPlanningSummary({
  tasks,
  teamSize,
  startAt,
  endAt,
  compact = false,
}: {
  tasks: BingoTaskDefinition[];
  teamSize: number;
  startAt?: string | null;
  endAt?: string | null;
  compact?: boolean;
}) {
  const summary = summarizeBingoPlanning(tasks, teamSize, startAt, endAt);
  const [fitTitle, fitCopy] = FIT_LABELS[summary.fit];
  const tone = summary.fit === 'over_capacity' ? 'border-[#a75e44]/55 bg-[#efd1bd] text-[#6c2c20]'
    : summary.fit === 'tight' ? 'border-[#a87527]/55 bg-[#f1dda5] text-[#5a3b14]'
      : 'border-[#62835d]/45 bg-[#dbe6c7] text-[#294827]';
  return (
    <section className={`rounded border ${tone} ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-[10px] font-black uppercase tracking-[0.09em]">Workload planner</p><p className="mt-1 text-sm font-black">{fitTitle}</p></div>
        <span className="rounded bg-black/10 px-2 py-1 text-[10px] font-black">{summary.estimatedTaskCount}/{summary.totalTaskCount} tasks estimated</span>
      </div>
      <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-2' : 'sm:grid-cols-3'}`}>
        <Metric label="Full-board work" value={`${formatExpectedHours(summary.personHours)} player-time`} />
        <Metric label={`${summary.teamSize}-player team`} value={`${formatExpectedHours(summary.parallelTeamHours)} elapsed in parallel`} />
        <Metric
          label="Event capacity"
          value={summary.teamCapacityHours === null ? 'No dated limit' : `${formatExpectedHours(summary.teamCapacityHours)} player-time`}
        />
      </div>
      {!compact ? <p className="mt-3 text-[10px] leading-relaxed">{fitCopy} Estimates use individual drop rates and efficient rates entered on each task; they are planning averages, not RNG guarantees.</p> : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-current/15 bg-white/25 p-2"><span className="block text-[9px] font-black uppercase tracking-[0.06em] opacity-80">{label}</span><strong className="mt-1 block text-xs">{value}</strong></div>;
}
