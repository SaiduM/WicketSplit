import { env } from "cloudflare:workers";

export type EarlyAccessStatus = "none" | "pending" | "approved" | "rejected";

const DEFAULT_ADMIN = "saidubabumallela@gmail.com";
const encode = (bytes:Uint8Array) => {let binary="";bytes.forEach(byte=>binary+=String.fromCharCode(byte));return btoa(binary)};
const decode = (value:string) => Uint8Array.from(atob(value),character=>character.charCodeAt(0));

export const hashEarlyAccessToken = async (value:string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(byte=>byte.toString(16).padStart(2,"0")).join("");
export const createEarlyAccessToken = () => crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","");

async function earlyAccessKey(){
  const secret=(env as unknown as Record<string,string>).SESSION_SECRET;
  if(!secret)throw new Error("SESSION_SECRET is not configured");
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`wicketsplit-early-access:${secret}`));
  return crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt","decrypt"]);
}

export async function encryptEarlyAccessToken(token:string){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},await earlyAccessKey(),new TextEncoder().encode(token));
  return `${encode(iv)}.${encode(new Uint8Array(encrypted))}`;
}

export async function decryptEarlyAccessToken(value:string|null){
  if(!value)return null;
  try{const [iv,ciphertext]=value.split(".");if(!iv||!ciphertext)return null;const clear=await crypto.subtle.decrypt({name:"AES-GCM",iv:decode(iv)},await earlyAccessKey(),decode(ciphertext));return new TextDecoder().decode(clear)}catch{return null}
}

export function isEarlyAccessAdmin(email: string) {
  const configured = ((env as unknown as Record<string, string>).EARLY_ACCESS_ADMIN_EMAILS ?? DEFAULT_ADMIN)
    .split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  return configured.includes(email.trim().toLowerCase());
}

export async function ensureEarlyAccessTable() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS early_access_requests (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      team_name TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      requested_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT,
      approval_token_hash TEXT,
      approval_token_secret TEXT,
      approval_expires_at TEXT,
      approval_used_at TEXT
    )`).run();
  for(const statement of [
    "ALTER TABLE early_access_requests ADD COLUMN approval_token_hash TEXT",
    "ALTER TABLE early_access_requests ADD COLUMN approval_token_secret TEXT",
    "ALTER TABLE early_access_requests ADD COLUMN approval_expires_at TEXT",
    "ALTER TABLE early_access_requests ADD COLUMN approval_used_at TEXT",
  ]){try{await env.DB.prepare(statement).run()}catch{}}
  await env.DB.batch([
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_early_access_status_requested ON early_access_requests(status, requested_at)"),
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_early_access_approval_token ON early_access_requests(approval_token_hash) WHERE approval_token_hash IS NOT NULL"),
  ]);
}

export async function earlyAccessStatus(email: string): Promise<EarlyAccessStatus> {
  if (isEarlyAccessAdmin(email)) return "approved";
  await ensureEarlyAccessTable();
  const row = await env.DB.prepare("SELECT status FROM early_access_requests WHERE email = ?")
    .bind(email.toLowerCase()).first<{status: Exclude<EarlyAccessStatus, "none">}>();
  return row?.status ?? "none";
}
