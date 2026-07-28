import { env } from "cloudflare:workers";
import { getGoogleUser } from "../../../google-auth";

const hashToken = async (token: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))).map(byte=>byte.toString(16).padStart(2,"0")).join("");

export async function GET(request: Request) {
  const url=new URL(request.url); const token=url.searchParams.get("token")??"";
  if(!token||token.length>200) return Response.redirect(new URL("/?invite=invalid",url));
  const user=await getGoogleUser();
  if(!user) return Response.redirect(new URL(`/login?return_to=${encodeURIComponent(`/api/invites/accept?token=${token}`)}`,url));
  const tokenHash=await hashToken(token);
  const invite=await env.DB.prepare("SELECT team_id, player_id, expires_at, accepted_by FROM team_invites WHERE token_hash = ?").bind(tokenHash).first<{team_id:number;player_id:number;expires_at:string;accepted_by:string|null}>();
  if(!invite||invite.accepted_by||Date.parse(invite.expires_at)<=Date.now()) return Response.redirect(new URL("/app?invite=invalid",url));
  const email=user.email.toLowerCase(); const now=new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO team_memberships (team_id, email, role, player_id, joined_at) VALUES (?, ?, 'member', ?, ?)
      ON CONFLICT(team_id,email) DO NOTHING`).bind(invite.team_id,email,invite.player_id,now),
    env.DB.prepare("UPDATE team_invites SET accepted_by = ?, accepted_at = ? WHERE token_hash = ? AND accepted_by IS NULL").bind(email,now,tokenHash),
  ]);
  return Response.redirect(new URL("/app?invite=joined",url));
}
