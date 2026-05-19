import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createCheckoutSession, createPortalSession } from "@/lib/stripe";

// Pulse EDO + Pulse Real Estate sunset to new signups 2026-05-18.
// Any checkout requests for those plans return 410 Gone. Existing
// subscribers still use the customer portal (action === "portal").
const SUNSET_PLANS = new Set(["edo", "realtor"]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, plan } = await req.json();

  if (action === "checkout") {
    if (typeof plan !== "string" || plan.length === 0) {
      return NextResponse.json(
        { error: "plan is required for checkout" },
        { status: 400 }
      );
    }
    if (SUNSET_PLANS.has(plan)) {
      return NextResponse.json(
        {
          error: "product_sunset",
          message:
            "This product is no longer offered to new subscribers. Existing subscriptions continue at the current price.",
        },
        { status: 410 }
      );
    }
    const checkout = await createCheckoutSession(session.user.id, session.user.email!, plan);
    return NextResponse.json({ url: checkout.url });
  }

  if (action === "portal") {
    const portal = await createPortalSession(session.user.id);
    return NextResponse.json({ url: portal.url });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
