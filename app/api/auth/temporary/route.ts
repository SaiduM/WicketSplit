import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { createSessionToken, sessionCookie } from "../../../google-auth";

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function GET(request: Request) {
  const runtime = env as unknown as Record<string, string>;
  const expectedToken = runtime.TEMP_ACCESS_TOKEN ?? "";
  const email = runtime.TEMP_ACCESS_EMAIL?.trim().toLowerCase() ?? "";
  const expiresAt = Date.parse(runtime.TEMP_ACCESS_EXPIRES_AT ?? "");
  const suppliedToken = new URL(request.url).searchParams.get("token") ?? "";

  if (!expectedToken || !email || !Number.isFinite(expiresAt) || Date.now() >= expiresAt || !safeEqual(suppliedToken, expectedToken)) {
    return Response.redirect(new URL("/login?return_to=/app&temporary_access=invalid", request.url));
  }

  const token = await createSessionToken({ sub: `temporary:${email}`, email, name: email.split("@")[0] });
  (await cookies()).set(sessionCookie.name, token, sessionCookie.options);
  return Response.redirect(new URL("/app", request.url));
}
