import { createHashedCredential } from '@/lib/access-tokens';
import { getSessionUser } from '@/lib/auth';
import { recordAudit, requestId } from '@/lib/audit';
import { BingoError, bingoErrorResponse, parseJson } from '@/lib/bingo';
import { createBingoEventSnapshot, validBingoDate } from '@/lib/bingo-event-creation';
import { sanitizeStandaloneBingoTeams } from '@/lib/bingo-roster';
import { getBuiltinBingoTemplate, sanitizeBingoTemplate } from '@/lib/bingo-types';
import { ensureSchema, getDatabase, json } from '@/lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '@/lib/rate-limit';
import type { DraftResult, ResultPlayer } from '@/lib/types';
import { hasBotTrap, normalizeRsn } from '@/lib/validation';

type PublicTemplateRow = {
  id: string;
  configuration_json: string;
};

export async function POST(request: Request) {
  let createdDraftId: string | null = null;
  try {
    await ensureSchema();
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (hasBotTrap(body)) return json({ error: 'The bingo event could not be created.' }, { status: 400 });
    await enforceRateLimit({ request, scope: 'create-standalone-bingo', limit: 8, windowSeconds: 3600 });

    const title = typeof body.title === 'string' ? body.title.trim().replace(/\s+/g, ' ').slice(0, 80) : '';
    if (!title) throw new BingoError('Give the bingo event a title.', 400);
    const roster = sanitizeStandaloneBingoTeams(body.teams);
    if (roster.errors.length) throw new BingoError(roster.errors[0], 400);

    const builtin = getBuiltinBingoTemplate(body.templateKey);
    const publicTemplate = typeof body.templateId === 'string' && body.templateId
      ? await getDatabase().prepare(
        `SELECT id, configuration_json FROM bingo_templates
         WHERE id = ? AND visibility = 'public' AND public_slug IS NOT NULL`,
      ).bind(body.templateId).first<PublicTemplateRow>()
      : null;
    if (typeof body.templateId === 'string' && body.templateId && !publicTemplate) {
      throw new BingoError('That community template is no longer publicly available.', 404);
    }
    const customConfiguration = Boolean(body.configuration && typeof body.configuration === 'object' && !publicTemplate);
    const configuration = publicTemplate
      ? sanitizeBingoTemplate(parseJson(publicTemplate.configuration_json, {}), builtin)
      : customConfiguration ? sanitizeBingoTemplate(body.configuration, builtin) : builtin;
    const startAt = validBingoDate(body.startAt);
    const endAt = validBingoDate(body.endAt);
    if (body.startAt && !startAt) throw new BingoError('Choose a valid bingo start time.', 400);
    if (body.endAt && !endAt) throw new BingoError('Choose a valid bingo end time.', 400);
    if (endAt && !startAt) throw new BingoError('Add a start time before setting an end time.', 400);

    const db = getDatabase();
    const sessionUser = await getSessionUser(request);
    const credential = await createHashedCredential();
    const draftId = crypto.randomUUID();
    createdDraftId = draftId;
    const now = new Date().toISOString();
    let sortOrder = 0;
    const playerRows: { id: string; name: string; normalizedName: string; sortOrder: number }[] = [];
    const resultTeams = roster.teams.map((team, teamIndex) => {
      const members = team.players.map((name) => {
        const player = { id: crypto.randomUUID(), name, normalizedName: normalizeRsn(name), sortOrder: sortOrder++ };
        playerRows.push(player);
        return player;
      });
      const captain = members[0]!;
      const players: ResultPlayer[] = members.slice(1).map((player) => ({
        id: player.id,
        name: player.name,
        averageScore: null,
      }));
      return {
        teamIndex,
        captain: { id: captain.id, name: captain.name },
        players,
        averageScore: null,
      };
    });
    const result: DraftResult = {
      generatedAt: now,
      draftType: 'random',
      teams: resultTeams,
      avoidOverrides: 0,
      constraintOverrides: 0,
      seed: 'standalone-bingo',
    };

    await db.batch([
      db.prepare(`INSERT INTO drafts
        (id, admin_token, admin_token_hash, title, public_slug, owner_user_id, draft_type, team_count,
         roster_mode, registration_open, status, result_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'random', ?, 'import', 0, 'complete', ?, ?, ?)`)
        .bind(draftId, credential.retired, credential.hash, title, null, sessionUser?.id ?? null,
          roster.teams.length, JSON.stringify(result), now, now),
      ...playerRows.map((player) => db.prepare(`INSERT INTO players
        (id, draft_id, name, normalized_name, sort_order, source, signup_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'import', 'approved', ?, ?)`)
        .bind(player.id, draftId, player.name, player.normalizedName, player.sortOrder, now, now)),
    ]);

    const created = await createBingoEventSnapshot({
      draftId,
      title,
      result,
      configuration,
      mode: configuration.mode,
      boardScope: configuration.mode === 'lockout' ? 'shared' : configuration.boardScope,
      startAt,
      endAt,
      createdByUserId: sessionUser?.id ?? null,
      templateKey: publicTemplate || customConfiguration ? null : builtin.key,
      teamNames: Object.fromEntries(roster.teams.map((team, index) => [index, team.name])),
    });
    await recordAudit(db, {
      draftId,
      actorUserId: sessionUser?.id ?? null,
      actorType: sessionUser ? 'organizer' : 'anonymous',
      eventType: 'bingo.created',
      metadata: {
        eventId: created.id,
        source: customConfiguration ? 'standalone_custom' : 'standalone',
        mode: configuration.mode,
        teamCount: roster.teams.length,
        playerCount: roster.playerCount,
        taskCount: configuration.tasks.length,
      },
      requestId: requestId(request),
      createdAt: now,
    });
    if (publicTemplate) {
      await db.prepare('UPDATE bingo_templates SET clone_count = clone_count + 1 WHERE id = ? AND visibility = ?')
        .bind(publicTemplate.id, 'public').run();
    }

    return json({
      id: created.id,
      managePath: `/bingo/manage/${credential.token}/${created.id}`,
      publicPath: created.publicPath,
      teamLinks: created.teamLinks,
    }, { status: 201 });
  } catch (error) {
    if (createdDraftId) {
      await getDatabase().prepare('DELETE FROM drafts WHERE id = ?').bind(createdDraftId).run().catch(() => undefined);
    }
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    const failure = bingoErrorResponse(error);
    if (failure.status < 500) return json({ error: failure.message }, { status: failure.status });
    console.error('create standalone bingo failed', error);
    return json({ error: 'The bingo event could not be created. Please try again.' }, { status: 500 });
  }
}
