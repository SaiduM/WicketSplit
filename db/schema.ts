import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  ownerEmail: text("owner_email").notNull(),
  createdAt: text("created_at").notNull(),
});

export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").notNull(),
  name: text("name").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const leagues = sqliteTable("leagues", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
});

export const games = sqliteTable("games", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leagueId: integer("league_id").notNull(),
  opponent: text("opponent").notNull(),
  playedOn: text("played_on").notNull(),
  venue: text("venue"),
});

export const gamePlayers = sqliteTable("game_players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("game_id").notNull(),
  playerId: integer("player_id").notNull(),
});

export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leagueId: integer("league_id").notNull(),
  gameId: integer("game_id"),
  label: text("label").notNull(),
  category: text("category").notNull(),
  amount: real("amount").notNull(),
  paidByPlayerId: integer("paid_by_player_id").notNull(),
  splitRule: text("split_rule").notNull(),
  incurredOn: text("incurred_on").notNull(),
});

export const appStates = sqliteTable("app_states", {
  teamKey: text("team_key").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const apiRateLimits = sqliteTable("api_rate_limits", {
  rateKey: text("rate_key").primaryKey(),
  windowStart: integer("window_start").notNull(),
  requestCount: integer("request_count").notNull(),
});

export const teamMemberAccess = sqliteTable("team_member_access", {
  teamId: integer("team_id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  pinHash: text("pin_hash").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  accessSecret: text("access_secret"),
});

export const sharedTeams = sqliteTable("shared_teams", {
  teamId: integer("team_id").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const teamMemberships = sqliteTable("team_memberships", {
  teamId: integer("team_id").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  playerId: integer("player_id"),
  joinedAt: text("joined_at").notNull(),
}, table => [
  primaryKey({ columns: [table.teamId, table.email] }),
  index("idx_team_memberships_email_joined").on(table.email, table.joinedAt),
  index("idx_team_memberships_team_role_joined").on(table.teamId, table.role, table.joinedAt, table.email),
  index("idx_team_memberships_team_player").on(table.teamId, table.playerId),
]);

export const teamInvites = sqliteTable("team_invites", {
  tokenHash: text("token_hash").primaryKey(),
  teamId: integer("team_id").notNull(),
  playerId: integer("player_id").notNull(),
  createdBy: text("created_by").notNull(),
  expiresAt: text("expires_at").notNull(),
  acceptedBy: text("accepted_by"),
  acceptedAt: text("accepted_at"),
  inviteRole: text("invite_role").notNull().default("member"),
  intendedEmail: text("intended_email"),
}, table => [
  index("idx_team_invites_team_player_pending").on(table.teamId, table.playerId, table.acceptedBy),
  index("idx_team_invites_team_email_pending").on(table.teamId, table.intendedEmail, table.acceptedBy),
  index("idx_team_invites_expiry").on(table.expiresAt),
]);

export const workspaceTeams = sqliteTable("workspace_teams", {
  teamId: integer("team_id").primaryKey(),
  name: text("name").notNull(),
  sport: text("sport").notNull(),
  cricclubs: text("cricclubs"),
  version: integer("version").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});

export const workspacePlayers = sqliteTable("workspace_players", {
  teamId: integer("team_id").notNull(),
  playerId: integer("player_id").notNull(),
  payload: text("payload").notNull(),
  sortOrder: integer("sort_order").notNull(),
}, table => [
  primaryKey({ columns: [table.teamId, table.playerId] }),
  index("idx_workspace_players_team_sort").on(table.teamId, table.sortOrder),
]);

export const workspaceLeagues = sqliteTable("workspace_leagues", {
  teamId: integer("team_id").notNull(),
  leagueId: integer("league_id").notNull(),
  name: text("name").notNull(),
  season: text("season").notNull(),
  status: text("status").notNull(),
  cricclubs: text("cricclubs"),
  sortOrder: integer("sort_order").notNull(),
}, table => [
  primaryKey({ columns: [table.teamId, table.leagueId] }),
  index("idx_workspace_leagues_team_sort").on(table.teamId, table.sortOrder),
]);

const workspaceRecordColumns = {
  teamId: integer("team_id").notNull(),
  leagueId: integer("league_id").notNull(),
  recordId: integer("record_id").notNull(),
  eventDate: text("event_date").notNull().default(""),
  payload: text("payload").notNull(),
  sortOrder: integer("sort_order").notNull(),
};

export const workspaceGames = sqliteTable("workspace_games", workspaceRecordColumns, table => [
  primaryKey({ columns: [table.teamId, table.leagueId, table.recordId] }),
  index("idx_workspace_games_league_date").on(table.teamId, table.leagueId, table.eventDate, table.sortOrder),
]);

export const workspaceExpenses = sqliteTable("workspace_expenses", workspaceRecordColumns, table => [
  primaryKey({ columns: [table.teamId, table.leagueId, table.recordId] }),
  index("idx_workspace_expenses_league_date").on(table.teamId, table.leagueId, table.eventDate, table.sortOrder),
]);

export const workspaceCredits = sqliteTable("workspace_credits", workspaceRecordColumns, table => [
  primaryKey({ columns: [table.teamId, table.leagueId, table.recordId] }),
  index("idx_workspace_credits_league_date").on(table.teamId, table.leagueId, table.eventDate, table.sortOrder),
]);

export const workspacePayments = sqliteTable("workspace_payments", workspaceRecordColumns, table => [
  primaryKey({ columns: [table.teamId, table.leagueId, table.recordId] }),
  index("idx_workspace_payments_league_date").on(table.teamId, table.leagueId, table.eventDate, table.sortOrder),
]);
