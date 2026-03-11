import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createCheckoutSession, createPortalSession } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action } = await req.json();

  if (action === "checkout") {
    const checkout = await createCheckoutSession(session.user.id, session.user.email!);
    return NextResponse.json({ url: checkout.url });
  }

  if (action === "portal") {
    const portal = await createPortalSession(session.user.id);
    return NextResponse.json({ url: portal.url });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
