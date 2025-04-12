// src/lib/coordinateUtils.ts

import { LatLng, MapConfig, SvgPoint } from '@/types';
// Import default config and constants
import { defaultMapConfig, MILES_TO_KM } from '@/lib/MapConfig';

/**
 * Convert custom geographic coordinates (latitude and longitude) to SVG coordinates.
 * Assumes (0,0) is top-left of SVG.
 * @param lat - Custom Latitude.
 * @param lng - Custom Longitude.
 * @param config - Map configuration to use (defaults to defaultMapConfig).
 * @returns SVG coordinates { x: number, y: number }.
 */
export const latLngToSvg = (
  lat: number,
  lng: number,
  config: MapConfig = defaultMapConfig // Accept optional config
): SvgPoint => {
  // Use the provided or default config for calculations
  const y = config.equatorY - lat * config.pixelsPerLatitude;
  // Adjust longitude calculation based on reference longitude if needed
  const referenceLng = config.primeMeridianReferenceLng ?? 0; // Use 0 if not defined
  // Original logic had a hardcoded '30', let's use referenceLng for clarity
  // If your custom lng=0 *is* at geographic 30E, then referenceLng should be 30.
  // If your custom lng=0 *is* at the primeMeridianX, then the formula is simpler:
  // const x = config.primeMeridianX + lng * config.pixelsPerLongitude;
  // Assuming the original logic meant custom lng = (geoLng - referenceLng):
  const x = config.primeMeridianX + lng * config.pixelsPerLongitude;

  return { x, y };
};

/**
 * Convert SVG coordinates (origin top-left) to custom geographic coordinates.
 * @param svgX - X coordinate in the SVG space.
 * @param svgY - Y coordinate in the SVG space.
 * @param config - Map configuration to use (defaults to defaultMapConfig).
 * @returns Custom geographic coordinates { lat: number, lng: number }.
 */
export const svgToLatLng = (
  svgX: number,
  svgY: number,
  config: MapConfig = defaultMapConfig // Accept optional config
): LatLng => {
  // Use the provided or default config for calculations
  const lat = (config.equatorY - svgY) / config.pixelsPerLatitude;
  // Adjust longitude calculation based on reference longitude if needed
  const referenceLng = config.primeMeridianReferenceLng ?? 0; // Use 0 if not defined
  // If your custom lng=0 *is* at the primeMeridianX, then the formula is simpler:
  // const lng = (svgX - config.primeMeridianX) / config.pixelsPerLongitude;
  // Assuming the original logic meant custom lng = (geoLng - referenceLng):
  const lng = (svgX - config.primeMeridianX) / config.pixelsPerLongitude;

  return { lat, lng };
};

/**
 * Calculates distance based on custom coordinates.
 * NOTE: This is a simplified Euclidean distance in the projected space.
 * Accuracy depends on the projection's distortion and assumes constant scale
 * based on the provided mapConfig.
 * @param latlng1 - Start point in custom LatLng.
 * @param latlng2 - End point in custom LatLng.
 * @param mapConfig - Map configuration containing scale info.
 * @returns Object with pixel, miles, and km distances.
 */
export const calculateDistance = (
  latlng1: LatLng,
  latlng2: LatLng,
  mapConfig: MapConfig = defaultMapConfig // Use passed config or default
): { pixels: number; miles: number; km: number } => {
  // Use latLngToSvg defined above, passing the relevant mapConfig
  const point1 = latLngToSvg(latlng1.lat, latlng1.lng, mapConfig);
  const point2 = latLngToSvg(latlng2.lat, latlng2.lng, mapConfig);

  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  const pixelDistance = Math.sqrt(dx * dx + dy * dy);

  // Use scale from the provided mapConfig
  // Ensure mapConfig.milesPerPixel reflects the scale accurately for the current context/zoom
  const milesDistance = pixelDistance * mapConfig.milesPerPixel;
  const kmDistance = milesDistance * MILES_TO_KM; // Use imported constant

  return { pixels: pixelDistance, miles: milesDistance, km: kmDistance };
};


// --- Deprecated/Unused Function ---
// Keeping this commented out in case it's referenced elsewhere, but it seems
// redundant given the updated latLngToSvg and svgToLatLng.
// /**
//  * Convert geographic coordinates to a custom coordinate system.
//  * @param lng - Longitude in geographic space.
//  * @param lat - Latitude in geographic space.
//  * @param mapConfig - Map configuration object.
//  * @param primeMeridianSvg - Prime meridian reference point in SVG space.
//  * @returns Custom coordinates.
//  */
// export const svgToCustomLatLng = (
//   lng: number, // This seems misnamed, likely intended to be svgX?
//   lat: number, // This seems misnamed, likely intended to be svgY?
//   mapConfig: any,
//   primeMeridianSvg: SvgPoint // This seems redundant if primeMeridianX is in mapConfig
// ): LatLng => {
//   // This logic looks very similar to svgToLatLng, but uses different inputs
//   // It might be intended for a different conversion or contain errors.
//   const customLat = (mapConfig.equatorY - lat) / mapConfig.pixelsPerLatitude;
//   const customLng =
//     (lng - primeMeridianSvg.x) / mapConfig.pixelsPerLongitude + (mapConfig.primeMeridianReferenceLng || 0);
//   return { lat: customLat, lng: customLng };
// };
