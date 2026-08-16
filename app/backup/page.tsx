import { requireGoogleUser } from "../google-auth";
import BackupClient from "./backup-client";
export const dynamic="force-dynamic";
export default async function BackupPage(){const user=await requireGoogleUser();if(user.provider==="team")return <main className="utility-page"><section className="utility-card"><h1>Treasurer account required</h1><p>Team-link players cannot export or restore team records.</p><a href="/app">Return to WicketSplit</a></section></main>;return <BackupClient/>}
