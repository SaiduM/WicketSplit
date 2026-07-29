import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { getGoogleUser, sessionCookie } from "../../google-auth";
import { enforceApiRateLimit, isSameOrigin } from "../security";

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  const user = await getGoogleUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const email=user.email.toLowerCase();
  if(!await enforceApiRateLimit(`account-delete:${email}`,3,60*60*1000)) return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "3600" } });
  const owned=await env.DB.prepare("SELECT team_id FROM team_memberships WHERE email = ? AND role = 'treasurer'").bind(email).all<{team_id:number}>();
  for(const {team_id} of owned.results){
    const remaining=await env.DB.prepare("SELECT COUNT(*) AS count FROM team_memberships WHERE team_id = ? AND role = 'treasurer' AND email <> ?").bind(team_id,email).first<{count:number}>();
    if((remaining?.count??0)===0) await env.DB.batch([
        env.DB.prepare("DELETE FROM team_invites WHERE team_id = ?").bind(team_id),
        env.DB.prepare("DELETE FROM team_memberships WHERE team_id = ?").bind(team_id),
        env.DB.prepare("DELETE FROM shared_teams WHERE team_id = ?").bind(team_id),
      ]);
  }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM team_memberships WHERE email = ?").bind(email),
    env.DB.prepare("DELETE FROM app_states WHERE team_key = ?").bind(email),
  ]);
  (await cookies()).delete(sessionCookie.name);
  return Response.json({ ok: true });
}
