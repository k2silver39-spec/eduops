import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['172.24.35.135'],
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;
