/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Playwright must not be bundled by webpack — it's loaded at runtime in the
  // /api/render route which renders cards to PNG with a headless browser.
  experimental: {
    serverComponentsExternalPackages: ['playwright', 'playwright-core'],
  },
};

export default nextConfig;
