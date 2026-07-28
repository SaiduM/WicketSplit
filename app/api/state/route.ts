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
  if (!value || typeof value !== "object") return false;
  const state = value as { registered?: unknown; name?: unknown; teams?: unknown };
  if (typeof state.registered !== "boolean" || typeof state.name !== "string" || !Array.isArray(state.teams)) return false;
  if (state.name.length > 160 || state.teams.length > 50) return false;
  return state.teams.every((team: unknown) => {
    if (!team || typeof team !== "object") return false;
    const item = team as { name?: unknown; players?: unknown; leagues?: unknown };
    if (typeof item.name !== "string" || item.name.length > 160 || !Array.isArray(item.players) || !Array.isArray(item.leagues)) return false;
    if (item.players.length > 500 || item.leagues.length > 100) return false;
    return item.leagues.every((league: unknown) => {
      if (!league || typeof league !== "object") return false;
      const record = league as { name?: unknown; games?: unknown; expenses?: unknown };
      return typeof record.name === "string" && record.name.length <= 160 &&
        Array.isArray(record.games) && record.games.length <= 1_000 &&
        Array.isArray(record.expenses) && record.expenses.length <= 10_000;
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
