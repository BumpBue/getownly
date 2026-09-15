import type { NextConfig } from "next";

// No `images.remotePatterns` on purpose. Nothing in this app hands a storage
// URL to next/image: the optimiser fetches the picture from the server, and
// every URL MinIO gives out is signed for the host the *browser* can reach.
// Under `docker compose --profile full` those are different machines, so the
// optimiser cannot fetch what it is pointed at. Files from storage are
// rendered with a plain <img>, the same way slips, QR codes and avatars
// always have been.
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://getownly-backend.onrender.com/api/:path*',
      },
    ];
  },
};

export default nextConfig;
