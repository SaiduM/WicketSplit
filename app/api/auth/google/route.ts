import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { createSessionToken, sessionCookie } from "../../../google-auth";
import { isSameOrigin } from "../../security";

type GooglePayload = {
  sub: string; email: string; name?: string; picture?: string;
  aud: string; iss: string; exp: number; email_verified?: boolean;
};

function decodePart(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return JSON.parse(atob(normalized + "=".repeat((4 - normalized.length % 4) % 4)));
}

function decodeSignature(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function verifyGoogleCredential(token: string): Promise<GooglePayload | null> {
  try {
    const [headerPart, payloadPart, signaturePart] = token.split(".");
    if (!headerPart || !payloadPart || !signaturePart) return null;
    const header = decodePart(headerPart) as { alg?: string; kid?: string };
    const payload = decodePart(payloadPart) as GooglePayload;
    if (header.alg !== "RS256" || !header.kid) return null;
    const clientId = (env as unknown as Record<string, string>).GOOGLE_CLIENT_ID;
    const now = Math.floor(Date.now() / 1000);
    if (!clientId || payload.aud !== clientId || !["accounts.google.com","https://accounts.google.com"].includes(payload.iss) ||
        payload.exp <= now || payload.email_verified !== true || !payload.email || !payload.sub) return null;
    const keysResponse = await fetch("https://www.googleapis.com/oauth2/v3/certs");
    if (!keysResponse.ok) return null;
    const { keys } = await keysResponse.json() as { keys: JsonWebKey[] };
    const jwk = keys.find(key => key.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const signed = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decodeSignature(signaturePart), signed) ? payload : null;
  } catch { return null; }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS api_rate_limits (
    rate_key TEXT PRIMARY KEY,
    window_start INTEGER NOT NULL,
    request_count INTEGER NOT NULL
  )`).run();
  const identity = request.headers.get("cf-connecting-ip") ?? "unknown";
  const windowStart = Math.floor(Date.now() / 60_000);
  const rate = await env.DB.prepare(`INSERT INTO api_rate_limits (rate_key, window_start, request_count)
    VALUES (?, ?, 1)
    ON CONFLICT(rate_key) DO UPDATE SET
      request_count = CASE WHEN window_start = excluded.window_start THEN request_count + 1 ELSE 1 END,
      window_start = excluded.window_start
    RETURNING request_count`).bind(`google-login:${identity}`, windowStart).first<{ request_count: number }>();
  if ((rate?.request_count ?? 21) > 20) return Response.json({ error: "Too many sign-in attempts" }, { status: 429, headers: { "Retry-After": "60" } });
  let credential = "";
  try { credential = String((await request.json() as { credential?: unknown }).credential ?? ""); } catch {}
  if (!credential || credential.length > 10_000) return Response.json({ error: "Invalid credential" }, { status: 400 });
  const profile = await verifyGoogleCredential(credential);
  if (!profile) return Response.json({ error: "Google verification failed" }, { status: 401 });
  const token = await createSessionToken({
    sub: profile.sub, email: profile.email.toLowerCase(), name: profile.name ?? profile.email, picture: profile.picture, provider: "google",
  });
  (await cookies()).set(sessionCookie.name, token, sessionCookie.options);
  return Response.json({ ok: true });
}
