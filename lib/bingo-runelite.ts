import { recordAudit } from './audit';
import { BingoError, bingoActivityInsert, loadBingoView, parseJson } from './bingo';
import {
  DEFAULT_RUNELITE_SCOPES, RUNELITE_DISCLOSURE_VERSION, canonicalRunelitePairingCode,
  makeRunelitePairingCode, parseRuneliteDeviceCredential, runeliteDeviceCredential, runelitePrivacy,
  sanitizeRuneliteObservation, sanitizeRuneliteScopes, type RuneliteScope,
} from './bingo-runelite-core';
import { ingestVerificationSignal } from './bingo-verification';
import { getDatabase } from './db';
import { hashToken, randomToken } from './security';
import { normalizeRsn } from './validation';

const PAIRING_LIFETIME_MS = 10 * 60_000;
const DEVICE_LIFETIME_MS = 180 * 24 * 60 * 60_000;
const MAX_ACTIVE_DEVICES_PER_MEMBER = 3;

type IntegrationRow = {
  event_id: string; enabled: number; scopes_json: string; disclosure_version: number;
  created_at: string; updated_at: string;
};
type DeviceRow = {
  id: string; event_id: string; team_id: string; member_id: string; pairing_id: string;
  device_name: string; plugin_version: string; scopes_json: string; disclosure_version: number;
  last_rsn: string; last_seen_at: string; expires_at: string; revoked_at: string | null;
  revoked_by: string | null; created_at: string; display_name?: string;
};
type DeviceContextRow = DeviceRow & {
  draft_id: string; event_title: string; event_status: string; public_slug: string; revision: number;
  team_name: string; team_color: string; display_name: string; normalized_name: string;
  integration_enabled: number; integration_scopes_json: string;
};
type PairingRow = {
  id: string; event_id: string; team_id: string; member_id: string; expires_at: string;
  consumed_at: string | null; revoked_at: string | null; display_name: string; normalized_name: string;
  event_title: string; event_status: string; draft_id: string; team_name: string;
  enabled: number; scopes_json: string; disclosure_version: number;
};

export type RuneliteDeviceContext = {
  id: string;
  eventId: string;
  teamId: string;
  memberId: string;
  memberName: string;
  normalizedName: string;
  eventTitle: string;
  eventStatus: string;
  publicSlug: string;
  revision: number;
  teamName: string;
  teamColor: string;
  pluginVersion: string;
  scopes: RuneliteScope[];
  draftId: string;
};

export async function configureRunelite(input: { eventId: string; enabled: boolean; scopes: unknown }) {
  const db = getDatabase();
  const event = await db.prepare('SELECT id FROM bingo_events WHERE id = ?').bind(input.eventId).first();
  if (!event) throw new BingoError('That bingo event does not exist.', 404);
  const scopes = sanitizeRuneliteScopes(input.scopes, DEFAULT_RUNELITE_SCOPES);
  if (input.enabled && !scopes.length) throw new BingoError('Enable at least one RuneLite data scope.');
  const now = new Date().toISOString();
  const statements = [
    db.prepare(
      `INSERT INTO bingo_runelite_integrations
        (event_id, enabled, scopes_json, disclosure_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(event_id) DO UPDATE SET enabled = excluded.enabled, scopes_json = excluded.scopes_json,
         disclosure_version = excluded.disclosure_version, updated_at = excluded.updated_at`,
    ).bind(input.eventId, input.enabled, JSON.stringify(scopes), RUNELITE_DISCLOSURE_VERSION, now, now),
    db.prepare('UPDATE bingo_events SET revision = revision + 1, updated_at = ? WHERE id = ?').bind(now, input.eventId),
  ];
  if (!input.enabled) {
    statements.push(db.prepare(
      `UPDATE bingo_runelite_devices SET revoked_at = COALESCE(revoked_at, ?), revoked_by = COALESCE(revoked_by, 'organizer_disabled')
       WHERE event_id = ? AND revoked_at IS NULL`,
    ).bind(now, input.eventId));
    statements.push(db.prepare(
      `UPDATE bingo_runelite_pairings SET revoked_at = COALESCE(revoked_at, ?)
       WHERE event_id = ? AND consumed_at IS NULL AND revoked_at IS NULL`,
    ).bind(now, input.eventId));
  }
  await db.batch(statements);
  return getRuneliteStatus(input.eventId);
}

