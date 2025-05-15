// src/lib/coordinates-system.ts

import { LatLng, MapConfig, SvgPoint } from '@/types';

/**
 * Converts geographic coordinates (latitude and longitude) to SVG coordinates (x, y).
 * Uses the provided mapConfig for projection parameters.
 * Assumes a linear projection defined by the mapConfig.
 *
 * @param {number} lat - Latitude in geographic space.
 * @param {number} lng - Longitude in geographic space.
 * @param {MapConfig} mapConfig - The current map configuration containing projection parameters.
 * @returns {SvgPoint} SVG coordinates (x, y).
 * @throws {Error} If mapConfig is missing required projection properties.
 */
export const latLngToSvg = (
  lat: number,
  lng: number,
  mapConfig: MapConfig,
): SvgPoint => {
  const {
    equatorY,
    pixelsPerLatitude,
    primeMeridianX,
    pixelsPerLongitude,
    primeMeridianReferenceLng, // Use the reference longitude from config
  } = mapConfig;

  // Validate required config properties
  if (
    equatorY === undefined ||
    pixelsPerLatitude === undefined ||
    primeMeridianX === undefined ||
    pixelsPerLongitude === undefined
    // primeMeridianReferenceLng is optional, defaults below
  ) {
    throw new Error(
      'MapConfig is missing required properties for latLngToSvg conversion (equatorY, pixelsPerLatitude, primeMeridianX, pixelsPerLongitude).',
    );
  }
  if (pixelsPerLatitude === 0 || pixelsPerLongitude === 0) {
    throw new Error('pixelsPerLatitude or pixelsPerLongitude cannot be zero.');
  }

  // Use nullish coalescing for a default reference longitude of 0 if not specified
  const referenceLng = primeMeridianReferenceLng ?? 0;

  // Calculate SVG Y: Higher latitude means lower Y value (moving "up" from equatorY)
  const y = equatorY - lat * pixelsPerLatitude;

  // Calculate SVG X: Offset from primeMeridianX based on longitude difference from referenceLng
  const x = primeMeridianX + (lng - referenceLng) * pixelsPerLongitude;

  return { x, y };
};

/**
 * Converts SVG coordinates (x, y) to geographic coordinates (latitude and longitude).
 * Uses the provided mapConfig for projection parameters.
 * This is the inverse operation of latLngToSvg.
 *
 * @param {number} svgX - X coordinate in the SVG space.
 * @param {number} svgY - Y coordinate in the SVG space.
 * @param {MapConfig} mapConfig - The current map configuration containing projection parameters.
 * @returns {LatLng} Geographic coordinates (latitude and longitude).
 * @throws {Error} If mapConfig is missing required projection properties.
 */
export const svgToLatLng = (
  svgX: number,
  svgY: number,
  mapConfig: MapConfig,
): LatLng => {
  const {
    equatorY,
    pixelsPerLatitude,
    primeMeridianX,
    pixelsPerLongitude,
    primeMeridianReferenceLng, // Use the reference longitude from config
  } = mapConfig;

  // Validate required config properties
  if (
    equatorY === undefined ||
    pixelsPerLatitude === undefined ||
    primeMeridianX === undefined ||
    pixelsPerLongitude === undefined
    // primeMeridianReferenceLng is optional, defaults below
  ) {
    throw new Error(
      'MapConfig is missing required properties for svgToLatLng conversion (equatorY, pixelsPerLatitude, primeMeridianX, pixelsPerLongitude).',
    );
  }
  if (pixelsPerLatitude === 0 || pixelsPerLongitude === 0) {
    throw new Error('pixelsPerLatitude or pixelsPerLongitude cannot be zero.');
  }

  // Use nullish coalescing for a default reference longitude of 0 if not specified
  const referenceLng = primeMeridianReferenceLng ?? 0;

  // Calculate Latitude: Higher SVG Y means lower latitude
  const lat = (equatorY - svgY) / pixelsPerLatitude;

  // Calculate Longitude: Based on pixel difference from primeMeridianX, adjusted by referenceLng
  const lng = (svgX - primeMeridianX) / pixelsPerLongitude + referenceLng;

  return { lat, lng };
};

