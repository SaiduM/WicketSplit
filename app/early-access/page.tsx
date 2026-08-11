import { requireGoogleUser } from "../google-auth";
import EarlyAccessAdmin from "./early-access-admin";

export const dynamic="force-dynamic";

export default async function EarlyAccessPage(){
  await requireGoogleUser();
  return <EarlyAccessAdmin/>;
}

