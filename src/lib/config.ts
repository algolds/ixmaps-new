import getConfig from 'next/config';

// Safely get runtime config with fallbacks
const runtimeConfig = () => {
  try {
    const { publicRuntimeConfig = {} } = getConfig() || {};
    return publicRuntimeConfig;
  } catch (e) {
    return { basePath: '/projects/ixmaps' };
  }
};

export const basePath = runtimeConfig().basePath || '';