/**
 * Converts SVG coordinates to geographic coordinates using a specific prime meridian SVG reference X.
 * Use this function *only* if the prime meridian's SVG X-coordinate for the current
 * calculation context is different from the one stored globally in mapConfig.primeMeridianX.
 * For general conversions, prefer svgToLatLng.
 *
 * @param {number} svgX - X coordinate in the SVG space.
 * @param {number} svgY - Y coordinate in the SVG space.
 * @param {MapConfig} mapConfig - Map configuration object (used for scaling, equator, and reference Lng).
 * @param {number} primeMeridianSvgX - The specific X coordinate of the prime meridian in SVG space for this calculation.
 * @returns {LatLng} Geographic coordinates (latitude and longitude).
 * @throws {Error} If mapConfig is missing required projection properties.
 */
export const svgToCustomLatLng = (
  svgX: number,
  svgY: number,
  mapConfig: MapConfig,
  primeMeridianSvgX: number, // The specific SVG X for the reference meridian in this context
): LatLng => {
  const {
    equatorY,
    pixelsPerLatitude,
    pixelsPerLongitude,
    primeMeridianReferenceLng, // Still use the reference longitude from config
  } = mapConfig;

  // Validate required config properties needed for this calculation
  if (
    equatorY === undefined ||
    pixelsPerLatitude === undefined ||
    pixelsPerLongitude === undefined
    // primeMeridianReferenceLng is optional, defaults below
  ) {
    throw new Error(
      'MapConfig is missing required properties for svgToCustomLatLng conversion (equatorY, pixelsPerLatitude, pixelsPerLongitude).',
    );
  }
  if (pixelsPerLatitude === 0 || pixelsPerLongitude === 0) {
    throw new Error('pixelsPerLatitude or pixelsPerLongitude cannot be zero.');
  }

  // Use nullish coalescing for a default reference longitude of 0 if not specified
  const referenceLng = primeMeridianReferenceLng ?? 0;

  // Calculate Latitude: Same as svgToLatLng
  const customLat = (equatorY - svgY) / pixelsPerLatitude;

  // Calculate Longitude: Use the PASSED primeMeridianSvgX instead of mapConfig.primeMeridianX
  const customLng =
    (svgX - primeMeridianSvgX) / pixelsPerLongitude + referenceLng;

  return { lat: customLat, lng: customLng };
};

/**
 * Formats a latitude value into a string (e.g., 45.67° N).
 * @param {number} lat Latitude in decimal degrees.
 * @param {number} [precision=2] Number of decimal places.
 * @returns {string} Formatted latitude string or '---' if invalid.
 */
export function formatLatitude(lat: number, precision: number = 2): string {
  if (typeof lat !== 'number' || isNaN(lat)) return '---';
  const direction = lat >= 0 ? 'N' : 'S';
  return `${Math.abs(lat).toFixed(precision)}° ${direction}`;
}

/**
 * Formats a longitude value into a string (e.g., 120.12° W).
 * @param {number} lng Longitude in decimal degrees.
 * @param {number} [precision=2] Number of decimal places.
 * @returns {string} Formatted longitude string or '---' if invalid.
 */
export function formatLongitude(lng: number, precision: number = 2): string {
  if (typeof lng !== 'number' || isNaN(lng)) return '---';
  const direction = lng >= 0 ? 'E' : 'W';
  // No normalization applied by default, shows E/W relative to 0.
  return `${Math.abs(lng).toFixed(precision)}° ${direction}`;
}

// --- Haversine Distance Calculation ---

const EARTH_RADIUS = {
  km: 6371, // Earth radius in kilometers
  miles: 3959, // Earth radius in miles
};

/** Converts degrees to radians. */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculates the great-circle distance between two geographic points
 * using the Haversine formula.
 *
 * @param {number} lat1 Latitude of the first point.
 * @param {number} lng1 Longitude of the first point.
 * @param {number} lat2 Latitude of the second point.
 * @param {number} lng2 Longitude of the second point.
 * @param {'km' | 'miles'} [unit='km'] Unit for the result ('km' or 'miles').
 * @returns {number} The distance in the specified unit.
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  unit: 'km' | 'miles' = 'km',
): number {
  if (
    isNaN(lat1) ||
    isNaN(lng1) ||
    isNaN(lat2) ||
    isNaN(lng2)
  ) {
    return NaN; // Return NaN if any input is invalid
  }

  const radius = EARTH_RADIUS[unit];
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) *
      Math.cos(radLat2) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return radius * c;
}
