// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['leaflet'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  // --- Conditional Base Path & Asset Prefix ---
  // When NODE_ENV is 'production' (set by PM2), use the subpath.
  // Otherwise (in development), use the root path ('').
  basePath: process.env.NODE_ENV === 'production' ? '' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '' : '',

  // --- publicRuntimeConfig ---
  // This makes the calculated basePath available on the client-side via getConfig()
  // Although often not needed if you fetch relative paths correctly (see point 3)
  publicRuntimeConfig: {
    basePath: process.env.NODE_ENV === 'production' ? '' : '',
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
