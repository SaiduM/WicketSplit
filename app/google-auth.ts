import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type GoogleUser = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  provider?: "google" | "phone";
  phoneNumber?: string;
  exp: number;
};
const COOKIE_NAME = "wicketsplit_session";

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function sessionKey() {
  const secret = (env as unknown as Record<string, string>).SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSessionToken(user: Omit<GoogleUser, "exp">, maxAge = 60 * 60 * 24 * 30) {
  const payload: GoogleUser = { ...user, exp: Math.floor(Date.now() / 1000) + maxAge };
  const encoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await sessionKey(), new TextEncoder().encode(encoded));
  return `${encoded}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token: string): Promise<GoogleUser | null> {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const valid = await crypto.subtle.verify("HMAC", await sessionKey(), base64UrlDecode(signature), new TextEncoder().encode(encoded));
  if (!valid) return null;
  try {
    const user = JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded))) as GoogleUser;
    return user.exp > Math.floor(Date.now() / 1000) &&
      typeof user.email === "string" &&
      typeof user.sub === "string" &&
      typeof user.name === "string" ? user : null;
  } catch { return null; }
}

export async function getGoogleUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return token ? verifySessionToken(token) : null;
}

export async function requireGoogleUser() {
  const user = await getGoogleUser();
  if (!user) redirect("/login?return_to=/app");
  return user;
}

export const sessionCookie = {
  name: COOKIE_NAME,
  options: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 30 },
};
