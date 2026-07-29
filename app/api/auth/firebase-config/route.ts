import { env } from "cloudflare:workers";
import { firebaseWebDefaults } from "../../../firebase-web-config";

export async function GET() {
  const values = env as unknown as Record<string, string>;
  const config = {
    apiKey: values.FIREBASE_API_KEY || firebaseWebDefaults.apiKey,
    authDomain: values.FIREBASE_AUTH_DOMAIN || firebaseWebDefaults.authDomain,
    projectId: values.FIREBASE_PROJECT_ID || firebaseWebDefaults.projectId,
    appId: values.FIREBASE_APP_ID || firebaseWebDefaults.appId,
  };
  const enabled = Object.values(config).every(Boolean);
  return Response.json(enabled ? { enabled, config } : { enabled: false }, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