export async function getRuneliteStatus(eventId: string, teamId?: string | null) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const [integration, devices] = await Promise.all([
    loadIntegration(eventId),
    db.prepare(
      `SELECT brd.id, brd.event_id, brd.team_id, brd.member_id, brd.pairing_id, brd.device_name,
              brd.plugin_version, brd.scopes_json, brd.disclosure_version, brd.last_rsn, brd.last_seen_at,
              brd.expires_at, brd.revoked_at, brd.revoked_by, brd.created_at, btm.display_name
       FROM bingo_runelite_devices brd
       JOIN bingo_team_members btm ON btm.id = brd.member_id
       WHERE brd.event_id = ? AND brd.revoked_at IS NULL AND brd.expires_at > ?${teamId ? ' AND brd.team_id = ?' : ''}
       ORDER BY btm.display_name, brd.created_at DESC`,
    ).bind(...(teamId ? [eventId, now, teamId] : [eventId, now])).all<DeviceRow>(),
  ]);
  const privacy = runelitePrivacy(Boolean(integration?.enabled), parseJson(integration?.scopes_json, DEFAULT_RUNELITE_SCOPES));
  return {
    ...privacy,
    activeDeviceCount: devices.results.length,
    devices: devices.results.map(deviceView),
  };
}

export async function issueRunelitePairing(input: {
  eventId: string; teamId: string; memberId: string; issuedBy: 'team' | 'organizer';
}) {
  const db = getDatabase();
  const now = new Date();
  const [integration, member, active] = await Promise.all([
    loadIntegration(input.eventId),
    db.prepare(
      `SELECT btm.id, btm.display_name, be.status
       FROM bingo_team_members btm JOIN bingo_teams bt ON bt.id = btm.team_id
       JOIN bingo_events be ON be.id = bt.event_id
       WHERE btm.id = ? AND btm.team_id = ? AND bt.event_id = ?`,
    ).bind(input.memberId, input.teamId, input.eventId).first<{ id: string; display_name: string; status: string }>(),
    db.prepare(
      `SELECT COUNT(*) AS count FROM bingo_runelite_devices
       WHERE event_id = ? AND member_id = ? AND revoked_at IS NULL AND expires_at > ?`,
    ).bind(input.eventId, input.memberId, now.toISOString()).first<{ count: number }>(),
  ]);
  if (!integration?.enabled) throw new BingoError('The organizer has not enabled RuneLite pairing for this event.', 409);
  if (!member) throw new BingoError('That player is not on this event team.', 404);
  if (!['draft', 'scheduled', 'live'].includes(member.status)) throw new BingoError('Pairing is closed for this event.', 409);
  if ((active?.count ?? 0) >= MAX_ACTIVE_DEVICES_PER_MEMBER) {
    throw new BingoError('This player already has three active devices. Revoke one before pairing another.', 409);
  }
  const code = makeRunelitePairingCode();
  const canonical = canonicalRunelitePairingCode(code);
  const id = crypto.randomUUID();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + PAIRING_LIFETIME_MS).toISOString();
  await db.batch([
    db.prepare(
      `UPDATE bingo_runelite_pairings SET revoked_at = ?
       WHERE event_id = ? AND member_id = ? AND consumed_at IS NULL AND revoked_at IS NULL`,
    ).bind(createdAt, input.eventId, input.memberId),
    db.prepare(
      `INSERT INTO bingo_runelite_pairings
        (id, event_id, team_id, member_id, code_hash, issued_by, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, input.eventId, input.teamId, input.memberId, await hashToken(canonical), input.issuedBy, expiresAt, createdAt),
  ]);
  return { pairingId: id, code, memberId: member.id, memberName: member.display_name, expiresAt };
}

export async function redeemRunelitePairing(input: {
  code: unknown; rsn: unknown; deviceName: unknown; pluginVersion: unknown; scopes: unknown;
  consent: unknown; disclosureVersion: unknown;
}) {
  if (input.consent !== true || Number(input.disclosureVersion) !== RUNELITE_DISCLOSURE_VERSION) {
    throw new BingoError('Accept the current RuneLite data disclosure before pairing.');
  }
  const canonical = canonicalRunelitePairingCode(input.code);
  if (canonical.length !== 12) throw new BingoError('That pairing code is invalid or expired.', 404);
  const db = getDatabase();
  const now = new Date();
  const pairing = await db.prepare(
    `SELECT brp.id, brp.event_id, brp.team_id, brp.member_id, brp.expires_at, brp.consumed_at, brp.revoked_at,
            btm.display_name, btm.normalized_name, be.title AS event_title, be.status AS event_status,
            be.draft_id, bt.name AS team_name, bri.enabled, bri.scopes_json, bri.disclosure_version
     FROM bingo_runelite_pairings brp
     JOIN bingo_team_members btm ON btm.id = brp.member_id
     JOIN bingo_teams bt ON bt.id = brp.team_id
     JOIN bingo_events be ON be.id = brp.event_id
     JOIN bingo_runelite_integrations bri ON bri.event_id = brp.event_id
     WHERE brp.code_hash = ?`,
  ).bind(await hashToken(canonical)).first<PairingRow>();
  if (!pairing || pairing.consumed_at || pairing.revoked_at || Date.parse(pairing.expires_at) <= now.getTime()) {
    throw new BingoError('That pairing code is invalid or expired.', 404);
  }
  if (!pairing.enabled || !['draft', 'scheduled', 'live'].includes(pairing.event_status)) {
    throw new BingoError('RuneLite pairing is closed for this event.', 409);
  }
  const rsn = textValue(input.rsn, 12);
  if (!rsn || normalizeRsn(rsn) !== normalizeRsn(pairing.normalized_name)) {
    throw new BingoError(`Log in as ${pairing.display_name} before redeeming this code.`, 403);
  }
  const allowedScopes = sanitizeRuneliteScopes(parseJson(pairing.scopes_json, DEFAULT_RUNELITE_SCOPES));
  const requestedScopes = sanitizeRuneliteScopes(input.scopes, allowedScopes).filter((scope) => allowedScopes.includes(scope));
  if (!requestedScopes.length) throw new BingoError('Select at least one organizer-approved data scope.');
  const active = await db.prepare(
    `SELECT COUNT(*) AS count FROM bingo_runelite_devices
     WHERE event_id = ? AND member_id = ? AND revoked_at IS NULL AND expires_at > ?`,
  ).bind(pairing.event_id, pairing.member_id, now.toISOString()).first<{ count: number }>();
  if ((active?.count ?? 0) >= MAX_ACTIVE_DEVICES_PER_MEMBER) {
    throw new BingoError('This player already has three active devices. Revoke one before pairing another.', 409);
  }
  const deviceName = textValue(input.deviceName, 60) || 'RuneLite client';
  const pluginVersion = textValue(input.pluginVersion, 30) || 'unknown';
  const deviceId = crypto.randomUUID();
  const secret = randomToken(32);
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + DEVICE_LIFETIME_MS).toISOString();
  try {
    await db.batch([
      db.prepare(
        `UPDATE bingo_runelite_pairings SET consumed_at = ?
         WHERE id = ? AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > ?`,
      ).bind(createdAt, pairing.id, createdAt),
      db.prepare(
        `INSERT INTO bingo_runelite_devices
          (id, event_id, team_id, member_id, pairing_id, token_hash, device_name, plugin_version,
           scopes_json, disclosure_version, last_rsn, last_seen_at, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(deviceId, pairing.event_id, pairing.team_id, pairing.member_id, pairing.id, await hashToken(secret),
        deviceName, pluginVersion, JSON.stringify(requestedScopes), RUNELITE_DISCLOSURE_VERSION,
        pairing.display_name, createdAt, expiresAt, createdAt),
      bingoActivityInsert({
        eventId: pairing.event_id, teamId: pairing.team_id, type: 'runelite.paired',
        message: `${pairing.display_name} paired RuneLite for event tracking.`, now: createdAt,
      }),
    ]);
  } catch (error) {
    if (/UNIQUE|constraint/i.test(error instanceof Error ? error.message : String(error))) {
      throw new BingoError('That pairing code has already been redeemed.', 409);
    }
    throw error;
  }
  await recordAudit(db, {
    draftId: pairing.draft_id, actorType: 'participant', actorReference: deviceId,
    eventType: 'bingo.runelite_paired', metadata: { eventId: pairing.event_id, teamId: pairing.team_id, memberId: pairing.member_id },
    createdAt,
  }).catch(() => undefined);
  return {
    schemaVersion: 1,
    credential: runeliteDeviceCredential(deviceId, secret),
    expiresAt,
    event: { id: pairing.event_id, title: pairing.event_title },
    team: { id: pairing.team_id, name: pairing.team_name },
    member: { id: pairing.member_id, name: pairing.display_name },
    privacy: runelitePrivacy(true, requestedScopes),
    endpoints: { events: '/api/runelite/events', overlay: '/api/runelite/overlay', device: '/api/runelite/device' },
  };
}

