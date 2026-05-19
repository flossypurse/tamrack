import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// ── Early-access invite wall (2026-05-18) ──────────────────────────────
// While EARLY_ACCESS != "false", only the routes below are public.
// Everything else requires authenticated session OR valid Bearer key.
// API routes additionally enforce scope checks in their route handlers.
//
// Flip EARLY_ACCESS=false at public launch — the broader publicRoutes /
// publicPrefixes lists kick back in then.
function earlyAccessOn(): boolean {
  return (process.env.EARLY_ACCESS ?? "true").toLowerCase() !== "false";
}

// Strict allow-list while invite wall is on. Anything not in this list and
// not /invite/<token> requires authentication.
const EARLY_ACCESS_PUBLIC_ROUTES = ["/", "/sunset", "/login", "/charts"];
const EARLY_ACCESS_PUBLIC_PREFIXES = [
  "/api/auth/",
  "/api/health",
  "/api/og",
  // Invite redemption surface — token in the path, validated by the page.
  "/invite/",
  // Chart catalogue — only public/free surface during early access.
  "/charts/",
  "/embed/",
];

// Tamrack-era surfaces that handle their own access gating internally
// (early_access flag + plan check via userHasTamrackAccess). Middleware
// passes any logged-in user through; the page/route handler does the
// real authorization check. Necessary because invitees on plan='founder'
// have NO Stripe subscription, so the legacy subscription check below
// would otherwise punt them to /billing.
const TAMRACK_SELF_GATED_PREFIXES = [
  "/d/",         // saved Smart UI dashboards
  "/ask",        // Smart UI query landing
  "/docs",       // Tamrack docs surface (Fumadocs)
  "/api/smart/", // Smart UI streaming + persistence APIs
  "/account",    // user account + key display
];

// Routes that don't require auth (public-launch mode).
// SEO strategy: macro pages are public to be indexed by Google.
// Users see value → hit paywall on deep-dives → sign up.
const publicRoutes = [
  "/", "/login", "/subscribe", "/terms", "/privacy", "/pricing",
  "/sunset",
  "/home/dashboard", "/municipalities",
  "/municipalities/coverage",
  // Category overview pages — rich SEO landing pages, no gated data
  "/economy", "/real-estate", "/community", "/environment", "/governance", "/tools",
  // Chart catalogue — public SEO funnel
  "/charts",
  // Pulse Learn — free course
  "/learn",
];
const publicPrefixes = [
  "/api/auth", "/api/webhooks", "/api/waitlist", "/api/health", "/api/og", "/embed/", "/waitlist/",
  // Category pages — all public for SEO (rank for "Alberta [topic]" queries)
  "/economy/", "/real-estate/", "/community/", "/environment/", "/governance/",
  // Municipality detail pages — public for SEO (dynamic metadata + OG tags)
  "/municipalities/",
  "/home/signals",
  // Tools
  "/tools/",
  // Chart catalogue — all chart pages are public
  "/charts/",
  // Pulse Learn — free public course
  "/learn/",
  "/api/learn/",
];

// Free pages — visible without subscription (part of the funnel)
// Users still need to be logged in, but don't need an active subscription
const freePages = [
  "/home/dashboard",
  "/municipalities",
  // Category overview pages — always free
  "/economy", "/real-estate", "/community", "/environment", "/governance", "/tools",
  // Briefings hub only — individual briefings require subscription
  "/home/briefings",
  "/tools/docs", "/tools/sources",
  // Phase 1 audience expansion — free funnel to show value
  "/real-estate/pipeline", "/real-estate/rental", "/real-estate/commercial",
  // Phase 2 — free funnel
  "/economy/drilling", "/economy/compare",
];
const freePrefixes = [
  "/economy/", "/community/", "/environment/", "/governance/",
  "/home/signals", "/home/learn",
];

// Pages where only exact match is free (sub-routes require subscription)
const freePagesExactOnly = new Set(["/home/briefings"]);

function isTamrackSelfGated(pathname: string): boolean {
  return TAMRACK_SELF_GATED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : p + "/"),
  );
}

function isPublicRoute(pathname: string) {
  if (earlyAccessOn()) {
    // Strict allow-list while invite wall is on.
    if (EARLY_ACCESS_PUBLIC_ROUTES.includes(pathname)) return true;
    return EARLY_ACCESS_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  }
  if (publicRoutes.includes(pathname)) return true;
  return publicPrefixes.some((p) => pathname.startsWith(p));
}

function isApiRoute(pathname: string) {
  return pathname.startsWith("/api/");
}

