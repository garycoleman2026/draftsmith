import type { BingoTaskRule } from './bingo-rules';
import type { BingoVerificationSignal } from './bingo-verification-core';
import type { WiseOldManSnapshot } from './wise-old-man-core';

export type WomRosterSnapshot = { memberId: string; teamId: string; snapshot: WiseOldManSnapshot };
export type WomTaskRequirement = { id: string; rule: BingoTaskRule };
export type WomGeneratedSignal = { teamId: string; memberId: string | null; signal: BingoVerificationSignal };

export function buildWiseOldManSignals(input: {
  runId: string;
  tasks: WomTaskRequirement[];
  baseline: WomRosterSnapshot[];
  current: WomRosterSnapshot[];
}): WomGeneratedSignal[] {
  const baselineByMember = new Map(input.baseline.map((row) => [row.memberId, row]));
  const currentByTeam = new Map<string, WomRosterSnapshot[]>();
  for (const row of input.current) currentByTeam.set(row.teamId, [...(currentByTeam.get(row.teamId) ?? []), row]);
  const signals: WomGeneratedSignal[] = [];
  for (const task of input.tasks) {
    const rule = task.rule;
    if (!rule.proof.sources.includes('wise_old_man')) continue;
    if (!['xp_gain', 'level_reached', 'boss_kc'].includes(rule.verifier.type)) continue;
    if (rule.scope.type === 'exact_party' || rule.scope.type === 'all_members') continue;
    for (const [teamId, teamRows] of currentByTeam) {
      if (rule.scope.type === 'team_total') {
        const value = teamValue(rule, teamRows, baselineByMember);
        if (!value || value.value <= 0) continue;
        signals.push(generated(task, input.runId, teamId, null, value.metric, value.value, value.observedAt, value.baselineAt));
        continue;
      }
      for (const row of teamRows) {
        const baseline = baselineByMember.get(row.memberId);
        if (!baseline) continue;
        const value = memberValue(rule, row.snapshot, baseline.snapshot);
        if (!value || value.value <= 0) continue;
        signals.push(generated(task, input.runId, teamId, row.memberId, value.metric, value.value,
          row.snapshot.snapshotAt, baseline.snapshot.snapshotAt));
      }
    }
  }
  return signals;
}

function generated(
  task: WomTaskRequirement,
  runId: string,
  teamId: string,
  memberId: string | null,
  metric: string,
  value: number,
  observedAt: string,
  baselineAt: string,
): WomGeneratedSignal {
  const verifier = task.rule.verifier;
  return {
    teamId,
    memberId,
    signal: {
      idempotencyKey: `wom:${runId}:${task.id}:${memberId ?? teamId}:team`.slice(0, 120),
      source: 'wise_old_man',
      signalType: verifier.type,
      target: verifier.target,
      targetId: verifier.targetId,
      metric,
      value,
      unit: verifier.unit,
      measurement: 'absolute',
      participants: [],
      tags: [],
      observedAt,
      metadata: {
        eligibleTaskIds: [task.id],
        baselineAt,
        snapshotAt: observedAt,
        provider: 'wise_old_man',
      },
    },
  };
}

function teamValue(rule: BingoTaskRule, rows: WomRosterSnapshot[], baselineByMember: Map<string, WomRosterSnapshot>) {
  const memberValues = rows.flatMap((row) => {
    const baseline = baselineByMember.get(row.memberId);
    if (!baseline) return [];
    const value = memberValue(rule, row.snapshot, baseline.snapshot);
    return value ? [{ ...value, observedAt: row.snapshot.snapshotAt, baselineAt: baseline.snapshot.snapshotAt }] : [];
  });
  if (!memberValues.length) return null;
  const observedAt = memberValues.map((value) => value.observedAt).sort().at(-1)!;
  const baselineAt = memberValues.map((value) => value.baselineAt).sort()[0];
  if (rule.verifier.type === 'level_reached') {
    const best = memberValues.sort((left, right) => right.value - left.value)[0];
    return { metric: best.metric, value: best.value, observedAt, baselineAt };
  }
  return { metric: memberValues[0].metric, value: memberValues.reduce((sum, item) => sum + item.value, 0), observedAt, baselineAt };
}

function memberValue(rule: BingoTaskRule, current: WiseOldManSnapshot, baseline: WiseOldManSnapshot) {
  const metric = rule.verifier.metric || (rule.verifier.type === 'xp_gain' ? 'overall' : '');
  if (rule.verifier.type === 'xp_gain') {
    const pair = numberPair(current.skills[metric]?.experience, baseline.skills[metric]?.experience);
    return pair ? { metric, value: Math.max(0, pair[0] - pair[1]) } : null;
  }
  if (rule.verifier.type === 'boss_kc') {
    const pair = numberPair(current.bosses[metric], baseline.bosses[metric]);
    return pair ? { metric, value: Math.max(0, pair[0] - pair[1]) } : null;
  }
  const target = rule.verifier.amount ?? 1;
  if (metric) {
    const currentLevel = current.skills[metric]?.level;
    const baselineLevel = baseline.skills[metric]?.level;
    const pair = numberPair(currentLevel, baselineLevel);
    if (!pair || pair[1] >= target) return null;
    return { metric, value: pair[0] };
  }
  const eligible = Object.entries(current.skills).flatMap(([skill, stats]) => {
    if (skill === 'overall') return [];
    const baselineLevel = baseline.skills[skill]?.level;
    return Number.isFinite(baselineLevel) && baselineLevel < target ? [{ metric: skill, value: stats.level }] : [];
  });
  return eligible.sort((left, right) => right.value - left.value)[0] ?? null;
}

function numberPair(left: number | undefined, right: number | undefined): [number, number] | null {
  return Number.isFinite(left) && Number.isFinite(right) ? [left!, right!] : null;
}