export async function requireRuneliteDevice(request: Request, options: { requireRsn?: boolean } = {}): Promise<RuneliteDeviceContext> {
  const header = request.headers.get('authorization');
  const raw = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const credential = parseRuneliteDeviceCredential(raw);
  if (!credential) throw new BingoError('Provide a valid RuneLite device credential.', 401);
  const db = getDatabase();
  const now = new Date();
  const row = await db.prepare(
    `SELECT brd.id, brd.event_id, brd.team_id, brd.member_id, brd.pairing_id, brd.device_name,
            brd.plugin_version, brd.scopes_json, brd.disclosure_version, brd.last_rsn, brd.last_seen_at,
            brd.expires_at, brd.revoked_at, brd.revoked_by, brd.created_at,
            be.draft_id, be.title AS event_title, be.status AS event_status, be.public_slug, be.revision,
            bt.name AS team_name, bt.color AS team_color, btm.display_name, btm.normalized_name,
            bri.enabled AS integration_enabled, bri.scopes_json AS integration_scopes_json
     FROM bingo_runelite_devices brd
     JOIN bingo_events be ON be.id = brd.event_id
     JOIN bingo_teams bt ON bt.id = brd.team_id
     JOIN bingo_team_members btm ON btm.id = brd.member_id
     JOIN bingo_runelite_integrations bri ON bri.event_id = brd.event_id
     WHERE brd.id = ? AND brd.token_hash = ? AND brd.revoked_at IS NULL AND brd.expires_at > ?`,
  ).bind(credential.deviceId, await hashToken(credential.secret), now.toISOString()).first<DeviceContextRow>();
  if (!row || !row.integration_enabled) throw new BingoError('This RuneLite device is disconnected or expired.', 401);
  if (options.requireRsn) {
    const currentRsn = textValue(request.headers.get('x-runelite-rsn'), 12);
    if (!currentRsn || normalizeRsn(currentRsn) !== normalizeRsn(row.normalized_name)) {
      throw new BingoError(`This device is paired to ${row.display_name}. Log into that account before sending event data.`, 403);
    }
  }
  const deviceScopes = sanitizeRuneliteScopes(parseJson(row.scopes_json, []), []);
  const eventScopes = sanitizeRuneliteScopes(parseJson(row.integration_scopes_json, []), []);
  const scopes = deviceScopes.filter((scope) => eventScopes.includes(scope));
  if (!scopes.length) throw new BingoError('This device has no enabled data scopes.', 403);
  if (Date.parse(row.last_seen_at) < now.getTime() - 5 * 60_000) {
    await db.prepare('UPDATE bingo_runelite_devices SET last_seen_at = ? WHERE id = ?').bind(now.toISOString(), row.id).run();
  }
  return {
    id: row.id, eventId: row.event_id, teamId: row.team_id, memberId: row.member_id,
    memberName: row.display_name, normalizedName: row.normalized_name, eventTitle: row.event_title,
    eventStatus: row.event_status, publicSlug: row.public_slug, revision: row.revision,
    teamName: row.team_name, teamColor: row.team_color, pluginVersion: row.plugin_version,
    scopes, draftId: row.draft_id,
  };
}

