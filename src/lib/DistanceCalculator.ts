import { DistanceResult } from '@/types';
import type { LatLng, Map } from 'leaflet';

export const MILES_PER_PIXEL = 3.2;
export const KM_PER_PIXEL = 5.15;

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
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);
    
    const miles = pixelDistance * MILES_PER_PIXEL;
    const km = pixelDistance * KM_PER_PIXEL;
    
    return { miles, kilometers: km, km };
  } catch (e) {
    console.error('Error calculating distance:', e);
    return { miles: 0, kilometers: 0, km: 0 };
  }
};

// Calibrated distance calculation compatible with coordinate system
export const coordinateSystemCalculateDistance = (
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
    
    // Use calibrated value for this map with coord system
    const CALIBRATED_MILES_PER_PIXEL = 2.7;
    
    // Apply zoom level scaling but skip latitude factor
    const zoom = map.getZoom();
    const milesPerPixel = CALIBRATED_MILES_PER_PIXEL / Math.pow(2, zoom);
    const miles = pixelDistance * milesPerPixel;
    
    // Convert to kilometers
    const km = miles * 1.60934;
    
    return {
      miles: miles,
      kilometers: km,
      km: km
    };
  } catch (e) {
    console.error('Error calculating distance:', e);
    return { miles: 0, kilometers: 0, km: 0 };
  }
};