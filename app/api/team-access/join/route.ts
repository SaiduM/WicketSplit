import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { createSessionToken, sessionCookie } from "../../../google-auth";
import { clientIp, enforceApiRateLimit, isSameOrigin } from "../../security";

const hash = async (value:string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(byte=>byte.toString(16).padStart(2,"0")).join("");
type StoredTeam={name?:string;players?:Array<{id:number;name:string}>};

async function ensureTables(){
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS team_member_access (team_id INTEGER PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,pin_hash TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,access_secret TEXT)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS team_memberships (team_id INTEGER NOT NULL,email TEXT NOT NULL,role TEXT NOT NULL,player_id INTEGER,joined_at TEXT NOT NULL,PRIMARY KEY(team_id,email))`),
  ]);
}

export async function POST(request:Request){
  if(!isSameOrigin(request))return Response.json({error:"Invalid request origin"},{status:403});
  if(Number(request.headers.get("content-length")??"0")>4_096)return Response.json({error:"Invalid team access"},{status:413});
  let token="";let pin="";let playerId=0;try{const body=await request.json() as {token?:unknown;pin?:unknown;playerId?:unknown};token=String(body.token??"");pin=String(body.pin??"");playerId=Number(body.playerId??0)}catch{}
  if(!/^[a-f0-9]{64}$/.test(token)||!/^[0-9]{6}$/.test(pin)||(!Number.isSafeInteger(playerId)&&playerId!==0))return Response.json({error:"Check the private link and 6-digit PIN"},{status:400});
  const ip=clientIp(request);if(!await enforceApiRateLimit(`team-access-join-ip:${ip}`,20,60*1000))return Response.json({error:"Too many attempts. Try again in a minute."},{status:429,headers:{"Retry-After":"60"}});
  await ensureTables();const tokenHash=await hash(token);
  if(!await enforceApiRateLimit(`team-access-join-token:${tokenHash}`,12,60*1000))return Response.json({error:"Too many attempts. Ask the treasurer for a new link if needed."},{status:429});
  const access=await env.DB.prepare("SELECT team_id,pin_hash FROM team_member_access WHERE token_hash = ?").bind(tokenHash).first<{team_id:number;pin_hash:string}>();
  if(!access||access.pin_hash!==await hash(`${token}:${pin}`))return Response.json({error:"The team link or PIN is incorrect"},{status:403});
  const row=await env.DB.prepare("SELECT payload FROM shared_teams WHERE team_id = ?").bind(access.team_id).first<{payload:string}>();if(!row)return Response.json({error:"Team is no longer available"},{status:404});
  const team=JSON.parse(row.payload) as StoredTeam;const players=(team.players??[]).map(player=>({id:player.id,name:player.name})).sort((a,b)=>a.name.localeCompare(b.name));
  if(!playerId)return Response.json({teamName:team.name??"Team",players});
  const player=players.find(candidate=>candidate.id===playerId);if(!player)return Response.json({error:"Select a valid roster player"},{status:400});
  const email=`team-${access.team_id}-player-${player.id}@member.wicketsplit.local`;const now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO team_memberships (team_id,email,role,player_id,joined_at) VALUES (?,?,'member',?,?)
    ON CONFLICT(team_id,email) DO UPDATE SET role='member',player_id=excluded.player_id`).bind(access.team_id,email,player.id,now).run();
  const session=await createSessionToken({sub:`team-member:${access.team_id}:${player.id}`,email,name:player.name,provider:"team",teamId:access.team_id,playerId:player.id,teamAccessTokenHash:tokenHash});
  (await cookies()).set(sessionCookie.name,session,sessionCookie.options);
  return Response.json({ok:true});
}
