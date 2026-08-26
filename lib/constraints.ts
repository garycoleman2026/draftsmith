import { getTargetTeamSizes } from './draft';

export type RosterRule = {
  type: 'together' | 'apart';
  enforcement?: 'hard' | 'soft';
  playerAId: string;
  playerBId: string;
};

export function validateRosterRules(input: {
  playerIds: string[];
  teamCount: number;
  captains: { playerId: string; teamIndex: number }[];
  rules: RosterRule[];
}) {
  const parent = new Map(input.playerIds.map((id) => [id, id] as const));
  const find = (id: string): string => {
    const next = parent.get(id) ?? id;
    if (next === id) return id;
    const root = find(next);
    parent.set(id, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const aRoot = find(a);
    const bRoot = find(b);
    if (aRoot !== bRoot) parent.set(bRoot, aRoot);
  };

  const hardRules = input.rules.filter((rule) => (rule.enforcement ?? 'hard') === 'hard');
  for (const rule of hardRules) {
    if (rule.type === 'together') union(rule.playerAId, rule.playerBId);
  }
  for (const rule of hardRules) {
    if (rule.type === 'apart' && find(rule.playerAId) === find(rule.playerBId)) {
      return 'That rule conflicts with an existing together group.';
    }
  }

  const membersByRoot = new Map<string, string[]>();
  for (const playerId of input.playerIds) {
    const root = find(playerId);
    const members = membersByRoot.get(root) ?? [];
    members.push(playerId);
    membersByRoot.set(root, members);
  }
  const captainByPlayer = new Map(input.captains.map((captain) => [captain.playerId, captain] as const));
  const targetSizes = getTargetTeamSizes(input.playerIds.length, input.teamCount);
  const maximumTeamSize = Math.max(0, ...targetSizes);
  for (const members of membersByRoot.values()) {
    const groupCaptains = members.flatMap((playerId) => {
      const captain = captainByPlayer.get(playerId);
      return captain ? [captain] : [];
    });
    if (groupCaptains.length > 1) {
      return 'A together group cannot contain more than one captain.';
    }
    const capacity = groupCaptains.length
      ? targetSizes[groupCaptains[0].teamIndex] ?? maximumTeamSize
      : maximumTeamSize;
    if (members.length > capacity) {
      return `That together group has ${members.length} players but the largest available team has ${capacity} spots.`;
    }
  }
  return null;
}
