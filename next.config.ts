/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['leaflet'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Uncomment this if you want to use a base path
 // basePath: '/wiki/prod/v14/projects/ixmaps',
}

module.exports = nextConfig;