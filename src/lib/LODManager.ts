/**
 * LODManager.ts
 * 
 * Manages Level of Detail (LOD) for large SVG maps
 * Selects appropriate resolution map based on zoom level
 */

import { MapConfig } from '@/types';
import { getAssetPath } from '@/lib/config';

// Define LOD levels
export enum LODLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

// Define map paths for each LOD level
export interface LODMapPaths {
  [LODLevel.LOW]: string;
  [LODLevel.MEDIUM]: string;
  [LODLevel.HIGH]: string;
}

// Default LOD configuration
export const defaultLODConfig = {
  // Map file paths with proper basePath
  paths: {
    [LODLevel.LOW]: getAssetPath('/maps/master-map-low.svg'),
    [LODLevel.MEDIUM]: getAssetPath('/maps/master-map-medium.svg'),
    [LODLevel.HIGH]: getAssetPath('/maps/master-map-high.svg'),
  },
  
  // Zoom level thresholds
  zoomThresholds: {
    [LODLevel.LOW]: -2,    // Use low-res when zoom <= -2
    [LODLevel.MEDIUM]: 1,  // Use medium-res when -2 < zoom <= 1
    // HIGH detail used when zoom > 1
  }
};

/**
 * Determines appropriate LOD level based on current zoom
 * @param zoom Current map zoom level
 * @param config LOD configuration
 * @returns The appropriate LOD level
 */
export function getCurrentLODLevel(zoom: number, config = defaultLODConfig): LODLevel {
  if (zoom <= config.zoomThresholds[LODLevel.LOW]) {
    return LODLevel.LOW;
  } else if (zoom <= config.zoomThresholds[LODLevel.MEDIUM]) {
    return LODLevel.MEDIUM;
  } else {
    return LODLevel.HIGH;
  }
}

/**
 * Get map file path for the current zoom level
 * @param zoom Current zoom level
 * @param config LOD configuration
 * @returns Path to the appropriate resolution map
 */
export function getMapPathForZoom(zoom: number, config = defaultLODConfig): string {
  const level = getCurrentLODLevel(zoom, config);
  return config.paths[level];
}

/**
 * Enhanced MapConfig interface with LOD support
 */
export interface LODMapConfig extends MapConfig {
  lodPaths: LODMapPaths;
  lodEnabled: boolean;
}

/**
 * Updates MapConfig with path for current zoom level
 * @param config Current map configuration
 * @param zoom Current zoom level
 * @returns Updated map configuration with appropriate map path
 */
export function updateConfigForZoom(config: LODMapConfig, zoom: number): LODMapConfig {
  if (!config.lodEnabled) {
    return config;
  }
  
  const level = getCurrentLODLevel(zoom);
  return {
    ...config,
    baseMapUrl: config.lodPaths[level],
    masterMapPath: config.lodPaths[level]
  };
}