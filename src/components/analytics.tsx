"use client";

import Script from "next/script";
import { useCookieConsent } from "./cookie-consent";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function Analytics() {
  const consent = useCookieConsent();

  if (!GA_ID || consent !== "granted") return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}

// ---------------------------------------------------------------------------
// Custom event helpers
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function sendEvent(name: string, params?: Record<string, string>) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", name, params);
  }
}

/** Track sign-up button click */
export function trackSignUp() {
  sendEvent("sign_up");
}

/** Track free trial activation */
export function trackTrialStart() {
  sendEvent("trial_start");
}

/** Track subscription conversion */
export function trackSubscribe(plan: string) {
  sendEvent("subscribe", { plan });
}

/** Generic event — used by pages that fire custom event names */
export function trackEvent(name: string, category?: string, label?: string) {
  sendEvent(name, {
    ...(category ? { event_category: category } : {}),
    ...(label ? { event_label: label } : {}),
  });
}

/** Manual page view (use when client-side routing skips the gtag default) */
export function trackPageView(path: string) {
  if (typeof window !== "undefined" && window.gtag && GA_ID) {
    window.gtag("config", GA_ID, { page_path: path });
  }
}
