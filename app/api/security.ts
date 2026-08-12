import { env } from "cloudflare:workers";

const productionOrigin = "https://www.wicketsplit.com";

export function publicAppOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  return requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1"
    ? requestUrl.origin
    : productionOrigin;
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export async function enforceApiRateLimit(key: string, limit: number, windowMs: number) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS api_rate_limits (
    rate_key TEXT PRIMARY KEY,
    window_start INTEGER NOT NULL,
    request_count INTEGER NOT NULL
  )`).run();
  const windowStart = Math.floor(Date.now() / windowMs);
  const row = await env.DB.prepare(`INSERT INTO api_rate_limits (rate_key, window_start, request_count)
    VALUES (?, ?, 1)
    ON CONFLICT(rate_key) DO UPDATE SET
      request_count = CASE WHEN window_start = excluded.window_start THEN request_count + 1 ELSE 1 END,
      window_start = excluded.window_start
    RETURNING request_count`).bind(key, windowStart).first<{request_count:number}>();
  return (row?.request_count ?? limit + 1) <= limit;
}

export const clientIp = (request: Request) => request.headers.get("cf-connecting-ip") ?? "unknown";
