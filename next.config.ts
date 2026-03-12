import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // TODO: fix type errors in traffic/benchmarks pages, then remove this
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
