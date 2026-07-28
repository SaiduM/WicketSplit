import { env } from "cloudflare:workers";
import { getGoogleUser } from "../../google-auth";

const hashToken = async (token: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))).map(byte=>byte.toString(16).padStart(2,"0")).join("");

async function ensureInviteTables() {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS team_invites (
      token_hash TEXT PRIMARY KEY, team_id INTEGER NOT NULL, player_id INTEGER NOT NULL,
      created_by TEXT NOT NULL, expires_at TEXT NOT NULL, accepted_by TEXT, accepted_at TEXT
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS team_memberships (
      team_id INTEGER NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL,
      player_id INTEGER, joined_at TEXT NOT NULL, PRIMARY KEY(team_id, email)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS shared_teams (
      team_id INTEGER PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL
    )`),
  ]);
  try { await env.DB.prepare("ALTER TABLE team_invites ADD COLUMN invite_role TEXT NOT NULL DEFAULT 'member'").run(); } catch {}
}

export async function POST(request: Request) {
  const user = await getGoogleUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  await ensureInviteTables();
  let teamId=0; let playerId=0; let role:"treasurer"|"member"="member";
  try { const body=await request.json() as {teamId?:unknown;playerId?:unknown;role?:unknown};teamId=Number(body.teamId);playerId=Number(body.playerId);role=body.role==="treasurer"?"treasurer":"member"; } catch {}
  if (!Number.isSafeInteger(teamId)||!Number.isSafeInteger(playerId)) return Response.json({ error: "Invalid invitation" }, { status: 400 });
  const email=user.email.toLowerCase();
  const membership=await env.DB.prepare("SELECT role FROM team_memberships WHERE team_id = ? AND email = ?").bind(teamId,email).first<{role:string}>();
  if (membership?.role!=="treasurer") return Response.json({ error: "Only a treasurer can invite members" }, { status: 403 });
  const team=await env.DB.prepare("SELECT payload FROM shared_teams WHERE team_id = ?").bind(teamId).first<{payload:string}>();
  const playerExists=Boolean(team&&(JSON.parse(team.payload) as {players?:Array<{id:number}>}).players?.some(player=>player.id===playerId));
  if(!playerExists) return Response.json({ error: "Player not found" }, { status: 404 });
  const token=crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","");
  const tokenHash=await hashToken(token); const expiresAt=new Date(Date.now()+7*24*60*60*1000).toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM team_invites WHERE team_id = ? AND player_id = ? AND accepted_by IS NULL").bind(teamId,playerId),
    env.DB.prepare("INSERT INTO team_invites (token_hash, team_id, player_id, created_by, expires_at, invite_role) VALUES (?, ?, ?, ?, ?, ?)").bind(tokenHash,teamId,playerId,email,expiresAt,role),
  ]);
  return Response.json({ url: `${new URL(request.url).origin}/api/invites/accept?token=${token}`, expiresAt, role });
}
