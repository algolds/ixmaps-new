// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['leaflet'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  // --- Conditional Base Path & Asset Prefix ---
  // No basePath when proxied through Apache domain
  // Use basePath only for direct access via ixwiki.com/public/maps/ixmaps-new
  basePath: '',
  assetPrefix: '',

  // --- publicRuntimeConfig ---
  publicRuntimeConfig: {
    basePath: '',
    environment: process.env.NODE_ENV,
  },
};

// Debugging output (useful during build/start)
console.log('[next.config.js] NODE_ENV:', process.env.NODE_ENV);
console.log(
  '[next.config.js] Calculated basePath:',
  nextConfig.basePath,
);
console.log(
  '[next.config.js] Calculated assetPrefix:',
  nextConfig.assetPrefix,
);

module.exports = nextConfig;
