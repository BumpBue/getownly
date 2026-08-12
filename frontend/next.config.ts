import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Course covers arrive as short-lived signed URLs pointing straight at
    // MinIO, so the host has to be allow-listed for next/image to load them.
    // Change this alongside MINIO_ENDPOINT when storage moves off localhost.
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
