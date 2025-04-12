// src/lib/coordinateUtils.ts (Example Update)

import { LatLng } from '@/types'; // Keep LatLng if used elsewhere

/**
 * Converts SVG pixel coordinates (origin top-left) to Leaflet LatLng
 * for use with CRS.Simple.
 * @param svgX - X coordinate in SVG pixel space.
 * @param svgY - Y coordinate in SVG pixel space.
 * @param L - Leaflet instance (required to create L.LatLng)
 * @returns Leaflet LatLng object [y, x].
 */
export const svgToLeafletLatLng = (svgX: number, svgY: number, L: any): any => {
  if (!L || !L.latLng) {
    console.error('Leaflet instance (L) is required for svgToLeafletLatLng');
    return null; // Or throw an error
  }
  // Leaflet uses [y, x] for LatLng in CRS.Simple context
  return L.latLng(svgY, svgX);
};

/**
 * Converts Leaflet LatLng (used with CRS.Simple) back to SVG pixel coordinates.
 * @param latLng - Leaflet LatLng object [y, x].
 * @returns SVG coordinates { x: number, y: number }.
 */
export const leafletLatLngToSvg = (latLng: any): { x: number; y: number } => {
  // In CRS.Simple, lat corresponds to Y, lng corresponds to X
  return { x: latLng.lng, y: latLng.lat };
};

// --- Deprecated Functions ---
// /** @deprecated Use svgToLeafletLatLng with CRS.Simple */
// export const latLngToSvg = (lat: number, lng: number): SvgPoint => { ... };
// /** @deprecated Use leafletLatLngToSvg with CRS.Simple */
// export const svgToLatLng = (svgX: number, svgY: number): { lat: number; lng: number } => { ... };
// /** @deprecated Custom coordinate system removed */
// export const svgToCustomLatLng = (...) => { ... };
