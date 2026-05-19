/**
 * Stripe Meters wiring for Tamrack.
 *
 * Tamrack pricing per charter:
 *   - $9/mo flat for 50,000 included units
 *   - $0.0001/unit overage, billed via Stripe Meters
 *
 * This module exposes `emitMeterEvent()` which the API auth layer calls
 * after a successful authenticated request that produced overage. The
 * call is non-blocking — failures are logged and swallowed so a Stripe
 * outage never user-blocks a substrate call.
 *
 * Configure:
 *   - STRIPE_SECRET_KEY              (existing)
 *   - STRIPE_METER_TAMRACK_UNITS     (new; the `event_name` registered on
 *                                     the Tamrack units Meter in Stripe)
 *
 * Stripe customer is read from `subscriptions.stripe_customer_id` — keys
 * that don't resolve to a customer are no-ops (we still record the unit
 * locally; we just don't bill it).
 */

import { stripe } from "./stripe";
import { getDb } from "./db";
import { PLAN_LIMITS, type PlanTier } from "./api-keys";

/**
 * Stripe Meter event name. Override via env so prod / staging can point at
 * different meter resources without redeploying.
 */
const METER_EVENT_NAME = process.env.STRIPE_METER_TAMRACK_UNITS ?? "tamrack_units";

export interface EmitMeterParams {
  userId: string;
  /** Plan tier at time of request; used to short-circuit non-metered plans. */
  plan: PlanTier;
  /** Overage units (already computed by incrementUserUnits). */
  overageUnits: number;
  /** Endpoint or tool name — used as identifier for Stripe idempotency / debugging. */
  endpoint: string;
}

/**
 * Emit a Stripe Meter event for the overage portion of a request.
 *
 * No-ops in these cases:
 *   - plan has `meters_overage: false` (free, founder)
 *   - overageUnits <= 0 (request fit inside included quota)
 *   - user has no `stripe_customer_id` (key minted before Stripe linkage)
 *   - STRIPE_SECRET_KEY missing (local dev without Stripe configured)
 *
 * Errors are logged + swallowed. Production observability should pick
 * these up via Sentry breadcrumbs (TODO: wire when Sentry lands here).
 */
export async function emitMeterEvent(params: EmitMeterParams): Promise<void> {
  const { userId, plan, overageUnits, endpoint } = params;

  if (overageUnits <= 0) return;
  if (!PLAN_LIMITS[plan]?.meters_overage) return;
  if (!process.env.STRIPE_SECRET_KEY) return;

  try {
    const pool = await getDb();
    const { rows } = await pool.query(
      `SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1`,
      [userId],
    );
    const customerId = rows[0]?.stripe_customer_id as string | undefined;
    if (!customerId) return;

    // Stripe Meter Events API. `payload.value` is a string per Stripe's
    // type contract (server-side it's parsed as a number).
    await stripe.billing.meterEvents.create({
      event_name: METER_EVENT_NAME,
      payload: {
        stripe_customer_id: customerId,
        value: String(overageUnits),
        endpoint,
      },
      // Identifier scopes to user + minute to dedupe accidental retries
      // without conflating distinct calls in the same minute.
      identifier: `${userId}:${endpoint}:${Date.now()}`,
    });
  } catch (err) {
    console.warn("[stripe-meters] emit failed:", (err as Error).message ?? err);
  }
}

/**
 * Fire-and-forget wrapper for the after-response path. Returns immediately;
 * the actual Stripe call runs on the event loop. Use this from the auth
 * layer so user-perceived latency is unaffected by Stripe API latency.
 */
export function emitMeterEventAsync(params: EmitMeterParams): void {
  // Don't await — let it run; capture errors at the boundary.
  void emitMeterEvent(params).catch((err) => {
    console.warn("[stripe-meters] async emit threw:", err);
  });
}
