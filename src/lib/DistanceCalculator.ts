// src/lib/DistanceCalculator.ts
import { DistanceResult, MapConfig } from '@/types'; // Ensure MapConfig is imported if needed by calculateScaleFactor
import type { LatLng, Map } from 'leaflet';

// Constants for scale calculations
import { defaultMapConfig } from '@/lib/MapConfig';

const BASE_MILES_PER_PIXEL = defaultMapConfig.milesPerPixel; // Use milesPerPixel from mapConfig
// FIX: MILES_TO_KM should be approx 1.60934, not 2.59 (which is sq mi to sq km)
const MILES_TO_KM = 1.60934; // Conversion factor from miles to kilometers
const BASE_KM_PER_PIXEL = BASE_MILES_PER_PIXEL * MILES_TO_KM; // Convert to km

/**
 * Calculate distance between two LatLng points using the map's projection and zoom level.
 * @param latlng1 First point
 * @param latlng2 Second point
 * @param map The Leaflet map object
 * @returns Object containing distances in miles and kilometers
 */
export const calculateDistance = (
  latlng1: LatLng,
  latlng2: LatLng,
  map: Map,
): DistanceResult => {
  try {
    // Use Leaflet's built-in distance calculation for geographic accuracy
    const distanceMeters = map.distance(latlng1, latlng2);

    if (distanceMeters === undefined || isNaN(distanceMeters)) {
      console.warn('Could not calculate distance between points.');
      // FIX: Return object matching DistanceResult, remove 'km' property
      return { miles: 0, kilometers: 0 };
    }

    const kilometers = distanceMeters / 1000;
    const miles = kilometers / MILES_TO_KM;

    // FIX: Return object matching DistanceResult, remove 'km' property
    return {
      miles: miles,
      kilometers: kilometers,
    };
  } catch (e) {
    console.error('Error calculating distance:', e);
    // FIX: Return object matching DistanceResult, remove 'km' property
    return { miles: 0, kilometers: 0 };
  }
};

/**
 * Calculates scale factor between raw map and display
 * @param map The Leaflet map instance
 * @param config Map configuration object (containing rawWidth, rawHeight, svgWidth, svgHeight)
 * @returns The calculated scale factor
 */
export const calculateScaleFactor = (map: Map, config: any): number => {
  // This function seems unrelated to distance calculation and might belong elsewhere.
  // Also, its implementation using config properties (svgWidth, rawWidth etc.)
  // doesn't seem directly related to Leaflet's dynamic scaling.
  // Keeping it as is, but noting potential issues.
  try {
    // Use the current display size vs raw map size
    const mapContainer = map.getContainer();
    if (!mapContainer) return 1; // Handle case where container isn't ready

    const mapWidth = mapContainer.clientWidth;
    const mapHeight = mapContainer.clientHeight;

    // Ensure config properties exist before using them
    if (
      !config ||
      !config.svgWidth ||
      !config.rawWidth ||
      !config.svgHeight ||
      !config.rawHeight
    ) {
      console.warn('Missing properties in config for calculateScaleFactor');
      return 1;
    }

    // Calculate width and height scale factors based on config
    // This logic might need review depending on what 'scale factor' represents
    const widthScale = config.svgWidth / config.rawWidth;
    const heightScale = config.svgHeight / config.rawHeight;

    // Use the smaller scale to maintain proportions
    return Math.min(widthScale, heightScale);
  } catch (e) {
    console.error('Error calculating scale factor:', e);
    return 1; // Default to 1 on error
  }
};

/**
 * Calculates the distance between two LatLng points in screen pixels.
 * @param latlng1 First point
 * @param latlng2 Second point
 * @param map The Leaflet map object
 * @returns Distance in pixels
 */
export const calculatePixelDistance = (
  latlng1: LatLng,
  latlng2: LatLng,
  map: Map,
): number => {
  try {
    const point1 = map.latLngToContainerPoint(latlng1);
    const point2 = map.latLngToContainerPoint(latlng2);

    if (!point1 || !point2) return 0;

    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;

    return Math.sqrt(dx * dx + dy * dy);
  } catch (e) {
    console.error('Error calculating pixel distance:', e);
    return 0;
  }
};

// FIX: Removed unused showResultToast function that relied on a global 'showToast'
// const showResultToast = (miles: number, km: number) => {
//   if (typeof window.showToast === 'function') {
//     const message = `Total: ${miles.toFixed(2)} mi (${km.toFixed(2)} km)`;
//     window.showToast(message, 'success', 5000);
//   } else {
//     alert(`Total: ${miles.toFixed(2)} mi (${km.toFixed(2)} km)`);
//   }
// };
