import { env } from "cloudflare:workers";
import { getGoogleUser } from "../../google-auth";

const MAX_PAYLOAD_BYTES = 256_000;
const READS_PER_MINUTE = 120;
const WRITES_PER_MINUTE = 40;

async function ensureTables() {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS app_states (
      team_key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS api_rate_limits (
      rate_key TEXT PRIMARY KEY,
      window_start INTEGER NOT NULL,
      request_count INTEGER NOT NULL
    )`),
  ]);
}

async function enforceRateLimit(identity: string, action: "read" | "write") {
  const windowStart = Math.floor(Date.now() / 60_000);
  const limit = action === "write" ? WRITES_PER_MINUTE : READS_PER_MINUTE;
  const row = await env.DB.prepare(`INSERT INTO api_rate_limits (rate_key, window_start, request_count)
    VALUES (?, ?, 1)
    ON CONFLICT(rate_key) DO UPDATE SET
      request_count = CASE WHEN window_start = excluded.window_start THEN request_count + 1 ELSE 1 END,
      window_start = excluded.window_start
    RETURNING request_count`).bind(`${identity}:${action}`, windowStart).first<{ request_count: number }>();
  return { allowed: (row?.request_count ?? limit + 1) <= limit, limit };
}

function isValidState(value: unknown): boolean {
  const text = (candidate: unknown, max: number, required = true) =>
    typeof candidate === "string" && candidate.length <= max && (!required || candidate.trim().length > 0);
  const id = (candidate: unknown) => typeof candidate === "number" && Number.isSafeInteger(candidate) && candidate > 0;
  if (!value || typeof value !== "object") return false;
  const state = value as { registered?: unknown; name?: unknown; teams?: unknown };
  if (typeof state.registered !== "boolean" || !text(state.name, 160, state.registered) || !Array.isArray(state.teams)) return false;
  if (state.teams.length > 50) return false;
  return state.teams.every((team: unknown) => {
    if (!team || typeof team !== "object") return false;
    const item = team as { id?: unknown; name?: unknown; sport?: unknown; players?: unknown[]; leagues?: unknown[] };
    if (!id(item.id) || !text(item.name, 160) || !text(item.sport, 80) || !Array.isArray(item.players) || !Array.isArray(item.leagues)) return false;
    if (item.players.length > 500 || item.leagues.length > 100) return false;
    const playerIds = new Set<number>();
    if (!item.players.every(player => {
      if (!player || typeof player !== "object") return false;
      const record = player as { id?: unknown; name?: unknown; initials?: unknown; email?: unknown; color?: unknown };
      if (!id(record.id) || playerIds.has(record.id as number) || !text(record.name, 160) || !text(record.initials, 8) || !text(record.color, 40)) return false;
      if (record.email !== undefined && !text(record.email, 254, false)) return false;
      playerIds.add(record.id as number); return true;
    })) return false;
    const leagueIds = new Set<number>();
    return item.leagues.every((league: unknown) => {
      if (!league || typeof league !== "object") return false;
      const record = league as { id?: unknown; name?: unknown; season?: unknown; status?: unknown; games?: unknown[]; expenses?: unknown[] };
      if (!id(record.id) || leagueIds.has(record.id as number) || !text(record.name, 160) || !text(record.season, 40) ||
          !["Active","Completed"].includes(String(record.status)) || !Array.isArray(record.games) || record.games.length > 1_000 ||
          !Array.isArray(record.expenses) || record.expenses.length > 10_000) return false;
      leagueIds.add(record.id as number);
      const gameIds = new Set<number>();
      if (!record.games.every(game => {
        if (!game || typeof game !== "object") return false;
        const fixture = game as { id?: unknown; date?: unknown; opponent?: unknown; venue?: unknown; players?: unknown[]; status?: unknown };
        if (!id(fixture.id) || gameIds.has(fixture.id as number) || !text(fixture.date, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(String(fixture.date)) ||
            !text(fixture.opponent, 160) || !text(fixture.venue, 240, false) || !Array.isArray(fixture.players) ||
            fixture.players.length > 12 || !["Upcoming","Completed"].includes(String(fixture.status))) return false;
        if (new Set(fixture.players).size !== fixture.players.length || !fixture.players.every(playerId => id(playerId) && playerIds.has(playerId as number))) return false;
        gameIds.add(fixture.id as number); return true;
      })) return false;
      const expenseIds = new Set<number>();
      return record.expenses.every(expense => {
        if (!expense || typeof expense !== "object") return false;
        const payment = expense as { id?: unknown; date?: unknown; label?: unknown; category?: unknown; amount?: unknown; paidBy?: unknown; gameId?: unknown; split?: unknown; participants?: unknown[] };
        if (!id(payment.id) || expenseIds.has(payment.id as number) || !text(payment.date, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(String(payment.date)) ||
            !text(payment.label, 240) || !text(payment.category, 80) || typeof payment.amount !== "number" || !Number.isFinite(payment.amount) ||
            payment.amount <= 0 || payment.amount > 100_000_000 || typeof payment.paidBy !== "number" || !Number.isSafeInteger(payment.paidBy) || payment.paidBy < 0 ||
            !["players","team"].includes(String(payment.split))) return false;
        if (payment.split === "players" && (!id(payment.gameId) || !gameIds.has(payment.gameId as number))) return false;
        if (payment.participants !== undefined && (!Array.isArray(payment.participants) || payment.participants.length === 0 ||
            new Set(payment.participants).size !== payment.participants.length ||
            !payment.participants.every(playerId => id(playerId) && playerIds.has(playerId as number)))) return false;
        expenseIds.add(payment.id as number); return true;
      });
    });
  });
}

export async function GET() {
  const user = await getGoogleUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  await ensureTables();
  const rate = await enforceRateLimit(user.email.toLowerCase(), "read");
  if (!rate.allowed) return Response.json({ error: "Too many requests. Try again shortly." }, { status: 429, headers: { "Retry-After": "60" } });
  const row = await env.DB.prepare("SELECT payload FROM app_states WHERE team_key = ?")
    .bind(user.email.toLowerCase()).first<{ payload: string }>();
  return Response.json(row ? JSON.parse(row.payload) : {}, { headers: { "X-RateLimit-Limit": String(rate.limit) } });
}

export async function POST(request: Request) {
  const user = await getGoogleUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_PAYLOAD_BYTES) return Response.json({ error: "Workspace data is too large" }, { status: 413 });
  await ensureTables();
  const rate = await enforceRateLimit(user.email.toLowerCase(), "write");
  if (!rate.allowed) return Response.json({ error: "Too many updates. Try again shortly." }, { status: 429, headers: { "Retry-After": "60" } });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_PAYLOAD_BYTES) return Response.json({ error: "Workspace data is too large" }, { status: 413 });
  let state: unknown;
  try { state = JSON.parse(raw); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!isValidState(state)) return Response.json({ error: "Invalid workspace data" }, { status: 400 });
  await env.DB.prepare(`INSERT INTO app_states (team_key, payload, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(team_key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`)
    .bind(user.email.toLowerCase(), JSON.stringify(state), new Date().toISOString()).run();
  return Response.json({ ok: true }, { headers: { "X-RateLimit-Limit": String(rate.limit) } });
}
