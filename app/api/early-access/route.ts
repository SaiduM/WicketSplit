import { env } from "cloudflare:workers";
import { getGoogleUser } from "../../google-auth";
import { earlyAccessStatus, ensureEarlyAccessTable, isEarlyAccessAdmin } from "../../early-access-policy";
import { clientIp, enforceApiRateLimit, isSameOrigin } from "../security";

type RequestRow = {email:string;name:string;team_name:string;note:string;status:string;requested_at:string;reviewed_at:string|null;reviewed_by:string|null};

export async function GET() {
  const user=await getGoogleUser();
  if(!user||user.provider==="team")return Response.json({error:"Sign in required"},{status:401});
  await ensureEarlyAccessTable();
  const email=user.email.toLowerCase();
  if(!isEarlyAccessAdmin(email))return Response.json({status:await earlyAccessStatus(email),isAdmin:false});
  const rows=await env.DB.prepare("SELECT email,name,team_name,note,status,requested_at,reviewed_at,reviewed_by FROM early_access_requests ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, requested_at DESC LIMIT 200").all<RequestRow>();
  return Response.json({status:"approved",isAdmin:true,requests:rows.results});
}

export async function POST(request:Request){
  if(!isSameOrigin(request))return Response.json({error:"Invalid request origin"},{status:403});
  const user=await getGoogleUser();
  if(!user||user.provider==="team")return Response.json({error:"Sign in required"},{status:401});
  const email=user.email.toLowerCase();
  const allowed=await enforceApiRateLimit(`early-access-request:${email}`,5,24*60*60*1000)&&await enforceApiRateLimit(`early-access-request-ip:${clientIp(request)}`,20,24*60*60*1000);
  if(!allowed)return Response.json({error:"Too many requests. Try again tomorrow."},{status:429});
  const body=await request.json().catch(()=>null) as {teamName?:unknown;note?:unknown}|null;
  const teamName=typeof body?.teamName==="string"?body.teamName.trim():"";
  const note=typeof body?.note==="string"?body.note.trim():"";
  if(!teamName||teamName.length>160||note.length>800)return Response.json({error:"Enter a team name and keep the message under 800 characters."},{status:400});
  await ensureEarlyAccessTable();
  const existing=await earlyAccessStatus(email);
  if(existing==="approved")return Response.json({status:"approved"});
  const now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO early_access_requests (email,name,team_name,note,status,requested_at,reviewed_at,reviewed_by)
    VALUES (?,?,?,?, 'pending', ?,NULL,NULL)
    ON CONFLICT(email) DO UPDATE SET name=excluded.name,team_name=excluded.team_name,note=excluded.note,status='pending',requested_at=excluded.requested_at,reviewed_at=NULL,reviewed_by=NULL`)
    .bind(email,user.name.slice(0,160),teamName,note,now).run();
  return Response.json({status:"pending"});
}

export async function PATCH(request:Request){
  if(!isSameOrigin(request))return Response.json({error:"Invalid request origin"},{status:403});
  const user=await getGoogleUser();
  if(!user||!isEarlyAccessAdmin(user.email))return Response.json({error:"Administrator access required"},{status:403});
  const body=await request.json().catch(()=>null) as {email?:unknown;status?:unknown}|null;
  const email=typeof body?.email==="string"?body.email.trim().toLowerCase():"";
  const status=body?.status;
  if(!/^\S+@\S+\.\S+$/.test(email)||!['approved','rejected','pending'].includes(String(status)))return Response.json({error:"Invalid access update"},{status:400});
  await ensureEarlyAccessTable();
  const result=await env.DB.prepare("UPDATE early_access_requests SET status=?,reviewed_at=?,reviewed_by=? WHERE email=?")
    .bind(status,new Date().toISOString(),user.email.toLowerCase(),email).run();
  if(!result.meta.changes)return Response.json({error:"Request not found"},{status:404});
  return Response.json({ok:true});
}

