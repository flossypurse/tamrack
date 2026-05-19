import { redirect } from "next/navigation";

// `edo` mapping removed 2026-05-18 — Pulse EDO sunset to new signups; any
// waitlist links that hit /waitlist/edo now fall through to /sunset.
const redirects: Record<string, string> = {
  learn: "/learn",
  edo: "/sunset",
  realtor: "/sunset",
};

export default async function WaitlistPage({ params }: { params: Promise<{ product: string }> }) {
  const { product } = await params;
  const dest = redirects[product] || "/pricing";
  redirect(dest);
}
