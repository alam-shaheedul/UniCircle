import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "app.cuet.ac.bd",
        pathname: "/storage/**",
      },
      {
        protocol: "https",
        hostname: "app.cuet.ac.bd",
        pathname: "/assets/images/avatar/**",
      },
    ],
  },
};

export default nextConfig;
