import { createHashedCredential, resolveSignupDraftId } from '../../../../lib/access-tokens';
import { recordAudit, requestId } from '../../../../lib/audit';
import { ensureSchema, getDatabase, json } from '../../../../lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '../../../../lib/rate-limit';
import type { DraftType, SurveyFieldType } from '../../../../lib/types';
import { cleanRsn, hasBotTrap, isExpired, MAX_ROSTER_SIZE, normalizeRsn, validateRsn } from '../../../../lib/validation';
import { scheduleDiscordEvent } from '../../../../lib/discord-webhooks';

type DraftRow = {
  id: string;
  title: string;
  draft_type: DraftType;
  team_count: number;
  registration_open: number;
  registration_capacity: number;
  signup_approval_mode: number;
  registration_deadline: string | null;
  clan_id: string | null;
};
type QuestionRow = {
  id: string;
  label: string;
  field_type: SurveyFieldType;
  required: number;
  options_json: string | null;
  sort_order: number;
};

async function findDraft(token: string) {
  const draftId = await resolveSignupDraftId(token);
  if (!draftId) return null;
  return getDatabase()
    .prepare(
      `SELECT id, title, draft_type, team_count, registration_open,
              registration_capacity, signup_approval_mode, registration_deadline, clan_id
       FROM drafts WHERE id = ?`,
    )
    .bind(draftId)
    .first<DraftRow>();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const draft = await findDraft(token);
    if (!draft) return json({ error: 'This signup link is not valid.' }, { status: 404 });
    const db = getDatabase();
    const [questions, countRow] = await Promise.all([
      db
        .prepare(
          `SELECT id, label, field_type, required, options_json, sort_order
           FROM survey_questions WHERE draft_id = ? ORDER BY sort_order`,
        )
        .bind(draft.id)
        .all<QuestionRow>(),
      db
        .prepare("SELECT COUNT(*) AS count FROM players WHERE draft_id = ? AND withdrawn_at IS NULL")
        .bind(draft.id)
        .first<{ count: number }>(),
    ]);
    return json({
      draft: {
        title: draft.title,
        draftType: draft.draft_type,
        teamCount: draft.team_count,
        registrationOpen: Boolean(draft.registration_open),
        registrationCapacity: draft.registration_capacity,
        registrationDeadline: draft.registration_deadline,
        approvalRequired: Boolean(draft.signup_approval_mode),
      },
      signupCount: countRow?.count ?? 0,
      questions: questions.results.map(mapQuestion),
    });
  } catch (error) {
    console.error('load signup failed', error);
    return json({ error: 'The signup form could not be loaded.' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    await enforceRateLimit({ request, scope: 'event-signup', limit: 8, windowSeconds: 3600 });
    const draft = await findDraft(token);
    if (!draft) return json({ error: 'This signup link is not valid.' }, { status: 404 });
    if (!draft.registration_open || isExpired(draft.registration_deadline)) {
      return json({ error: 'Registration is closed for this event.' }, { status: 409 });
    }
    const body = (await request.json()) as { name?: unknown; answers?: unknown };
    if (hasBotTrap(body as Record<string, unknown>)) return json({ error: 'Your signup could not be saved.' }, { status: 400 });
    const name = typeof body.name === 'string' ? cleanRsn(body.name) : '';
    const nameError = validateRsn(name);
    if (nameError) return json({ error: nameError }, { status: 400 });
    const normalizedName = normalizeRsn(name);
    const submittedAnswers =
      body.answers && typeof body.answers === 'object'
        ? (body.answers as Record<string, unknown>)
        : {};
    const db = getDatabase();
    const [questions, existing, countRow, approvedCountRow] = await Promise.all([
      db
        .prepare(
          `SELECT id, label, field_type, required, options_json, sort_order
           FROM survey_questions WHERE draft_id = ? ORDER BY sort_order`,
        )
        .bind(draft.id)
        .all<QuestionRow>(),
      db
        .prepare('SELECT id FROM players WHERE draft_id = ? AND normalized_name = ?')
        .bind(draft.id, normalizedName)
        .first<{ id: string }>(),
      db
        .prepare('SELECT COUNT(*) AS count FROM players WHERE draft_id = ? AND withdrawn_at IS NULL')
        .bind(draft.id)
        .first<{ count: number }>(),
      db
        .prepare("SELECT COUNT(*) AS count FROM players WHERE draft_id = ? AND signup_status = 'approved' AND withdrawn_at IS NULL")
        .bind(draft.id)
        .first<{ count: number }>(),
    ]);
    if (existing) return json({ error: 'That in-game name is already registered.' }, { status: 409 });
    if ((countRow?.count ?? 0) >= MAX_ROSTER_SIZE) {
      return json({ error: `This event has reached its ${MAX_ROSTER_SIZE}-player limit.` }, { status: 409 });
    }

    const answers: { questionId: string; value: string }[] = [];
    for (const question of questions.results) {
      const rawValue = submittedAnswers[question.id];
      const value = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (question.required && !value) {
        return json({ error: `Answer “${question.label}” before joining.` }, { status: 400 });
      }
      if (!value) continue;
      const maxLength = question.field_type === 'long' ? 500 : 120;
      if (value.length > maxLength) {
        return json({ error: `“${question.label}” is too long.` }, { status: 400 });
      }
      if (question.field_type === 'number' && !Number.isFinite(Number(value))) {
        return json({ error: `“${question.label}” must be a number.` }, { status: 400 });
      }
      if (question.field_type === 'choice') {
        const options = parseOptions(question.options_json);
        if (!options.includes(value)) {
          return json({ error: `Choose a valid answer for “${question.label}”.` }, { status: 400 });
        }
      }
      answers.push({ questionId: question.id, value });
    }

    const playerId = crypto.randomUUID();
    const participantCredential = await createHashedCredential();
    const now = new Date().toISOString();
    const signupStatus = (approvedCountRow?.count ?? 0) >= draft.registration_capacity
      ? 'waitlisted'
      : draft.signup_approval_mode
        ? 'pending'
        : 'approved';
    await db.batch([
      db
        .prepare(
          `INSERT INTO players
            (id, draft_id, name, normalized_name, sort_order, source, signup_status,
             participant_token_hash, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'signup', ?, ?, ?, ?)`,
        )
        .bind(
          playerId,
          draft.id,
          name,
          normalizedName,
          countRow?.count ?? 0,
          signupStatus,
          participantCredential.hash,
          now,
          now,
        ),
      ...answers.map((answer) =>
        db
          .prepare('INSERT INTO survey_answers (question_id, player_id, value) VALUES (?, ?, ?)')
          .bind(answer.questionId, playerId, answer.value),
      ),
      ...(signupStatus === 'approved'
        ? [db.prepare('UPDATE captains SET submitted_at = NULL WHERE draft_id = ?').bind(draft.id)]
        : []),
      db
        .prepare("UPDATE drafts SET status = 'registration', result_json = NULL, updated_at = ? WHERE id = ?")
        .bind(now, draft.id),
    ]);
    await recordAudit(db, {
      draftId: draft.id,
      clanId: draft.clan_id,
      actorType: 'participant',
      actorReference: playerId,
      eventType: 'registration.created',
      metadata: { signupStatus },
      requestId: requestId(request),
    });
    scheduleDiscordEvent(draft.id, 'registration.created', {
      username: "Terry's Drafting",
      embeds: [{ title: `${name} signed up`, description: `Status: **${signupStatus}**`, color: 0xd0a23d }],
    });
    return json(
      {
        joined: true,
        name,
        signupStatus,
        signupCount: (countRow?.count ?? 0) + 1,
        managePath: `/participant/${participantCredential.token}`,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    console.error('save signup failed', error);
    return json({ error: 'Your signup could not be saved. Please try again.' }, { status: 500 });
  }
}

function mapQuestion(question: QuestionRow) {
  return {
    id: question.id,
    label: question.label,
    fieldType: question.field_type,
    required: Boolean(question.required),
    options: parseOptions(question.options_json),
  };
}

function parseOptions(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
