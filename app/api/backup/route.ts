import { env } from "cloudflare:workers";
import { loadNormalizedTeam, saveNormalizedTeam } from "../../../db/workspace";
import { getGoogleUser } from "../../google-auth";
import { clientIp, enforceApiRateLimit, isSameOrigin } from "../security";
import { isValidState } from "../state/route";

const FORMAT="wicketsplit-team-backup";const SCHEMA_VERSION=1;const MAX_BACKUP_BYTES=400_000;
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(byte=>byte.toString(16).padStart(2,"0")).join("");
const safeFile=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"team";
async function membership(teamId:number,email:string){return env.DB.prepare("SELECT role FROM team_memberships WHERE team_id=? AND email=?").bind(teamId,email).first<{role:string}>()}
async function owner(teamId:number){return (await env.DB.prepare("SELECT email FROM team_memberships WHERE team_id=? AND role='treasurer' ORDER BY joined_at,email LIMIT 1").bind(teamId).first<{email:string}>())?.email??null}
async function ensureRestoreTable(){await env.DB.batch([env.DB.prepare("CREATE TABLE IF NOT EXISTS team_restore_points (id TEXT PRIMARY KEY,team_id INTEGER NOT NULL,payload TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL)"),env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_team_restore_points_team_created ON team_restore_points(team_id,created_at)")])}

export async function GET(request:Request){
  const user=await getGoogleUser();if(!user||user.provider==="team")return Response.json({error:"Treasurer sign-in required"},{status:401});
  const teamId=Number(new URL(request.url).searchParams.get("teamId"));if(!Number.isSafeInteger(teamId)||teamId<=0)return Response.json({error:"Invalid team"},{status:400});
  const email=user.email.toLowerCase();if((await membership(teamId,email))?.role!=="treasurer")return Response.json({error:"Team treasurer access required"},{status:403});
  if(!await enforceApiRateLimit(`backup-export:${email}`,20,60*60*1000))return Response.json({error:"Too many backup requests"},{status:429});
  const team=await loadNormalizedTeam(teamId);if(!team)return Response.json({error:"Team not found"},{status:404});
  const teamJson=JSON.stringify(team);const backup={format:FORMAT,schemaVersion:SCHEMA_VERSION,exportedAt:new Date().toISOString(),checksum:await digest(teamJson),team};
  return new Response(JSON.stringify(backup,null,2),{headers:{"content-type":"application/json; charset=utf-8","content-disposition":`attachment; filename="wicketsplit-${safeFile(team.name)}-${new Date().toISOString().slice(0,10)}.json"`,"cache-control":"no-store"}});
}

export async function POST(request:Request){
  if(!isSameOrigin(request))return Response.json({error:"Invalid request origin"},{status:403});
  const user=await getGoogleUser();if(!user||user.provider==="team")return Response.json({error:"Treasurer sign-in required"},{status:401});
  if(Number(request.headers.get("content-length")??"0")>MAX_BACKUP_BYTES)return Response.json({error:"Backup file is too large"},{status:413});
  const body=await request.json().catch(()=>null) as {teamId?:unknown;confirmation?:unknown;backup?:unknown}|null;const teamId=Number(body?.teamId);const confirmation=String(body?.confirmation??"").trim();
  if(!Number.isSafeInteger(teamId)||teamId<=0||!body?.backup||typeof body.backup!=="object")return Response.json({error:"Invalid restore request"},{status:400});
  const email=user.email.toLowerCase();if((await owner(teamId))!==email)return Response.json({error:"Only the original team owner can restore a backup"},{status:403});
  const [accountAllowed,ipAllowed]=await Promise.all([enforceApiRateLimit(`backup-restore:${email}`,5,24*60*60*1000),enforceApiRateLimit(`backup-restore-ip:${clientIp(request)}`,15,24*60*60*1000)]);if(!accountAllowed||!ipAllowed)return Response.json({error:"Too many restore attempts. Try again tomorrow."},{status:429});
  const backup=body.backup as {format?:unknown;schemaVersion?:unknown;checksum?:unknown;team?:unknown};
  if(backup.format!==FORMAT||backup.schemaVersion!==SCHEMA_VERSION||typeof backup.checksum!=="string"||!backup.team||typeof backup.team!=="object")return Response.json({error:"This is not a supported WicketSplit backup"},{status:400});
  const restored=backup.team as Record<string,unknown>;if(Number(restored.id)!==teamId)return Response.json({error:"This backup belongs to a different team"},{status:409});
  const current=await loadNormalizedTeam(teamId);if(!current)return Response.json({error:"Team not found"},{status:404});
  if(confirmation!==current.name)return Response.json({error:`Type ${current.name} exactly to confirm`},{status:400});
  if(await digest(JSON.stringify(backup.team))!==backup.checksum)return Response.json({error:"Backup integrity check failed"},{status:400});
  const candidate={...restored,id:teamId,version:current.version};if(!isValidState({registered:true,name:"Restore",teams:[candidate]}))return Response.json({error:"Backup data failed validation"},{status:400});
  await ensureRestoreTable();const now=new Date().toISOString();const pointId=crypto.randomUUID();
  await env.DB.batch([env.DB.prepare("INSERT INTO team_restore_points(id,team_id,payload,created_by,created_at) VALUES(?,?,?,?,?)").bind(pointId,teamId,JSON.stringify(current),email,now),env.DB.prepare("DELETE FROM team_restore_points WHERE team_id=? AND id NOT IN (SELECT id FROM team_restore_points WHERE team_id=? ORDER BY created_at DESC LIMIT 10)").bind(teamId,teamId)]);
  const saved=await saveNormalizedTeam(candidate as Parameters<typeof saveNormalizedTeam>[0]);
  return Response.json({ok:true,version:saved.version,restorePointId:pointId});
}
