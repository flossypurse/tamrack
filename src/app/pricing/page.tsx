import { redirect } from "next/navigation";

// /pricing is retired during invite-only early access. Legacy invitee links
// and internal redirects (subscribe/billing/home/waitlist) still point here,
// so the route forwards to /access-request rather than 404ing.
export default async function PricingPage() {
  redirect("/access-request");
}
