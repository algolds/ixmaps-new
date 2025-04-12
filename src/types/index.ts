/**
 * IxMaps TypeScript Type Definitions
 */

import { Map as LeafletMap } from 'leaflet';
export * from './svg-types';  // Export SVG types
/**
 * Map bounds configuration
 */
export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Map configuration
 */
export interface MapConfig {
  primeMeridianReferenceLng: number;
  masterMapPath: string;
  baseMapUrl: string;
  svgWidth: number;
  svgHeight: number;
  initialZoom: number;
  minZoom: number;
  maxZoom: number;
  rawWidth: number;
  rawHeight: number;
  pixelsPerLongitude: number;
  pixelsPerLatitude: number;
  equatorY: number;
  primeMeridianX: number;
  milesPerPixel: number;
  kmPerPixel: number;
  labelFontSize: number;
  labelClassName: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  showCountryLabels: boolean;
}

/**
 * Prime meridian reference
 */
export interface PrimeMeridianRef {
  lat: number;
  lng: number;
}

/**
 * Toast notification types
 */
export type ToastType = 'info' | 'success' | 'warning' | 'error';

/**
 * Layer configuration
 */
export interface LayerConfig {
  id: string;
  name: string;
  url: string;
  visible: boolean;
  minZoom: number;
  maxZoom: number;
}

// Layer visibility settings interface
export interface LayerVisibility {
  political: boolean;
  climate: boolean;
  lakes: boolean;
  rivers: boolean;
  mountains: boolean;
  cities: boolean;
  countries: boolean;
  states: boolean;
  territories: boolean;
  disputed: boolean;
  labels: boolean;
  grid: boolean;
  scale: boolean;
  compass: boolean;
}

// Country label interface
export interface CountryLabel {
  x: number;
  y: number;
  name: string;
  originalId: string;
  class: 'standard' | 'major' | 'minor' | 'capital';
}

// Distance calculation result interface
export interface DistanceResult {
  kilometers: number;
  miles: number;
  km: number; // For backward compatibility
}

// SVG dimensions interface
export interface SVGDimensions {
  width: number;
  height: number;
}

// Coordinate interfaces
export interface LatLng {
  lat: number;
  lng: number;
}

export interface SvgPoint {
  x: number;
  y: number;
}

// Visible bounds
export interface VisibleBounds {
  northLat: number;
  southLat: number;
}

// Grid style
export interface GridStyle {
  MAJOR_LINE_WEIGHT: number;
  MINOR_LINE_WEIGHT: number;
  LINE_OPACITY: number;
  DASH_ARRAY: string;
  MAJOR_DASH_ARRAY: string | null;
  PRIME_MERIDIAN_COLOR: string;
  PRIME_MERIDIAN_WEIGHT: number;
  PRIME_MERIDIAN_OPACITY: number;
  PRIME_MERIDIAN_DASH_ARRAY: string;
  EQUATOR_COLOR: string;
  GRID_COLOR: string;
}

// Label style
export interface LabelStyle {
  MIN_DISTANCE: number;
  BACKGROUND_COLOR: string;
  BORDER_COLOR: string;
  BORDER_RADIUS: string;
  FONT_SIZE: string;
  FONT_WEIGHT: string;
  COLOR: string;
  PRIME_MERIDIAN_BACKGROUND: string;
  PRIME_MERIDIAN_COLOR: string;
  PRIME_MERIDIAN_PADDING: string;
  PRIME_MERIDIAN_BORDER_RADIUS: string;
  PRIME_MERIDIAN_FONT_SIZE: string;
  PRIME_MERIDIAN_TEXT_SHADOW: string;
}

// IxMaps namespace for global usage (will be adapted for React)
export interface IxMapsNamespace {
  Main: {
    showToast: (message: string, type?: string, duration?: number) => string;
    hideToast: (toastId: string) => void;
    calculateScaleFactor: () => number;
    calculateDistance: (latlng1: any, latlng2: any, unit?: 'miles' | 'km') => number;
    calculatePixelDistance: (latlng1: any, latlng2: any) => number;
    updateLayerVisibility: () => void;
    getLayerVisibility: () => LayerVisibility;
    showCountryLabels: () => void;
    hideCountryLabels: () => void;
    MILES_PER_PIXEL: number;
    KM_PER_PIXEL: number;
  };
}

/**
 * LOD Map Paths interface
 */
export interface LODMapPaths {
  low: string;
  medium: string;
  high: string;
}
/**
 * Extended Map configuration with LOD support
 */
export interface MapConfig {
  // Existing properties...
  
  // Add LOD properties
  lodEnabled?: boolean;
  lodPaths?: LODMapPaths;
}