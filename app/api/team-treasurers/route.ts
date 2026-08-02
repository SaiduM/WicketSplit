import { env } from "cloudflare:workers";
import { getGoogleUser } from "../../google-auth";
import { clientIp, enforceApiRateLimit, isSameOrigin } from "../security";

async function authorize(teamId:number,email:string){
  const membership=await env.DB.prepare("SELECT role FROM team_memberships WHERE team_id = ? AND email = ?").bind(teamId,email).first<{role:string}>();
  return membership?.role==="treasurer";
}

async function ownerEmail(teamId:number){
  const owner=await env.DB.prepare(`SELECT email FROM team_memberships WHERE team_id = ? AND role = 'treasurer' ORDER BY joined_at, email LIMIT 1`).bind(teamId).first<{email:string}>();
  return owner?.email??null;
}

export async function GET(request:Request){
  const user=await getGoogleUser();
  if(!user||user.provider==="team")return Response.json({error:"Treasurer sign-in required"},{status:401});
  const teamId=Number(new URL(request.url).searchParams.get("teamId"));
  if(!Number.isSafeInteger(teamId)||teamId<=0)return Response.json({error:"Invalid team"},{status:400});
  const email=user.email.toLowerCase();
  if(!await authorize(teamId,email))return Response.json({error:"Only a treasurer can view team access"},{status:403});
  if(!await enforceApiRateLimit(`team-treasurers-read:${email}`,120,60*60*1000))return Response.json({error:"Too many access requests"},{status:429});
  const [owner,rows]=await Promise.all([
    ownerEmail(teamId),
    env.DB.prepare("SELECT email, player_id FROM team_memberships WHERE team_id = ? AND role = 'treasurer' ORDER BY joined_at, email").bind(teamId).all<{email:string;player_id:number|null}>(),
  ]);
  return Response.json({treasurers:rows.results.map(row=>({email:row.email,playerId:row.player_id,isOwner:row.email===owner,isCurrent:row.email===email,canRemove:row.email!==owner&&row.email!==email}))});
}

export async function DELETE(request:Request){
  if(!isSameOrigin(request))return Response.json({error:"Invalid request origin"},{status:403});
  const user=await getGoogleUser();
  if(!user||user.provider==="team")return Response.json({error:"Treasurer sign-in required"},{status:401});
  if(Number(request.headers.get("content-length")??"0")>2_048)return Response.json({error:"Invalid access request"},{status:413});
  let teamId=0;let targetEmail="";
  try{const body=await request.json() as {teamId?:unknown;email?:unknown};teamId=Number(body.teamId);targetEmail=String(body.email??"").trim().toLowerCase()}catch{}
  if(!Number.isSafeInteger(teamId)||teamId<=0||targetEmail.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail))return Response.json({error:"Invalid treasurer access"},{status:400});
  const email=user.email.toLowerCase();
  const [accountAllowed,ipAllowed]=await Promise.all([enforceApiRateLimit(`team-treasurers-remove:${email}`,20,60*60*1000),enforceApiRateLimit(`team-treasurers-remove-ip:${clientIp(request)}`,60,60*60*1000)]);
  if(!accountAllowed||!ipAllowed)return Response.json({error:"Too many access changes. Try again later."},{status:429});
  if(!await authorize(teamId,email))return Response.json({error:"Only a treasurer can remove co-treasurer access"},{status:403});
  if(targetEmail===email)return Response.json({error:"You cannot remove your own current access"},{status:400});
  if(await ownerEmail(teamId)===targetEmail)return Response.json({error:"The original team owner cannot be removed"},{status:400});
  const target=await env.DB.prepare("SELECT player_id FROM team_memberships WHERE team_id = ? AND email = ? AND role = 'treasurer'").bind(teamId,targetEmail).first<{player_id:number|null}>();
  if(!target)return Response.json({error:"Co-treasurer access was not found"},{status:404});
  await env.DB.batch([
    env.DB.prepare("DELETE FROM team_memberships WHERE team_id = ? AND email = ? AND role = 'treasurer'").bind(teamId,targetEmail),
    env.DB.prepare("DELETE FROM team_invites WHERE team_id = ? AND intended_email = ? AND accepted_by IS NULL").bind(teamId,targetEmail),
  ]);
  return Response.json({ok:true,playerId:target.player_id});
}
