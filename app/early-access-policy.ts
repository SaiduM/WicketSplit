import { env } from "cloudflare:workers";

export type EarlyAccessStatus = "none" | "pending" | "approved" | "rejected";

const DEFAULT_ADMIN = "saidubabumallela@gmail.com";

export function isEarlyAccessAdmin(email: string) {
  const configured = ((env as unknown as Record<string, string>).EARLY_ACCESS_ADMIN_EMAILS ?? DEFAULT_ADMIN)
    .split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  return configured.includes(email.trim().toLowerCase());
}

export async function ensureEarlyAccessTable() {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS early_access_requests (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      team_name TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      requested_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_early_access_status_requested ON early_access_requests(status, requested_at)"),
  ]);
}

export async function earlyAccessStatus(email: string): Promise<EarlyAccessStatus> {
  if (isEarlyAccessAdmin(email)) return "approved";
  await ensureEarlyAccessTable();
  const row = await env.DB.prepare("SELECT status FROM early_access_requests WHERE email = ?")
    .bind(email.toLowerCase()).first<{status: Exclude<EarlyAccessStatus, "none">}>();
  return row?.status ?? "none";
}

