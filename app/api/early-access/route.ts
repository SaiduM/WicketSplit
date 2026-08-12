import { env } from "cloudflare:workers";
import { getGoogleUser } from "../../google-auth";
import { createEarlyAccessToken, decryptEarlyAccessToken, earlyAccessStatus, encryptEarlyAccessToken, ensureEarlyAccessTable, hashEarlyAccessToken, isEarlyAccessAdmin } from "../../early-access-policy";
import { clientIp, enforceApiRateLimit, isSameOrigin } from "../security";

type RequestRow = {email:string;name:string;team_name:string;note:string;status:"pending"|"approved"|"rejected";requested_at:string;reviewed_at:string|null;reviewed_by:string|null;approval_token_secret:string|null;approval_expires_at:string|null;approval_used_at:string|null};
const validEmail=(value:string)=>/^\S+@\S+\.\S+$/.test(value)&&value.length<=254;

async function publicRow(row:RequestRow,origin:string){
  const token=!row.approval_used_at&&row.approval_expires_at&&Date.parse(row.approval_expires_at)>Date.now()?await decryptEarlyAccessToken(row.approval_token_secret):null;
  return {...row,status:token?"approved":row.status,approval_token_secret:undefined,signupUrl:token?`${origin}/login?email=${encodeURIComponent(row.email)}&register=1&return_to=${encodeURIComponent(`/api/early-access/claim?token=${token}`)}`:null};
}

export async function GET(request:Request) {
  const user=await getGoogleUser();
  if(!user||user.provider==="team")return Response.json({error:"Sign in required"},{status:401});
  await ensureEarlyAccessTable();
  const email=user.email.toLowerCase();
  if(!isEarlyAccessAdmin(email))return Response.json({status:await earlyAccessStatus(email),isAdmin:false});
  const rows=await env.DB.prepare("SELECT email,name,team_name,note,status,requested_at,reviewed_at,reviewed_by,approval_token_secret,approval_expires_at,approval_used_at FROM early_access_requests ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, requested_at DESC LIMIT 200").all<RequestRow>();
  const origin=new URL(request.url).origin;
  const requests=await Promise.all(rows.results.map(row=>publicRow(row,origin)));
  return Response.json({status:"approved",isAdmin:true,requests});
}

export async function POST(request:Request){
  if(!isSameOrigin(request))return Response.json({error:"Invalid request origin"},{status:403});
  if(Number(request.headers.get("content-length")??"0")>4_096)return Response.json({error:"Request is too large"},{status:413});
  const body=await request.json().catch(()=>null) as {name?:unknown;email?:unknown;teamName?:unknown;note?:unknown}|null;
  const name=typeof body?.name==="string"?body.name.trim():"";
  const email=typeof body?.email==="string"?body.email.trim().toLowerCase():"";
  const teamName=typeof body?.teamName==="string"?body.teamName.trim():"";
  const note=typeof body?.note==="string"?body.note.trim():"";
  if(!name||name.length>160||!validEmail(email)||!teamName||teamName.length>160||note.length>800)return Response.json({error:"Enter your name, a valid email, and your team name."},{status:400});
  const allowed=await enforceApiRateLimit(`early-access-request:${email}`,5,24*60*60*1000)&&await enforceApiRateLimit(`early-access-request-ip:${clientIp(request)}`,20,24*60*60*1000);
  if(!allowed)return Response.json({error:"Too many requests. Try again tomorrow."},{status:429});
  await ensureEarlyAccessTable();
  const now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO early_access_requests (email,name,team_name,note,status,requested_at,reviewed_at,reviewed_by)
    VALUES (?,?,?,?, 'pending', ?,NULL,NULL)
    ON CONFLICT(email) DO UPDATE SET name=excluded.name,team_name=excluded.team_name,note=excluded.note,
      status=CASE WHEN early_access_requests.status='approved' THEN 'approved' ELSE 'pending' END,
      requested_at=CASE WHEN early_access_requests.status='approved' THEN early_access_requests.requested_at ELSE excluded.requested_at END,
      reviewed_at=CASE WHEN early_access_requests.status='approved' THEN early_access_requests.reviewed_at ELSE NULL END,
      reviewed_by=CASE WHEN early_access_requests.status='approved' THEN early_access_requests.reviewed_by ELSE NULL END`)
    .bind(email,name,teamName,note,now).run();
  return Response.json({ok:true,message:"If this email is eligible, the request is now awaiting review."});
}

export async function PATCH(request:Request){
  if(!isSameOrigin(request))return Response.json({error:"Invalid request origin"},{status:403});
  const user=await getGoogleUser();
  if(!user||!isEarlyAccessAdmin(user.email))return Response.json({error:"Administrator access required"},{status:403});
  const body=await request.json().catch(()=>null) as {email?:unknown;status?:unknown}|null;
  const email=typeof body?.email==="string"?body.email.trim().toLowerCase():"";
  const status=body?.status;
  if(!validEmail(email)||!['approved','rejected','pending'].includes(String(status)))return Response.json({error:"Invalid access update"},{status:400});
  if(!await enforceApiRateLimit(`early-access-review:${user.email.toLowerCase()}`,100,60*60*1000))return Response.json({error:"Too many access changes. Try again later."},{status:429});
  await ensureEarlyAccessTable();
  const now=new Date();let token:string|null=null;let hash:string|null=null;let secret:string|null=null;let expiresAt:string|null=null;
  if(status==="approved"){
    token=createEarlyAccessToken();hash=await hashEarlyAccessToken(token);secret=await encryptEarlyAccessToken(token);expiresAt=new Date(now.getTime()+7*24*60*60*1000).toISOString();
  }
  const storedStatus=status==="approved"?"pending":status;
  const result=await env.DB.prepare("UPDATE early_access_requests SET status=?,reviewed_at=?,reviewed_by=?,approval_token_hash=?,approval_token_secret=?,approval_expires_at=?,approval_used_at=NULL WHERE email=?")
    .bind(storedStatus,now.toISOString(),user.email.toLowerCase(),hash,secret,expiresAt,email).run();
  if(!result.meta.changes)return Response.json({error:"Request not found"},{status:404});
  const signupUrl=token?`${new URL(request.url).origin}/login?email=${encodeURIComponent(email)}&register=1&return_to=${encodeURIComponent(`/api/early-access/claim?token=${token}`)}`:null;
  return Response.json({ok:true,signupUrl,expiresAt});
}
