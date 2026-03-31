import { NextResponse } from "next/server";
import { auth } from "./auth";

/**
 * Verify the current session is an authenticated admin.
 * Returns the session if valid, or a 401/403 NextResponse if not.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { authorized: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "admin") {
    return { authorized: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { authorized: true as const, session };
}
