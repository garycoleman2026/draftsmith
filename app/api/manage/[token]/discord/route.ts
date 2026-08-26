import { env } from 'cloudflare:workers';
import { resolveManagerDraftId } from '../../../../../lib/access-tokens';
import { recordAudit } from '../../../../../lib/audit';
import { DISCORD_EVENT_TYPES, retryDiscordDeliveries } from '../../../../../lib/discord-webhooks';
import { ensureSchema, getDatabase, json } from '../../../../../lib/db';
import { encryptSecret } from '../../../../../lib/security';

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  await ensureSchema();
  const { token } = await context.params;
  const draftId = await resolveManagerDraftId(token);
  if (!draftId) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
  const db = getDatabase();
  const [integration, deliveries] = await Promise.all([
    db.prepare("SELECT id, enabled_events_json, created_at, updated_at FROM webhook_integrations WHERE draft_id = ? AND kind = 'discord' LIMIT 1")
      .bind(draftId).first<{ id: string; enabled_events_json: string; created_at: string; updated_at: string }>(),
    db.prepare(`SELECT wd.event_type, wd.status, wd.attempts, wd.response_code, wd.last_error, wd.created_at, wd.delivered_at
                FROM webhook_deliveries wd JOIN webhook_integrations wi ON wi.id = wd.integration_id
                WHERE wi.draft_id = ? ORDER BY wd.created_at DESC LIMIT 20`)
      .bind(draftId).all<Record<string, string | number | null>>(),
  ]);
  return json({
    configured: Boolean(integration),
    enabledEvents: integration ? parseEvents(integration.enabled_events_json) : [...DISCORD_EVENT_TYPES],
    deliveries: deliveries.results,
    encryptionConfigured: Boolean(env.APP_ENCRYPTION_KEY?.trim()),
  });
}

export async function PUT(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const draftId = await resolveManagerDraftId(token);
    if (!draftId) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    const secret = env.APP_ENCRYPTION_KEY?.trim();
    if (!secret) return json({ error: 'Discord delivery needs APP_ENCRYPTION_KEY configured in hosting.' }, { status: 503 });
    const body = (await request.json()) as { webhookUrl?: unknown; enabledEvents?: unknown };
    const webhookUrl = typeof body.webhookUrl === 'string' ? body.webhookUrl.trim() : '';
    if (!validDiscordWebhook(webhookUrl)) return json({ error: 'Paste a valid HTTPS Discord webhook URL.' }, { status: 400 });
    const enabledEvents = Array.isArray(body.enabledEvents)
      ? body.enabledEvents.filter((item): item is typeof DISCORD_EVENT_TYPES[number] =>
        typeof item === 'string' && DISCORD_EVENT_TYPES.includes(item as typeof DISCORD_EVENT_TYPES[number]))
      : [...DISCORD_EVENT_TYPES];
    const encryptedUrl = await encryptSecret(webhookUrl, secret);
    const db = getDatabase();
    const existing = await db.prepare("SELECT id FROM webhook_integrations WHERE draft_id = ? AND kind = 'discord' LIMIT 1")
      .bind(draftId).first<{ id: string }>();
    const id = existing?.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    if (existing) {
      await db.prepare('UPDATE webhook_integrations SET encrypted_url = ?, enabled_events_json = ?, updated_at = ? WHERE id = ?')
        .bind(encryptedUrl, JSON.stringify(enabledEvents), now, id).run();
    } else {
      await db.prepare(`INSERT INTO webhook_integrations
        (id, draft_id, kind, encrypted_url, enabled_events_json, created_at, updated_at)
        VALUES (?, ?, 'discord', ?, ?, ?, ?)`).bind(id, draftId, encryptedUrl, JSON.stringify(enabledEvents), now, now).run();
    }
    await recordAudit(getDatabase(), { draftId, actorType: 'organizer', eventType: 'integration.discord_configured', metadata: { enabledEvents }, createdAt: now });
    return json({ configured: true, enabledEvents });
  } catch (error) {
    console.error('configure discord failed', error);
    return json({ error: 'The Discord webhook could not be saved.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  await ensureSchema();
  const { token } = await context.params;
  const draftId = await resolveManagerDraftId(token);
  if (!draftId) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { action?: unknown };
  if (body.action !== 'retry') return json({ error: 'Choose retry.' }, { status: 400 });
  return json({ retried: await retryDiscordDeliveries(draftId) });
}

export async function DELETE(_request: Request, context: { params: Promise<{ token: string }> }) {
  await ensureSchema();
  const { token } = await context.params;
  const draftId = await resolveManagerDraftId(token);
  if (!draftId) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
  await getDatabase().prepare("DELETE FROM webhook_integrations WHERE draft_id = ? AND kind = 'discord'").bind(draftId).run();
  return json({ configured: false });
}

function validDiscordWebhook(value: string) {
  try {
    if (value.length > 500) return false;
    const url = new URL(value);
    return url.protocol === 'https:'
      && ['discord.com', 'discordapp.com'].includes(url.hostname)
      && /^\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+\/?$/.test(url.pathname);
  } catch { return false; }
}

function parseEvents(value: string) {
  try { const parsed = JSON.parse(value) as unknown; return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}
