// src/lib/config.ts
import getConfig from 'next/config';

// No basePath needed when proxied through Apache domain
const PROD_BASE_PATH = '';

// Export the base path directly from environment
export const basePath = PROD_BASE_PATH;

// Simple, reliable helper to create URLs
export function getAssetPath(path: string): string {
  // If path is already absolute URL, return as is
  if (path.startsWith('http')) return path;
  
  // Ensure path starts with slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // Return normalized path (no basePath when proxied)
  return normalizedPath;
}

// Log for debugging
console.log('Current environment:', process.env.NODE_ENV);
console.log('Asset path prefix:', basePath);