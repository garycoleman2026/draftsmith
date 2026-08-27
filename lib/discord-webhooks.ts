import { env, waitUntil } from 'cloudflare:workers';
import { recordAudit } from './audit';
import { getDatabase } from './db';
import { decryptSecret } from './security';

export const DISCORD_EVENT_TYPES = [
  'registration.created', 'registration.closed', 'captain.rankings_submitted',
  'live.started', 'live.pick', 'live.auto', 'draft.generated', 'draft.complete',
  'bingo.started', 'bingo.claim_submitted', 'bingo.claim_approved', 'bingo.completed',
] as const;
export type DiscordEventType = typeof DISCORD_EVENT_TYPES[number];

export function scheduleDiscordEvent(draftId: string, eventType: DiscordEventType, payload: DiscordPayload) {
  try {
    waitUntil(dispatchDiscordEvent(draftId, eventType, payload));
  } catch {
    // Local/test runtimes without an execution context still queue safely.
    void dispatchDiscordEvent(draftId, eventType, payload);
  }
}

export async function dispatchDiscordEvent(draftId: string, eventType: DiscordEventType, payload: DiscordPayload) {
  const db = getDatabase();
  try {
    const integrations = await db.prepare(
      `SELECT id, draft_id, encrypted_url, enabled_events_json FROM webhook_integrations
       WHERE draft_id = ? AND kind = 'discord'`,
    ).bind(draftId).all<{ id: string; draft_id: string | null; encrypted_url: string; enabled_events_json: string }>();
    for (const integration of integrations.results) {
      const enabled = parseEvents(integration.enabled_events_json);
      if (!enabled.includes(eventType)) continue;
      const deliveryId = crypto.randomUUID();
      await db.prepare(`INSERT INTO webhook_deliveries
        (id, integration_id, event_type, payload_json, status, attempts, created_at)
        VALUES (?, ?, ?, ?, 'pending', 0, ?)`)
        .bind(deliveryId, integration.id, eventType, JSON.stringify(payload), new Date().toISOString()).run();
      await deliver(integration, deliveryId, payload);
    }
  } catch (error) {
    await recordAudit(db, {
      draftId, actorType: 'system', eventType: 'integration.discord_queue_failed',
      metadata: { sourceEvent: eventType, error: error instanceof Error ? error.message : String(error) },
    }).catch(() => undefined);
  }
}

export async function retryDiscordDeliveries(draftId: string) {
  const db = getDatabase();
  const rows = await db.prepare(
    `SELECT wd.id, wd.payload_json, wi.id AS integration_id, wi.draft_id, wi.encrypted_url, wi.enabled_events_json
     FROM webhook_deliveries wd JOIN webhook_integrations wi ON wi.id = wd.integration_id
     WHERE wi.draft_id = ? AND wd.status IN ('pending', 'failed') AND wd.attempts < 4
     ORDER BY wd.created_at LIMIT 20`,
  ).bind(draftId).all<{
    id: string; payload_json: string; integration_id: string; draft_id: string | null; encrypted_url: string; enabled_events_json: string;
  }>();
  for (const row of rows.results) {
    await deliver({ id: row.integration_id, draft_id: row.draft_id, encrypted_url: row.encrypted_url, enabled_events_json: row.enabled_events_json }, row.id, JSON.parse(row.payload_json) as DiscordPayload);
  }
  return rows.results.length;
}

async function deliver(
  integration: { id: string; draft_id: string | null; encrypted_url: string; enabled_events_json: string },
  deliveryId: string,
  payload: DiscordPayload,
) {
  const db = getDatabase();
  let responseCode: number | null = null;
  try {
    const secret = env.APP_ENCRYPTION_KEY?.trim();
    if (!secret) throw new Error('APP_ENCRYPTION_KEY is not configured.');
    const url = await decryptSecret(integration.encrypted_url, secret);
    const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}wait=true`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    responseCode = response.status;
    if (!response.ok) throw new Error(`Discord returned HTTP ${response.status}.`);
    await db.prepare(`UPDATE webhook_deliveries SET status = 'delivered', attempts = attempts + 1,
      response_code = ?, last_error = NULL, delivered_at = ? WHERE id = ?`)
      .bind(response.status, new Date().toISOString(), deliveryId).run();
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
    await db.prepare(`UPDATE webhook_deliveries SET status = 'failed', attempts = attempts + 1,
      response_code = ?, last_error = ? WHERE id = ?`).bind(responseCode, message, deliveryId).run();
    await recordAudit(db, {
      draftId: integration.draft_id, actorType: 'system', eventType: 'integration.discord_delivery_failed',
      metadata: { deliveryId, integrationId: integration.id, responseCode, error: message },
    }).catch(() => undefined);
  }
}

export type DiscordPayload = {
  content?: string;
  username?: string;
  embeds?: Array<{ title?: string; description?: string; color?: number; fields?: Array<{ name: string; value: string; inline?: boolean }> }>;
};

function parseEvents(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is DiscordEventType => typeof item === 'string' && DISCORD_EVENT_TYPES.includes(item as DiscordEventType)) : [];
  } catch { return []; }
}
