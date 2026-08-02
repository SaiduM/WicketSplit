import { env } from "cloudflare:workers";
import { getGoogleUser } from "../../google-auth";
import { enforceApiRateLimit, isSameOrigin } from "../security";

export async function DELETE(request: Request) {
  if(!isSameOrigin(request)) return Response.json({error:"Invalid request origin"},{status:403});
  const user=await getGoogleUser();
  if(!user) return Response.json({error:"Sign in required"},{status:401});
  if(Number(request.headers.get("content-length")??"0")>2_048) return Response.json({error:"Invalid team request"},{status:413});
  let teamId=0;
  try{teamId=Number((await request.json() as {teamId?:unknown}).teamId)}catch{}
  if(!Number.isSafeInteger(teamId)||teamId<=0) return Response.json({error:"Invalid team request"},{status:400});
  const email=user.email.toLowerCase();
  if(!await enforceApiRateLimit(`team-delete:${email}`,5,60*60*1000)) return Response.json({error:"Too many team deletions. Try again later."},{status:429,headers:{"Retry-After":"3600"}});
  const membership=await env.DB.prepare("SELECT role FROM team_memberships WHERE team_id = ? AND email = ?").bind(teamId,email).first<{role:string}>();
  if(membership?.role!=="treasurer") return Response.json({error:"Only a treasurer can delete a team"},{status:403});
  const owner=await env.DB.prepare(`SELECT email FROM team_memberships
    WHERE team_id = ? AND role = 'treasurer' ORDER BY joined_at, email LIMIT 1`).bind(teamId).first<{email:string}>();
  if(owner?.email!==email) return Response.json({error:"Only the original team treasurer can delete this team"},{status:403});
  const team=await env.DB.prepare("SELECT team_id FROM shared_teams WHERE team_id = ?").bind(teamId).first();
  if(!team) return Response.json({error:"Team not found"},{status:404});
  await env.DB.batch([
    env.DB.prepare("DELETE FROM team_member_access WHERE team_id = ?").bind(teamId),
    env.DB.prepare("DELETE FROM team_invites WHERE team_id = ?").bind(teamId),
    env.DB.prepare("DELETE FROM team_memberships WHERE team_id = ?").bind(teamId),
    env.DB.prepare("DELETE FROM shared_teams WHERE team_id = ?").bind(teamId),
  ]);
  return Response.json({ok:true});
}
