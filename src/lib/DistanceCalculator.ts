import { DistanceResult } from '@/types';
import { defaultMapConfig } from '@/lib/MapConfig';
import type { LatLng, Map } from 'leaflet';

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
    
    // Apply zoom level scaling
    const zoom = map.getZoom();
    const milesPerPixel = defaultMapConfig.milesPerPixel / Math.pow(2, zoom);
    const miles = pixelDistance * milesPerPixel;
    
    // Convert to kilometers using the same ratio as MapConfig
    const km = pixelDistance * (defaultMapConfig.kmPerPixel / Math.pow(2, zoom));
    
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
    
    // Use calibrated value from MapConfig
    // Apply zoom level scaling
    const zoom = map.getZoom();
    const milesPerPixel = defaultMapConfig.milesPerPixel / Math.pow(2, zoom);
    const miles = pixelDistance * milesPerPixel;
    
    // Convert to kilometers using the same ratio as MapConfig
    const km = pixelDistance * (defaultMapConfig.kmPerPixel / Math.pow(2, zoom));
    
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