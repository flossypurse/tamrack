import Stripe from "stripe";
import { getDb } from "./db";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

export async function createCheckoutSession(userId: string, email: string) {
  const db = getDb();

  // Check for existing Stripe customer
  const sub = db.prepare(
    `SELECT stripe_customer_id FROM subscriptions WHERE user_id = ?`
  ).get(userId) as { stripe_customer_id: string | null } | undefined;

  let customerId = sub?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({ email, metadata: { userId } });
    customerId = customer.id;
    db.prepare(
      `UPDATE subscriptions SET stripe_customer_id = ? WHERE user_id = ?`
    ).run(customerId, userId);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?canceled=1`,
    metadata: { userId },
  });

  return session;
}

export async function createPortalSession(userId: string) {
  const db = getDb();
  const sub = db.prepare(
    `SELECT stripe_customer_id FROM subscriptions WHERE user_id = ?`
  ).get(userId) as { stripe_customer_id: string | null } | undefined;

  if (!sub?.stripe_customer_id) {
    throw new Error("No Stripe customer found");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
  });

  return session;
}

// ============================================================
// Webhook handlers — update local subscription state
// ============================================================

export function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const db = getDb();
  const userId = session.metadata?.userId;
  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  if (!userId) return;

  db.prepare(
    `UPDATE subscriptions SET id = ?, stripe_customer_id = ?, status = 'active', updated_at = datetime('now') WHERE user_id = ?`
  ).run(subscriptionId, customerId, userId);
}

export function handleInvoicePaid(invoice: Stripe.Invoice) {
  const db = getDb();
  const customerId = invoice.customer as string;

  // Only process subscription invoices
  const lineItem = invoice.lines?.data?.[0];
  if (!lineItem) return;

  const period = lineItem.period;
  db.prepare(
    `UPDATE subscriptions SET status = 'active', current_period_start = ?, current_period_end = ?, updated_at = datetime('now') WHERE stripe_customer_id = ?`
  ).run(
    period?.start ? new Date(period.start * 1000).toISOString() : null,
    period?.end ? new Date(period.end * 1000).toISOString() : null,
    customerId
  );
}

export function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const db = getDb();
  const customerId = invoice.customer as string;
  db.prepare(
    `UPDATE subscriptions SET status = 'past_due', updated_at = datetime('now') WHERE stripe_customer_id = ?`
  ).run(customerId);
}

export function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const db = getDb();
  // Period info is now on items in newer Stripe API versions
  const item = subscription.items?.data?.[0];
  const periodStart = item?.current_period_start
    ? new Date(item.current_period_start * 1000).toISOString()
    : null;
  const periodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000).toISOString()
    : null;

  db.prepare(
    `UPDATE subscriptions SET status = ?, cancel_at_period_end = ?, current_period_start = ?, current_period_end = ?, updated_at = datetime('now') WHERE stripe_customer_id = ?`
  ).run(
    subscription.status === "active" ? "active" : subscription.status === "trialing" ? "trialing" : subscription.status,
    subscription.cancel_at_period_end ? 1 : 0,
    periodStart,
    periodEnd,
    subscription.customer as string
  );
}

export function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const db = getDb();
  db.prepare(
    `UPDATE subscriptions SET status = 'canceled', cancel_at_period_end = 0, updated_at = datetime('now') WHERE stripe_customer_id = ?`
  ).run(subscription.customer as string);
}
