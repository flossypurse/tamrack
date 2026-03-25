import type { NextConfig } from "next";

// Build uses --webpack flag (see package.json) because Turbopack production
// builds in Next.js 16.1.x have a chunk-loading race condition that causes
// ChunkLoadError / ENOENT on SSR chunks during static page generation.
// Dev still uses Turbopack (Next.js 16 default). The prebuild script cleans
// .next to prevent Turbopack dev cache from conflicting with Webpack builds.
const nextConfig: NextConfig = {
  typescript: {
    // TODO: fix type errors in traffic/benchmarks pages, then remove this
    ignoreBuildErrors: true,
  },
  experimental: {
    // Limit static generation workers to reduce filesystem race conditions
    // that cause ENOENT / "Cannot find module" errors during build.
    // Default (os.cpus) spawns 10 workers which overwhelms the build pipeline.
    cpus: 2,
  },
  async redirects() {
    return [
      // Legacy municipality short URLs
      { source: "/parkland-county", destination: "/municipalities/parkland-county", permanent: true },
      { source: "/spruce-grove", destination: "/municipalities/spruce-grove", permanent: true },
      { source: "/st-albert", destination: "/municipalities/st-albert", permanent: true },
      { source: "/stony-plain", destination: "/municipalities/stony-plain", permanent: true },
      { source: "/strathcona", destination: "/municipalities/strathcona", permanent: true },

      // Old /m/ routes → /municipalities/
      { source: "/m/:slug", destination: "/municipalities/:slug", permanent: true },

      // Overview
      { source: "/signals", destination: "/overview/signals", permanent: true },
      { source: "/briefing", destination: "/overview/briefing", permanent: true },
      { source: "/briefing/:path*", destination: "/overview/briefing/:path*", permanent: true },

      // Economy
      { source: "/energy", destination: "/economy/energy", permanent: true },
      { source: "/drilling", destination: "/economy/drilling", permanent: true },
      { source: "/cycle", destination: "/economy/boom-bust", permanent: true },
      { source: "/diversification", destination: "/economy/diversification", permanent: true },
      { source: "/labour", destination: "/community/labour", permanent: true },
      { source: "/migration", destination: "/community/immigration", permanent: true },
      { source: "/agriculture", destination: "/economy/agriculture", permanent: true },

      // Real Estate
      { source: "/prospects", destination: "/real-estate/prospects", permanent: true },
      { source: "/micro", destination: "/real-estate/neighbourhoods", permanent: true },
      { source: "/pipeline", destination: "/real-estate/pipeline", permanent: true },
      { source: "/rental", destination: "/real-estate/rental", permanent: true },
      { source: "/commercial", destination: "/real-estate/commercial", permanent: true },

      // Intelligence (moved to /economy/ in Phase 1)
      { source: "/benchmarks", destination: "/economy/benchmarks", permanent: true },
      { source: "/corridors", destination: "/economy/corridors", permanent: true },
      { source: "/risk", destination: "/economy/risk", permanent: true },
      { source: "/invest", destination: "/economy/invest", permanent: true },
      { source: "/compare", destination: "/economy/compare", permanent: true },
      { source: "/intelligence/:path*", destination: "/economy/:path*", permanent: true },

      // Environment
      { source: "/weather", destination: "/environment/weather", permanent: true },
      { source: "/air-quality", destination: "/environment/air-quality", permanent: true },
      { source: "/water", destination: "/environment/water", permanent: true },
      { source: "/wildfire", destination: "/environment/wildfire", permanent: true },

      // Public Safety (moved to /community/ in Phase 1)
      { source: "/traffic", destination: "/community/traffic", permanent: true },
      { source: "/earthquakes", destination: "/community/seismic", permanent: true },
      { source: "/emergencies", destination: "/community/emergencies", permanent: true },
      { source: "/safety/:path*", destination: "/community/:path*", permanent: true },

      // Municipalities
      { source: "/coverage", destination: "/municipalities/coverage", permanent: true },

      // Tools
      { source: "/docs", destination: "/tools/docs", permanent: true },
      { source: "/sources", destination: "/tools/sources", permanent: true },

      // Legacy routes removed in Phase 1
      { source: "/overview/:path*", destination: "/home/:path*", permanent: true },
      { source: "/politics/:path*", destination: "/governance/:path*", permanent: true },
      { source: "/health/:path*", destination: "/community/health", permanent: true },
      { source: "/dashboard", destination: "/home/dashboard", permanent: true },
    ];
  },
};

export default nextConfig;
