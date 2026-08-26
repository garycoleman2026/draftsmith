import { resolveParticipantId } from '../../../../lib/access-tokens';
import { recordAudit, requestId } from '../../../../lib/audit';
import { ensureSchema, getDatabase, json } from '../../../../lib/db';
import { promoteWaitlist } from '../../../../lib/registration';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '../../../../lib/rate-limit';
import type { SurveyFieldType } from '../../../../lib/types';
import { cleanRsn, hasBotTrap, isExpired, normalizeRsn, validateRsn } from '../../../../lib/validation';

type ParticipantRow = {
  id: string;
  draft_id: string;
  name: string;
  signup_status: string;
  draft_title: string;
  registration_open: number;
  registration_deadline: string | null;
  live_started_at: string | null;
  clan_id: string | null;
  registration_capacity: number;
};
type QuestionRow = {
  id: string;
  label: string;
  field_type: SurveyFieldType;
  required: number;
  options_json: string | null;
  sort_order: number;
};

async function loadParticipant(token: string) {
  const playerId = await resolveParticipantId(token);
  if (!playerId) return null;
  return getDatabase()
    .prepare(
      `SELECT p.id, p.draft_id, p.name, p.signup_status,
              d.title AS draft_title, d.registration_open,
              d.registration_deadline, d.live_started_at, d.clan_id, d.registration_capacity
       FROM players p JOIN drafts d ON d.id = p.draft_id
       WHERE p.id = ? AND p.source = 'signup' AND p.withdrawn_at IS NULL`,
    )
    .bind(playerId)
    .first<ParticipantRow>();
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const participant = await loadParticipant(token);
    if (!participant) return json({ error: 'This participant link is not valid.' }, { status: 404 });
    const db = getDatabase();
    const [questions, answers] = await Promise.all([
      db
        .prepare(
          `SELECT id, label, field_type, required, options_json, sort_order
           FROM survey_questions WHERE draft_id = ? ORDER BY sort_order`,
        )
        .bind(participant.draft_id)
        .all<QuestionRow>(),
      db
        .prepare('SELECT question_id, value FROM survey_answers WHERE player_id = ?')
        .bind(participant.id)
        .all<{ question_id: string; value: string }>(),
    ]);
    return json({
      participant: {
        name: participant.name,
        signupStatus: participant.signup_status,
        canEdit: Boolean(participant.registration_open) && !participant.live_started_at && !isExpired(participant.registration_deadline),
      },
      draft: { title: participant.draft_title, registrationDeadline: participant.registration_deadline },
      questions: questions.results.map(mapQuestion),
      answers: Object.fromEntries(answers.results.map((answer) => [answer.question_id, answer.value])),
    });
  } catch (error) {
    console.error('load participant profile failed', error);
    return json({ error: 'Your participant profile could not be loaded.' }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    await enforceRateLimit({ request, scope: 'participant-edit', limit: 20, windowSeconds: 3600, subject: token });
    const participant = await loadParticipant(token);
    if (!participant) return json({ error: 'This participant link is not valid.' }, { status: 404 });
    if (!participant.registration_open || participant.live_started_at || isExpired(participant.registration_deadline)) {
      return json({ error: 'This event is no longer accepting profile changes.' }, { status: 409 });
    }
    const body = (await request.json()) as { name?: unknown; answers?: unknown; website?: unknown };
    if (hasBotTrap(body as Record<string, unknown>)) return json({ error: 'Your profile could not be saved.' }, { status: 400 });
    const name = typeof body.name === 'string' ? cleanRsn(body.name) : '';
    const nameError = validateRsn(name);
    if (nameError) return json({ error: nameError }, { status: 400 });
    const submittedAnswers = body.answers && typeof body.answers === 'object'
      ? (body.answers as Record<string, unknown>)
      : {};
    const db = getDatabase();
    const questions = await db
      .prepare(
        `SELECT id, label, field_type, required, options_json, sort_order
         FROM survey_questions WHERE draft_id = ? ORDER BY sort_order`,
      )
      .bind(participant.draft_id)
      .all<QuestionRow>();
    const answers = validateAnswers(questions.results, submittedAnswers);
    if ('error' in answers) return json({ error: answers.error }, { status: 400 });
    const existing = await db
      .prepare('SELECT id FROM players WHERE draft_id = ? AND normalized_name = ? AND id != ?')
      .bind(participant.draft_id, normalizeRsn(name), participant.id)
      .first();
    if (existing) return json({ error: 'That in-game name is already registered.' }, { status: 409 });
    const now = new Date().toISOString();
    await db.batch([
      db
        .prepare('UPDATE players SET name = ?, normalized_name = ?, updated_at = ? WHERE id = ?')
        .bind(name, normalizeRsn(name), now, participant.id),
      db.prepare('DELETE FROM survey_answers WHERE player_id = ?').bind(participant.id),
      ...answers.map((answer) =>
        db
          .prepare('INSERT INTO survey_answers (question_id, player_id, value) VALUES (?, ?, ?)')
          .bind(answer.questionId, participant.id, answer.value),
      ),
      db.prepare('UPDATE captains SET submitted_at = NULL, rankings_frozen_at = NULL WHERE draft_id = ?').bind(participant.draft_id),
      db
        .prepare("UPDATE drafts SET status = 'registration', result_json = NULL, updated_at = ? WHERE id = ?")
        .bind(now, participant.draft_id),
    ]);
    await recordAudit(db, {
      draftId: participant.draft_id,
      clanId: participant.clan_id,
      actorType: 'participant',
      actorReference: participant.id,
      eventType: 'registration.updated',
      requestId: requestId(request),
    });
    return json({ saved: true, name, signupStatus: participant.signup_status });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    console.error('update participant profile failed', error);
    return json({ error: 'Your participant profile could not be saved.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const participant = await loadParticipant(token);
    if (!participant) return json({ error: 'This participant link is not valid.' }, { status: 404 });
    if (participant.live_started_at) return json({ error: 'You cannot withdraw after the live draft starts.' }, { status: 409 });
    const db = getDatabase();
    const captain = await db.prepare('SELECT id FROM captains WHERE player_id = ?').bind(participant.id).first();
    if (captain) return json({ error: 'Ask the organizer to replace you as captain before withdrawing.' }, { status: 409 });
    const now = new Date().toISOString();
    await db.batch([
      db
        .prepare("UPDATE players SET signup_status = 'withdrawn', withdrawn_at = ?, updated_at = ? WHERE id = ?")
        .bind(now, now, participant.id),
      db.prepare('UPDATE captains SET submitted_at = NULL, rankings_frozen_at = NULL WHERE draft_id = ?').bind(participant.draft_id),
      db
        .prepare("UPDATE drafts SET status = 'registration', result_json = NULL, updated_at = ? WHERE id = ?")
        .bind(now, participant.draft_id),
    ]);
    const promotedPlayerIds = participant.signup_status === 'approved'
      ? await promoteWaitlist(db, participant.draft_id, participant.registration_capacity)
      : [];
    await recordAudit(db, {
      draftId: participant.draft_id,
      clanId: participant.clan_id,
      actorType: 'participant',
      actorReference: participant.id,
      eventType: 'registration.withdrawn',
      requestId: requestId(request),
    });
    return json({ withdrawn: true, promotedPlayerIds });
  } catch (error) {
    console.error('withdraw participant failed', error);
    return json({ error: 'You could not be withdrawn from this event.' }, { status: 500 });
  }
}

function validateAnswers(questions: QuestionRow[], submitted: Record<string, unknown>) {
  const answers: { questionId: string; value: string }[] = [];
  for (const question of questions) {
    const value = typeof submitted[question.id] === 'string' ? String(submitted[question.id]).trim() : '';
    if (question.required && !value) return { error: `Answer “${question.label}” before saving.` } as const;
    if (!value) continue;
    if (value.length > (question.field_type === 'long' ? 500 : 120)) return { error: `“${question.label}” is too long.` } as const;
    if (question.field_type === 'number' && !Number.isFinite(Number(value))) return { error: `“${question.label}” must be a number.` } as const;
    if (question.field_type === 'choice' && !parseOptions(question.options_json).includes(value)) {
      return { error: `Choose a valid answer for “${question.label}”.` } as const;
    }
    answers.push({ questionId: question.id, value });
  }
  return answers;
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
