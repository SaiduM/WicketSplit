import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
