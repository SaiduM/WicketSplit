import { getGoogleUser } from "../google-auth";
import FeedbackForm from "./feedback-form";
export const dynamic="force-dynamic";
export default async function FeedbackPage(){const user=await getGoogleUser();return <FeedbackForm signedIn={Boolean(user)} email={user&&!user.email.endsWith("@member.wicketsplit.local")?user.email:""}/>}
