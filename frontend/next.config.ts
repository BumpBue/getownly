import type { NextConfig } from "next";

// Course covers arrive as short-lived signed URLs pointing straight at
// MinIO, so the host has to be allow-listed for next/image to load them.
// This runs in Node at build/start time, so it reads the same MINIO_*
// values backend/.env.example describes rather than a hardcoded host -
// storage can move without a code change, only an env one.
const minioHostname = process.env.NEXT_PUBLIC_MINIO_ENDPOINT ?? "localhost";
const minioPort = process.env.NEXT_PUBLIC_MINIO_PORT ?? "9000";
const minioProtocol: "http" | "https" =
  process.env.NEXT_PUBLIC_MINIO_USE_SSL === "true" ? "https" : "http";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: minioProtocol,
        hostname: minioHostname,
        port: minioPort,
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
