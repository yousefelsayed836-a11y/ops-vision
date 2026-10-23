import { resolve } from "node:path";
/** @type {import('next').NextConfig} */
const config = {
  distDir: process.env.OPSVISION_DIST_DIR ?? (process.env.NODE_ENV === "development" ? ".next-dev" : ".next"),
  devIndicators: false,
  ...(process.platform === "win32" ? {} : { output: "standalone" }),
  poweredByHeader: false,
  experimental: { useWasmBinary: process.env.OPSVISION_WASM === "true" },
  // Equivalent to next-intl's request-config alias, without its optional native message precompiler.
  webpack(config) {
    config.resolve.alias["next-intl/config"] = resolve("src/i18n/request.ts");
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
          },
        ],
      },
    ];
  },
};
export default config;
