import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const drafts = sqliteTable(
  'drafts',
  {
    id: text('id').primaryKey().notNull(),
    adminToken: text('admin_token').notNull(),
    title: text('title').notNull(),
    draftType: text('draft_type').notNull(),
    teamCount: integer('team_count').notNull(),
    status: text('status').notNull().default('collecting'),
    resultJson: text('result_json'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('drafts_admin_token_unique').on(table.adminToken)],
);

export const players = sqliteTable(
  'players',
  {
    id: text('id').primaryKey().notNull(),
    draftId: text('draft_id').notNull().references(() => drafts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull(),
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
    avoid: integer('avoid', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.captainId, table.playerId] })],
);
