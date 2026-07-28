import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

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
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  await ensureTable();
  const row = await env.DB.prepare("SELECT payload FROM app_states WHERE team_key = ?")
    .bind(user.email.toLowerCase()).first<{ payload: string }>();
  return Response.json(row ? JSON.parse(row.payload) : {});
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  await ensureTable();
  const state = await request.json();
  await env.DB.prepare(`
    INSERT INTO app_states (team_key, payload, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(team_key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `).bind(user.email.toLowerCase(), JSON.stringify(state), new Date().toISOString()).run();
  return Response.json({ ok: true });
}
