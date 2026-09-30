import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The dev server is reached over Tailscale, not just localhost.
  allowedDevOrigins: ["100.*.*.*", "*.ts.net", "devbox"],
};

// BotID's challenge is served from the app's own origin, so blockers treat it as first-party.
export default withBotId(nextConfig);
