import { env } from "cloudflare:workers";

export async function GET() {
  const values = env as unknown as Record<string, string>;
  const config = {
    apiKey: values.FIREBASE_API_KEY,
    authDomain: values.FIREBASE_AUTH_DOMAIN,
    projectId: values.FIREBASE_PROJECT_ID,
    appId: values.FIREBASE_APP_ID,
  };
  const enabled = Object.values(config).every(Boolean);
  return Response.json(enabled ? { enabled, config } : { enabled: false }, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
