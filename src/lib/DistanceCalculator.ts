// src/lib/DistanceCalculator.ts
import { DistanceResult, MapConfig } from '@/types';
import type { LatLng, Map as LeafletMap } from 'leaflet';

// --- Import the CORRECT constant ---
import { MILES_TO_KM } from '@/lib/MapConfig'; // Use the value from MapConfig

/**
 * Calculate the geodesic distance between two LatLng points using the map's
 * projection and the Earth's ellipsoid model.
 * Relies on Leaflet's built-in `map.distance()` method for accuracy.
 *
 * @param latlng1 - The starting geographic point.
 * @param latlng2 - The ending geographic point.
 * @param map - The Leaflet map instance.
 * @returns An object containing the calculated distance in both miles and kilometers.
 *          Returns { miles: 0, kilometers: 0 } if calculation fails.
 */
export const calculateDistance = (
  latlng1: LatLng,
  latlng2: LatLng,
  map: LeafletMap,
): DistanceResult => {
  try {
    // map.distance() calculates geodesic distance in METERS
    const distanceMeters = map.distance(latlng1, latlng2);

    if (distanceMeters === undefined || isNaN(distanceMeters)) {
      console.warn(
        'Leaflet map.distance() could not calculate distance between points:',
        latlng1,
        latlng2,
      );
      return { miles: 0, kilometers: 0 };
    }

    // Convert meters to kilometers
    const kilometers = distanceMeters / 1000;

    // --- Use the IMPORTED constant ---
    const miles = kilometers / MILES_TO_KM;

    return {
      miles: miles,
      kilometers: kilometers,
    };
  } catch (error) {
    console.error('Error occurred during distance calculation:', error);
    return { miles: 0, kilometers: 0 };
  }
};

// --- calculatePixelDistance and calculateStaticScaleFactor remain unchanged ---
// They serve different purposes and don't rely on the problematic constants.

/**
 * Calculates the distance between two geographic points in screen pixels
 * based on the current map view (zoom and position).
 *
 * @param latlng1 - The starting geographic point.
 * @param latlng2 - The ending geographic point.
 * @param map - The Leaflet map instance.
 * @returns The distance in screen pixels. Returns 0 if conversion fails.
 */
export const calculatePixelDistance = (
  latlng1: LatLng,
  latlng2: LatLng,
  map: LeafletMap,
): number => {
  try {
    const point1 = map.latLngToContainerPoint(latlng1);
    const point2 = map.latLngToContainerPoint(latlng2);

    if (!point1 || !point2) {
      console.warn(
        'Could not convert one or both LatLng to container points:',
        latlng1,
        latlng2,
      );
      return 0;
    }
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
  } catch (error) {
    console.error('Error calculating pixel distance:', error);
    return 0;
  }
};

/**
 * Calculates a static scale factor based *only* on the provided map configuration's
 * SVG and raw dimensions.
 * @param config - The MapConfig object.
 * @returns The calculated static scale factor. Returns 1 if config is invalid.
 */
export const calculateStaticScaleFactor = (config: MapConfig): number => {
  try {
    if (
      !config ||
      config.svgWidth === undefined ||
      config.rawWidth === undefined ||
      config.svgHeight === undefined ||
      config.rawHeight === undefined ||
      config.rawWidth <= 0 ||
      config.rawHeight <= 0
    ) {
      console.warn(
        'Missing, invalid, or zero dimension properties in MapConfig for calculateStaticScaleFactor. Defaulting to 1.',
      );
      return 1;
    }
    const widthScale = config.svgWidth / config.rawWidth;
    const heightScale = config.svgHeight / config.rawHeight;
    return Math.min(widthScale, heightScale);
  } catch (error) {
    console.error('Error calculating static scale factor:', error);
    return 1;
  }
};
