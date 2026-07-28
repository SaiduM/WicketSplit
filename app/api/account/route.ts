import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { getGoogleUser, sessionCookie } from "../../google-auth";

export async function DELETE() {
  const user = await getGoogleUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  await env.DB.prepare("DELETE FROM app_states WHERE team_key = ?").bind(user.email.toLowerCase()).run();
  (await cookies()).delete(sessionCookie.name);
  return Response.json({ ok: true });
}
