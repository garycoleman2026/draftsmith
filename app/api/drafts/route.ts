import { createHashedCredential } from '../../../lib/access-tokens';
import { getSessionUser } from '../../../lib/auth';
import { recordAudit, requestId } from '../../../lib/audit';
import { ensureSchema, getDatabase, json } from '../../../lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '../../../lib/rate-limit';
import type {
  BalanceMetric,
  BalancePreset,
  DraftType,
  LiveOrder,
  QuestionVisibility,
  RosterMode,
  SurveyFieldType,
  SurveyQuestion,
} from '../../../lib/types';
import { hasBotTrap, MAX_ROSTER_SIZE, parseRsnList } from '../../../lib/validation';
import { uniqueDraftSlug } from '../../../lib/slugs';

const VALID_DRAFT_TYPES = new Set<DraftType>(['balanced', 'snake', 'random', 'live']);
const VALID_FIELD_TYPES = new Set<SurveyFieldType>(['short', 'long', 'number', 'choice']);
const VALID_VISIBILITY = new Set<QuestionVisibility>(['organizer', 'captains', 'public']);
const VALID_BALANCE_METRICS = new Set<BalanceMetric>(['playtime', 'pvm', 'skilling', 'raids', 'gear', 'knowledge']);
const VALID_BALANCE_PRESETS = new Set<BalancePreset>(['consensus', 'all_rounder', 'pvm', 'skilling', 'raids', 'custom']);
const VALID_LIVE_ORDERS = new Set<LiveOrder>(['snake', 'linear', 'random', 'third_round_reversal']);

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = (await request.json()) as {
      title?: unknown;
      draftType?: unknown;
      teamCount?: unknown;
      rosterMode?: unknown;
      players?: unknown;
      captainNames?: unknown;
      surveyQuestions?: unknown;
      clanId?: unknown;
      registrationCapacity?: unknown;
      signupApprovalMode?: unknown;
      registrationDeadline?: unknown;
      rankingDeadline?: unknown;
      answersVisibility?: unknown;
      balancePreset?: unknown;
      balanceWeights?: unknown;
      liveOrder?: unknown;
      livePickSeconds?: unknown;
      liveAutoPick?: unknown;
      website?: unknown;
    };

    if (hasBotTrap(body as Record<string, unknown>)) {
      return json({ error: 'The draft could not be created.' }, { status: 400 });
    }
    await enforceRateLimit({ request, scope: 'create-draft', limit: 8, windowSeconds: 3600 });

    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 80) : '';
    const draftType = body.draftType as DraftType;
    const teamCount = Number(body.teamCount);
    const rosterMode: RosterMode = body.rosterMode === 'signup' ? 'signup' : 'import';
    if (!VALID_DRAFT_TYPES.has(draftType)) {
      return json({ error: 'Choose a valid draft type.' }, { status: 400 });
    }
    if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > 8) {
      return json({ error: 'Choose between 2 and 8 teams.' }, { status: 400 });
    }

    const rawPlayers = Array.isArray(body.players) ? body.players : [];
    const rawCaptains = Array.isArray(body.captainNames) ? body.captainNames : [];
    const parsedPlayers = parseRsnList(rawPlayers);
    if (parsedPlayers.invalid.length) {
      return json(
        { error: `Invalid in-game name${parsedPlayers.invalid.length === 1 ? '' : 's'}: ${parsedPlayers.invalid.slice(0, 5).join(', ')}` },
        { status: 400 },
      );
    }
    const players = rosterMode === 'import' ? parsedPlayers.names : [];

    if (rosterMode === 'import' && players.length < teamCount) {
      return json({ error: `Add at least ${teamCount} players for ${teamCount} teams.` }, { status: 400 });
    }
    if (players.length > MAX_ROSTER_SIZE) {
      return json({ error: `Drafts can include up to ${MAX_ROSTER_SIZE} players.` }, { status: 400 });
    }

    const captainNames = rawCaptains
      .filter((name): name is string => typeof name === 'string')
      .map((name) => name.trim().replace(/\s+/g, ' '));
    if (rosterMode === 'import') {
      const captainKeys = new Set(captainNames.map((name) => name.toLocaleLowerCase()));
      const playerKeys = new Set(players.map((name) => name.toLocaleLowerCase()));
      if (
        captainNames.length !== teamCount ||
        captainKeys.size !== teamCount ||
        captainNames.some((name) => !playerKeys.has(name.toLocaleLowerCase()))
      ) {
        return json({ error: 'Choose a different player for each captain spot.' }, { status: 400 });
      }
    }

    const questions = rosterMode === 'signup' ? sanitizeQuestions(body.surveyQuestions) : [];
    const db = getDatabase();
    const sessionUser = await getSessionUser(request);
    const clanId = typeof body.clanId === 'string' ? body.clanId : null;
    if (clanId) {
      if (!sessionUser) return json({ error: 'Sign in before saving an event to a clan workspace.' }, { status: 401 });
      const membership = await db
        .prepare("SELECT role FROM clan_memberships WHERE clan_id = ? AND user_id = ? AND role IN ('owner', 'admin')")
        .bind(clanId, sessionUser.id)
        .first();
      if (!membership) return json({ error: 'You cannot create events in that clan workspace.' }, { status: 403 });
    }
    const draftId = crypto.randomUUID();
    const adminCredential = await createHashedCredential();
    const signupCredential = rosterMode === 'signup' ? await createHashedCredential() : null;
    const now = new Date().toISOString();
    const registrationCapacity = Math.max(teamCount, Math.min(MAX_ROSTER_SIZE, Number(body.registrationCapacity) || MAX_ROSTER_SIZE));
    const signupApprovalMode = body.signupApprovalMode === true;
    const registrationDeadline = validFutureDate(body.registrationDeadline);
    const rankingDeadline = validFutureDate(body.rankingDeadline);
    const answersVisibility = VALID_VISIBILITY.has(body.answersVisibility as QuestionVisibility)
      ? (body.answersVisibility as QuestionVisibility)
      : 'captains';
    const balancePreset = VALID_BALANCE_PRESETS.has(body.balancePreset as BalancePreset)
      ? (body.balancePreset as BalancePreset)
      : 'consensus';
    const balanceWeights = sanitizeWeights(body.balanceWeights);
    const liveOrder = VALID_LIVE_ORDERS.has(body.liveOrder as LiveOrder) ? (body.liveOrder as LiveOrder) : 'snake';
    const livePickSeconds = Math.max(0, Math.min(900, Number(body.livePickSeconds) || 0));
    const liveAutoPick = body.liveAutoPick === true;
    const publicSlug = await uniqueDraftSlug(title || 'clan-draft');
    const playerRows = players.map((name, sortOrder) => ({
      id: crypto.randomUUID(),
      name,
      sortOrder,
      normalizedName: name.toLocaleLowerCase('en-US'),
    }));
    const playerByName = new Map(
      playerRows.map((player) => [player.name.toLocaleLowerCase(), player] as const),
    );
    const captainRows = rosterMode === 'import'
      ? await Promise.all(captainNames.map(async (name, teamIndex) => ({
          id: crypto.randomUUID(),
          playerId: playerByName.get(name.toLocaleLowerCase())!.id,
          name: playerByName.get(name.toLocaleLowerCase())!.name,
          teamIndex,
          credential: await createHashedCredential(),
        })))
      : [];

    await db.batch([
      db
        .prepare(
          `INSERT INTO drafts
            (id, admin_token, admin_token_hash, title, public_slug, clan_id, owner_user_id,
             draft_type, team_count, roster_mode, signup_token, signup_token_hash,
             registration_open, registration_capacity, signup_approval_mode,
             registration_deadline, ranking_deadline, answers_visibility,
             balance_preset, balance_weights_json, live_order, live_pick_seconds,
             live_auto_pick, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          draftId,
          adminCredential.retired,
          adminCredential.hash,
          title || 'Untitled draft',
          publicSlug,
          clanId,
          sessionUser?.id ?? null,
          draftType,
          teamCount,
          rosterMode,
          signupCredential?.retired ?? null,
          signupCredential?.hash ?? null,
          rosterMode === 'signup' ? 1 : 0,
          registrationCapacity,
          signupApprovalMode ? 1 : 0,
          registrationDeadline,
          rankingDeadline,
          answersVisibility,
          balancePreset,
          Object.keys(balanceWeights).length ? JSON.stringify(balanceWeights) : null,
          liveOrder,
          livePickSeconds,
          liveAutoPick ? 1 : 0,
          rosterMode === 'signup' ? 'registration' : 'rankings',
          now,
          now,
        ),
      ...playerRows.map((player) =>
        db
          .prepare(
            `INSERT INTO players
              (id, draft_id, name, normalized_name, sort_order, source, signup_status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'import', 'approved', ?, ?)`,
          )
          .bind(player.id, draftId, player.name, player.normalizedName, player.sortOrder, now, now),
      ),
      ...captainRows.map((captain) =>
        db
          .prepare(
            `INSERT INTO captains
              (id, draft_id, player_id, team_index, token, token_hash)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            captain.id,
            draftId,
            captain.playerId,
            captain.teamIndex,
            captain.credential.retired,
            captain.credential.hash,
          ),
      ),
      ...questions.map((question, sortOrder) =>
        db
          .prepare(
            `INSERT INTO survey_questions
              (id, draft_id, label, field_type, required, visibility,
               balance_metric, balance_weight, options_json, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            draftId,
            question.label,
            question.fieldType,
            question.required ? 1 : 0,
            question.visibility ?? answersVisibility,
            question.balanceMetric ?? null,
            question.balanceWeight ?? 0,
            question.options.length ? JSON.stringify(question.options) : null,
            sortOrder,
          ),
      ),
    ]);

    await recordAudit(db, {
      draftId,
      clanId,
      actorUserId: sessionUser?.id ?? null,
      actorType: sessionUser ? 'organizer' : 'anonymous',
      eventType: 'event.created',
      metadata: { draftType, teamCount, rosterMode, playerCount: players.length },
      requestId: requestId(request),
    });

    return json(
      {
        id: draftId,
        adminPath: `/manage/${adminCredential.token}`,
        joinPath: signupCredential ? `/join/${publicSlug}` : null,
        captains: captainRows.map((captain) => ({
          name: captain.name,
          teamIndex: captain.teamIndex,
          path: `/rank/${captain.credential.token}`,
        })),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    console.error('create draft failed', error);
    return json({ error: 'The draft could not be created. Please try again.' }, { status: 500 });
  }
}

function sanitizeQuestions(value: unknown): SurveyQuestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const raw = item as Record<string, unknown>;
      const label = typeof raw.label === 'string' ? raw.label.trim().slice(0, 80) : '';
      const fieldType = raw.fieldType as SurveyFieldType;
      if (!label || !VALID_FIELD_TYPES.has(fieldType)) return [];
      const options = Array.isArray(raw.options)
        ? raw.options
            .filter((option): option is string => typeof option === 'string')
            .map((option) => option.trim().slice(0, 40))
            .filter(Boolean)
            .slice(0, 12)
        : [];
      const visibility = VALID_VISIBILITY.has(raw.visibility as QuestionVisibility)
        ? (raw.visibility as QuestionVisibility)
        : 'captains';
      const balanceMetric = VALID_BALANCE_METRICS.has(raw.balanceMetric as BalanceMetric)
        ? (raw.balanceMetric as BalanceMetric)
        : null;
      const balanceWeight = Math.max(0, Math.min(100, Number(raw.balanceWeight) || 0));
      return [{ label, fieldType, required: raw.required === true, options, visibility, balanceMetric, balanceWeight }];
    })
    .slice(0, 12);
}

function validFutureDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() > Date.now() ? date.toISOString() : null;
}

function sanitizeWeights(value: unknown) {
  if (!value || typeof value !== 'object') return {} as Record<string, number>;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, weight]) => /^[a-z_]{2,30}$/.test(key) && Number.isFinite(Number(weight)) && Number(weight) > 0)
      .slice(0, 12)
      .map(([key, weight]) => [key, Math.min(100, Number(weight))]),
  );
}
