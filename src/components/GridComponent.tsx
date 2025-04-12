// src/components/GridComponent.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import { MapConfig, LatLng } from '@/types'; // Import necessary types
// Import styles and potentially coordinate limits if defined
import { gridStyle, visibleBounds } from '@/lib/MapConfig';

// Define the props required by this component
interface GridComponentProps {
  map: any; // Leaflet map instance
  L: any; // Leaflet library instance
  visible: boolean; // Whether the grid should be visible
  mapConfig: MapConfig; // Contains CRS parameters and potentially style info
}

const GridComponent: React.FC<GridComponentProps> = ({
  map,
  L,
  visible,
  mapConfig, // Use mapConfig passed from parent
}) => {
  const gridLayerRef = useRef<any>(null);
  const gridPaneName = 'grid-pane'; // Define a pane name

  useEffect(() => {
    if (!map || !L) return;

    // --- Create a custom pane for the grid if it doesn't exist ---
    if (!map.getPane(gridPaneName)) {
      map.createPane(gridPaneName);
      // Set z-index to control drawing order (e.g., below labels)
      map.getPane(gridPaneName).style.zIndex = 450; // Adjust as needed (below markers/popups)
      map.getPane(gridPaneName).style.pointerEvents = 'none'; // Grid shouldn't capture events
    }

    // --- Create or get the layer group ---
    if (!gridLayerRef.current) {
      gridLayerRef.current = L.layerGroup([], { pane: gridPaneName }).addTo(map);
    }

    // --- Draw or clear grid based on visibility ---
    if (visible) {
      drawGrid(); // Call the drawing function
    } else {
      gridLayerRef.current?.clearLayers(); // Clear grid if not visible
    }

    // --- Cleanup function ---
    // This runs when dependencies change OR component unmounts
    return () => {
      // No need to remove layer on every visibility change if managed by clearLayers
      // Only remove fully on unmount if desired, but clearing is often enough
      // if (gridLayerRef.current) {
      //   map.removeLayer(gridLayerRef.current);
      //   gridLayerRef.current = null;
      // }
    };
    // Depend on map, L, visibility, and mapConfig (if grid parameters depend on it)
  }, [map, L, visible, mapConfig]);

  // Function to draw the grid lines
  const drawGrid = () => {
    if (!map || !gridLayerRef.current || !visible) return;

    // Clear previous grid lines
    gridLayerRef.current.clearLayers();

    // --- Define Grid Intervals (in custom LatLng degrees) ---
    // You could make these dynamic based on zoom if desired
    const latIntervalMajor = 30;
    const latIntervalMinor = 10;
    const lngIntervalMajor = 30;
    const lngIntervalMinor = 10;

    // --- Get Map Bounds in Custom LatLng ---
    const mapBounds = map.getBounds();
    // Use defined visible bounds or map bounds, whichever is tighter
    const minLat = Math.max(mapBounds.getSouth(), visibleBounds?.southLat ?? -90);
    const maxLat = Math.min(mapBounds.getNorth(), visibleBounds?.northLat ?? 90);
    // Extend longitude slightly beyond current view for smoother panning
    const minLng = mapBounds.getWest() - lngIntervalMajor;
    const maxLng = mapBounds.getEast() + lngIntervalMajor;

    const lines: any[] = [];

    // --- Draw Latitude Lines (Horizontal) ---
    for (let lat = 0; lat <= maxLat; lat += latIntervalMinor) {
      if (lat < minLat && lat !== 0) continue; // Skip lines below view unless equator
      const isMajor = lat % latIntervalMajor === 0;
      const isEquator = lat === 0;
      const style = {
        color: isEquator ? gridStyle.EQUATOR_COLOR : gridStyle.GRID_COLOR,
        weight: isMajor ? gridStyle.MAJOR_LINE_WEIGHT : gridStyle.MINOR_LINE_WEIGHT,
        opacity: gridStyle.LINE_OPACITY,
        dashArray: isMajor ? gridStyle.MAJOR_DASH_ARRAY : gridStyle.DASH_ARRAY,
        interactive: false, // Lines shouldn't be interactive
      };
      // Create LatLng points directly using custom coordinates
      lines.push(L.polyline([[lat, minLng], [lat, maxLng]], style));
    }
    // Draw negative latitudes
    for (let lat = -latIntervalMinor; lat >= minLat; lat -= latIntervalMinor) {
      if (lat > maxLat) continue; // Skip lines above view
      const isMajor = lat % latIntervalMajor === 0;
      const style = { /* ... same style logic as positive latitudes ... */
        color: gridStyle.GRID_COLOR,
        weight: isMajor ? gridStyle.MAJOR_LINE_WEIGHT : gridStyle.MINOR_LINE_WEIGHT,
        opacity: gridStyle.LINE_OPACITY,
        dashArray: isMajor ? gridStyle.MAJOR_DASH_ARRAY : gridStyle.DASH_ARRAY,
        interactive: false,
      };
      lines.push(L.polyline([[lat, minLng], [lat, maxLng]], style));
    }

    // --- Draw Longitude Lines (Vertical) ---
    for (let lng = 0; lng <= maxLng; lng += lngIntervalMinor) {
      if (lng < minLng && lng !== 0) continue; // Skip lines west of view unless prime meridian
      const isMajor = lng % lngIntervalMajor === 0;
      const isPrimeMeridian = lng === 0; // Custom Longitude 0 is the Prime Meridian
      const style = {
        color: isPrimeMeridian ? gridStyle.PRIME_MERIDIAN_COLOR : gridStyle.GRID_COLOR,
        weight: isPrimeMeridian ? gridStyle.PRIME_MERIDIAN_WEIGHT : (isMajor ? gridStyle.MAJOR_LINE_WEIGHT : gridStyle.MINOR_LINE_WEIGHT),
        opacity: isPrimeMeridian ? gridStyle.PRIME_MERIDIAN_OPACITY : gridStyle.LINE_OPACITY,
        dashArray: isPrimeMeridian ? gridStyle.PRIME_MERIDIAN_DASH_ARRAY : (isMajor ? gridStyle.MAJOR_DASH_ARRAY : gridStyle.DASH_ARRAY),
        interactive: false,
      };
      // Create LatLng points directly using custom coordinates
      lines.push(L.polyline([[minLat, lng], [maxLat, lng]], style));
    }
     // Draw negative longitudes
    for (let lng = -lngIntervalMinor; lng >= minLng; lng -= lngIntervalMinor) {
      if (lng > maxLng) continue; // Skip lines east of view
      const isMajor = lng % lngIntervalMajor === 0;
      const style = { /* ... same style logic as positive longitudes ... */
        color: gridStyle.GRID_COLOR,
        weight: isMajor ? gridStyle.MAJOR_LINE_WEIGHT : gridStyle.MINOR_LINE_WEIGHT,
        opacity: gridStyle.LINE_OPACITY,
        dashArray: isMajor ? gridStyle.MAJOR_DASH_ARRAY : gridStyle.DASH_ARRAY,
        interactive: false,
      };
      lines.push(L.polyline([[minLat, lng], [maxLat, lng]], style));
    }

    // Add all created lines to the layer group
    lines.forEach(line => gridLayerRef.current.addLayer(line));
  };

  // This component manages a Leaflet layer, doesn't render direct DOM
  return null;
};

export default GridComponent;
