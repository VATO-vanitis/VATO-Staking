import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable ESLint during production builds (we'll re-enable later)
  eslint: { ignoreDuringBuilds: true },

  // Silence the workspace root warning by forcing tracing to this folder
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
