import Stripe from "stripe";
import { getDb } from "./db";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

export async function createCheckoutSession(userId: string, email: string) {
  const pool = await getDb();

  const { rows } = await pool.query(
    `SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1`,
    [userId]
  );
  let customerId = rows[0]?.stripe_customer_id as string | null;

  if (!customerId) {
    const customer = await stripe.customers.create({ email, metadata: { userId } });
    customerId = customer.id;
    await pool.query(
      `UPDATE subscriptions SET stripe_customer_id = $1 WHERE user_id = $2`,
      [customerId, userId]
    );
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
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1`,
    [userId]
  );

  if (!rows[0]?.stripe_customer_id) {
    throw new Error("No Stripe customer found");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: rows[0].stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
  });

  return session;
}

// ============================================================
// Webhook handlers — update local subscription state
// ============================================================

export async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const pool = await getDb();
  const userId = session.metadata?.userId;
  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  if (!userId) return;

  await pool.query(
    `UPDATE subscriptions SET id = $1, stripe_customer_id = $2, status = 'active', updated_at = NOW() WHERE user_id = $3`,
    [subscriptionId, customerId, userId]
  );
}

export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const pool = await getDb();
  const customerId = invoice.customer as string;

  const lineItem = invoice.lines?.data?.[0];
  if (!lineItem) return;

  const period = lineItem.period;
  await pool.query(
    `UPDATE subscriptions SET status = 'active', current_period_start = $1, current_period_end = $2, updated_at = NOW() WHERE stripe_customer_id = $3`,
    [
      period?.start ? new Date(period.start * 1000).toISOString() : null,
      period?.end ? new Date(period.end * 1000).toISOString() : null,
      customerId,
    ]
  );
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const pool = await getDb();
  const customerId = invoice.customer as string;
  await pool.query(
    `UPDATE subscriptions SET status = 'past_due', updated_at = NOW() WHERE stripe_customer_id = $1`,
    [customerId]
  );
}

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const pool = await getDb();
  const item = subscription.items?.data?.[0];
  const periodStart = item?.current_period_start
    ? new Date(item.current_period_start * 1000).toISOString()
    : null;
  const periodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000).toISOString()
    : null;

  await pool.query(
    `UPDATE subscriptions SET status = $1, cancel_at_period_end = $2, current_period_start = $3, current_period_end = $4, updated_at = NOW() WHERE stripe_customer_id = $5`,
    [
      subscription.status === "active" ? "active" : subscription.status === "trialing" ? "trialing" : subscription.status,
      subscription.cancel_at_period_end ? 1 : 0,
      periodStart,
      periodEnd,
      subscription.customer as string,
    ]
  );
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const pool = await getDb();
  await pool.query(
    `UPDATE subscriptions SET status = 'canceled', cancel_at_period_end = 0, updated_at = NOW() WHERE stripe_customer_id = $1`,
    [subscription.customer as string]
  );
}
