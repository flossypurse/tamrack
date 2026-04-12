import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Routes that don't require auth
// SEO strategy: macro pages are public to be indexed by Google.
// Users see value → hit paywall on deep-dives → sign up.
const publicRoutes = [
  "/", "/login", "/subscribe", "/terms", "/privacy", "/pricing",
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
  "/economy/", "/community/", "/environment/", "/governance/",
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

function isPublicRoute(pathname: string) {
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

  // API routes — check for API key header (validation happens in route handler)
  if (isApiRoute(pathname)) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ap_")) {
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

  // EDO routes — require EDO plan + active subscription
  if (isEdoRoute(pathname)) {
    const plan = token.plan as string | undefined;
    const status = token.subscriptionStatus as string | undefined;
    const trialEnd = token.trialEnd as string | null | undefined;

    if (plan !== "edo" || !isActiveSubscription(status, trialEnd)) {
      // Allow onboarding page for EDO trialing users who haven't picked a municipality yet
      if (pathname === "/edo/onboarding" && plan === "edo") {
        return NextResponse.next();
      }
      return NextResponse.redirect(new URL("/subscribe?plan=edo", req.url));
    }

    // EDO users without a municipality binding get redirected to onboarding
    const municipalityId = token.municipalityId as string | null | undefined;
    if (!municipalityId && pathname !== "/edo/onboarding" && pathname !== "/edo/settings") {
      return NextResponse.redirect(new URL("/edo/onboarding", req.url));
    }

    return NextResponse.next();
  }

  // Realtor routes — require realtor plan + active subscription
  if (isRealtorRoute(pathname)) {
    const plan = token.plan as string | undefined;
    const status = token.subscriptionStatus as string | undefined;
    const trialEnd = token.trialEnd as string | null | undefined;

    if (plan !== "realtor" || !isActiveSubscription(status, trialEnd)) {
      // Allow onboarding page for realtor users who haven't picked an area yet
      if (pathname === "/realtor/onboarding" && plan === "realtor") {
        return NextResponse.next();
      }
      return NextResponse.redirect(new URL("/subscribe?plan=realtor", req.url));
    }

    // Realtor users without an operating area get redirected to onboarding
    const operatingArea = token.operatingArea as string[] | null | undefined;
    if ((!operatingArea || operatingArea.length === 0) && pathname !== "/realtor/onboarding" && pathname !== "/realtor/settings") {
      return NextResponse.redirect(new URL("/realtor/onboarding", req.url));
    }

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
