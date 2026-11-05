import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Slim, self-contained server bundle for containerized deploys (Cloud Run).
  output: "standalone",
};

export default nextConfig;
