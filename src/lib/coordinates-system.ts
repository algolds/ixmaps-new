// src/lib/coordinates-system.ts

import { LatLng, MapConfig, SvgPoint } from '@/types';
// Assuming defaultMapConfig is primarily for fallback or initial setup
// It's generally better to rely on the passed mapConfig for calculations
// import { defaultMapConfig } from '@/lib/MapConfig';

/**
 * Convert geographic coordinates (latitude and longitude) to SVG coordinates.
 * Uses the provided mapConfig for projection parameters.
 * @param lat - Latitude in geographic space.
 * @param lng - Longitude in geographic space.
 * @param mapConfig - The current map configuration containing projection parameters.
 * @returns SVG coordinates (X and Y).
 * @throws Error if mapConfig is missing required projection properties.
 */
export const latLngToSvg = (
  lat: number,
  lng: number,
  mapConfig: MapConfig
): SvgPoint => {
  // Validate required config properties
  if (
    mapConfig.equatorY === undefined ||
    mapConfig.pixelsPerLatitude === undefined ||
    mapConfig.primeMeridianX === undefined ||
    mapConfig.pixelsPerLongitude === undefined
  ) {
    throw new Error(
      'MapConfig is missing required properties for latLngToSvg conversion (equatorY, pixelsPerLatitude, primeMeridianX, pixelsPerLongitude).'
    );
  }

  // Calculate SVG coordinates based on the provided mapConfig
  const y = mapConfig.equatorY - lat * mapConfig.pixelsPerLatitude;
  // Assuming the '30' offset is specific to the projection/SVG setup
  // If primeMeridianReferenceLng is defined, use it, otherwise default to 0? Or keep 30?
  // Let's assume the formula intends a specific reference, keeping 30 for now.
  // Consider making the reference longitude part of MapConfig if it varies.
  const referenceLngOffset = 30; // Or mapConfig.primeMeridianReferenceLng || 0;
  const x =
    mapConfig.primeMeridianX +
    (lng - referenceLngOffset) * mapConfig.pixelsPerLongitude;

  return { x, y };
};

/**
 * Convert SVG coordinates to geographic coordinates (latitude and longitude).
 * Uses the provided mapConfig for projection parameters.
 * @param svgX - X coordinate in the SVG space.
 * @param svgY - Y coordinate in the SVG space.
 * @param mapConfig - The current map configuration containing projection parameters.
 * @returns Geographic coordinates (latitude and longitude).
 * @throws Error if mapConfig is missing required projection properties.
 */
export const svgToLatLng = (
  svgX: number,
  svgY: number,
  mapConfig: MapConfig
): LatLng => {
  // Validate required config properties
  if (
    mapConfig.equatorY === undefined ||
    mapConfig.pixelsPerLatitude === undefined ||
    mapConfig.primeMeridianX === undefined ||
    mapConfig.pixelsPerLongitude === undefined
  ) {
    throw new Error(
      'MapConfig is missing required properties for svgToLatLng conversion (equatorY, pixelsPerLatitude, primeMeridianX, pixelsPerLongitude).'
    );
  }

  // Calculate geographic coordinates based on the provided mapConfig
  const lat = (mapConfig.equatorY - svgY) / mapConfig.pixelsPerLatitude;
  // Assuming the '30' offset matches the one used in latLngToSvg
  const referenceLngOffset = 30; // Or mapConfig.primeMeridianReferenceLng || 0;
  const lng =
    (svgX - mapConfig.primeMeridianX) / mapConfig.pixelsPerLongitude +
    referenceLngOffset;

  return { lat, lng };
};

/**
 * Convert SVG coordinates to geographic coordinates using a specific prime meridian SVG reference.
 * Note: This function seems very similar to svgToLatLng. Ensure its purpose is distinct.
 * It might be intended for scenarios where the prime meridian's SVG X-coordinate
 * isn't directly stored in mapConfig.primeMeridianX but passed separately.
 * @param svgX - X coordinate in the SVG space.
 * @param svgY - Y coordinate in the SVG space.
 * @param mapConfig - Map configuration object (used for scaling and equator).
 * @param primeMeridianSvgX - The specific X coordinate of the prime meridian in SVG space for this calculation.
 * @returns Geographic coordinates (latitude and longitude).
 * @throws Error if mapConfig is missing required projection properties.
 */
export const svgToCustomLatLng = (
  svgX: number, // Renamed from lng for clarity
  svgY: number, // Renamed from lat for clarity
  mapConfig: MapConfig, // Use the specific MapConfig type
  primeMeridianSvgX: number // Pass only the X coordinate needed
): LatLng => {
  // Validate required config properties
  if (
    mapConfig.equatorY === undefined ||
    mapConfig.pixelsPerLatitude === undefined ||
    mapConfig.pixelsPerLongitude === undefined
  ) {
    throw new Error(
      'MapConfig is missing required properties for svgToCustomLatLng conversion (equatorY, pixelsPerLatitude, pixelsPerLongitude).'
    );
  }

  const customLat = (mapConfig.equatorY - svgY) / mapConfig.pixelsPerLatitude;
  // Assuming the '30' offset matches the one used in latLngToSvg/svgToLatLng
  const referenceLngOffset = 30; // Or mapConfig.primeMeridianReferenceLng || 0;
  const customLng =
    (svgX - primeMeridianSvgX) / mapConfig.pixelsPerLongitude +
    referenceLngOffset;

  return { lat: customLat, lng: customLng };
};

/**
 * Formats a latitude value into a string (e.g., 45.67° N).
 * @param lat Latitude in decimal degrees.
 * @param precision Number of decimal places (default: 2).
 * @returns Formatted latitude string.
 */
export function formatLatitude(lat: number, precision: number = 2): string {
  if (isNaN(lat)) return 'Invalid Latitude';
  const direction = lat >= 0 ? 'N' : 'S';
  return `${Math.abs(lat).toFixed(precision)}° ${direction}`;
}

/**
 * Formats a longitude value into a string (e.g., 120.12° W).
 * @param lng Longitude in decimal degrees.
 * @param precision Number of decimal places (default: 2).
 * @returns Formatted longitude string.
 */
export function formatLongitude(lng: number, precision: number = 2): string {
  if (isNaN(lng)) return 'Invalid Longitude';
  const direction = lng >= 0 ? 'E' : 'W';
  // Normalize longitude to be within -180 to 180 for consistent display if needed
  // const normalizedLng = (lng + 540) % 360 - 180; // Example normalization
  // return `${Math.abs(normalizedLng).toFixed(precision)}° ${normalizedLng >= 0 ? 'E' : 'W'}`;
  // Using original value for now:
  return `${Math.abs(lng).toFixed(precision)}° ${direction}`;
}

// Example of calculating distance (Haversine formula) - add if needed
const R = {
  km: 6371, // Earth radius in kilometers
  miles: 3959, // Earth radius in miles
};

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculates the distance between two geographic points using the Haversine formula.
 * @param lat1 Latitude of the first point.
 * @param lng1 Longitude of the first point.
 * @param lat2 Latitude of the second point.
 * @param lng2 Longitude of the second point.
 * @param unit Unit for the result ('km' or 'miles').
 * @returns The distance in the specified unit.
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  unit: 'km' | 'miles' = 'km'
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) *
      Math.sin(dLng / 2) *
      Math.cos(radLat1) *
      Math.cos(radLat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R[unit] * c;
}
