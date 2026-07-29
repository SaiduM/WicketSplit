import { env } from "cloudflare:workers";
import { getGoogleUser } from "../../../google-auth";
import { clientIp, enforceApiRateLimit } from "../../security";

const hashToken = async (token: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))).map(byte=>byte.toString(16).padStart(2,"0")).join("");

export async function GET(request: Request) {
  const url=new URL(request.url); const token=url.searchParams.get("token")??"";
  if(!token||token.length>200) return Response.redirect(new URL("/?invite=invalid",url));
  const ipAllowed=await enforceApiRateLimit(`invite-accept-ip:${clientIp(request)}`,30,60*1000);
  if(!ipAllowed) return Response.redirect(new URL("/login?invite=rate-limited",url));
  const user=await getGoogleUser();
  if(!user) return Response.redirect(new URL(`/login?return_to=${encodeURIComponent(`/api/invites/accept?token=${token}`)}`,url));
  const email=user.email.toLowerCase();
  const accountAllowed=await enforceApiRateLimit(`invite-accept:${email}`,20,60*1000);
  if(!accountAllowed) return Response.redirect(new URL("/app?invite=rate-limited",url));
  try { await env.DB.prepare("ALTER TABLE team_invites ADD COLUMN intended_email TEXT").run(); } catch {}
  const tokenHash=await hashToken(token);
  const invite=await env.DB.prepare("SELECT team_id, player_id, expires_at, accepted_by, invite_role, intended_email FROM team_invites WHERE token_hash = ?").bind(tokenHash).first<{team_id:number;player_id:number;expires_at:string;accepted_by:string|null;invite_role:"treasurer"|"member";intended_email:string|null}>();
  if(!invite||invite.accepted_by||Date.parse(invite.expires_at)<=Date.now()) return Response.redirect(new URL("/app?invite=invalid",url));
  const now=new Date().toISOString();
  if(invite.intended_email&&invite.intended_email!==email) return Response.redirect(new URL("/app?invite=email-mismatch",url));
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO team_memberships (team_id, email, role, player_id, joined_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(team_id,email) DO UPDATE SET role = excluded.role, player_id = excluded.player_id`).bind(invite.team_id,email,invite.invite_role??"member",invite.player_id,now),
    env.DB.prepare("UPDATE team_invites SET accepted_by = ?, accepted_at = ? WHERE token_hash = ? AND accepted_by IS NULL").bind(email,now,tokenHash),
  ]);
  return Response.redirect(new URL("/app?invite=joined",url));
}
