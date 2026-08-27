import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey().notNull(),
    discordId: text('discord_id'),
    email: text('email'),
    username: text('username').notNull(),
    displayName: text('display_name'),
    avatarHash: text('avatar_hash'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('users_discord_id_unique').on(table.discordId)],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
    lastSeenAt: text('last_seen_at').notNull(),
    revokedAt: text('revoked_at'),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('idx_sessions_user_id').on(table.userId),
    index('idx_sessions_expires_at').on(table.expiresAt),
  ],
);

export const oauthStates = sqliteTable(
  'oauth_states',
  {
    id: text('id').primaryKey().notNull(),
    stateHash: text('state_hash').notNull(),
    verifier: text('verifier').notNull(),
    returnTo: text('return_to').notNull().default('/dashboard'),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('oauth_states_state_hash_unique').on(table.stateHash),
    index('idx_oauth_states_expires_at').on(table.expiresAt),
  ],
);

export const clans = sqliteTable(
  'clans',
  {
    id: text('id').primaryKey().notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    createdByUserId: text('created_by_user_id').notNull().references(() => users.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('clans_slug_unique').on(table.slug)],
);

export const clanMemberships = sqliteTable(
  'clan_memberships',
  {
    clanId: text('clan_id').notNull().references(() => clans.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.clanId, table.userId] }),
    index('idx_clan_memberships_user_id').on(table.userId),
  ],
);

