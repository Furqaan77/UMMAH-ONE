import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Testers reach this PC through an ngrok link (16 Nov 2026).
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app"],
};

export default nextConfig;
