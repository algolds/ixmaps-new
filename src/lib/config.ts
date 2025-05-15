// src/lib/config.ts
import getConfig from 'next/config';

// Direct access to environment for critical path construction
const ENV_IS_PROD = process.env.NODE_ENV === 'production';
const PROD_BASE_PATH = '';

// Export the base path directly from environment
export const basePath = ENV_IS_PROD ? PROD_BASE_PATH : '';

// Simple, reliable helper to create URLs
export function getAssetPath(path: string): string {
  // If path is already absolute URL, return as is
  if (path.startsWith('http')) return path;
  
  // Ensure path starts with slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // In dev mode, just return the normalized path
  if (!ENV_IS_PROD) return normalizedPath;
  
  // In production, include the base path
  return `${PROD_BASE_PATH}${normalizedPath}`;
}

// Log for debugging
console.log('Current environment:', process.env.NODE_ENV);
console.log('Asset path prefix:', basePath);