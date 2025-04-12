// src/components/GridComponent.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
// Import types and coordinate functions
import { MapConfig, SvgPoint, LatLng } from '@/types';
import { latLngToSvg, svgToLatLng } from '@/lib/coordinates-system';
// Import default styles/config if needed, or get from mapConfig
import { gridStyle } from '@/lib/MapConfig'; // Assuming gridStyle is defined here

// Define the props interface to match what MapComponent provides
interface GridComponentProps {
  map: L.Map;
  L: typeof L;
  visible: boolean;
  mapConfig: MapConfig; // Accept the full map config
  primeMeridianSvg: SvgPoint | null; // Accept the calculated PM SVG origin
}

const GridComponent: React.FC<GridComponentProps> = ({
  map,
  L,
  visible,
  mapConfig, // Use the passed mapConfig
  primeMeridianSvg, // Use the passed primeMeridianSvg
}) => {
  const gridLayerRef = useRef<L.LayerGroup | null>(null);
  const initializedRef = useRef<boolean>(false); // To track initialization

  // Destructure necessary values from mapConfig for easier use
  // const { svgWidth, svgHeight, pixelsPerLongitude } = mapConfig; // Not directly used in draw logic below

  // Initialize grid layers and pane when component mounts
  useEffect(() => {
    if (!map || !L) return;

    // Create custom pane with high z-index for the grid
    const gridPaneName = 'grid-pane';
    if (!map.getPane(gridPaneName)) {
      const pane = map.createPane(gridPaneName);
      pane.style.zIndex = '650'; // Ensure grid is on top of most layers
      pane.style.pointerEvents = 'none'; // Grid shouldn't capture clicks
    }

    // Create layer group in the custom pane
    if (!gridLayerRef.current) {
      gridLayerRef.current = L.layerGroup([], { pane: gridPaneName });
      // Add to map immediately; visibility is controlled by adding/removing layers later
      gridLayerRef.current.addTo(map);
    }

    // Handler to redraw grid on map events
    const updateGrid = () => {
      // Only draw if visible and necessary data is available
      if (visible && primeMeridianSvg) {
        drawGrid();
      }
    };

    // Attach event listeners
    map.on('zoomend', updateGrid);
    map.on('moveend', updateGrid);
    // map.on('move', updateGrid); // 'move' can be very frequent, consider if needed

    initializedRef.current = true;

    // Initial draw if possible (with a slight delay)
    if (visible && primeMeridianSvg) {
      setTimeout(drawGrid, 100); // Increased delay slightly
    }

    // Cleanup function
    return () => {
      map.off('zoomend', updateGrid);
      map.off('moveend', updateGrid);
      // map.off('move', updateGrid);

      // Remove layer group from map on unmount
      if (gridLayerRef.current && map.hasLayer(gridLayerRef.current)) {
        map.removeLayer(gridLayerRef.current);
      }
      gridLayerRef.current = null; // Clear ref
    };
    // Dependencies for setting up the layer group and listeners
  }, [map, L]); // mapConfig values like svgWidth/Height are stable after init usually

  // Effect to handle visibility changes or prime meridian updates
  useEffect(() => {
    if (!initializedRef.current || !gridLayerRef.current) return; // Wait for init

    if (visible && primeMeridianSvg) {
      drawGrid(); // Redraw if becoming visible or PM changes
    } else {
      gridLayerRef.current.clearLayers(); // Clear layers if becoming hidden
    }
  }, [visible, primeMeridianSvg, mapConfig]); // Redraw if visibility, PM, or config changes

  // Function to draw the coordinate grid
  const drawGrid = () => {
    // Ensure all required elements are present
    if (!map || !gridLayerRef.current || !primeMeridianSvg || !visible) return;

    try {
      // Clear existing grid lines from the layer group
      gridLayerRef.current.clearLayers();

      const zoom = map.getZoom();

      // Determine grid spacing based on zoom level
      let spacing = 30; // Default spacing
      if (zoom > 4) spacing = 5;
      else if (zoom > 3) spacing = 10;
      else if (zoom > 2) spacing = 15;

      // Get prime meridian's SVG X coordinate
      // const primeMeridianX = primeMeridianSvg.x; // Not directly used for LatLng calculations

      // Get map's current geographic bounds
      const bounds = map.getBounds();
      const visibleWestLng = bounds.getWest();
      const visibleEastLng = bounds.getEast();
      const visibleNorthLat = bounds.getNorth();
      const visibleSouthLat = bounds.getSouth();

      // --- Draw Longitude Lines (Meridians) ---
      const minLng = Math.floor(visibleWestLng / spacing) * spacing - spacing; // Start drawing slightly left
      const maxLng = Math.ceil(visibleEastLng / spacing) * spacing + spacing; // Stop drawing slightly right

      for (let lng = minLng; lng <= maxLng; lng += spacing) {
        // Skip drawing if longitude is exactly 0 (handled by Prime Meridian draw)
        if (lng === 0) continue;

        const isMajor = lng % 30 === 0;
        try {
          // Create and add the polyline using LatLng
          L.polyline(
            [
              [visibleNorthLat, lng], // Use LatLng for Leaflet polyline
              [visibleSouthLat, lng],
            ],
            {
              color: gridStyle.GRID_COLOR,
              weight: isMajor
                ? gridStyle.MAJOR_LINE_WEIGHT
                : gridStyle.MINOR_LINE_WEIGHT,
              opacity: gridStyle.LINE_OPACITY,
              // FIX: Use undefined for dashArray if MAJOR_DASH_ARRAY is null
              dashArray: isMajor
                ? gridStyle.MAJOR_DASH_ARRAY ?? undefined
                : gridStyle.DASH_ARRAY,
              interactive: false,
              pane: 'grid-pane', // Ensure it's drawn in the correct pane
            }
          ).addTo(gridLayerRef.current);

          // Add labels for major lines (consider label overlap logic if needed)
          if (isMajor) {
            const labelLat = visibleSouthLat + (visibleNorthLat - visibleSouthLat) * 0.05; // Position near bottom
            const labelLng = lng;
             L.marker([labelLat, labelLng], {
               icon: L.divIcon({
                 className: 'grid-label longitude-label', // Add specific class
                 html: `${Math.abs(lng)}° ${lng > 0 ? 'E' : 'W'}`,
                 iconSize: [40, 20], // Adjust size as needed
                 iconAnchor: [20, 0], // Center label above point
               }),
               interactive: false,
               pane: 'grid-pane',
             }).addTo(gridLayerRef.current);
          }
        } catch (e) {
          // console.warn(`Error drawing longitude line at ${lng}:`, e);
        }
      }

      // --- Draw Prime Meridian Separately (including wraparound if needed) ---
      try {
        L.polyline(
          [
            [visibleNorthLat, 0],
            [visibleSouthLat, 0],
          ],
          {
            color: gridStyle.PRIME_MERIDIAN_COLOR,
            weight: gridStyle.PRIME_MERIDIAN_WEIGHT,
            opacity: gridStyle.PRIME_MERIDIAN_OPACITY,
            // Use undefined for dashArray if PRIME_MERIDIAN_DASH_ARRAY is null (though PM is usually dashed)
            dashArray: gridStyle.PRIME_MERIDIAN_DASH_ARRAY ?? undefined,
            interactive: false,
            pane: 'grid-pane',
          }
        ).addTo(gridLayerRef.current);

        // Add Prime Meridian label
        const pmLabelLat = visibleSouthLat + (visibleNorthLat - visibleSouthLat) * 0.05;
         L.marker([pmLabelLat, 0], {
           icon: L.divIcon({
             className: 'grid-label prime-meridian-label',
             html: '0°',
             iconSize: [40, 20],
             iconAnchor: [20, 0],
           }),
           interactive: false,
           pane: 'grid-pane',
         }).addTo(gridLayerRef.current);

        // Add logic here to draw wrapped Prime Meridians if your map wraps horizontally
        // e.g., draw at +360 and -360 longitude if necessary based on visible bounds

      } catch (e) {
         // console.warn(`Error drawing prime meridian:`, e);
      }


      // --- Draw Latitude Lines (Parallels) ---
      const minLat = Math.floor(visibleSouthLat / spacing) * spacing;
      const maxLat = Math.ceil(visibleNorthLat / spacing) * spacing;

      for (let lat = minLat; lat <= maxLat; lat += spacing) {
        const isMajor = lat % 30 === 0;
        const isEquator = lat === 0;

        try {
          // Define the line segment slightly wider than the visible area
          const lineWestLng = visibleWestLng - 10; // Extend beyond view
          const lineEastLng = visibleEastLng + 10;

          // Create and add the polyline
          L.polyline(
            [
              [lat, lineWestLng],
              [lat, lineEastLng],
            ],
            {
              color: isEquator
                ? gridStyle.EQUATOR_COLOR
                : gridStyle.GRID_COLOR,
              weight:
                isMajor || isEquator
                  ? gridStyle.MAJOR_LINE_WEIGHT
                  : gridStyle.MINOR_LINE_WEIGHT,
              opacity: gridStyle.LINE_OPACITY,
              // FIX: Use undefined for dashArray for solid lines (major/equator)
              dashArray:
                isMajor || isEquator
                  ? undefined // Use undefined for solid line
                  : gridStyle.DASH_ARRAY,
              interactive: false,
              pane: 'grid-pane',
            }
          ).addTo(gridLayerRef.current);

          // Add labels for major lines or the equator
          if (isMajor || isEquator) {
             const labelLat = lat;
             const labelLng = visibleWestLng + (visibleEastLng - visibleWestLng) * 0.05; // Position near left edge
             L.marker([labelLat, labelLng], {
               icon: L.divIcon({
                 className: `grid-label ${isEquator ? 'equator-label' : 'latitude-label'}`,
                 html: `${Math.abs(lat)}° ${lat >= 0 ? 'N' : 'S'}`,
                 iconSize: [40, 20],
                 iconAnchor: [0, 10], // Anchor left-middle
               }),
               interactive: false,
               pane: 'grid-pane',
             }).addTo(gridLayerRef.current);
          }
        } catch (e) {
          // console.warn(`Error drawing latitude line at ${lat}:`, e);
        }
      }
    } catch (error) {
      console.error('Error during drawGrid execution:', error);
    }
  };

  // This component manages Leaflet layers and doesn't render React DOM
  return null;
};

export default GridComponent;
