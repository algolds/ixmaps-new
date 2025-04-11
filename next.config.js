/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['leaflet'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  basePath: process.env.NODE_ENV === 'production' ? '/projects/ixmaps' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/projects/ixmaps' : '',
  publicRuntimeConfig: {
    basePath: process.env.NODE_ENV === 'production' ? '/projects/ixmaps' : '',
    environment: process.env.NODE_ENV
  },
};

// Debugging output
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('basePath config:', nextConfig.basePath);

module.exports = nextConfig;