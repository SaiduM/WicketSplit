import { env } from "cloudflare:workers";
import { getGoogleUser } from "../../../google-auth";
import { ensureEarlyAccessTable, hashEarlyAccessToken } from "../../../early-access-policy";
import { clientIp, enforceApiRateLimit } from "../../security";

export async function GET(request:Request){
  const url=new URL(request.url);const token=url.searchParams.get("token")??"";
  if(!token||token.length>200)return Response.redirect(new URL("/login?access=invalid",url));
  const user=await getGoogleUser();
  if(!user)return Response.redirect(new URL(`/login?return_to=${encodeURIComponent(`/api/early-access/claim?token=${token}`)}`,url));
  if(user.provider==="team")return Response.redirect(new URL("/app?access=account-required",url));
  if(!await enforceApiRateLimit(`early-access-claim-ip:${clientIp(request)}`,30,60*60*1000))return Response.redirect(new URL("/login?access=rate-limited",url));
  await ensureEarlyAccessTable();const tokenHash=await hashEarlyAccessToken(token);const now=new Date().toISOString();
  const row=await env.DB.prepare("SELECT email,status,approval_expires_at,approval_used_at FROM early_access_requests WHERE approval_token_hash=?").bind(tokenHash).first<{email:string;status:string;approval_expires_at:string|null;approval_used_at:string|null}>();
  if(!row||!['pending','approved'].includes(row.status)||row.approval_used_at||!row.approval_expires_at||Date.parse(row.approval_expires_at)<=Date.now())return Response.redirect(new URL("/app?access=invalid-or-expired",url));
  if(row.email.toLowerCase()!==user.email.toLowerCase())return Response.redirect(new URL("/app?access=email-mismatch",url));
  const result=await env.DB.prepare("UPDATE early_access_requests SET status='approved',approval_used_at=?,approval_token_secret=NULL WHERE approval_token_hash=? AND approval_used_at IS NULL").bind(now,tokenHash).run();
  if(!result.meta.changes)return Response.redirect(new URL("/app?access=already-used",url));
  return Response.redirect(new URL("/app?access=approved",url));
}