function isAdminRoute(pathname: string) {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

function isEdoRoute(pathname: string) {
  return pathname.startsWith("/edo");
}

function isRealtorRoute(pathname: string) {
  return pathname.startsWith("/realtor");
}

function isActiveSubscription(status: string | undefined, trialEnd: string | null | undefined): boolean {
  if (status === "active") return true;
  if (status === "trialing" && trialEnd) {
    return new Date(trialEnd) > new Date();
  }
  return false;
}

function isFreePage(pathname: string): boolean {
  if (freePages.some((p) => pathname === p || (!freePagesExactOnly.has(p) && pathname.startsWith(p + "/")))) {
    return true;
  }
  return freePrefixes.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Static files and Next.js internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // API routes — check for API key header (validation happens in route handler).
  // Accept tk_* (Tamrack) and ap_* (legacy dual-accept window).
  if (isApiRoute(pathname)) {
    const authHeader = req.headers.get("authorization");
    if (
      authHeader?.startsWith("Bearer tk_") ||
      authHeader?.startsWith("Bearer ap_")
    ) {
      return NextResponse.next();
    }
  }

  // Get JWT token (works in Edge Runtime — no DB access needed)
  const secureCookie =
    req.headers.get("x-forwarded-proto") === "https" ||
    req.nextUrl.protocol === "https:";
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie,
  });

  // Logged-in users hitting /login — skip the form, go to callbackUrl or dashboard
  if (token && pathname === "/login") {
    const callbackUrl = req.nextUrl.searchParams.get("callbackUrl");
    if (callbackUrl && callbackUrl.startsWith("/")) {
      return NextResponse.redirect(new URL(callbackUrl, req.url));
    }
    return NextResponse.redirect(new URL("/home/dashboard", req.url));
  }

  // Plan-aware redirects for logged-in users on public pages
  if (token && pathname === "/subscribe") {
    const plan = req.nextUrl.searchParams.get("plan");
    const userPlan = token.plan as string | undefined;
    const status = token.subscriptionStatus as string | undefined;
    const trialEnd = token.trialEnd as string | null | undefined;

    if (plan && plan === userPlan && isActiveSubscription(status, trialEnd)) {
      const dest = plan === "realtor" ? "/realtor/market" : plan === "edo" ? "/edo" : "/home/dashboard";
      return NextResponse.redirect(new URL(dest, req.url));
    }
  }

  // Returning user redirect: /home/dashboard → product dashboard if subscribed
  if (token && pathname === "/home/dashboard") {
    const userPlan = token.plan as string | undefined;
    const status = token.subscriptionStatus as string | undefined;
    const trialEnd = token.trialEnd as string | null | undefined;

    if (isActiveSubscription(status, trialEnd)) {
      if (userPlan === "realtor") {
        return NextResponse.redirect(new URL("/realtor/market", req.url));
      }
      if (userPlan === "edo") {
        return NextResponse.redirect(new URL("/edo", req.url));
      }
    }
  }

  // Public routes — always pass through
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // No token — redirect to login or return 401 for API
  if (!token) {
    if (isApiRoute(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes — check role
  if (isAdminRoute(pathname)) {
    if (token.role !== "admin") {
      return NextResponse.redirect(new URL("/home/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // EDO routes — require EDO plan + active subscription.
  // EDO is closed to new signups (2026-05-18); non-EDO users hitting these
  // routes go to /sunset, NOT /subscribe?plan=edo. Grandfathered EDO users
  // flow through unchanged.
  if (isEdoRoute(pathname)) {
    const plan = token.plan as string | undefined;
    const status = token.subscriptionStatus as string | undefined;
    const trialEnd = token.trialEnd as string | null | undefined;

    if (plan !== "edo" || !isActiveSubscription(status, trialEnd)) {
      return NextResponse.redirect(new URL("/sunset", req.url));
    }

    // EDO users without a municipality binding get redirected to onboarding
    // (which now shows a sunset notice; pre-existing users have municipality_id set)
    const municipalityId = token.municipalityId as string | null | undefined;
    if (!municipalityId && pathname !== "/edo/onboarding" && pathname !== "/edo/settings") {
      return NextResponse.redirect(new URL("/edo/onboarding", req.url));
    }

    return NextResponse.next();
  }

  // Realtor routes — require realtor plan + active subscription.
  // Real Estate is closed to new signups (2026-05-18); non-realtor users
  // hitting these routes go to /sunset. Grandfathered realtor users flow
  // through unchanged.
  if (isRealtorRoute(pathname)) {
    const plan = token.plan as string | undefined;
    const status = token.subscriptionStatus as string | undefined;
    const trialEnd = token.trialEnd as string | null | undefined;

    if (plan !== "realtor" || !isActiveSubscription(status, trialEnd)) {
      return NextResponse.redirect(new URL("/sunset", req.url));
    }

    // Realtor users without an operating area get redirected to onboarding
    // (which now shows a sunset notice; pre-existing users have operating_area set)
    const operatingArea = token.operatingArea as string[] | null | undefined;
    if ((!operatingArea || operatingArea.length === 0) && pathname !== "/realtor/onboarding" && pathname !== "/realtor/settings") {
      return NextResponse.redirect(new URL("/realtor/onboarding", req.url));
    }

    return NextResponse.next();
  }

  // Tamrack self-gated surfaces — pass any logged-in user through; the
  // page/route handler enforces the actual early_access/plan check.
  if (isTamrackSelfGated(pathname)) {
    return NextResponse.next();
  }

  // Check subscription for API routes
  if (isApiRoute(pathname)) {
    const status = token.subscriptionStatus as string | undefined;
    const trialEnd = token.trialEnd as string | null | undefined;
    if (!isActiveSubscription(status, trialEnd)) {
      return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Protected pages — check subscription
  const status = token.subscriptionStatus as string | undefined;
  const trialEnd = token.trialEnd as string | null | undefined;
  if (!isActiveSubscription(status, trialEnd)) {
    // Always allow billing/account pages
    if (pathname === "/billing" || pathname === "/account") {
      return NextResponse.next();
    }
    // Allow free funnel pages without subscription
    if (isFreePage(pathname)) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/billing?expired=1", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
