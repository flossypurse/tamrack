import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // TODO: fix type errors in traffic/benchmarks pages, then remove this
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      { source: "/parkland-county", destination: "/m/parkland-county", permanent: true },
      { source: "/spruce-grove", destination: "/m/spruce-grove", permanent: true },
      { source: "/st-albert", destination: "/m/st-albert", permanent: true },
      { source: "/stony-plain", destination: "/m/stony-plain", permanent: true },
    ];
  },
};

export default nextConfig;
