// src/lib/MapConfig.ts
import { MapConfig } from '@/types';
import { getAssetPath } from './config';

// Scale constants (Keep if needed for scale bar, otherwise remove)
// export const BASE_MILES_PER_PIXEL = 10; // No longer directly applicable with CRS.Simple
// export const MILES_TO_KM = 2.59;

// Default map configuration
export const defaultMapConfig: MapConfig = {
  masterMapPath: getAssetPath('/maps/master-map.svg'), // Keep if used as fallback
  baseMapUrl: getAssetPath('/maps/master-map.svg'), // Main SVG path
  svgWidth: 8200, // SVG width in pixels
  svgHeight: 4900, // SVG height in pixels
  initialZoom: 0, // Start at zoom 0 (1 unit = 1 pixel)
  minZoom: -2, // Allow zooming out
  maxZoom: 4, // Allow zooming in












  // rawWidth: 8200, // Redundant if same as svgWidth
  // rawHeight: 4900, // Redundant if same as svgHeight
  // --- REMOVED Geographic/Custom Coordinate System Properties ---
  // pixelsPerLongitude: 45.5666,
  // pixelsPerLatitude: 27.2222,
  // equatorY: 2450,
  // primeMeridianX: 4785,
  // milesPerPixel: 10,
  // get kmPerPixel() { ... },
  // primeMeridianRef: { lat: -14.08, lng: 30.0 },
  labelFontSize: 12, // Keep for styling if needed elsewhere
  labelClassName: 'country-label', // Keep for styling


  // Bounds are now derived from svgWidth/svgHeight in LeafletLoader
  // bounds: { north: 0, south: 4900, east: 8200, west: 0 },
  showCountryLabels: true,
  rawWidth: 0,
  rawHeight: 0,
  pixelsPerLongitude: 0,
  pixelsPerLatitude: 0,
  equatorY: 0,
  primeMeridianX: 0,
  milesPerPixel: 0,
  kmPerPixel: 0,
  bounds: {
    north: 0,
    south: 0,
    east: 0,
    west: 0
  }
};

// --- REMOVED Geographic Grid/Label Styles ---
// gridStyle: { ... } // Remove or adapt if you draw a pixel grid
// labelStyle: { ... } // Remove or adapt for pixel-based labels
// visibleBounds: { ... } // Remove
