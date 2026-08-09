import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const platformFrameAncestors =
  process.env.PLATFORM_FRAME_ANCESTORS?.trim() ||
  "'self' file: http://127.0.0.1:4173 http://localhost:4173";
const platformRelease = (
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.NEXT_PUBLIC_PLATFORM_RELEASE ||
  "local"
).slice(0, 12);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/platform/index.html",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, must-revalidate"
          }
        ]
      },
      {
        source: "/platform-native/index.html",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, must-revalidate"
          }
        ]
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Platform-Release",
            value: platformRelease
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000"
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${platformFrameAncestors}`
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()"
          }
        ]
      }
    ];
  },
  outputFileTracingRoot: projectRoot,
  ...(process.env.NEXT_STANDALONE === "1" ? { output: "standalone" } : {})
};

export default nextConfig;
