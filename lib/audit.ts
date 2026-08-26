import type { getDatabase } from './db';

type Database = ReturnType<typeof getDatabase>;

export async function recordAudit(
  db: Database,
  input: {
    draftId?: string | null;
    clanId?: string | null;
    actorUserId?: string | null;
    actorType: 'anonymous' | 'participant' | 'captain' | 'organizer' | 'system';
    actorReference?: string | null;
    eventType: string;
    metadata?: unknown;
    requestId?: string | null;
    createdAt?: string;
  },
) {
  await db
    .prepare(
      `INSERT INTO audit_events
        (id, draft_id, clan_id, actor_user_id, actor_type, actor_reference,
         event_type, metadata_json, request_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.draftId ?? null,
      input.clanId ?? null,
      input.actorUserId ?? null,
      input.actorType,
      input.actorReference ?? null,
      input.eventType,
      input.metadata === undefined ? null : JSON.stringify(input.metadata),
      input.requestId ?? null,
      input.createdAt ?? new Date().toISOString(),
    )
    .run();
}

export function requestId(request: Request) {
  return request.headers.get('cf-ray') ?? request.headers.get('x-request-id') ?? crypto.randomUUID();
}

export function logFailure(event: string, error: unknown, request?: Request) {
  console.error(
    JSON.stringify({
      level: 'error',
      event,
      requestId: request ? requestId(request) : undefined,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      at: new Date().toISOString(),
    }),
  );
}
