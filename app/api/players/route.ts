import { env } from "cloudflare:workers";
import { getGoogleUser } from "../../google-auth";
import { loadOrMigrateTeam, saveNormalizedTeam } from "../../../db/workspace";
import { enforceApiRateLimit, isSameOrigin } from "../security";

type StoredTeam = {
  players?: Array<{id:number;name:string}>;
  leagues?: Array<{
    games?: Array<{players?:number[]}>;
    expenses?: Array<{paidBy?:number;participants?:number[]}>;
    credits?: Array<{playerId?:number;participants?:number[]}>;
    payments?: Array<{fromPlayerId?:number;toPlayerId?:number}>;
  }>;
};

export async function DELETE(request: Request) {
  if(!isSameOrigin(request)) return Response.json({error:"Invalid request origin"},{status:403});
  const user=await getGoogleUser();
  if(!user) return Response.json({error:"Sign in required"},{status:401});
  if(Number(request.headers.get("content-length")??"0")>4_096) return Response.json({error:"Invalid player request"},{status:413});
  let teamId=0; let playerId=0;
  try{const body=await request.json() as {teamId?:unknown;playerId?:unknown};teamId=Number(body.teamId);playerId=Number(body.playerId)}catch{}
  if(!Number.isSafeInteger(teamId)||teamId<=0||!Number.isSafeInteger(playerId)||playerId<=0) return Response.json({error:"Invalid player request"},{status:400});
  const email=user.email.toLowerCase();
  if(!await enforceApiRateLimit(`player-delete:${email}`,20,60*60*1000)) return Response.json({error:"Too many player changes. Try again later."},{status:429,headers:{"Retry-After":"3600"}});
  const membership=await env.DB.prepare("SELECT role FROM team_memberships WHERE team_id = ? AND email = ?").bind(teamId,email).first<{role:string}>();
  if(membership?.role!=="treasurer") return Response.json({error:"Only a treasurer can delete players"},{status:403});
  const access=await env.DB.prepare("SELECT COUNT(*) AS count FROM team_memberships WHERE team_id = ? AND player_id = ?").bind(teamId,playerId).first<{count:number}>();
  if((access?.count??0)>0) return Response.json({error:"This player has team access. Their access must be removed before deleting them."},{status:409});
  const row=await env.DB.prepare("SELECT payload FROM shared_teams WHERE team_id = ?").bind(teamId).first<{payload:string}>();
  if(!row) return Response.json({error:"Team not found"},{status:404});
  const team=await loadOrMigrateTeam(teamId,row.payload) as StoredTeam&{id:number;name:string;sport:string;version?:number;players:Array<{id:number;name:string}>;leagues:Array<Record<string,unknown>>};
  const player=team.players?.find(candidate=>candidate.id===playerId);
  if(!player) return Response.json({error:"Player not found"},{status:404});
  const referenced=(team.leagues??[]).some(league=>
    (league.games??[]).some(game=>game.players?.includes(playerId))||
    (league.expenses??[]).some(expense=>expense.paidBy===playerId||expense.participants?.includes(playerId))||
    (league.credits??[]).some(credit=>credit.playerId===playerId||credit.participants?.includes(playerId))||
    (league.payments??[]).some(payment=>payment.fromPlayerId===playerId||payment.toPlayerId===playerId)
  );
  if(referenced) return Response.json({error:"This player is used in a game or financial entry and cannot be deleted."},{status:409});
  team.players=(team.players??[]).filter(candidate=>candidate.id!==playerId);
  const saved=await saveNormalizedTeam(team as Parameters<typeof saveNormalizedTeam>[0]);
  team.version=saved.version;
  await env.DB.prepare("DELETE FROM team_invites WHERE team_id = ? AND player_id = ? AND accepted_by IS NULL").bind(teamId,playerId).run();
  return Response.json({ok:true,version:saved.version});
}
