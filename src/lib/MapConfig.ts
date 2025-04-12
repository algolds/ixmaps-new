import { MapConfig } from '@/types';
import { getAssetPath } from './config';

// Scale constants
export const BASE_MILES_PER_PIXEL = 10; // Base scale at zoom level 0: 1px = 10 sq mi
export const MILES_TO_KM = 2.59; // Conversion factor from square miles to square kilometers
// Default map configuration
export const defaultMapConfig: MapConfig = {
  masterMapPath: getAssetPath('/maps/master-map.svg'),
  baseMapUrl: getAssetPath('/maps/master-map.svg'),
  svgWidth: 8200,
  svgHeight: 4900,
  lodConfig: {
    paths: {
      low: '',
      medium: '',
      high: ''
    },
    zoomThresholds: {
      low: 0,
      medium: 0
    }
  }, // Added missing property
  initialLayerVisibility: {
    political: true,
    climate: false,
    lakes: false,
    rivers: false,
    'altitude-layers': false
  }, // Added missing property
  initialZoom: -2,
  minZoom: -2,
  maxZoom: 4.0,
  rawWidth: 8200, // Same as svgWidth by default
  rawHeight: 4900, // Same as svgHeight by default
  pixelsPerLongitude: 45.5666,
  pixelsPerLatitude: 27.2222,
  equatorY: 2450,
  primeMeridianX: 4785,
  milesPerPixel: 10, // Base scale at zoom level 0: 1px = 10 sq mi
  get kmPerPixel() {
    return this.milesPerPixel * MILES_TO_KM;
  },

  labelFontSize: 12,
  labelClassName: 'country-label',
  bounds: {
    north: 0,
    south: 4900,
    east: 8200,
    west: 0,
  },
  showCountryLabels: true,
  primeMeridianReferenceLng: 0
};

// Prime meridian reference point
export const primeMeridianRef = {
  lat: -14.08, // Negative value for Southern hemisphere
  lng: 30.0, // This is 30°E in geographic coordinates, but will be treated as 0°
};

// Grid style configuration
export const gridStyle = {
  MAJOR_LINE_WEIGHT: 1.5,
  MINOR_LINE_WEIGHT: 0.8,
  LINE_OPACITY: 0.6,
  DASH_ARRAY: '5,5',
  MAJOR_DASH_ARRAY: null,
  PRIME_MERIDIAN_COLOR: '#FF8000',
  PRIME_MERIDIAN_WEIGHT: 2.5,
  PRIME_MERIDIAN_OPACITY: 0.8,
  PRIME_MERIDIAN_DASH_ARRAY: '8,6',
  EQUATOR_COLOR: '#FF4500',
  GRID_COLOR: '#666',
};

// Label style configuration
export const labelStyle = {
  MIN_DISTANCE: 50,
  BACKGROUND_COLOR: 'rgba(255, 255, 255, 0.7)',
  BORDER_COLOR: '#666',
  BORDER_RADIUS: '3px',
  FONT_SIZE: '10px',
  FONT_WEIGHT: 'bold',
  COLOR: '#333',
  PRIME_MERIDIAN_BACKGROUND: 'rgba(255, 128, 0, 0.8)',
  PRIME_MERIDIAN_COLOR: 'white',
  PRIME_MERIDIAN_PADDING: '3px 8px',
  PRIME_MERIDIAN_BORDER_RADIUS: '4px',
  PRIME_MERIDIAN_FONT_SIZE: '12px',
  PRIME_MERIDIAN_TEXT_SHADOW: '1px 1px 1px rgba(0,0,0,0.5)',
};

// Visible latitude bounds
export const visibleBounds = {
  northLat: 70, // Northern visible limit in degrees
  southLat: -70, // Southern visible limit in degrees
};