export async function ingestRuneliteBatch(device: RuneliteDeviceContext, value: unknown) {
  if (device.eventStatus !== 'live') throw new BingoError('RuneLite observations are accepted only while the bingo is live.', 409);
  const body = objectValue(value);
  const batchKey = strictIdentifier(body.batchKey, 8, 64, 'RuneLite batches need a stable batch key.');
  if (!Array.isArray(body.observations) || !body.observations.length || body.observations.length > 25) {
    throw new BingoError('Send between 1 and 25 observations per batch.');
  }
  const db = getDatabase();
  const existing = await db.prepare(
    `SELECT event_count, accepted_count, duplicate_count, rejected_count, created_at
     FROM bingo_runelite_batches WHERE device_id = ? AND batch_key = ?`,
  ).bind(device.id, batchKey).first<{
    event_count: number; accepted_count: number; duplicate_count: number; rejected_count: number; created_at: string;
  }>();
  if (existing) return { batchKey, replayed: true, ...batchSummary(existing), results: [] };
  let acceptedCount = 0;
  let duplicateCount = 0;
  const results: Array<Record<string, unknown>> = [];
  for (const observation of body.observations) {
    let clientEventId = '';
    try {
      const normalized = sanitizeRuneliteObservation(observation, {
        deviceId: device.id, pluginVersion: device.pluginVersion, memberRsn: device.memberName, allowedScopes: device.scopes,
      });
      clientEventId = normalized.clientEventId;
      const ingested = await ingestVerificationSignal({
        eventId: device.eventId, teamId: device.teamId, memberId: device.memberId, signal: normalized.signal,
      });
      if (ingested.duplicate) duplicateCount += 1;
      else acceptedCount += 1;
      results.push({
        clientEventId, status: ingested.duplicate ? 'duplicate' : 'accepted',
        candidates: ingested.candidates.map((candidate) => ({
          taskId: candidate.taskId, status: candidate.status, progressValue: candidate.progressValue,
          targetValue: candidate.targetValue, confidence: candidate.confidence,
        })),
      });
    } catch (error) {
      results.push({
        clientEventId: clientEventId || observationIdentifier(observation), status: 'rejected',
        error: error instanceof Error && (error instanceof BingoError ? error.status < 500 : true)
          ? error.message : 'The observation could not be processed.',
      });
    }
  }
  const rejectedCount = results.length - acceptedCount - duplicateCount;
  const createdAt = new Date().toISOString();
  try {
    await db.batch([
      db.prepare(
        `INSERT INTO bingo_runelite_batches
          (id, device_id, batch_key, event_count, accepted_count, duplicate_count, rejected_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(crypto.randomUUID(), device.id, batchKey, body.observations.length,
        acceptedCount, duplicateCount, rejectedCount, createdAt),
      db.prepare('UPDATE bingo_runelite_devices SET last_seen_at = ? WHERE id = ?').bind(createdAt, device.id),
    ]);
  } catch (error) {
    if (/UNIQUE|constraint/i.test(error instanceof Error ? error.message : String(error))) {
      const replay = await db.prepare(
        `SELECT event_count, accepted_count, duplicate_count, rejected_count, created_at
         FROM bingo_runelite_batches WHERE device_id = ? AND batch_key = ?`,
      ).bind(device.id, batchKey).first<{
        event_count: number; accepted_count: number; duplicate_count: number; rejected_count: number; created_at: string;
      }>();
      if (replay) return { batchKey, replayed: true, ...batchSummary(replay), results: [] };
    }
    throw error;
  }
  return {
    batchKey, replayed: false, eventCount: body.observations.length,
    acceptedCount, duplicateCount, rejectedCount, createdAt, results,
  };
}

export async function buildRuneliteOverlay(device: RuneliteDeviceContext, origin: string) {
  const data = await loadBingoView({ eventId: device.eventId, viewer: 'team', teamId: device.teamId });
  const ownTeam = data.teams.find((team) => team.id === device.teamId);
  if (!ownTeam) throw new BingoError('This RuneLite team is no longer part of the event.', 404);
  const progressByTask = new Map(data.verification.candidates.map((candidate) => [candidate.taskId, candidate]));
  const capturePlan = data.tasks.flatMap((task) => {
    if (task.concealed || task.freeSpace || !task.rule.proof.sources.includes('runelite')) return [];
    if (!task.repeatable && task.ownerTeamIds.length) return [];
    return [{
      taskId: task.id, signalType: task.rule.verifier.type, target: task.rule.verifier.target,
      targetId: task.rule.verifier.targetId, metric: task.rule.verifier.metric,
    }];
  });
  return {
    schemaVersion: 1,
    serverTime: new Date().toISOString(),
    pollAfterSeconds: 5,
    event: {
      id: data.event.id, title: data.event.title, status: data.event.status, revision: data.event.revision,
      publicUrl: `${origin}${data.event.publicPath}`,
    },
    member: { id: device.memberId, name: device.memberName },
    team: {
      id: ownTeam.id, name: ownTeam.name, color: ownTeam.color, score: ownTeam.score,
      rank: ownTeam.rank, completedCount: ownTeam.completedCount, lineCount: ownTeam.lineCount,
    },
    standings: data.teams.map((team) => ({
      id: team.id, name: team.name, color: team.color, score: team.score, rank: team.rank,
      completedCount: team.completedCount, lineCount: team.lineCount,
    })),
    board: data.tasks.map((task) => {
      const progress = progressByTask.get(task.id);
      return {
        id: task.id, sortOrder: task.sortOrder, title: task.title, points: task.points,
        category: task.category, concealed: task.concealed, freeSpace: task.freeSpace,
        claimed: task.ownerTeamIds.length > 0, claimedByOwnTeam: task.ownerTeamIds.includes(device.teamId),
        pendingForOwnTeam: task.pendingTeamIds.includes(device.teamId), claimable: task.claimable,
        progress: progress ? {
          status: progress.status, value: progress.progressValue, target: progress.targetValue,
          confidence: progress.confidence,
        } : null,
      };
    }),
    capturePlan,
    privacy: runelitePrivacy(true, device.scopes),
  };
}

export async function revokeRuneliteDevice(input: {
  deviceId: string; eventId: string; actor: 'organizer' | 'team' | 'device'; teamId?: string | null;
}) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = await db.prepare(
    `UPDATE bingo_runelite_devices SET revoked_at = ?, revoked_by = ?
     WHERE id = ? AND event_id = ? AND revoked_at IS NULL${input.teamId ? ' AND team_id = ?' : ''}`,
  ).bind(...(input.teamId
    ? [now, input.actor, input.deviceId, input.eventId, input.teamId]
    : [now, input.actor, input.deviceId, input.eventId])).run();
  if (!result.meta.changes) throw new BingoError('That RuneLite device is already disconnected or unavailable.', 404);
  return { revoked: true, deviceId: input.deviceId, revokedAt: now };
}

function loadIntegration(eventId: string) {
  return getDatabase().prepare('SELECT * FROM bingo_runelite_integrations WHERE event_id = ?').bind(eventId).first<IntegrationRow>();
}
function deviceView(device: DeviceRow) {
  return {
    id: device.id, teamId: device.team_id, memberId: device.member_id,
    memberName: device.display_name ?? device.last_rsn, deviceName: device.device_name,
    pluginVersion: device.plugin_version, scopes: sanitizeRuneliteScopes(parseJson(device.scopes_json, []), []),
    disclosureVersion: device.disclosure_version, lastRsn: device.last_rsn,
    lastSeenAt: device.last_seen_at, expiresAt: device.expires_at, createdAt: device.created_at,
  };
}
function batchSummary(row: {
  event_count: number; accepted_count: number; duplicate_count: number; rejected_count: number; created_at: string;
}) {
  return {
    eventCount: row.event_count, acceptedCount: row.accepted_count, duplicateCount: row.duplicate_count,
    rejectedCount: row.rejected_count, createdAt: row.created_at,
  };
}
function textValue(value: unknown, maximum: number) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maximum) : '';
}
function objectValue(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BingoError('Provide a JSON object.');
  return value as Record<string, unknown>;
}
function strictIdentifier(value: unknown, minimum: number, maximum: number, message: string) {
  if (typeof value !== 'string' || value.length < minimum || value.length > maximum || !/^[A-Za-z0-9._:-]+$/.test(value)) {
    throw new BingoError(message);
  }
  return value;
}
function observationIdentifier(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  return textValue((value as Record<string, unknown>).clientEventId, 64);
}
