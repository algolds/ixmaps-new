// src/lib/MapConfig.ts
import { MapConfig } from '@/types';
import { getAssetPath } from './config';

// --- Core Constants ---
export const MILES_TO_KM = 1.60934;
// Define the original base scale (miles per original pixel at zoom 0)
const ORIGINAL_BASE_MILES_PER_PIXEL = 3;

// --- Default Map Configuration ---

// --- Original SVG Dimensions & Parameters (Used as Base for Calculation) ---
const ORIGINAL_SVG_WIDTH = 8200;
const ORIGINAL_SVG_HEIGHT = 4900;
const ORIGINAL_EQUATOR_Y = 2450;
const ORIGINAL_PRIME_MERIDIAN_X = 4785; // X coord for the *original* reference longitude
const ORIGINAL_PIXELS_PER_LNG = 45.5666;
const ORIGINAL_PIXELS_PER_LAT = 27.2222;

// --- *** CALCULATED EFFECTIVE SCALING FACTORS (Based on your updated values) *** ---
const EFFECTIVE_SCALE_X = 0.099156; // Reflects overall X scaling
const EFFECTIVE_SCALE_Y = 0.125229; // Reflects overall Y scaling
// --- *********************************************************************** ---

// --- Calculated Rendered Dimensions & Parameters ---
const RENDERED_WIDTH = ORIGINAL_SVG_WIDTH * EFFECTIVE_SCALE_X; // ~813.08
const RENDERED_HEIGHT = ORIGINAL_SVG_HEIGHT * EFFECTIVE_SCALE_Y; // ~613.62
const RENDERED_EQUATOR_Y = ORIGINAL_EQUATOR_Y * EFFECTIVE_SCALE_Y; // ~306.81
const RENDERED_PRIME_MERIDIAN_X = ORIGINAL_PRIME_MERIDIAN_X * EFFECTIVE_SCALE_X; // ~474.56
const RENDERED_PIXELS_PER_LNG = ORIGINAL_PIXELS_PER_LNG * EFFECTIVE_SCALE_X; // ~4.5181
const RENDERED_PIXELS_PER_LAT = ORIGINAL_PIXELS_PER_LAT * EFFECTIVE_SCALE_Y; // ~3.4091

// --- Calculate NEW Base Scale for Rendered System ---
const RENDERED_BASE_MILES_PER_PIXEL = ORIGINAL_BASE_MILES_PER_PIXEL / EFFECTIVE_SCALE_X; // ~30.25 (Corrected calculation based on ORIGINAL_BASE_MILES_PER_PIXEL = 3)

export const defaultMapConfig: MapConfig = {
  // --- File Paths ---
  masterMapPath: getAssetPath('/maps/master-map.svg'),
  baseMapUrl: getAssetPath('/maps/master-map.svg'),

  // --- SVG/Raw Dimensions (Reflecting EFFECTIVE Rendered Space) ---
  svgWidth: RENDERED_WIDTH,
  svgHeight: RENDERED_HEIGHT,
  rawWidth: RENDERED_WIDTH,
  rawHeight: RENDERED_HEIGHT,

  // --- LOD Config ---
  lodConfig: {
    paths: { low: '', medium: '', high: '' },
    zoomThresholds: { low: 0, medium: 0 },
  },

  // --- Initial Map State ---
  initialLayerVisibility: {
    political: true,
    climate: false,
    lakes: false,
    rivers: false,
    'altitude-layers': false,
  },
  // initialZoom is handled by fitBounds in LeafletLoader
  // --- Zoom Constraints ---
  minZoom: 2, // Minimum zoom level allowed AFTER initial fit
  maxZoom: 6, // Maximum zoom level allowed


  // --- Projection & Coordinate System Parameters ---
  pixelsPerLongitude: RENDERED_PIXELS_PER_LNG,
  pixelsPerLatitude: RENDERED_PIXELS_PER_LAT,
  equatorY: RENDERED_EQUATOR_Y,
  primeMeridianX: RENDERED_PRIME_MERIDIAN_X,
  primeMeridianReferenceLng: 30,

  // --- Scale Parameters ---
  milesPerPixel: RENDERED_BASE_MILES_PER_PIXEL, // Base scale (miles per RENDERED pixel at zoom 0)
  get kmPerPixel(): number {
    if (typeof this.milesPerPixel !== 'number') {
      console.warn('MapConfig: milesPerPixel is unexpectedly not a number for kmPerPixel calculation.');
      return 0;
    }
    return this.milesPerPixel * MILES_TO_KM;
  },

  // --- Labeling ---
  labelFontSize: 12,
  labelClassName: 'country-label',
  showCountryLabels: true,
  countryLabelOffset: { x: 0, y: 0 },

  // --- Map Bounds (in EFFECTIVE RENDERED Pixel Coordinates) ---
  bounds: {
    north: 0,
    south: RENDERED_HEIGHT,
    east: RENDERED_WIDTH,
    west: 0,
  },
  initialZoom: 0
};

// --- Reference Points & Styles ---
export const primeMeridianRef = { lat: -14.08, lng: 30.0 };
export const gridStyle = { /* ... */ };
export const labelStyle = { /* ... */ };
export const visibleBounds = { northLat: 50, southLat: -50 };
