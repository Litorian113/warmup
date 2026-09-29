import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The dev server is reached over Tailscale, not just localhost.
  allowedDevOrigins: ["100.*.*.*", "*.ts.net", "devbox"],
};

export default nextConfig;
