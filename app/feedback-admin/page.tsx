import { requireGoogleUser } from "../google-auth";
import FeedbackAdmin from "./feedback-admin";
export const dynamic="force-dynamic";
export default async function FeedbackAdminPage(){await requireGoogleUser();return <FeedbackAdmin/>}
