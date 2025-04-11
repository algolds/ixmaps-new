/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV === 'development';

const basePath = isDevelopment ? '' : '/projects/ixmaps';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['leaflet'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  basePath: basePath,
  publicRuntimeConfig: {
    basePath: basePath, // Expose basePath to the client
  },
};

module.exports = nextConfig;