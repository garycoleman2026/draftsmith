import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const drafts = sqliteTable(
  'drafts',
  {
    id: text('id').primaryKey().notNull(),
    adminToken: text('admin_token').notNull(),
    title: text('title').notNull(),
    draftType: text('draft_type').notNull(),
    teamCount: integer('team_count').notNull(),
    rosterMode: text('roster_mode').notNull().default('import'),
    signupToken: text('signup_token'),
    registrationOpen: integer('registration_open', { mode: 'boolean' }).notNull().default(false),
    liveStartedAt: text('live_started_at'),
    status: text('status').notNull().default('collecting'),
    resultJson: text('result_json'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('drafts_admin_token_unique').on(table.adminToken),
    uniqueIndex('drafts_signup_token_unique').on(table.signupToken),
  ],
);

export const players = sqliteTable(
  'players',
  {
    id: text('id').primaryKey().notNull(),
    draftId: text('draft_id').notNull().references(() => drafts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull(),
    source: text('source').notNull().default('import'),
    createdAt: text('created_at'),
  },
  (table) => [index('idx_players_draft_id').on(table.draftId)],
);

export const captains = sqliteTable(
  'captains',
  {
    id: text('id').primaryKey().notNull(),
    draftId: text('draft_id').notNull().references(() => drafts.id, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    teamIndex: integer('team_index').notNull(),
    token: text('token').notNull(),
    submittedAt: text('submitted_at'),
  },
  (table) => [
    uniqueIndex('captains_token_unique').on(table.token),
    uniqueIndex('captains_draft_team_unique').on(table.draftId, table.teamIndex),
    uniqueIndex('captains_draft_player_unique').on(table.draftId, table.playerId),
    index('idx_captains_draft_id').on(table.draftId),
  ],
);

export const rankings = sqliteTable(
  'rankings',
  {
    captainId: text('captain_id').notNull().references(() => captains.id, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull(),
    score: integer('score'),
    avoid: integer('avoid', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.captainId, table.playerId] })],
);

export const surveyQuestions = sqliteTable(
  'survey_questions',
  {
    id: text('id').primaryKey().notNull(),
    draftId: text('draft_id').notNull().references(() => drafts.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    fieldType: text('field_type').notNull(),
    required: integer('required', { mode: 'boolean' }).notNull().default(false),
    optionsJson: text('options_json'),
    sortOrder: integer('sort_order').notNull(),
  },
  (table) => [index('idx_survey_questions_draft_id').on(table.draftId)],
);

export const surveyAnswers = sqliteTable(
  'survey_answers',
  {
    questionId: text('question_id').notNull().references(() => surveyQuestions.id, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    value: text('value').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.questionId, table.playerId] }),
    index('idx_survey_answers_player_id').on(table.playerId),
  ],
);

export const draftConstraints = sqliteTable(
  'draft_constraints',
  {
    id: text('id').primaryKey().notNull(),
    draftId: text('draft_id').notNull().references(() => drafts.id, { onDelete: 'cascade' }),
    constraintType: text('constraint_type').notNull(),
    playerAId: text('player_a_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    playerBId: text('player_b_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_draft_constraints_draft_id').on(table.draftId),
    uniqueIndex('draft_constraints_pair_unique').on(
      table.draftId,
      table.constraintType,
      table.playerAId,
      table.playerBId,
    ),
  ],
);

export const livePicks = sqliteTable(
  'live_picks',
  {
    id: text('id').primaryKey().notNull(),
    draftId: text('draft_id').notNull().references(() => drafts.id, { onDelete: 'cascade' }),
    captainId: text('captain_id').notNull().references(() => captains.id, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    pickNumber: integer('pick_number').notNull(),
    turnNumber: integer('turn_number').notNull(),
    pickedAt: text('picked_at').notNull(),
  },
  (table) => [
    index('idx_live_picks_draft_id').on(table.draftId),
    uniqueIndex('live_picks_player_unique').on(table.draftId, table.playerId),
    uniqueIndex('live_picks_number_unique').on(table.draftId, table.pickNumber),
  ],
);
