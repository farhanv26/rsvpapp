import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the development badge clear of the app's account controls and phone navigation.
  devIndicators: false,
  // Demo and normal development must never share a Next build/cache directory.
  distDir: process.env.VOWPAL_DEMO === "1" ? ".next-demo" : ".next",
  reactCompiler: true,
  experimental: {
    // A 10 MB file plus multipart headers must fit through the proxy buffer.
    proxyClientMaxBodySize: "11mb",
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
