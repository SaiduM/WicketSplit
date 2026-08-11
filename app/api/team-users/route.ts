import { env } from "cloudflare:workers";
import { getGoogleUser } from "../../google-auth";
import { loadNormalizedTeam } from "../../../db/workspace";
import { clientIp, enforceApiRateLimit, isSameOrigin } from "../security";

async function ownerEmail(teamId:number){
  return (await env.DB.prepare("SELECT email FROM team_memberships WHERE team_id = ? AND role = 'treasurer' ORDER BY joined_at,email LIMIT 1").bind(teamId).first<{email:string}>())?.email??null;
}

async function requireOwner(teamId:number,email:string){return await ownerEmail(teamId)===email}

export async function GET(request:Request){
  const user=await getGoogleUser();
  if(!user||user.provider==="team")return Response.json({error:"Owner sign-in required"},{status:401});
  const teamId=Number(new URL(request.url).searchParams.get("teamId"));
  if(!Number.isSafeInteger(teamId)||teamId<=0)return Response.json({error:"Invalid team"},{status:400});
  const email=user.email.toLowerCase();
  if(!await requireOwner(teamId,email))return Response.json({error:"Only the original team owner can view team users"},{status:403});
  if(!await enforceApiRateLimit(`team-users-read:${email}`,120,60*60*1000))return Response.json({error:"Too many user requests"},{status:429});
  const [memberships,invites,team,lastUpdate]=await Promise.all([
    env.DB.prepare("SELECT email,role,player_id,joined_at FROM team_memberships WHERE team_id = ? ORDER BY joined_at,email").bind(teamId).all<{email:string;role:"treasurer"|"member";player_id:number|null;joined_at:string}>(),
    env.DB.prepare("SELECT player_id,invite_role,intended_email,created_by,expires_at FROM team_invites WHERE team_id = ? AND accepted_by IS NULL AND expires_at > ? ORDER BY expires_at").bind(teamId,new Date().toISOString()).all<{player_id:number;invite_role:string;intended_email:string|null;created_by:string;expires_at:string}>(),
    loadNormalizedTeam(teamId),
    env.DB.prepare("SELECT updated_at FROM workspace_teams WHERE team_id = ?").bind(teamId).first<{updated_at:string}>(),
  ]);
  if(!team)return Response.json({error:"Team not found"},{status:404});
  const playerName=(playerId:number|null)=>team.players.find(player=>player.id===playerId)?.name??null;
  const synthetic=(value:string)=>value.startsWith(`team-${teamId}-player-`)&&value.endsWith("@member.wicketsplit.local");
  return Response.json({
    users:memberships.results.map(row=>({
      email:synthetic(row.email)?null:row.email,
      membershipEmail:row.email,
      role:row.role==="treasurer"?(row.email===email?"Owner":"Co-treasurer"):"Player",
      playerId:row.player_id,playerName:playerName(row.player_id),joinedAt:row.joined_at,
      accessType:synthetic(row.email)?"Team link + PIN":"Authenticated account",
      isCurrent:row.email===email,canRemove:row.role==="member",
    })),
    pendingInvites:invites.results.map(invite=>({playerId:invite.player_id,playerName:playerName(invite.player_id),role:invite.invite_role==="treasurer"?"Co-treasurer":"Player",email:invite.intended_email,createdBy:invite.created_by,expiresAt:invite.expires_at})),
    lastTeamUpdate:lastUpdate?.updated_at.slice(0,24)??null,
  });
}

export async function DELETE(request:Request){
  if(!isSameOrigin(request))return Response.json({error:"Invalid request origin"},{status:403});
  const user=await getGoogleUser();
  if(!user||user.provider==="team")return Response.json({error:"Owner sign-in required"},{status:401});
  if(Number(request.headers.get("content-length")??"0")>2_048)return Response.json({error:"Invalid membership request"},{status:413});
  let teamId=0;let membershipEmail="";
  try{const body=await request.json() as {teamId?:unknown;membershipEmail?:unknown};teamId=Number(body.teamId);membershipEmail=String(body.membershipEmail??"").trim().toLowerCase()}catch{}
  if(!Number.isSafeInteger(teamId)||teamId<=0||!membershipEmail||membershipEmail.length>254)return Response.json({error:"Invalid membership"},{status:400});
  const email=user.email.toLowerCase();
  const [accountAllowed,ipAllowed]=await Promise.all([enforceApiRateLimit(`team-users-remove:${email}`,30,60*60*1000),enforceApiRateLimit(`team-users-remove-ip:${clientIp(request)}`,90,60*60*1000)]);
  if(!accountAllowed||!ipAllowed)return Response.json({error:"Too many access changes"},{status:429});
  if(!await requireOwner(teamId,email))return Response.json({error:"Only the original team owner can remove player sessions"},{status:403});
  const target=await env.DB.prepare("SELECT role FROM team_memberships WHERE team_id = ? AND email = ?").bind(teamId,membershipEmail).first<{role:string}>();
  if(!target)return Response.json({error:"Team user was not found"},{status:404});
  if(target.role!=="member")return Response.json({error:"Remove co-treasurers from the roster access controls"},{status:400});
  await env.DB.prepare("DELETE FROM team_memberships WHERE team_id = ? AND email = ? AND role = 'member'").bind(teamId,membershipEmail).run();
  return Response.json({ok:true});
}
