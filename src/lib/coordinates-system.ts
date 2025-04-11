import { LatLng, SvgPoint } from '@/types';
import { defaultMapConfig } from '@/lib/MapConfig';

/**
 * Convert geographic coordinates (latitude and longitude) to SVG coordinates.
 * @param lat - Latitude in geographic space.
 * @param lng - Longitude in geographic space.
 * @returns SVG coordinates (X and Y).
 */
export const latLngToSvg = (lat: number, lng: number): SvgPoint => {
  const y = defaultMapConfig.equatorY - lat * defaultMapConfig.pixelsPerLatitude;
  const x =
    defaultMapConfig.primeMeridianX + (lng - 30) * defaultMapConfig.pixelsPerLongitude;
  return { x, y };
};

/**
 * Convert SVG coordinates to geographic coordinates (latitude and longitude).
 * @param svgX - X coordinate in the SVG space.
 * @param svgY - Y coordinate in the SVG space.
 * @returns Geographic coordinates (latitude and longitude).
 */
export const svgToLatLng = (svgX: number, svgY: number): { lat: number; lng: number } => {
  const lat = (defaultMapConfig.equatorY - svgY) / defaultMapConfig.pixelsPerLatitude;
  const lng =
    (svgX - defaultMapConfig.primeMeridianX) / defaultMapConfig.pixelsPerLongitude + 30;
  return { lat, lng };
};

/**
 * Convert geographic coordinates to a custom coordinate system.
 * @param lng - Longitude in geographic space.
 * @param lat - Latitude in geographic space.
 * @param mapConfig - Map configuration object.
 * @param primeMeridianSvg - Prime meridian reference point in SVG space.
 * @returns Custom coordinates.
 */
export const svgToCustomLatLng = (
  lng: number,
  lat: number,
  mapConfig: any,
  primeMeridianSvg: SvgPoint
): LatLng => {
  const customLat = (mapConfig.equatorY - lat) / mapConfig.pixelsPerLatitude;
  const customLng =
    (lng - primeMeridianSvg.x) / mapConfig.pixelsPerLongitude + 30;
  return { lat: customLat, lng: customLng };
};
