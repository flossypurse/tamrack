import Stripe from "stripe";
import { getDb } from "./db";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

// Plan-specific Stripe price IDs.
// `pro` was a phantom plan (never had a Stripe product); removed 2026-05-18.
// EDO and Realtor are sunset to new signups but the price IDs stay defined
// so the billing portal can still manage existing subscriptions.
const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  edo: process.env.STRIPE_EDO_PRICE_ID,
  realtor: process.env.STRIPE_REALTOR_PRICE_ID,
};

export async function createCheckoutSession(userId: string, email: string, plan: string) {
  if (!plan) {
    throw new Error("createCheckoutSession requires an explicit plan");
  }
  const priceId = PLAN_PRICE_IDS[plan];
  if (!priceId) {
    throw new Error(`No Stripe price ID configured for plan: ${plan}`);
  }
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

  // Update subscription plan type
  await pool.query(
    `UPDATE subscriptions SET plan = $1, updated_at = NOW() WHERE user_id = $2`,
    [plan, userId]
  );

  const successUrl = plan === "edo"
    ? `${process.env.NEXT_PUBLIC_APP_URL}/edo/onboarding?success=1`
    : plan === "realtor"
    ? `${process.env.NEXT_PUBLIC_APP_URL}/realtor/onboarding?success=1`
    : `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=1`;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?canceled=1`,
    metadata: { userId, plan },
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
  // Plan is set by createCheckoutSession via metadata — no longer falls back to
  // 'pro' (phantom plan retired 2026-05-18). If metadata is missing, bail.
  const plan = session.metadata?.plan;
  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  if (!userId || !plan) return;

  await pool.query(
    `UPDATE subscriptions SET id = $1, stripe_customer_id = $2, status = 'active', plan = $3, updated_at = NOW() WHERE user_id = $4`,
    [subscriptionId, customerId, plan, userId]
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
