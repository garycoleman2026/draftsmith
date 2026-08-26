import { ensureSchema, getDatabase, json, makeToken } from '../../../lib/db';
import type { DraftType, RosterMode, SurveyFieldType, SurveyQuestion } from '../../../lib/types';

const VALID_DRAFT_TYPES = new Set<DraftType>(['balanced', 'snake', 'random', 'live']);
const VALID_FIELD_TYPES = new Set<SurveyFieldType>(['short', 'long', 'number', 'choice']);

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
    };

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
    const names = rawPlayers
      .filter((name): name is string => typeof name === 'string')
      .map((name) => name.trim().replace(/\s+/g, ' ').slice(0, 80))
      .filter(Boolean);
    const uniqueNames = new Map<string, string>();
    for (const name of names) uniqueNames.set(name.toLocaleLowerCase(), name);
    const players = rosterMode === 'import' ? [...uniqueNames.values()] : [];

    if (rosterMode === 'import' && players.length < teamCount) {
      return json({ error: `Add at least ${teamCount} players for ${teamCount} teams.` }, { status: 400 });
    }
    if (players.length > 120) {
      return json({ error: 'Drafts can include up to 120 players.' }, { status: 400 });
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
    const draftId = crypto.randomUUID();
    const adminToken = makeToken();
    const signupToken = rosterMode === 'signup' ? makeToken() : null;
    const now = new Date().toISOString();
    const playerRows = players.map((name, sortOrder) => ({
      id: crypto.randomUUID(),
      name,
      sortOrder,
    }));
    const playerByName = new Map(
      playerRows.map((player) => [player.name.toLocaleLowerCase(), player] as const),
    );
    const captainRows = rosterMode === 'import'
      ? captainNames.map((name, teamIndex) => ({
          id: crypto.randomUUID(),
          playerId: playerByName.get(name.toLocaleLowerCase())!.id,
          name: playerByName.get(name.toLocaleLowerCase())!.name,
          teamIndex,
          token: makeToken(),
        }))
      : [];

    await db.batch([
      db
        .prepare(
          `INSERT INTO drafts
            (id, admin_token, title, draft_type, team_count, roster_mode, signup_token,
             registration_open, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'collecting', ?, ?)`,
        )
        .bind(
          draftId,
          adminToken,
          title || 'Untitled draft',
          draftType,
          teamCount,
          rosterMode,
          signupToken,
          rosterMode === 'signup' ? 1 : 0,
          now,
          now,
        ),
      ...playerRows.map((player) =>
        db
          .prepare(
            `INSERT INTO players (id, draft_id, name, sort_order, source, created_at)
             VALUES (?, ?, ?, ?, 'import', ?)`,
          )
          .bind(player.id, draftId, player.name, player.sortOrder, now),
      ),
      ...captainRows.map((captain) =>
        db
          .prepare(
            'INSERT INTO captains (id, draft_id, player_id, team_index, token) VALUES (?, ?, ?, ?, ?)',
          )
          .bind(captain.id, draftId, captain.playerId, captain.teamIndex, captain.token),
      ),
      ...questions.map((question, sortOrder) =>
        db
          .prepare(
            `INSERT INTO survey_questions
              (id, draft_id, label, field_type, required, options_json, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            draftId,
            question.label,
            question.fieldType,
            question.required ? 1 : 0,
            question.options.length ? JSON.stringify(question.options) : null,
            sortOrder,
          ),
      ),
    ]);

    return json(
      {
        adminPath: `/manage/${adminToken}`,
        joinPath: signupToken ? `/join/${signupToken}` : null,
        captains: captainRows.map((captain) => ({
          name: captain.name,
          teamIndex: captain.teamIndex,
          path: `/rank/${captain.token}`,
        })),
      },
      { status: 201 },
    );
  } catch (error) {
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
      return [{ label, fieldType, required: raw.required === true, options }];
    })
    .slice(0, 12);
}
