// src/lib/MapConfig.ts
import { MapConfig } from '@/types'; // Assuming MapConfig type is defined in '@/types'
import { getAssetPath } from './config'; // Assuming getAssetPath helper exists

// --- Core Constants ---

/**
 * Conversion factor from miles to kilometers.
 * (1 mile = 1.60934 kilometers)
 */
export const MILES_TO_KM = 1.60934;

/**
 * Base scale defined for the map, often corresponding to zoom level 0.
 * Represents the approximate number of miles per pixel at the base zoom.
 * Adjust this value based on your specific map's projection and intended base scale.
 */
export const BASE_MILES_PER_PIXEL = 10; // Example: 1 pixel = 10 miles at base zoom

// --- Default Map Configuration ---

export const defaultMapConfig: MapConfig = {
  // --- File Paths ---
  masterMapPath: getAssetPath('/maps/master-map.svg'), // Path to the main SVG map file
  baseMapUrl: getAssetPath('/maps/master-map.svg'), // URL used for the base layer

  // --- SVG/Raw Dimensions ---
  // Dimensions of the source SVG file
  svgWidth: 8200,
  svgHeight: 4900,
  // Raw dimensions used for internal calculations or scaling (often same as SVG)
  rawWidth: 8200,
  rawHeight: 4900,

  // --- Level of Detail (LOD) Configuration ---
  // Optional: Define different map versions for different zoom levels
  lodConfig: {
    paths: {
      low: '', // Path to low-detail map SVG/data
      medium: '', // Path to medium-detail map SVG/data
      high: '', // Path to high-detail map SVG/data (often same as masterMapPath)
    },
    zoomThresholds: {
      low: 0, // Zoom level below which 'low' detail is used
      medium: 0, // Zoom level below which 'medium' detail is used
    },
  },

  // --- Initial Map State ---
  initialLayerVisibility: {
    // Control which layers are visible when the map loads
    political: true,
    climate: false,
    lakes: false,
    rivers: false,
    'altitude-layers': false,
  },
  initialZoom: -2, // Starting zoom level

  // --- Zoom Constraints ---
  minZoom: -2, // Minimum allowed zoom level
  maxZoom: 4.0, // Maximum allowed zoom level

  // --- Projection & Coordinate System Parameters ---
  // These values define how geographic coordinates map to pixel coordinates
  // Adjust these based on your specific map projection and origin point
  pixelsPerLongitude: 45.5666, // How many pixels represent one degree of longitude
  pixelsPerLatitude: 27.2222, // How many pixels represent one degree of latitude
  equatorY: 2450, // The Y-pixel coordinate corresponding to the equator (0° latitude)
  primeMeridianX: 4785, // The X-pixel coordinate corresponding to the prime meridian (0° longitude)
  primeMeridianReferenceLng: 0, // The geographic longitude considered the "center" or reference (often 0 or a custom value)

  // --- Scale Parameters ---
  milesPerPixel: BASE_MILES_PER_PIXEL, // Base scale (miles per pixel at zoom 0)
  /**
   * Calculated kilometers per pixel at the base zoom level.
   * Uses the corrected MILES_TO_KM conversion factor.
   */
  get kmPerPixel() {
    return this.milesPerPixel * MILES_TO_KM;
  },

  // --- Labeling ---
  labelFontSize: 12, // Default font size for labels
  labelClassName: 'country-label', // CSS class for labels
  showCountryLabels: true, // Whether to display country labels by default

  // --- Map Bounds (in Pixel Coordinates) ---
  // Defines the clickable/interactive area in the map's pixel coordinate system
  bounds: {
    north: 0, // Top boundary
    south: 4900, // Bottom boundary (usually svgHeight)
    east: 8200, // Right boundary (usually svgWidth)
    west: 0, // Left boundary
  },
};

// --- Reference Points & Styles ---

/**
 * Geographic reference point often used for aligning the prime meridian.
 * Note: The 'lng' here might be treated as 0° in the map's internal logic
 * if primeMeridianReferenceLng is used for offsetting.
 */
export const primeMeridianRef = {
  lat: -14.08, // Latitude of the reference point
  lng: 30.0, // Geographic longitude of the reference point
};

/**
 * Styling configuration for the map grid lines (latitude/longitude).
 */
export const gridStyle = {
  MAJOR_LINE_WEIGHT: 1.5,
  MINOR_LINE_WEIGHT: 0.8,
  LINE_OPACITY: 0.6,
  DASH_ARRAY: '5,5', // Dashes for minor lines
  MAJOR_DASH_ARRAY: null, // Solid for major lines (null or 'none')
  GRID_COLOR: '#666666', // Default color for grid lines

  // Prime Meridian specific styles
  PRIME_MERIDIAN_COLOR: '#FF8000', // Orange
  PRIME_MERIDIAN_WEIGHT: 2.5,
  PRIME_MERIDIAN_OPACITY: 0.8,
  PRIME_MERIDIAN_DASH_ARRAY: '8,6', // Distinct dash pattern

  // Equator specific styles
  EQUATOR_COLOR: '#FF4500', // Reddish-orange
  // Add EQUATOR_WEIGHT, EQUATOR_OPACITY, EQUATOR_DASH_ARRAY if needed
};

/**
 * Styling configuration for labels displayed on the map grid.
 */
export const labelStyle = {
  MIN_DISTANCE: 50, // Minimum pixel distance between labels to avoid overlap
  BACKGROUND_COLOR: 'rgba(255, 255, 255, 0.7)',
  BORDER_COLOR: '#666666',
  BORDER_RADIUS: '3px',
  FONT_SIZE: '10px',
  FONT_WEIGHT: 'bold',
  COLOR: '#333333',
  PADDING: '2px 5px', // Added padding for standard labels

  // Prime Meridian label specific styles
  PRIME_MERIDIAN_BACKGROUND: 'rgba(255, 128, 0, 0.8)', // Orange background
  PRIME_MERIDIAN_COLOR: 'white',
  PRIME_MERIDIAN_PADDING: '3px 8px',
  PRIME_MERIDIAN_BORDER_RADIUS: '4px',
  PRIME_MERIDIAN_FONT_SIZE: '12px',
  PRIME_MERIDIAN_TEXT_SHADOW: '1px 1px 1px rgba(0,0,0,0.5)',
  // Add styles for Equator labels if needed
};

/**
 * Defines the approximate visible latitude limits for certain features or calculations.
 * Useful if your map projection distorts heavily near the poles.
 */
export const visibleBounds = {
  northLat: 70, // Northern visible limit in degrees latitude
  southLat: -70, // Southern visible limit in degrees latitude
};
