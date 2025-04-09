/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Configure Next.js to transpile TypeScript properly
  webpack: (config: { module: { rules: { test: RegExp; use: string; exclude: RegExp; }[]; }; }) => {
    config.module.rules.push({
      test: /\.tsx?$/,
      use: 'ts-loader',
      exclude: /node_modules/,
    });
    return config;
  },
  // Ensure Leaflet is treated as client-side only
  transpilePackages: ['leaflet'],
};

module.exports = nextConfig;