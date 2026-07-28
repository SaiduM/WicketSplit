import { requireChatGPTUser } from "../chatgpt-auth";
import Dashboard from "../dashboard";

export const dynamic = "force-dynamic";

export default async function Workspace() {
  const user = await requireChatGPTUser("/app");
  return <Dashboard user={{ name: user.fullName ?? user.displayName, email: user.email }} />;
}
