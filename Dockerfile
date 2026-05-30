# ─── builder ──────────────────────────────────────────────────────────────────
# @resonatehq/sdk@0.10.2 declares engines: { node: ">= 22" }, so we must use
# Node 22.  build-essential / python3 are needed by better-sqlite3 (native C++
# addon compiled at npm install time).
FROM node:22-slim AS builder

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Install native build toolchain (better-sqlite3 requires python3 + g++ + make)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

# ── dependency layer (cached unless package-lock.json changes) ────────────────
COPY package.json package-lock.json ./
RUN npm ci

# ── source ───────────────────────────────────────────────────────────────────
COPY . .

# Build-time stubs for env vars that are read at module-load time.
# stripe.ts initialises `new Stripe(process.env.STRIPE_SECRET_KEY!)` at the
# module level; without a non-empty value Next.js throws during static analysis.
# These placeholder values are never used at runtime — real secrets are injected
# via Fly secrets at deploy time.
ARG STRIPE_SECRET_KEY=sk_build_placeholder_not_real
ARG NEXTAUTH_SECRET=build_placeholder_not_real
ARG AUTH_SECRET=build_placeholder_not_real
ARG DATABASE_URL=postgresql://localhost:5432/tamrack_build
ENV STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV AUTH_SECRET=${AUTH_SECRET}
ENV DATABASE_URL=${DATABASE_URL}

# NEXT_PUBLIC_* are bundled into the client JS at build time, not read at runtime.
# Pass via --build-arg on flyctl deploy; fall back to safe defaults for unset values.
ARG NEXT_PUBLIC_APP_URL=https://tamrack-webui.fly.dev
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID=
ARG NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false
ARG NEXT_PUBLIC_SENTRY_DSN=
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=${NEXT_PUBLIC_GA_MEASUREMENT_ID}
ENV NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=${NEXT_PUBLIC_GOOGLE_AUTH_ENABLED}
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}

# Build Next.js.  The --webpack flag is required (see next.config.ts comment).
RUN npm run build

# ─── runtime ──────────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Create a non-root user to run the app
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy the full build output and dependencies from builder.
# Using Option A (no standalone output) keeps next.config.ts untouched and
# avoids the standalone copy semantics, at the cost of a larger final image.
COPY --from=builder --chown=nextjs:nodejs /app/.next        ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/public        ./public
# scripts/ + src/ ship in the runtime image so one-off ops jobs (geo backfill,
# G4 dietary taxonomy, etc.) can run via `flyctl ssh console -C 'npx tsx
# scripts/<name>.ts'` without a separate builder image. The scripts import
# from src/lib/*, so we need both trees. Adds ~3 MB to the image.
COPY --from=builder --chown=nextjs:nodejs /app/scripts       ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/src           ./src
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

USER nextjs

EXPOSE 3000

# `npm start` runs `next start` which binds to PORT (default 3000)
CMD ["npm", "start"]