export const drafts = sqliteTable(
  'drafts',
  {
    id: text('id').primaryKey().notNull(),
    adminToken: text('admin_token').notNull(),
    adminTokenHash: text('admin_token_hash'),
    title: text('title').notNull(),
    publicSlug: text('public_slug'),
    clanId: text('clan_id').references(() => clans.id, { onDelete: 'set null' }),
    ownerUserId: text('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    draftType: text('draft_type').notNull(),
    teamCount: integer('team_count').notNull(),
    rosterMode: text('roster_mode').notNull().default('import'),
    signupToken: text('signup_token'),
    signupTokenHash: text('signup_token_hash'),
    registrationOpen: integer('registration_open', { mode: 'boolean' }).notNull().default(false),
    registrationCapacity: integer('registration_capacity').notNull().default(120),
    signupApprovalMode: integer('signup_approval_mode', { mode: 'boolean' }).notNull().default(false),
    registrationDeadline: text('registration_deadline'),
    rankingDeadline: text('ranking_deadline'),
    answersVisibility: text('answers_visibility').notNull().default('captains'),
    balancePreset: text('balance_preset').notNull().default('consensus'),
    balanceWeightsJson: text('balance_weights_json'),
    liveStartedAt: text('live_started_at'),
    liveOrder: text('live_order').notNull().default('snake'),
    livePickSeconds: integer('live_pick_seconds').notNull().default(0),
    liveAutoPick: integer('live_auto_pick', { mode: 'boolean' }).notNull().default(false),
    livePausedAt: text('live_paused_at'),
    liveTurnStartedAt: text('live_turn_started_at'),
    liveRevision: integer('live_revision').notNull().default(0),
    status: text('status').notNull().default('registration'),
    resultJson: text('result_json'),
    archivedAt: text('archived_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('drafts_admin_token_unique').on(table.adminToken),
    uniqueIndex('drafts_admin_token_hash_unique').on(table.adminTokenHash),
    uniqueIndex('drafts_signup_token_unique').on(table.signupToken),
    uniqueIndex('drafts_signup_token_hash_unique').on(table.signupTokenHash),
    uniqueIndex('drafts_public_slug_unique').on(table.publicSlug),
    index('idx_drafts_clan_id').on(table.clanId),
    index('idx_drafts_owner_user_id').on(table.ownerUserId),
    index('idx_drafts_status').on(table.status),
  ],
);

export const draftAccessTokens = sqliteTable(
  'draft_access_tokens',
  {
    id: text('id').primaryKey().notNull(),
    draftId: text('draft_id').notNull().references(() => drafts.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    purpose: text('purpose').notNull().default('manage'),
    createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    expiresAt: text('expires_at'),
    revokedAt: text('revoked_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('draft_access_tokens_hash_unique').on(table.tokenHash),
    index('idx_draft_access_tokens_draft_id').on(table.draftId),
  ],
);

export const players = sqliteTable(
  'players',
  {
    id: text('id').primaryKey().notNull(),
    draftId: text('draft_id').notNull().references(() => drafts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    normalizedName: text('normalized_name'),
    sortOrder: integer('sort_order').notNull(),
    source: text('source').notNull().default('import'),
    signupStatus: text('signup_status').notNull().default('approved'),
    participantTokenHash: text('participant_token_hash'),
    createdAt: text('created_at'),
    updatedAt: text('updated_at'),
    withdrawnAt: text('withdrawn_at'),
  },
  (table) => [
    index('idx_players_draft_id').on(table.draftId),
    uniqueIndex('players_participant_token_hash_unique').on(table.participantTokenHash),
    uniqueIndex('players_draft_normalized_unique').on(table.draftId, table.normalizedName),
  ],
);

export const captains = sqliteTable(
  'captains',
  {
    id: text('id').primaryKey().notNull(),
    draftId: text('draft_id').notNull().references(() => drafts.id, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    teamIndex: integer('team_index').notNull(),
    token: text('token').notNull(),
    tokenHash: text('token_hash'),
    submittedAt: text('submitted_at'),
    rankingRevision: integer('ranking_revision').notNull().default(0),
    rankingsFrozenAt: text('rankings_frozen_at'),
  },
  (table) => [
    uniqueIndex('captains_token_unique').on(table.token),
    uniqueIndex('captains_token_hash_unique').on(table.tokenHash),
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

export const rankingRevisions = sqliteTable(
  'ranking_revisions',
  {
    id: text('id').primaryKey().notNull(),
    captainId: text('captain_id').notNull().references(() => captains.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    rankingsJson: text('rankings_json').notNull(),
    submittedAt: text('submitted_at').notNull(),
  },
  (table) => [
    uniqueIndex('ranking_revisions_captain_revision_unique').on(table.captainId, table.revision),
    index('idx_ranking_revisions_captain_id').on(table.captainId),
  ],
);

export const surveyQuestions = sqliteTable(
  'survey_questions',
  {
    id: text('id').primaryKey().notNull(),
    draftId: text('draft_id').notNull().references(() => drafts.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    fieldType: text('field_type').notNull(),
    required: integer('required', { mode: 'boolean' }).notNull().default(false),
    visibility: text('visibility').notNull().default('captains'),
    balanceMetric: text('balance_metric'),
    balanceWeight: integer('balance_weight').notNull().default(0),
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
    enforcement: text('enforcement').notNull().default('hard'),
    penalty: integer('penalty').notNull().default(100),
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

export const liveTurnActions = sqliteTable(
  'live_turn_actions',
  {
    id: text('id').primaryKey().notNull(),
    draftId: text('draft_id').notNull().references(() => drafts.id, { onDelete: 'cascade' }),
    captainId: text('captain_id').notNull().references(() => captains.id, { onDelete: 'cascade' }),
    turnNumber: integer('turn_number').notNull(),
    action: text('action').notNull(),
    playerIdsJson: text('player_ids_json'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('live_turn_actions_draft_turn_unique').on(table.draftId, table.turnNumber),
    index('idx_live_turn_actions_draft_id').on(table.draftId),
  ],
);

export const draftRuns = sqliteTable(
  'draft_runs',
  {
    id: text('id').primaryKey().notNull(),
    draftId: text('draft_id').notNull().references(() => drafts.id, { onDelete: 'cascade' }),
    runNumber: integer('run_number').notNull(),
    source: text('source').notNull().default('generated'),
    seed: text('seed').notNull(),
    configurationJson: text('configuration_json').notNull(),
    resultJson: text('result_json').notNull(),
    fairnessJson: text('fairness_json').notNull(),
    createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('draft_runs_draft_number_unique').on(table.draftId, table.runNumber),
    index('idx_draft_runs_draft_id').on(table.draftId),
  ],
);

export const eventTemplates = sqliteTable(
  'event_templates',
  {
    id: text('id').primaryKey().notNull(),
    clanId: text('clan_id').notNull().references(() => clans.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    configurationJson: text('configuration_json').notNull(),
    createdByUserId: text('created_by_user_id').notNull().references(() => users.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('idx_event_templates_clan_id').on(table.clanId)],
);

export const playerInsightCache = sqliteTable(
  'player_insight_cache',
  {
    normalizedName: text('normalized_name').primaryKey().notNull(),
    displayName: text('display_name').notNull(),
    payloadJson: text('payload_json').notNull(),
    fetchedAt: text('fetched_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    staleAt: text('stale_at').notNull(),
    failureCount: integer('failure_count').notNull().default(0),
    lastError: text('last_error'),
  },
  (table) => [index('idx_player_insight_cache_expires_at').on(table.expiresAt)],
);

export const rateLimits = sqliteTable(
  'rate_limits',
  {
    key: text('key').primaryKey().notNull(),
    count: integer('count').notNull().default(0),
    windowStartedAt: text('window_started_at').notNull(),
    expiresAt: text('expires_at').notNull(),
  },
  (table) => [index('idx_rate_limits_expires_at').on(table.expiresAt)],
);

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text('id').primaryKey().notNull(),
    draftId: text('draft_id').references(() => drafts.id, { onDelete: 'cascade' }),
    clanId: text('clan_id').references(() => clans.id, { onDelete: 'cascade' }),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorType: text('actor_type').notNull(),
    actorReference: text('actor_reference'),
    eventType: text('event_type').notNull(),
    metadataJson: text('metadata_json'),
    requestId: text('request_id'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_audit_events_draft_id').on(table.draftId),
    index('idx_audit_events_clan_id').on(table.clanId),
    index('idx_audit_events_created_at').on(table.createdAt),
  ],
);

export const webhookIntegrations = sqliteTable(
  'webhook_integrations',
  {
    id: text('id').primaryKey().notNull(),
    draftId: text('draft_id').references(() => drafts.id, { onDelete: 'cascade' }),
    clanId: text('clan_id').references(() => clans.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().default('discord'),
    encryptedUrl: text('encrypted_url').notNull(),
    enabledEventsJson: text('enabled_events_json').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_webhook_integrations_draft_id').on(table.draftId),
    index('idx_webhook_integrations_clan_id').on(table.clanId),
  ],
);

export const webhookDeliveries = sqliteTable(
  'webhook_deliveries',
  {
    id: text('id').primaryKey().notNull(),
    integrationId: text('integration_id').notNull().references(() => webhookIntegrations.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    payloadJson: text('payload_json').notNull(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    responseCode: integer('response_code'),
    lastError: text('last_error'),
    createdAt: text('created_at').notNull(),
    deliveredAt: text('delivered_at'),
  },
  (table) => [
    index('idx_webhook_deliveries_integration_id').on(table.integrationId),
    index('idx_webhook_deliveries_status').on(table.status),
  ],
);

export const bingoEvents = sqliteTable(
  'bingo_events',
  {
    id: text('id').primaryKey().notNull(),
    draftId: text('draft_id').notNull().references(() => drafts.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    publicSlug: text('public_slug').notNull(),
    mode: text('mode').notNull().default('points'),
    boardScope: text('board_scope').notNull().default('shared'),
    gridSize: integer('grid_size').notNull().default(5),
    status: text('status').notNull().default('draft'),
    winCondition: text('win_condition').notNull().default('points'),
    targetValue: integer('target_value').notNull().default(0),
    requiresReview: integer('requires_review', { mode: 'boolean' }).notNull().default(true),
    publicSpectator: integer('public_spectator', { mode: 'boolean' }).notNull().default(true),
    spectatorDelaySeconds: integer('spectator_delay_seconds').notNull().default(0),
    startAt: text('start_at'),
    endAt: text('end_at'),
    startedAt: text('started_at'),
    endedAt: text('ended_at'),
    baselineStatus: text('baseline_status').notNull().default('idle'),
    revision: integer('revision').notNull().default(0),
    rulesJson: text('rules_json'),
    createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('bingo_events_public_slug_unique').on(table.publicSlug),
    index('idx_bingo_events_draft_id').on(table.draftId),
    index('idx_bingo_events_status').on(table.status),
  ],
);

export const bingoTeams = sqliteTable(
  'bingo_teams',
  {
    id: text('id').primaryKey().notNull(),
    eventId: text('event_id').notNull().references(() => bingoEvents.id, { onDelete: 'cascade' }),
    sourceTeamIndex: integer('source_team_index').notNull(),
    name: text('name').notNull(),
    color: text('color').notNull(),
    emblem: text('emblem').notNull(),
    accessTokenHash: text('access_token_hash').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('bingo_teams_event_index_unique').on(table.eventId, table.sourceTeamIndex),
    uniqueIndex('bingo_teams_access_hash_unique').on(table.accessTokenHash),
    index('idx_bingo_teams_event_id').on(table.eventId),
  ],
);

export const bingoTeamMembers = sqliteTable(
  'bingo_team_members',
  {
    id: text('id').primaryKey().notNull(),
    teamId: text('team_id').notNull().references(() => bingoTeams.id, { onDelete: 'cascade' }),
    playerId: text('player_id').references(() => players.id, { onDelete: 'set null' }),
    displayName: text('display_name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    role: text('role').notNull().default('member'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('bingo_members_team_name_unique').on(table.teamId, table.normalizedName),
    index('idx_bingo_members_team_id').on(table.teamId),
    index('idx_bingo_members_player_id').on(table.playerId),
  ],
);

export const bingoTasks = sqliteTable(
  'bingo_tasks',
  {
    id: text('id').primaryKey().notNull(),
    eventId: text('event_id').notNull().references(() => bingoEvents.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    points: integer('points').notNull().default(0),
    category: text('category').notNull().default('General'),
    difficulty: text('difficulty').notNull().default('medium'),
    verificationMode: text('verification_mode').notNull().default('manual'),
    repeatable: integer('repeatable', { mode: 'boolean' }).notNull().default(false),
    maxCompletions: integer('max_completions').notNull().default(1),
    hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
    freeSpace: integer('free_space', { mode: 'boolean' }).notNull().default(false),
    iconKey: text('icon_key').notNull().default('scroll'),
    ruleJson: text('rule_json').notNull().default('{}'),
    sortOrder: integer('sort_order').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('bingo_tasks_event_order_unique').on(table.eventId, table.sortOrder),
    index('idx_bingo_tasks_event_id').on(table.eventId),
  ],
);

export const bingoEvidenceUploads = sqliteTable(
  'bingo_evidence_uploads',
  {
    id: text('id').primaryKey().notNull(),
    eventId: text('event_id').notNull().references(() => bingoEvents.id, { onDelete: 'cascade' }),
    teamId: text('team_id').notNull().references(() => bingoTeams.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').notNull(),
    filename: text('filename').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    createdAt: text('created_at').notNull(),
    consumedAt: text('consumed_at'),
  },
  (table) => [
    uniqueIndex('bingo_evidence_object_key_unique').on(table.objectKey),
    index('idx_bingo_evidence_event_team').on(table.eventId, table.teamId),
  ],
);

export const bingoVerificationEvents = sqliteTable(
  'bingo_verification_events',
  {
    id: text('id').primaryKey().notNull(),
    eventId: text('event_id').notNull().references(() => bingoEvents.id, { onDelete: 'cascade' }),
    teamId: text('team_id').notNull().references(() => bingoTeams.id, { onDelete: 'cascade' }),
    memberId: text('member_id').references(() => bingoTeamMembers.id, { onDelete: 'set null' }),
    idempotencyKey: text('idempotency_key').notNull(),
    source: text('source').notNull(),
    signalType: text('signal_type').notNull(),
    payloadJson: text('payload_json').notNull(),
    observedAt: text('observed_at').notNull(),
    receivedAt: text('received_at').notNull(),
  },
  (table) => [
    uniqueIndex('bingo_verification_events_idempotency_unique').on(table.eventId, table.teamId, table.source, table.idempotencyKey),
    index('idx_bingo_verification_events_event_observed').on(table.eventId, table.observedAt),
    index('idx_bingo_verification_events_team_received').on(table.teamId, table.receivedAt),
  ],
);

export const bingoVerificationCandidates = sqliteTable(
  'bingo_verification_candidates',
  {
    id: text('id').primaryKey().notNull(),
    eventId: text('event_id').notNull().references(() => bingoEvents.id, { onDelete: 'cascade' }),
    taskId: text('task_id').notNull().references(() => bingoTasks.id, { onDelete: 'cascade' }),
    teamId: text('team_id').notNull().references(() => bingoTeams.id, { onDelete: 'cascade' }),
    memberId: text('member_id').references(() => bingoTeamMembers.id, { onDelete: 'set null' }),
    sourceSummary: text('source_summary').notNull(),
    confidence: text('confidence').notNull().default('reported'),
    status: text('status').notNull().default('progress'),
    progressValue: real('progress_value').notNull().default(0),
    targetValue: real('target_value').notNull().default(1),
    summary: text('summary').notNull(),
    detailsJson: text('details_json').notNull().default('{}'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    resolvedAt: text('resolved_at'),
  },
  (table) => [
    uniqueIndex('bingo_verification_candidates_task_team_unique').on(table.eventId, table.taskId, table.teamId),
    index('idx_bingo_verification_candidates_event_status').on(table.eventId, table.status),
    index('idx_bingo_verification_candidates_team_status').on(table.teamId, table.status),
  ],
);

export const bingoVerificationMatches = sqliteTable(
  'bingo_verification_matches',
  {
    id: text('id').primaryKey().notNull(),
    candidateId: text('candidate_id').notNull().references(() => bingoVerificationCandidates.id, { onDelete: 'cascade' }),
    verificationEventId: text('verification_event_id').notNull().references(() => bingoVerificationEvents.id, { onDelete: 'cascade' }),
    taskId: text('task_id').notNull().references(() => bingoTasks.id, { onDelete: 'cascade' }),
    teamId: text('team_id').notNull().references(() => bingoTeams.id, { onDelete: 'cascade' }),
    memberId: text('member_id').references(() => bingoTeamMembers.id, { onDelete: 'set null' }),
    value: real('value').notNull(),
    progressKind: text('progress_kind').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('bingo_verification_matches_event_task_unique').on(table.verificationEventId, table.taskId),
    index('idx_bingo_verification_matches_candidate').on(table.candidateId),
  ],
);

export const bingoClaims = sqliteTable(
  'bingo_claims',
  {
    id: text('id').primaryKey().notNull(),
    eventId: text('event_id').notNull().references(() => bingoEvents.id, { onDelete: 'cascade' }),
    taskId: text('task_id').notNull().references(() => bingoTasks.id, { onDelete: 'cascade' }),
    teamId: text('team_id').notNull().references(() => bingoTeams.id, { onDelete: 'cascade' }),
    memberId: text('member_id').references(() => bingoTeamMembers.id, { onDelete: 'set null' }),
    claimedByName: text('claimed_by_name').notNull(),
    note: text('note').notNull().default(''),
    evidenceUrl: text('evidence_url'),
    evidenceUploadId: text('evidence_upload_id').references(() => bingoEvidenceUploads.id, { onDelete: 'set null' }),
    verificationSource: text('verification_source').notNull().default('manual'),
    verificationConfidence: text('verification_confidence').notNull().default('unverified'),
    verificationCandidateId: text('verification_candidate_id').references(() => bingoVerificationCandidates.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('pending'),
    reviewNote: text('review_note'),
    scoreAwarded: integer('score_awarded').notNull().default(0),
    submittedAt: text('submitted_at').notNull(),
    reviewedAt: text('reviewed_at'),
    approvedAt: text('approved_at'),
  },
  (table) => [
    uniqueIndex('bingo_claims_verification_candidate_unique').on(table.verificationCandidateId),
    index('idx_bingo_claims_event_status').on(table.eventId, table.status),
    index('idx_bingo_claims_task_team').on(table.taskId, table.teamId),
    index('idx_bingo_claims_submitted_at').on(table.submittedAt),
  ],
);

export const bingoCompletions = sqliteTable(
  'bingo_completions',
  {
    id: text('id').primaryKey().notNull(),
    eventId: text('event_id').notNull().references(() => bingoEvents.id, { onDelete: 'cascade' }),
    taskId: text('task_id').notNull().references(() => bingoTasks.id, { onDelete: 'cascade' }),
    teamId: text('team_id').notNull().references(() => bingoTeams.id, { onDelete: 'cascade' }),
    claimId: text('claim_id').notNull().references(() => bingoClaims.id, { onDelete: 'cascade' }),
    completionNumber: integer('completion_number').notNull().default(1),
    globalLockKey: text('global_lock_key'),
    points: integer('points').notNull(),
    verificationSource: text('verification_source').notNull().default('manual'),
    verificationConfidence: text('verification_confidence').notNull().default('unverified'),
    completedAt: text('completed_at').notNull(),
  },
  (table) => [
    uniqueIndex('bingo_completions_claim_unique').on(table.claimId),
    uniqueIndex('bingo_completions_team_number_unique').on(table.taskId, table.teamId, table.completionNumber),
    uniqueIndex('bingo_completions_global_lock_unique').on(table.globalLockKey),
    index('idx_bingo_completions_event_id').on(table.eventId),
    index('idx_bingo_completions_team_id').on(table.teamId),
  ],
);

export const bingoActivity = sqliteTable(
  'bingo_activity',
  {
    id: text('id').primaryKey().notNull(),
    eventId: text('event_id').notNull().references(() => bingoEvents.id, { onDelete: 'cascade' }),
    teamId: text('team_id').references(() => bingoTeams.id, { onDelete: 'set null' }),
    taskId: text('task_id').references(() => bingoTasks.id, { onDelete: 'set null' }),
    activityType: text('activity_type').notNull(),
    message: text('message').notNull(),
    metadataJson: text('metadata_json'),
    visibleAt: text('visible_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_bingo_activity_event_visible').on(table.eventId, table.visibleAt)],
);

export const bingoTemplates = sqliteTable(
  'bingo_templates',
  {
    id: text('id').primaryKey().notNull(),
    ownerDraftId: text('owner_draft_id').references(() => drafts.id, { onDelete: 'cascade' }),
    clanId: text('clan_id').references(() => clans.id, { onDelete: 'cascade' }),
    ownerUserId: text('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    mode: text('mode').notNull(),
    boardScope: text('board_scope').notNull(),
    configurationJson: text('configuration_json').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_bingo_templates_owner_draft').on(table.ownerDraftId),
    index('idx_bingo_templates_clan_id').on(table.clanId),
  ],
);

export const bingoWomSyncRuns = sqliteTable(
  'bingo_wom_sync_runs',
  {
    id: text('id').primaryKey().notNull(),
    eventId: text('event_id').notNull().references(() => bingoEvents.id, { onDelete: 'cascade' }),
    phase: text('phase').notNull(),
    status: text('status').notNull().default('running'),
    sourceMode: text('source_mode').notNull(),
    totalCount: integer('total_count').notNull().default(0),
    capturedCount: integer('captured_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    reconcileOffset: integer('reconcile_offset').notNull().default(0),
    signalsCount: integer('signals_count').notNull().default(0),
    lastRequestAt: text('last_request_at'),
    errorSummary: text('error_summary'),
    startedAt: text('started_at').notNull(),
    completedAt: text('completed_at'),
  },
  (table) => [
    index('idx_bingo_wom_sync_runs_event_started').on(table.eventId, table.startedAt),
    index('idx_bingo_wom_sync_runs_event_status').on(table.eventId, table.status),
  ],
);

export const bingoWomIntegrations = sqliteTable(
  'bingo_wom_integrations',
  {
    eventId: text('event_id').primaryKey().notNull().references(() => bingoEvents.id, { onDelete: 'cascade' }),
    groupId: integer('group_id'),
    syncIntervalHours: integer('sync_interval_hours').notNull().default(6),
    autoSync: integer('auto_sync', { mode: 'boolean' }).notNull().default(false),
    status: text('status').notNull().default('idle'),
    baselineRunId: text('baseline_run_id').references(() => bingoWomSyncRuns.id, { onDelete: 'set null' }),
    lastSyncAt: text('last_sync_at'),
    nextSyncAt: text('next_sync_at'),
    lastError: text('last_error'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('idx_bingo_wom_integrations_next_sync').on(table.nextSyncAt)],
);

export const bingoRuneliteIntegrations = sqliteTable(
  'bingo_runelite_integrations',
  {
    eventId: text('event_id').primaryKey().notNull().references(() => bingoEvents.id, { onDelete: 'cascade' }),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
    scopesJson: text('scopes_json').notNull().default('[]'),
    disclosureVersion: integer('disclosure_version').notNull().default(1),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
);

export const bingoRunelitePairings = sqliteTable(
  'bingo_runelite_pairings',
  {
    id: text('id').primaryKey().notNull(),
    eventId: text('event_id').notNull().references(() => bingoEvents.id, { onDelete: 'cascade' }),
    teamId: text('team_id').notNull().references(() => bingoTeams.id, { onDelete: 'cascade' }),
    memberId: text('member_id').notNull().references(() => bingoTeamMembers.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    issuedBy: text('issued_by').notNull(),
    expiresAt: text('expires_at').notNull(),
    consumedAt: text('consumed_at'),
    revokedAt: text('revoked_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('bingo_runelite_pairings_code_hash_unique').on(table.codeHash),
    index('idx_bingo_runelite_pairings_event_member').on(table.eventId, table.memberId),
    index('idx_bingo_runelite_pairings_expires').on(table.expiresAt),
  ],
);

export const bingoRuneliteDevices = sqliteTable(
  'bingo_runelite_devices',
  {
    id: text('id').primaryKey().notNull(),
    eventId: text('event_id').notNull().references(() => bingoEvents.id, { onDelete: 'cascade' }),
    teamId: text('team_id').notNull().references(() => bingoTeams.id, { onDelete: 'cascade' }),
    memberId: text('member_id').notNull().references(() => bingoTeamMembers.id, { onDelete: 'cascade' }),
    pairingId: text('pairing_id').notNull().references(() => bingoRunelitePairings.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    deviceName: text('device_name').notNull(),
    pluginVersion: text('plugin_version').notNull(),
    scopesJson: text('scopes_json').notNull(),
    disclosureVersion: integer('disclosure_version').notNull().default(1),
    lastRsn: text('last_rsn').notNull(),
    lastSeenAt: text('last_seen_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    revokedAt: text('revoked_at'),
    revokedBy: text('revoked_by'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('bingo_runelite_devices_pairing_unique').on(table.pairingId),
    uniqueIndex('bingo_runelite_devices_token_hash_unique').on(table.tokenHash),
    index('idx_bingo_runelite_devices_event').on(table.eventId),
    index('idx_bingo_runelite_devices_team').on(table.teamId),
    index('idx_bingo_runelite_devices_member').on(table.memberId),
    index('idx_bingo_runelite_devices_expires').on(table.expiresAt),
  ],
);

export const bingoRuneliteBatches = sqliteTable(
  'bingo_runelite_batches',
  {
    id: text('id').primaryKey().notNull(),
    deviceId: text('device_id').notNull().references(() => bingoRuneliteDevices.id, { onDelete: 'cascade' }),
    batchKey: text('batch_key').notNull(),
    eventCount: integer('event_count').notNull(),
    acceptedCount: integer('accepted_count').notNull(),
    duplicateCount: integer('duplicate_count').notNull(),
    rejectedCount: integer('rejected_count').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('bingo_runelite_batches_device_key_unique').on(table.deviceId, table.batchKey),
    index('idx_bingo_runelite_batches_device_created').on(table.deviceId, table.createdAt),
  ],
);

export const bingoPlayerSnapshots = sqliteTable(
  'bingo_player_snapshots',
  {
    id: text('id').primaryKey().notNull(),
    eventId: text('event_id').notNull().references(() => bingoEvents.id, { onDelete: 'cascade' }),
    memberId: text('member_id').notNull().references(() => bingoTeamMembers.id, { onDelete: 'cascade' }),
    syncRunId: text('sync_run_id').references(() => bingoWomSyncRuns.id, { onDelete: 'cascade' }),
    phase: text('phase').notNull(),
    sourceState: text('source_state').notNull(),
    schemaVersion: integer('schema_version').notNull().default(1),
    providerUpdatedAt: text('provider_updated_at'),
    payloadJson: text('payload_json').notNull(),
    capturedAt: text('captured_at').notNull(),
  },
  (table) => [
    uniqueIndex('bingo_snapshots_member_phase_unique').on(table.memberId, table.phase),
    uniqueIndex('bingo_snapshots_run_member_unique').on(table.syncRunId, table.memberId),
    index('idx_bingo_snapshots_event_phase').on(table.eventId, table.phase),
    index('idx_bingo_snapshots_sync_run').on(table.syncRunId),
  ],
);
