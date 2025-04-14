// src/types/index.ts

import { Map as LeafletMap, LatLngBounds } from 'leaflet'; // Import LatLngBounds
export * from './svg-types'; // Export SVG types

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
 * LOD Map Paths interface
 */
export interface LODMapPaths {
  low: string;
  medium: string;
  high: string;
}

/**
 * Map configuration
 */
export interface MapConfig {
  masterMapPath: string; // Path to the master SVG file
  baseMapUrl?: string; // Optional: URL template for a tile base map
  svgWidth: number; // Intrinsic width of the SVG map
  svgHeight: number; // Intrinsic height of the SVG map
  initialZoom: number;
  minZoom: number;
  maxZoom: number;
  rawWidth?: number; // Deprecated or specific use? Consider removal if unused
  rawHeight?: number; // Deprecated or specific use? Consider removal if unused
  pixelsPerLongitude: number; // Map projection scaling factor
  pixelsPerLatitude: number; // Map projection scaling factor
  equatorY: number; // Y-coordinate of the equator in SVG space
  primeMeridianX: number; // X-coordinate of the prime meridian in SVG space
  milesPerPixel: number; // Scale factor at a reference zoom level
  kmPerPixel: number; // Scale factor at a reference zoom level (often calculated)
  labelFontSize?: number; // Default font size for labels
  labelClassName?: string; // CSS class for labels
  bounds: MapBounds; // Geographic bounds of the map {N, S, E, W}
  showCountryLabels: boolean; // Initial visibility for country labels
  primeMeridianReferenceLng?: number; // Reference longitude for PM calculations (often 0)
  initialLayerVisibility?: Record<string, boolean>; // Initial visibility states for SVG layers

  // Add the prime meridian reference Lat/Lng (make optional '?' if not always present)
  primeMeridianRef?: { lat: number; lng: number };

  // LOD properties (Optional)
  lodEnabled?: boolean;
  lodConfig?: {
    paths: LODMapPaths;
    zoomThresholds: { low: number; medium: number };
  };

  // NEW: Optional offset for country labels in SVG pixels
  countryLabelOffset?: { x: number; y: number };
}

/**
 * Toast notification types
 */
export type ToastType = 'info' | 'success' | 'warning' | 'error';

// Layer visibility settings type
export type LayerVisibility = Record<string, boolean>;

/* --- Commented out conflicting interface ---
export interface LayerVisibility {
  [key: string]: boolean;
  // ... specific layers ...
}
*/

// Country label interface
export interface CountryLabel {
  x: number; // SVG x-coordinate
  y: number; // SVG y-coordinate
  name: string; // Country name
  originalId?: string; // Optional ID from source data
  class?: 'standard' | 'major' | 'minor' | 'capital'; // Classification for styling/filtering
}

// Distance calculation result interface
export interface DistanceResult {
  kilometers: number;
  miles: number;
}

// SVG dimensions interface (Potentially redundant)
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

// Grid style interface
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

// Label style interface
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

// Consider if IxMapsNamespace is still needed
export interface IxMapsNamespace {
  // ...
}

// SVGLayerControlRef likely not needed with current approach
// export interface SVGLayerControlRef { ... }
