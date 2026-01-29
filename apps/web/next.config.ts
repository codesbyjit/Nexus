import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "bucket.codesbyjit.site",
        port: "",       // default HTTPS port
        pathname: "/**", // allow all paths under this host
      },
    ],
  },
};

export default nextConfig;
