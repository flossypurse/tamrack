"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Activity, Mail, Loader2 } from "lucide-react";
import { trackEvent } from "@/components/analytics";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");
  const rawCallbackUrl = searchParams.get("callbackUrl") || "/home/dashboard";
  const callbackUrl = plan && !rawCallbackUrl.includes("plan=")
    ? `${rawCallbackUrl}${rawCallbackUrl.includes("?") ? "&" : "?"}plan=${plan}`
    : rawCallbackUrl;
  const authError = searchParams.get("error");

  const heading = plan === "realtor"
    ? "Start Pulse Real Estate"
    : plan === "edo"
    ? "Start Pulse EDO"
    : "Sign in to Alberta Pulse Check";

  const subtitle = plan === "realtor"
    ? "$49/mo per seat — sign in to begin"
    : plan === "edo"
    ? "$299/mo per municipality — sign in to begin"
    : "Community intelligence for Alberta decision-makers";

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      trackEvent("sign_up_intent", "conversion", "login_page");
      const result = await signIn("nodemailer", {
        email,
        callbackUrl,
        redirect: false,
      });
      if (result?.error) {
        setError("Failed to send magic link. Please try again.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
          <Mail size={32} className="text-accent" />
        </div>
        <h2 className="text-xl font-semibold">Check your email</h2>
        <p className="text-muted text-sm">
          We sent a sign-in link to <span className="text-foreground font-medium">{email}</span>.
          <br />Click the link to access your dashboard.
        </p>
        <button
          onClick={() => setSent(false)}
          className="text-sm text-accent hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">{heading}</h1>
        <p className="text-muted text-sm">
          {subtitle}
        </p>
      </div>

      {(authError || error) && (
        <div className="bg-accent-red/10 border border-accent-red/20 rounded-lg p-3 text-sm text-accent-red">
          {error || "There was an error signing in. Please try again."}
        </div>
      )}

      {/* Magic Link */}
      <form onSubmit={handleEmail} className="space-y-3">
        <label className="block text-sm font-medium text-muted">Email address</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-4 py-2.5 bg-card border border-card-border rounded-lg text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Mail size={16} />
          )}
          {loading ? "Sending..." : "Send magic link"}
        </button>
      </form>

      {/* Divider */}
      {process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-card-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-2 text-muted">or</span>
            </div>
          </div>

          {/* Google */}
          <button
            onClick={() => signIn("google", { callbackUrl: callbackUrl })}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-card-border rounded-lg text-foreground hover:bg-card transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </>
      )}

      <p className="text-center text-xs text-muted/60">
        By signing in, you agree to our{" "}
        <Link href="/terms" className="text-accent hover:underline">Terms</Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-accent hover:underline">Privacy Policy</Link>.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Activity size={28} className="text-accent" />
          <span className="text-lg font-semibold">Alberta Pulse Check</span>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6">
          <Suspense fallback={<div className="h-64 animate-pulse bg-card-border/50 rounded" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
