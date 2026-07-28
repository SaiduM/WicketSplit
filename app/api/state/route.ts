import { env } from "cloudflare:workers";

const TEAM_KEY = "wolfpacks";

async function ensureTable() {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS app_states (
      team_key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
}

export async function GET() {
  await ensureTable();
  const row = await env.DB.prepare("SELECT payload FROM app_states WHERE team_key = ?")
    .bind(TEAM_KEY)
    .first<{ payload: string }>();
  return Response.json(row ? JSON.parse(row.payload) : {});
}

export async function POST(request: Request) {
  await ensureTable();
  const state = await request.json();
  await env.DB.prepare(`
    INSERT INTO app_states (team_key, payload, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(team_key) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `).bind(TEAM_KEY, JSON.stringify(state), new Date().toISOString()).run();
  return Response.json({ ok: true });
}
