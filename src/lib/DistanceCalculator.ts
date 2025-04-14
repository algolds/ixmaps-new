// src/lib/DistanceCalculator.ts
import { DistanceResult, MapConfig } from '@/types'; // Import necessary types
import type { LatLng, Map as LeafletMap, Point } from 'leaflet'; // Use LeafletMap alias

// Import the corrected conversion factor from the central configuration
import { MILES_TO_KM } from '@/lib/MapConfig';

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
  map: LeafletMap, // Use alias for clarity
): DistanceResult => {
  try {
    // map.distance() calculates geodesic distance in METERS
    const distanceMeters = map.distance(latlng1, latlng2);

    // Validate the result from map.distance()
    if (distanceMeters === undefined || isNaN(distanceMeters)) {
      console.warn(
        'Leaflet map.distance() could not calculate distance between points:',
        latlng1,
        latlng2,
      );
      return { miles: 0, kilometers: 0 }; // Return zero result on failure
    }

    // Convert meters to kilometers
    const kilometers = distanceMeters / 1000;

    // Convert kilometers to miles using the corrected factor
    const miles = kilometers / MILES_TO_KM;

    // Return the result conforming to the DistanceResult type
    return {
      miles: miles,
      kilometers: kilometers,
    };
  } catch (error) {
    console.error('Error occurred during distance calculation:', error);
    // Return zero result in case of unexpected errors
    return { miles: 0, kilometers: 0 };
  }
};

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
  map: LeafletMap, // Use alias
): number => {
  try {
    // Convert LatLng coordinates to pixel coordinates within the map container
    const point1: Point = map.latLngToContainerPoint(latlng1);
    const point2: Point = map.latLngToContainerPoint(latlng2);

    // Check if the conversion was successful
    if (!point1 || !point2) {
      console.warn(
        'Could not convert one or both LatLng to container points:',
        latlng1,
        latlng2,
      );
      return 0;
    }

    // Calculate the difference in x and y pixel coordinates
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;

    // Calculate the straight-line distance using the Pythagorean theorem
    return Math.sqrt(dx * dx + dy * dy);
  } catch (error) {
    console.error('Error calculating pixel distance:', error);
    return 0; // Return 0 on error
  }
};

/**
 * Calculates a static scale factor based *only* on the provided map configuration's
 * SVG and raw dimensions.
 *
 * Note: This factor represents the ratio between the SVG dimensions and the
 * 'raw' dimensions defined in the config. It does *not* reflect the dynamic
 * scaling that occurs due to Leaflet's zooming. Its primary use might be
 * during initial setup or for calculations independent of the current map view.
 *
 * @param config - The MapConfig object containing svgWidth, rawWidth, svgHeight, rawHeight.
 * @returns The calculated static scale factor (minimum of width/height ratios).
 *          Returns 1 if config properties are missing or invalid.
 */
export const calculateStaticScaleFactor = (config: MapConfig): number => {
  try {
    // Validate necessary properties in the config object
    if (
      !config ||
      config.svgWidth === undefined ||
      config.rawWidth === undefined ||
      config.svgHeight === undefined ||
      config.rawHeight === undefined ||
      config.rawWidth <= 0 || // Prevent division by zero or nonsensical scale
      config.rawHeight <= 0
    ) {
      console.warn(
        'Missing, invalid, or zero dimension properties in MapConfig for calculateStaticScaleFactor. Defaulting to 1.',
        {
          svgW: config?.svgWidth,
          rawW: config?.rawWidth,
          svgH: config?.svgHeight,
          rawH: config?.rawHeight,
        },
      );
      return 1; // Default scale factor
    }

    // Calculate scale factors based on width and height
    const widthScale = config.svgWidth / config.rawWidth;
    const heightScale = config.svgHeight / config.rawHeight;

    // Return the smaller scale factor to ensure content fits if maintaining aspect ratio
    // If aspect ratio isn't a concern, you might choose widthScale or average them.
    return Math.min(widthScale, heightScale);
  } catch (error) {
    console.error('Error calculating static scale factor:', error);
    return 1; // Default to 1 on error
  }
};

// Removed the unused showResultToast function
