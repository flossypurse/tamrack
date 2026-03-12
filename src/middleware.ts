import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Routes that don't require auth
const publicRoutes = ["/", "/login", "/terms", "/privacy", "/pricing", "/municipalities", "/coverage"];
const publicPrefixes = ["/api/auth", "/api/webhooks", "/api/health", "/embed/"];

// Free pages — visible without subscription (part of the funnel)
// Users still need to be logged in, but don't need an active subscription
const freePages = [
  "/dashboard",
  "/energy",
  "/cycle",
  "/diversification",
  "/labour",
  "/migration",
  "/agriculture",
  "/signals",
  "/learn",
  "/docs",
  "/sources",
  "/municipalities",
  // Phase 1 audience expansion — free funnel to show value
  "/pipeline",
  "/rental",
  "/commercial",
  // Phase 2 — free funnel
  "/drilling",
  "/compare",
  // Briefings — role-based intelligence reports
  "/briefing",
];

function isPublicRoute(pathname: string) {
  if (publicRoutes.includes(pathname)) return true;
  return publicPrefixes.some((p) => pathname.startsWith(p));
}

function isApiRoute(pathname: string) {
  return pathname.startsWith("/api/");
}

function isAdminRoute(pathname: string) {
  return pathname.startsWith("/admin");
}

function isActiveSubscription(status: string | undefined, trialEnd: string | null | undefined): boolean {
  if (status === "active") return true;
  if (status === "trialing" && trialEnd) {
    return new Date(trialEnd) > new Date();
  }
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes — always pass through
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

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
  // Must detect HTTPS so getToken looks for the correct cookie name:
  // __Secure-authjs.session-token (HTTPS) vs authjs.session-token (HTTP)
  const secureCookie =
    req.headers.get("x-forwarded-proto") === "https" ||
    req.nextUrl.protocol === "https:";
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie,
  });

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
      return NextResponse.redirect(new URL("/dashboard", req.url));
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
    if (freePages.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/billing?expired=1", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
