import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { getGoogleUser, sessionCookie } from "../../google-auth";

export async function DELETE() {
  const user = await getGoogleUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const email=user.email.toLowerCase();
  const owned=await env.DB.prepare("SELECT team_id FROM team_memberships WHERE email = ? AND role = 'treasurer'").bind(email).all<{team_id:number}>();
  for(const {team_id} of owned.results){
    await env.DB.batch([
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
