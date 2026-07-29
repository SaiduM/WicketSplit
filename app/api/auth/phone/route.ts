import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { createSessionToken, sessionCookie } from "../../../google-auth";
import { firebaseWebDefaults } from "../../../firebase-web-config";

type FirebasePayload = {
  sub: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
  auth_time: number;
  phone_number?: string;
  firebase?: { sign_in_provider?: string };
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

async function verifyFirebaseToken(token: string): Promise<FirebasePayload | null> {
  try {
    const [headerPart, payloadPart, signaturePart] = token.split(".");
    if (!headerPart || !payloadPart || !signaturePart) return null;
    const header = decodePart(headerPart) as { alg?: string; kid?: string };
    const payload = decodePart(payloadPart) as FirebasePayload;
    const projectId = (env as unknown as Record<string, string>).FIREBASE_PROJECT_ID || firebaseWebDefaults.projectId;
    const now = Math.floor(Date.now() / 1000);
    if (!projectId || header.alg !== "RS256" || !header.kid ||
        payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}` ||
        payload.exp <= now || payload.iat > now || payload.auth_time > now ||
        payload.firebase?.sign_in_provider !== "phone" || !payload.phone_number || !payload.sub) return null;
    const response = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    if (!response.ok) return null;
    const keys = await response.json() as Record<string, JsonWebKey>;
    const jwk = keys[header.kid];
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const signed = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decodeSignature(signaturePart), signed) ? payload : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
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
    RETURNING request_count`).bind(`phone-login:${identity}`, windowStart).first<{ request_count: number }>();
  if ((rate?.request_count ?? 11) > 10) {
    return Response.json({ error: "Too many sign-in attempts" }, { status: 429, headers: { "Retry-After": "60" } });
  }
  let idToken = "";
  try { idToken = String((await request.json() as { idToken?: unknown }).idToken ?? ""); } catch {}
  if (!idToken || idToken.length > 10_000) return Response.json({ error: "Invalid credential" }, { status: 400 });
  const profile = await verifyFirebaseToken(idToken);
  if (!profile?.phone_number) return Response.json({ error: "Phone verification failed" }, { status: 401 });
  const phoneNumber = profile.phone_number;
  const token = await createSessionToken({
    sub: `firebase:${profile.sub}`,
    email: `phone:${phoneNumber}`,
    name: phoneNumber,
    provider: "phone",
    phoneNumber,
  });
  (await cookies()).set(sessionCookie.name, token, sessionCookie.options);
  return Response.json({ ok: true });
}
