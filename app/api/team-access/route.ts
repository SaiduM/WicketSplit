import { env } from "cloudflare:workers";
import { getGoogleUser } from "../../google-auth";
import { clientIp, enforceApiRateLimit, isSameOrigin, publicAppOrigin } from "../security";

const hash = async (value:string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(byte=>byte.toString(16).padStart(2,"0")).join("");
const createToken = () => crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","");
const createPin = () => String(crypto.getRandomValues(new Uint32Array(1))[0]%900_000+100_000);
const encode = (bytes:Uint8Array) => {let binary="";bytes.forEach(byte=>binary+=String.fromCharCode(byte));return btoa(binary)};
const decode = (value:string) => Uint8Array.from(atob(value),character=>character.charCodeAt(0));

async function accessKey(){
  const secret=(env as unknown as Record<string,string>).SESSION_SECRET;
  if(!secret)throw new Error("SESSION_SECRET is not configured");
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`wicketsplit-team-access:${secret}`));
  return crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt","decrypt"]);
}
async function encryptAccess(token:string,pin:string){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},await accessKey(),new TextEncoder().encode(JSON.stringify({token,pin})));
  return `${encode(iv)}.${encode(new Uint8Array(encrypted))}`;
}
async function decryptAccess(value:string){
  try{const [iv,ciphertext]=value.split(".");if(!iv||!ciphertext)return null;const clear=await crypto.subtle.decrypt({name:"AES-GCM",iv:decode(iv)},await accessKey(),decode(ciphertext));const parsed=JSON.parse(new TextDecoder().decode(clear)) as {token?:unknown;pin?:unknown};return typeof parsed.token==="string"&&typeof parsed.pin==="string"?{token:parsed.token,pin:parsed.pin}:null}catch{return null}
}

async function ensureTables(){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS team_member_access (
    team_id INTEGER PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    pin_hash TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    access_secret TEXT
  )`).run();
  try{await env.DB.prepare("ALTER TABLE team_member_access ADD COLUMN access_secret TEXT").run()}catch{}
}

async function authorize(teamId:number,email:string){
  const membership=await env.DB.prepare("SELECT role FROM team_memberships WHERE team_id = ? AND email = ?").bind(teamId,email).first<{role:string}>();
  return membership?.role==="treasurer";
}

export async function GET(request:Request){
  const user=await getGoogleUser();if(!user||user.provider==="team")return Response.json({error:"Treasurer sign-in required"},{status:401});
  const teamId=Number(new URL(request.url).searchParams.get("teamId"));if(!Number.isSafeInteger(teamId)||teamId<=0)return Response.json({error:"Invalid team"},{status:400});
  const email=user.email.toLowerCase();if(!await authorize(teamId,email))return Response.json({error:"Only a treasurer can manage team member access"},{status:403});
  if(!await enforceApiRateLimit(`team-access-read:${email}`,120,60*60*1000))return Response.json({error:"Too many access requests. Try again later."},{status:429});
  await ensureTables();const row=await env.DB.prepare("SELECT access_secret FROM team_member_access WHERE team_id = ?").bind(teamId).first<{access_secret:string|null}>();
  if(!row)return Response.json({exists:false});const access=row.access_secret?await decryptAccess(row.access_secret):null;
  if(!access)return Response.json({exists:true,replacementRequired:true});
  return Response.json({exists:true,url:`${publicAppOrigin(request)}/join-team?token=${access.token}`,pin:access.pin});
}

export async function POST(request:Request){
  if(!isSameOrigin(request))return Response.json({error:"Invalid request origin"},{status:403});
  const user=await getGoogleUser();
  if(!user||user.provider==="team")return Response.json({error:"Treasurer sign-in required"},{status:401});
  if(Number(request.headers.get("content-length")??"0")>2_048)return Response.json({error:"Invalid access request"},{status:413});
  let teamId=0;let replace=false;try{const body=await request.json() as {teamId?:unknown;replace?:unknown};teamId=Number(body.teamId);replace=body.replace===true}catch{}
  if(!Number.isSafeInteger(teamId)||teamId<=0)return Response.json({error:"Invalid team"},{status:400});
  const email=user.email.toLowerCase();
  const [accountAllowed,ipAllowed]=await Promise.all([enforceApiRateLimit(`team-access-create:${email}`,10,60*60*1000),enforceApiRateLimit(`team-access-create-ip:${clientIp(request)}`,30,60*60*1000)]);
  if(!accountAllowed||!ipAllowed)return Response.json({error:"Too many access-link changes. Try again later."},{status:429,headers:{"Retry-After":"3600"}});
  if(!await authorize(teamId,email))return Response.json({error:"Only a treasurer can manage team member access"},{status:403});
  const team=await env.DB.prepare("SELECT payload FROM shared_teams WHERE team_id = ?").bind(teamId).first<{payload:string}>();
  if(!team)return Response.json({error:"Team not found"},{status:404});
  await ensureTables();
  const current=await env.DB.prepare("SELECT access_secret FROM team_member_access WHERE team_id = ?").bind(teamId).first<{access_secret:string|null}>();
  if(current?.access_secret&&!replace){const existing=await decryptAccess(current.access_secret);if(existing)return Response.json({url:`${publicAppOrigin(request)}/join-team?token=${existing.token}`,pin:existing.pin,teamName:(JSON.parse(team.payload) as {name?:string}).name??"your team",reused:true})}
  const token=createToken();const pin=createPin();const tokenHash=await hash(token);const pinHash=await hash(`${token}:${pin}`);const accessSecret=await encryptAccess(token,pin);const now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO team_member_access (team_id,token_hash,pin_hash,created_by,created_at,access_secret) VALUES (?,?,?,?,?,?)
    ON CONFLICT(team_id) DO UPDATE SET token_hash=excluded.token_hash,pin_hash=excluded.pin_hash,created_by=excluded.created_by,created_at=excluded.created_at,access_secret=excluded.access_secret`).bind(teamId,tokenHash,pinHash,email,now,accessSecret).run();
  return Response.json({url:`${publicAppOrigin(request)}/join-team?token=${token}`,pin,teamName:(JSON.parse(team.payload) as {name?:string}).name??"your team"});
}

export async function DELETE(request:Request){
  if(!isSameOrigin(request))return Response.json({error:"Invalid request origin"},{status:403});
  const user=await getGoogleUser();
  if(!user||user.provider==="team")return Response.json({error:"Treasurer sign-in required"},{status:401});
  let teamId=0;try{teamId=Number((await request.json() as {teamId?:unknown}).teamId)}catch{}
  if(!Number.isSafeInteger(teamId)||teamId<=0)return Response.json({error:"Invalid team"},{status:400});
  const email=user.email.toLowerCase();
  if(!await enforceApiRateLimit(`team-access-revoke:${email}`,10,60*60*1000))return Response.json({error:"Too many access changes. Try again later."},{status:429});
  const membership=await env.DB.prepare("SELECT role FROM team_memberships WHERE team_id = ? AND email = ?").bind(teamId,email).first<{role:string}>();
  if(membership?.role!=="treasurer")return Response.json({error:"Only a treasurer can manage team member access"},{status:403});
  await ensureTables();await env.DB.batch([
    env.DB.prepare("DELETE FROM team_member_access WHERE team_id = ?").bind(teamId),
    env.DB.prepare("DELETE FROM team_memberships WHERE team_id = ? AND email LIKE ?").bind(teamId,`team-${teamId}-player-%@member.wicketsplit.local`),
  ]);
  return Response.json({ok:true});
}
