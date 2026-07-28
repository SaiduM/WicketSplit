import { cookies } from "next/headers";
import { sessionCookie } from "../../../google-auth";

export async function GET(request: Request) {
  (await cookies()).set(sessionCookie.name, "", { ...sessionCookie.options, maxAge: 0 });
  return Response.redirect(new URL("/", request.url));
}
