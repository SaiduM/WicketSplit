import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { getGoogleUser, sessionCookie } from "../../google-auth";
import { enforceApiRateLimit, isSameOrigin } from "../security";

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  const user = await getGoogleUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const email=user.email.toLowerCase();
  if(!await enforceApiRateLimit(`account-player-link:${email}`,10,60*60*1000)) return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "3600" } });
  let teamId=0; let playerId=0;
  try{const body=await request.json() as {teamId?:unknown;playerId?:unknown};teamId=Number(body.teamId);playerId=Number(body.playerId)}catch{}
  if(!Number.isSafeInteger(teamId)||teamId<=0||!Number.isSafeInteger(playerId)||playerId<=0) return Response.json({error:"Invalid player link"},{status:400});
  const membership=await env.DB.prepare("SELECT role FROM team_memberships WHERE team_id = ? AND email = ?").bind(teamId,email).first<{role:string}>();
  if(!membership) return Response.json({error:"You do not have access to this team"},{status:403});
  const team=await env.DB.prepare("SELECT payload FROM shared_teams WHERE team_id = ?").bind(teamId).first<{payload:string}>();
  const playerExists=Boolean(team&&(JSON.parse(team.payload) as {players?:Array<{id:number}>}).players?.some(player=>player.id===playerId));
  if(!playerExists) return Response.json({error:"Player was not found in this roster"},{status:404});
  const alreadyLinked=await env.DB.prepare("SELECT email FROM team_memberships WHERE team_id = ? AND player_id = ? AND email <> ?").bind(teamId,playerId,email).first<{email:string}>();
  if(alreadyLinked) return Response.json({error:"That roster player is already linked to another account"},{status:409});
  await env.DB.prepare("UPDATE team_memberships SET player_id = ? WHERE team_id = ? AND email = ?").bind(playerId,teamId,email).run();
  return Response.json({ok:true,playerId});
}

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
