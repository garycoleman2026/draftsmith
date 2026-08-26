import { resolveManagerDraftId } from '../../../../lib/access-tokens';
import { getLiveTurn, type LivePickRow, type LiveTurnActionRow } from '../../../../lib/live';
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
  registration_capacity: number;
  signup_approval_mode: number;
  registration_deadline: string | null;
  ranking_deadline: string | null;
  answers_visibility: string;
  balance_preset: string;
  balance_weights_json: string | null;
  live_started_at: string | null;
  live_order: 'snake' | 'linear' | 'random' | 'third_round_reversal';
  live_pick_seconds: number;
  live_auto_pick: number;
  live_paused_at: string | null;
  live_turn_started_at: string | null;
  live_revision: number;
  clan_id: string | null;
  public_slug: string | null;
  archived_at: string | null;
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
  signup_status: string;
  withdrawn_at: string | null;
};
type CaptainQueryRow = CaptainRow & {
  token: string;
  submitted_at: string | null;
  ranking_revision: number;
  rankings_frozen_at: string | null;
};
type QuestionRow = {
  id: string;
  label: string;
  field_type: SurveyFieldType;
  required: number;
  visibility: 'organizer' | 'captains' | 'public';
  balance_metric: string | null;
  balance_weight: number;
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
  enforcement: 'hard' | 'soft';
  penalty: number;
};
type PickQueryRow = LivePickRow & { player_name: string };

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const draftId = await resolveManagerDraftId(token);
    if (!draftId) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    const db = getDatabase();
    const draft = await db
      .prepare(
        `SELECT id, title, draft_type, team_count, roster_mode, signup_token,
                registration_open, registration_capacity, signup_approval_mode,
                registration_deadline, ranking_deadline, answers_visibility,
                balance_preset, balance_weights_json, live_started_at, live_order,
                live_pick_seconds, live_auto_pick, live_paused_at, live_turn_started_at,
                live_revision, status, result_json, created_at, clan_id, public_slug, archived_at
         FROM drafts WHERE id = ?`,
      )
      .bind(draftId)
      .first<DraftRow>();
    if (!draft) return json({ error: 'This organizer link is not valid.' }, { status: 404 });

    const [playerResult, captainResult, questionResult, answerResult, constraintResult, pickResult, actionResult, runResult, auditResult] =
      await Promise.all([
        db
          .prepare(
            `SELECT id, name, sort_order, source, created_at, signup_status, withdrawn_at
             FROM players WHERE draft_id = ? ORDER BY sort_order`,
          )
          .bind(draft.id)
          .all<PlayerRow>(),
        db
          .prepare(
            `SELECT c.id, c.player_id, p.name, c.team_index, c.token, c.submitted_at,
                    c.ranking_revision, c.rankings_frozen_at
             FROM captains c
             JOIN players p ON p.id = c.player_id
             WHERE c.draft_id = ? ORDER BY c.team_index`,
          )
          .bind(draft.id)
          .all<CaptainQueryRow>(),
        db
          .prepare(
            `SELECT id, label, field_type, required, visibility, balance_metric,
                    balance_weight, options_json, sort_order
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
            `SELECT dc.id, dc.constraint_type, dc.enforcement, dc.penalty,
                    dc.player_a_id, pa.name AS player_a_name,
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
        db
          .prepare(
            `SELECT captain_id, turn_number, action, player_ids_json, created_at
             FROM live_turn_actions WHERE draft_id = ? ORDER BY turn_number`,
          )
          .bind(draft.id)
          .all<LiveTurnActionRow>(),
        db
          .prepare(
            `SELECT id, run_number, source, seed, fairness_json, created_at
             FROM draft_runs WHERE draft_id = ? ORDER BY run_number DESC LIMIT 20`,
          )
          .bind(draft.id)
          .all<{ id: string; run_number: number; source: string; seed: string; fairness_json: string; created_at: string }>(),
        db
          .prepare(
            `SELECT event_type, actor_type, metadata_json, created_at
             FROM audit_events WHERE draft_id = ? ORDER BY created_at DESC LIMIT 30`,
          )
          .bind(draft.id)
          .all<{ event_type: string; actor_type: string; metadata_json: string | null; created_at: string }>(),
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

    const activePlayers = playerResult.results.filter((player) => player.signup_status === 'approved' && !player.withdrawn_at);
    const activePlayerIds = new Set(activePlayers.map((player) => player.id));
    const captains = captainResult.results.filter((captain) => activePlayerIds.has(captain.player_id));
    const picks = pickResult.results;
    const currentTurn = draft.live_started_at
      ? getLiveTurn({
          totalPlayers: activePlayers.length,
          captains,
          picks,
          actions: actionResult.results,
          order: draft.live_order,
          randomSeed: draft.id,
        })
      : null;
    const captainPlayerIds = new Set(captains.map((captain) => captain.player_id));
    const pickedPlayerIds = new Set(picks.map((pick) => pick.player_id));

    return json({
      draft: {
        id: draft.id,
        title: draft.title,
        draftType: draft.draft_type,
        teamCount: draft.team_count,
        rosterMode: draft.roster_mode,
        status: draft.status,
        registrationCapacity: draft.registration_capacity,
        signupApprovalMode: Boolean(draft.signup_approval_mode),
        registrationDeadline: draft.registration_deadline,
        rankingDeadline: draft.ranking_deadline,
        answersVisibility: draft.answers_visibility,
        balancePreset: draft.balance_preset,
        balanceWeights: parseRecord(draft.balance_weights_json),
        publicSlug: draft.public_slug,
        publicPath: draft.public_slug ? `/event/${draft.public_slug}` : null,
        clanId: draft.clan_id,
        archivedAt: draft.archived_at,
        createdAt: draft.created_at,
      },
      joinPath: draft.roster_mode === 'signup' && draft.public_slug ? `/join/${draft.public_slug}` : null,
      registrationOpen: Boolean(draft.registration_open),
      surveyQuestions: questionResult.results.map((question) => ({
        id: question.id,
        label: question.label,
        fieldType: question.field_type,
        required: Boolean(question.required),
        visibility: question.visibility,
        balanceMetric: question.balance_metric,
        balanceWeight: question.balance_weight,
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
        path: captain.token && !captain.token.startsWith('retired:') ? `/rank/${captain.token}` : null,
        submittedAt: captain.submitted_at,
        rankingRevision: captain.ranking_revision,
        rankingsFrozenAt: captain.rankings_frozen_at,
      })),
      constraints: constraintResult.results.map((constraint) => ({
        id: constraint.id,
        type: constraint.constraint_type,
        enforcement: constraint.enforcement,
        penalty: constraint.penalty,
        playerA: { id: constraint.player_a_id, name: constraint.player_a_name },
        playerB: { id: constraint.player_b_id, name: constraint.player_b_name },
      })),
      live: draft.draft_type === 'live' ? {
        started: Boolean(draft.live_started_at),
        startedAt: draft.live_started_at,
        order: draft.live_order,
        pickSeconds: draft.live_pick_seconds,
        autoPick: Boolean(draft.live_auto_pick),
        paused: Boolean(draft.live_paused_at),
        pausedAt: draft.live_paused_at,
        turnStartedAt: draft.live_turn_started_at,
        revision: draft.live_revision,
        picks: picks.map((pick) => ({
          captainId: pick.captain_id,
          playerId: pick.player_id,
          playerName: pick.player_name,
          pickNumber: pick.pick_number,
          turnNumber: pick.turn_number,
          pickedAt: pick.picked_at,
        })),
        actions: actionResult.results,
        availablePlayerIds: activePlayers
          .filter((player) => !captainPlayerIds.has(player.id) && !pickedPlayerIds.has(player.id))
          .map((player) => player.id),
        currentCaptain: currentTurn ? {
          id: currentTurn.captain.id,
          name: currentTurn.captain.name,
          teamIndex: currentTurn.captain.team_index,
          turnNumber: currentTurn.turnNumber,
        } : null,
      } : null,
      runs: runResult.results.map((run) => ({ ...run, fairness: parseRecord(run.fairness_json) })),
      audit: auditResult.results.map((event) => ({ ...event, metadata: parseRecord(event.metadata_json) })),
      result,
    });
  } catch (error) {
    console.error('load organizer failed', error);
    return json({ error: 'The draft could not be loaded.' }, { status: 500 });
  }
}

function parseRecord(value: string | null) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
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
