import { requireGoogleUser } from "../google-auth";
import Dashboard from "../dashboard";

export const dynamic = "force-dynamic";

export default async function Workspace() {
  const user = await requireGoogleUser();
  return <Dashboard user={{ name: user.name, email: user.email }} />;
}
