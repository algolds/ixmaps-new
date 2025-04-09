import { DistanceResult } from '@/types';
import type { LatLng, Map } from 'leaflet';

// Constants for scale calculations
import { defaultMapConfig } from '@/lib/MapConfig';

const BASE_MILES_PER_PIXEL = defaultMapConfig.milesPerPixel; // Use milesPerPixel from mapConfig
const BASE_KM_PER_PIXEL = BASE_MILES_PER_PIXEL * 2.59; // Convert to km
const MILES_TO_KM = 2.59; // Conversion factor from square miles to square kilometers

/**
 * Calculate pixel distance between two points with consistent scale
 * @param latlng1 First point
 * @param latlng2 Second point
 * @param map The Leaflet map object
 * @returns Object containing distances in miles and kilometers
 */
export const calculateDistance = (
  latlng1: LatLng, 
  latlng2: LatLng, 
  map: Map
): DistanceResult => {
  try {
    const point1 = map.latLngToContainerPoint(latlng1);
    const point2 = map.latLngToContainerPoint(latlng2);
    
    if (!point1 || !point2) return { miles: 0, kilometers: 0, km: 0 };
    
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    
    // Calculate pixel distance
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);
    
    // Calculate distance in miles and kilometers using the base scale
    const zoom = map.getZoom();
    const milesPerPixel = BASE_MILES_PER_PIXEL / Math.pow(2, zoom);
    const kilometersPerPixel = milesPerPixel * MILES_TO_KM; // Convert miles to kilometers
    const miles = pixelDistance * milesPerPixel; // Total distance in miles
    const kilometers = miles * MILES_TO_KM; // Total distance in kilometers
    
    return {
      miles: miles,
      kilometers: kilometers,
      km: kilometers
    };
  } catch (e) {
    console.error('Error calculating distance:', e);
    return { miles: 0, kilometers: 0, km: 0 };
  }
};

/**
 * Calculates scale factor between raw map and display
 * @param config - Map configuration object
 * @returns The calculated scale factor
 */
export const calculateScaleFactor = (map: Map, config: any): number => {
  try {
    // Use the current display size vs raw map size
    const mapWidth = map.getContainer().clientWidth;
    const mapHeight = map.getContainer().clientHeight;
    
    // Calculate width and height scale factors
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
 * Legacy function for backward compatibility
 * @param latlng1 First point
 * @param latlng2 Second point
 * @param map The Leaflet map object
 * @returns Distance in pixels
 */
export const calculatePixelDistance = (
  latlng1: LatLng, 
  latlng2: LatLng, 
  map: Map
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

const showResultToast = (miles: number, km: number) => {
  if (typeof window.showToast === 'function') {
    const message = `Total: ${miles.toFixed(2)} mi (${km.toFixed(2)} km)`;
    window.showToast(message, 'success', 5000);
  } else {
    alert(`Total: ${miles.toFixed(2)} mi (${km.toFixed(2)} km)`);
  }
};