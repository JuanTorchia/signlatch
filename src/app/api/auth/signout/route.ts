import { cookies } from "next/headers";

export async function POST(request: Request) {
  (await cookies()).delete("signlatch_session");
  return Response.redirect(new URL("/", request.url), 303);
}
