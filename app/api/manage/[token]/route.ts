import { getLiveTurn, type LivePickRow } from '../../../../lib/live';
import { ensureSchema, getDatabase, json } from '../../../../lib/db';
import type { CaptainRow } from '../../../../lib/draft';
import type { DraftResult, DraftType, RosterMode, SurveyFieldType } from '../../../../lib/types';

type DraftRow = {
  id: string;
  title: string;
  draft_type: DraftType;
  team_count: number;
  roster_mode: RosterMode;
  signup_token: string | null;
  registration_open: number;
  live_started_at: string | null;
  status: string;
  result_json: string | null;
  created_at: string;
};
type PlayerRow = {
  id: string;
  name: string;
  sort_order: number;
  source: string;
  created_at: string | null;
};
type CaptainQueryRow = CaptainRow & {
  token: string;
  submitted_at: string | null;
};
type QuestionRow = {
  id: string;
  label: string;
  field_type: SurveyFieldType;
  required: number;
  options_json: string | null;
  sort_order: number;
};
type AnswerRow = { player_id: string; question_id: string; label: string; value: string };
type ConstraintQueryRow = {
  id: string;
  constraint_type: 'together' | 'apart';
  player_a_id: string;
  player_a_name: string;
  player_b_id: string;
  player_b_name: string;
};
type PickQueryRow = LivePickRow & { player_name: string };

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const db = getDatabase();
    const draft = await db
      .prepare(
        `SELECT id, title, draft_type, team_count, roster_mode, signup_token,
                registration_open, live_started_at, status, result_json, created_at
         FROM drafts WHERE admin_token = ?`,
      )
      .bind(token)
      .first<DraftRow>();
    if (!draft) return json({ error: 'This organizer link is not valid.' }, { status: 404 });

    const [playerResult, captainResult, questionResult, answerResult, constraintResult, pickResult] =
      await Promise.all([
        db
          .prepare(
            `SELECT id, name, sort_order, source, created_at
             FROM players WHERE draft_id = ? ORDER BY sort_order`,
          )
          .bind(draft.id)
          .all<PlayerRow>(),
        db
          .prepare(
            `SELECT c.id, c.player_id, p.name, c.team_index, c.token, c.submitted_at
             FROM captains c
             JOIN players p ON p.id = c.player_id
             WHERE c.draft_id = ? ORDER BY c.team_index`,
          )
          .bind(draft.id)
          .all<CaptainQueryRow>(),
        db
          .prepare(
            `SELECT id, label, field_type, required, options_json, sort_order
             FROM survey_questions WHERE draft_id = ? ORDER BY sort_order`,
          )
          .bind(draft.id)
          .all<QuestionRow>(),
        db
          .prepare(
            `SELECT sa.player_id, sa.question_id, sq.label, sa.value
             FROM survey_answers sa
             JOIN survey_questions sq ON sq.id = sa.question_id
             WHERE sq.draft_id = ? ORDER BY sq.sort_order`,
          )
          .bind(draft.id)
          .all<AnswerRow>(),
        db
          .prepare(
            `SELECT dc.id, dc.constraint_type, dc.player_a_id, pa.name AS player_a_name,
                    dc.player_b_id, pb.name AS player_b_name
             FROM draft_constraints dc
             JOIN players pa ON pa.id = dc.player_a_id
             JOIN players pb ON pb.id = dc.player_b_id
             WHERE dc.draft_id = ? ORDER BY dc.created_at`,
          )
          .bind(draft.id)
          .all<ConstraintQueryRow>(),
        db
          .prepare(
            `SELECT lp.captain_id, lp.player_id, lp.pick_number, lp.turn_number,
                    lp.picked_at, p.name AS player_name
             FROM live_picks lp JOIN players p ON p.id = lp.player_id
             WHERE lp.draft_id = ? ORDER BY lp.pick_number`,
          )
          .bind(draft.id)
          .all<PickQueryRow>(),
      ]);

    const answersByPlayer = new Map<string, AnswerRow[]>();
    for (const answer of answerResult.results) {
      const answers = answersByPlayer.get(answer.player_id) ?? [];
      answers.push(answer);
      answersByPlayer.set(answer.player_id, answers);
    }

    let result: DraftResult | null = null;
    if (draft.result_json) {
      try {
        result = JSON.parse(draft.result_json) as DraftResult;
      } catch {
        result = null;
      }
    }

    const captains = captainResult.results;
    const picks = pickResult.results;
    const currentTurn = draft.live_started_at
      ? getLiveTurn({ totalPlayers: playerResult.results.length, captains, picks })
      : null;
    const captainPlayerIds = new Set(captains.map((captain) => captain.player_id));
    const pickedPlayerIds = new Set(picks.map((pick) => pick.player_id));

    return json({
      draft: {
        title: draft.title,
        draftType: draft.draft_type,
        teamCount: draft.team_count,
        rosterMode: draft.roster_mode,
        status: draft.status,
        createdAt: draft.created_at,
      },
      joinPath: draft.signup_token ? `/join/${draft.signup_token}` : null,
      registrationOpen: Boolean(draft.registration_open),
      surveyQuestions: questionResult.results.map((question) => ({
        id: question.id,
        label: question.label,
        fieldType: question.field_type,
        required: Boolean(question.required),
        options: parseOptions(question.options_json),
      })),
      players: playerResult.results.map((player) => ({
        ...player,
        answers: (answersByPlayer.get(player.id) ?? []).map((answer) => ({
          questionId: answer.question_id,
          label: answer.label,
          value: answer.value,
        })),
      })),
      captains: captains.map((captain) => ({
        id: captain.id,
        playerId: captain.player_id,
        name: captain.name,
        teamIndex: captain.team_index,
        path: `/rank/${captain.token}`,
        submittedAt: captain.submitted_at,
      })),
      constraints: constraintResult.results.map((constraint) => ({
        id: constraint.id,
        type: constraint.constraint_type,
        playerA: { id: constraint.player_a_id, name: constraint.player_a_name },
        playerB: { id: constraint.player_b_id, name: constraint.player_b_name },
      })),
      live: draft.draft_type === 'live' ? {
        started: Boolean(draft.live_started_at),
        startedAt: draft.live_started_at,
        picks: picks.map((pick) => ({
          captainId: pick.captain_id,
          playerId: pick.player_id,
          playerName: pick.player_name,
          pickNumber: pick.pick_number,
          turnNumber: pick.turn_number,
          pickedAt: pick.picked_at,
        })),
        availablePlayerIds: playerResult.results
          .filter((player) => !captainPlayerIds.has(player.id) && !pickedPlayerIds.has(player.id))
          .map((player) => player.id),
        currentCaptain: currentTurn ? {
          id: currentTurn.captain.id,
          name: currentTurn.captain.name,
          teamIndex: currentTurn.captain.team_index,
          turnNumber: currentTurn.turnNumber,
        } : null,
      } : null,
      result,
    });
  } catch (error) {
    console.error('load organizer failed', error);
    return json({ error: 'The draft could not be loaded.' }, { status: 500 });
  }
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
