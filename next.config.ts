/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['leaflet'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  basePath: '/projects/ixmaps', // Static basePath for the project
  publicRuntimeConfig: {
    basePath: '/projects/ixmaps', // Expose basePath to the client
  },
};

module.exports = nextConfig;
