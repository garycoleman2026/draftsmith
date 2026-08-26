import { createHashedCredential } from './access-tokens';
import { getDatabase } from './db';
import { uniqueDraftSlug } from './slugs';

export type EventConfiguration = {
  draftType: string; teamCount: number; registrationCapacity: number; signupApprovalMode: boolean;
  answersVisibility: string; balancePreset: string; balanceWeights: Record<string, number>;
  liveOrder: string; livePickSeconds: number; liveAutoPick: boolean;
  surveyQuestions: Array<{
    label: string; fieldType: string; required: boolean; visibility: string;
    balanceMetric: string | null; balanceWeight: number; options: string[];
  }>;
};

export async function configurationFromDraft(draftId: string): Promise<EventConfiguration | null> {
  const db = getDatabase();
  const [draft, questions] = await Promise.all([
    db.prepare(`SELECT draft_type, team_count, registration_capacity, signup_approval_mode,
      answers_visibility, balance_preset, balance_weights_json, live_order, live_pick_seconds, live_auto_pick
      FROM drafts WHERE id = ?`).bind(draftId).first<Record<string, string | number | null>>(),
    db.prepare(`SELECT label, field_type, required, visibility, balance_metric, balance_weight,
      options_json FROM survey_questions WHERE draft_id = ? ORDER BY sort_order`).bind(draftId).all<Record<string, string | number | null>>(),
  ]);
  if (!draft) return null;
  return {
    draftType: String(draft.draft_type), teamCount: Number(draft.team_count),
    registrationCapacity: Number(draft.registration_capacity), signupApprovalMode: Boolean(draft.signup_approval_mode),
    answersVisibility: String(draft.answers_visibility), balancePreset: String(draft.balance_preset),
    balanceWeights: parseObject(draft.balance_weights_json), liveOrder: String(draft.live_order),
    livePickSeconds: Number(draft.live_pick_seconds), liveAutoPick: Boolean(draft.live_auto_pick),
    surveyQuestions: questions.results.map((question) => ({
      label: String(question.label), fieldType: String(question.field_type), required: Boolean(question.required),
      visibility: String(question.visibility), balanceMetric: question.balance_metric ? String(question.balance_metric) : null,
      balanceWeight: Number(question.balance_weight), options: parseArray(question.options_json),
    })),
  };
}

export async function createEventFromConfiguration(input: {
  configuration: EventConfiguration; title: string; clanId: string; userId: string;
}) {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const manager = await createHashedCredential();
  const signup = await createHashedCredential();
  const slug = await uniqueDraftSlug(input.title);
  const now = new Date().toISOString();
  const config = input.configuration;
  await db.batch([
    db.prepare(`INSERT INTO drafts
      (id, admin_token, admin_token_hash, title, public_slug, clan_id, owner_user_id,
       draft_type, team_count, roster_mode, signup_token, signup_token_hash,
       registration_open, registration_capacity, signup_approval_mode, answers_visibility,
       balance_preset, balance_weights_json, live_order, live_pick_seconds, live_auto_pick,
       status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'signup', ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'registration', ?, ?)`)
      .bind(id, manager.retired, manager.hash, input.title.slice(0, 80), slug, input.clanId, input.userId,
        config.draftType, Math.max(2, Math.min(8, config.teamCount)), signup.retired, signup.hash,
        Math.max(2, Math.min(120, config.registrationCapacity)), config.signupApprovalMode ? 1 : 0,
        config.answersVisibility, config.balancePreset, JSON.stringify(config.balanceWeights), config.liveOrder,
        Math.max(0, Math.min(3600, config.livePickSeconds)), config.liveAutoPick ? 1 : 0, now, now),
    ...config.surveyQuestions.slice(0, 12).map((question, index) => db.prepare(`INSERT INTO survey_questions
      (id, draft_id, label, field_type, required, visibility, balance_metric, balance_weight, options_json, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), id, question.label.slice(0, 80), question.fieldType, question.required ? 1 : 0,
        question.visibility, question.balanceMetric, question.balanceWeight, JSON.stringify(question.options), index)),
  ]);
  return { id, adminPath: `/manage/${manager.token}`, joinPath: `/join/${slug}` };
}

function parseObject(value: unknown) { try { const parsed = JSON.parse(String(value || '{}')) as unknown; return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, number> : {}; } catch { return {}; } }
function parseArray(value: unknown) { try { const parsed = JSON.parse(String(value || '[]')) as unknown; return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []; } catch { return []; } }
