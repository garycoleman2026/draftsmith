import { ensureSchema, getDatabase, json } from '../../../../lib/db';
import type { DraftType, SurveyFieldType } from '../../../../lib/types';

type DraftRow = {
  id: string;
  title: string;
  draft_type: DraftType;
  team_count: number;
  registration_open: number;
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
  return getDatabase()
    .prepare(
      `SELECT id, title, draft_type, team_count, registration_open
       FROM drafts WHERE signup_token = ?`,
    )
    .bind(token)
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
        .prepare('SELECT COUNT(*) AS count FROM players WHERE draft_id = ?')
        .bind(draft.id)
        .first<{ count: number }>(),
    ]);
    return json({
      draft: {
        title: draft.title,
        draftType: draft.draft_type,
        teamCount: draft.team_count,
        registrationOpen: Boolean(draft.registration_open),
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
    const draft = await findDraft(token);
    if (!draft) return json({ error: 'This signup link is not valid.' }, { status: 404 });
    if (!draft.registration_open) {
      return json({ error: 'Registration is closed for this event.' }, { status: 409 });
    }
    const body = (await request.json()) as { name?: unknown; answers?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
    if (!name || name.length > 12 || !/^[A-Za-z0-9 _-]+$/.test(name)) {
      return json(
        { error: 'Enter a valid in-game name using up to 12 letters, numbers, spaces, - or _.' },
        { status: 400 },
      );
    }
    const submittedAnswers =
      body.answers && typeof body.answers === 'object'
        ? (body.answers as Record<string, unknown>)
        : {};
    const db = getDatabase();
    const [questions, existing, countRow] = await Promise.all([
      db
        .prepare(
          `SELECT id, label, field_type, required, options_json, sort_order
           FROM survey_questions WHERE draft_id = ? ORDER BY sort_order`,
        )
        .bind(draft.id)
        .all<QuestionRow>(),
      db
        .prepare('SELECT id FROM players WHERE draft_id = ? AND name = ? COLLATE NOCASE')
        .bind(draft.id, name)
        .first<{ id: string }>(),
      db
        .prepare('SELECT COUNT(*) AS count FROM players WHERE draft_id = ?')
        .bind(draft.id)
        .first<{ count: number }>(),
    ]);
    if (existing) return json({ error: 'That in-game name is already registered.' }, { status: 409 });
    if ((countRow?.count ?? 0) >= 120) {
      return json({ error: 'This event has reached its 120-player limit.' }, { status: 409 });
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
    const now = new Date().toISOString();
    await db.batch([
      db
        .prepare(
          `INSERT INTO players (id, draft_id, name, sort_order, source, created_at)
           VALUES (?, ?, ?, ?, 'signup', ?)`,
        )
        .bind(playerId, draft.id, name, countRow?.count ?? 0, now),
      ...answers.map((answer) =>
        db
          .prepare('INSERT INTO survey_answers (question_id, player_id, value) VALUES (?, ?, ?)')
          .bind(answer.questionId, playerId, answer.value),
      ),
      db.prepare('UPDATE captains SET submitted_at = NULL WHERE draft_id = ?').bind(draft.id),
      db
        .prepare("UPDATE drafts SET status = 'collecting', result_json = NULL, updated_at = ? WHERE id = ?")
        .bind(now, draft.id),
    ]);
    return json({ joined: true, name, signupCount: (countRow?.count ?? 0) + 1 }, { status: 201 });
  } catch (error) {
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
