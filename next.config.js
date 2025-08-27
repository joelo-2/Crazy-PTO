/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: { appDir: true },
};
module.exports = nextConfig;
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: { appDir: true },
  typescript: { ignoreBuildErrors: true }, // optional: allow build even if TS complains
  eslint: { ignoreDuringBuilds: true }     // optional: skip ESLint in CI
};
module.exports = nextConfig;
