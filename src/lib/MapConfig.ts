import { MapConfig } from '@/types';

// Default map configuration
export const defaultMapConfig: MapConfig = {
  masterMapPath: '/master-map.svg',
  baseMapUrl: '/master-map.svg',
  svgWidth: 8202,
  svgHeight: 4900,
  initialZoom: 0,
  minZoom: -1,
  maxZoom: 5,
  rawWidth: 8202,
  rawHeight: 4900,
  pixelsPerLongitude: 22.783333,
  pixelsPerLatitude: 27.222222,
  equatorY: 2450,
  primeMeridianX: 4101,
  milesPerPixel: 3.2,
  kmPerPixel: 5.15,
  labelFontSize: 12,
  labelClassName: 'country-label',
  bounds: {
    north: 0,
    south: 4900,
    east: 8202,
    west: 0
  },
  showCountryLabels: true
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
  GRID_COLOR: '#666'
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
  PRIME_MERIDIAN_TEXT_SHADOW: '1px 1px 1px rgba(0,0,0,0.5)'
};

// Visible latitude bounds
export const visibleBounds = {
  northLat: 70,  // Northern visible limit in degrees
  southLat: -70  // Southern visible limit in degrees
};