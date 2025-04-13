// src/components/GridComponent.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapConfig, SvgPoint } from '@/types';
// Import necessary coordinate functions
import {
  svgToLatLng,
  latLngToSvg,
  formatLatitude,
  formatLongitude,
} from '@/lib/coordinates-system';
import { gridStyle } from '@/lib/MapConfig'; // Assuming grid styles are here

interface GridComponentProps {
  map: L.Map;
  L: typeof L;
  mapConfig: MapConfig;
  primeMeridianSvg: SvgPoint | null; // Needed for PM line and potentially grid labels
  showGrid: boolean; // Renamed from 'visible' for clarity - controls grid lines
  showPrimeMeridian: boolean; // Controls visibility of the PM line
  showPositionDisplay: boolean; // Controls visibility of the mouse coordinate display
}

const GridComponent: React.FC<GridComponentProps> = ({
  map,
  L,
  mapConfig,
  primeMeridianSvg,
  showGrid, // Use the specific prop name
  showPrimeMeridian,
  showPositionDisplay,
}) => {
  const gridLayerRef = useRef<L.LayerGroup | null>(null);
  const positionDisplayControlRef = useRef<L.Control | null>(null); // Ref for the Leaflet control
  const positionDisplayDivRef = useRef<HTMLDivElement | null>(null); // Ref for the DOM element

  // --- Effect for Managing the Grid Layer Group ---
  useEffect(() => {
    if (!map || !L) return;

    // Ensure the layer group exists if any part is visible
    if (showGrid || showPrimeMeridian) {
      if (!gridLayerRef.current) {
        gridLayerRef.current = L.layerGroup();
        // Add to map only if it wasn't already added
        if (!map.hasLayer(gridLayerRef.current)) {
          gridLayerRef.current.addTo(map);
        }
      }
    } else {
      // If neither grid nor PM should be shown, remove the layer group
      if (gridLayerRef.current && map.hasLayer(gridLayerRef.current)) {
        gridLayerRef.current.remove();
        // Optionally clear the ref, but clearLayers in the drawing effect handles content
        // gridLayerRef.current = null;
      }
    }

    // Cleanup: Ensure layer group is removed on component unmount if it exists
    return () => {
      if (gridLayerRef.current && map && map.hasLayer(gridLayerRef.current)) {
        try {
          gridLayerRef.current.remove();
        } catch (e) {
          console.warn('Error removing grid layer group on unmount:', e);
        }
      }
    };
    // Dependencies: map, L, showGrid, showPrimeMeridian
  }, [map, L, showGrid, showPrimeMeridian]);

  // --- Effect for Drawing Grid and Prime Meridian ---
  useEffect(() => {
    // Exit if map/L not ready or the layer group isn't created/added
    if (!map || !L || !gridLayerRef.current) {
      return;
    }

    // Clear previous grid lines and PM line from the layer group
    gridLayerRef.current.clearLayers();

    // --- Draw Grid Lines ---
    if (showGrid) {
      try {
        const bounds = map.getBounds();
        const zoom = map.getZoom();
        const svgBounds = map.getPixelBounds(); // Get viewport in pixels

        // Define grid spacing based on zoom (example logic)
        let latSpacing = 30;
        let lngSpacing = 30;
        if (zoom > 1) {
          latSpacing = 15;
          lngSpacing = 15;
        }
        if (zoom > 3) {
          latSpacing = 10;
          lngSpacing = 10;
        }
        // Add more levels if needed

        // Calculate visible lat/lng range (approximate)
        const northEast = bounds.getNorthEast();
        const southWest = bounds.getSouthWest();

        // --- Draw Latitude Lines ---
        const startLat = Math.floor(southWest.lat / latSpacing) * latSpacing;
        const endLat = Math.ceil(northEast.lat / latSpacing) * latSpacing;

        for (let lat = startLat; lat <= endLat; lat += latSpacing) {
          if (lat < mapConfig.bounds.south || lat > mapConfig.bounds.north)
            continue; // Skip if outside map bounds

          try {
            // Need points far left and far right in SVG coords for the line
            const leftPointSvg = latLngToSvg(lat, -180, mapConfig); // Approx west edge
            const rightPointSvg = latLngToSvg(lat, 180, mapConfig); // Approx east edge

            // Convert SVG Y back to LatLng for Leaflet polyline (using a fixed Lng, e.g., 0)
            // This seems overly complex. Let's draw directly if possible or use bounds.
            // Alternative: Use map bounds directly
            const linePoints: L.LatLngExpression[] = [
              [lat, bounds.getWest()],
              [lat, bounds.getEast()],
            ];

            const isMajor = lat % 30 === 0; // Example: Major line every 30 degrees
            L.polyline(linePoints, {
              color: gridStyle.GRID_COLOR || '#666',
              weight: isMajor
                ? gridStyle.MAJOR_LINE_WEIGHT || 1.5
                : gridStyle.MINOR_LINE_WEIGHT || 0.8,
              opacity: gridStyle.LINE_OPACITY || 0.6,
              dashArray: isMajor
                ? gridStyle.MAJOR_DASH_ARRAY || undefined
                : gridStyle.DASH_ARRAY || '5,5',
              interactive: false,
            }).addTo(gridLayerRef.current);

            // TODO: Add Latitude Labels if needed (similar logic using L.marker/L.divIcon)
          } catch (lineError) {
            console.warn(`Error drawing latitude line at ${lat}:`, lineError);
          }
        }

        // --- Draw Longitude Lines ---
        const startLng = Math.floor(southWest.lng / lngSpacing) * lngSpacing;
        const endLng = Math.ceil(northEast.lng / lngSpacing) * lngSpacing;

        for (let lng = startLng; lng <= endLng; lng += lngSpacing) {
          if (lng < mapConfig.bounds.west || lng > mapConfig.bounds.east)
            continue; // Skip if outside map bounds

          try {
            const linePoints: L.LatLngExpression[] = [
              [bounds.getSouth(), lng],
              [bounds.getNorth(), lng],
            ];
            const isMajor = lng % 30 === 0; // Example: Major line every 30 degrees

            L.polyline(linePoints, {
              color: gridStyle.GRID_COLOR || '#666',
              weight: isMajor
                ? gridStyle.MAJOR_LINE_WEIGHT || 1.5
                : gridStyle.MINOR_LINE_WEIGHT || 0.8,
              opacity: gridStyle.LINE_OPACITY || 0.6,
              dashArray: isMajor
                ? gridStyle.MAJOR_DASH_ARRAY || undefined
                : gridStyle.DASH_ARRAY || '5,5',
              interactive: false,
            }).addTo(gridLayerRef.current);

            // TODO: Add Longitude Labels if needed
          } catch (lineError) {
            console.warn(`Error drawing longitude line at ${lng}:`, lineError);
          }
        }
      } catch (gridError) {
        console.error('Error calculating or drawing grid:', gridError);
      }
    }

    // --- Draw Prime Meridian Line ---
    if (showPrimeMeridian && primeMeridianSvg) {
      try {
        // Calculate the geographic coordinates for the top and bottom of the PM line
        // using the SVG origin X and the SVG height from mapConfig.
        // We need the LatLng equivalent for the line.
        // The PM is at a constant *longitude* (0 degrees in the custom system,
        // which corresponds to primeMeridianRef.lng in the standard system if needed,
        // but visually it's a vertical line at primeMeridianSvg.x).
        // We need the top/bottom latitude corresponding to the map bounds.

        // Get the LatLng for the top-left and bottom-right corners of the *SVG*
        const svgTopLeftLatLng = svgToLatLng(0, 0, mapConfig);
        const svgBottomRightLatLng = svgToLatLng(
          mapConfig.svgWidth,
          mapConfig.svgHeight,
          mapConfig,
        );

        // Get the LatLng corresponding to the prime meridian's SVG X coordinate
        // at the top and bottom of the SVG canvas.
        const startPointLatLng = svgToLatLng(
          primeMeridianSvg.x,
          0, // Top of SVG
          mapConfig,
        );
        const endPointLatLng = svgToLatLng(
          primeMeridianSvg.x,
          mapConfig.svgHeight, // Bottom of SVG
          mapConfig,
        );

        // Create the polyline using the calculated LatLng points
        const line = L.polyline(
          [
            [startPointLatLng.lat, startPointLatLng.lng],
            [endPointLatLng.lat, endPointLatLng.lng],
          ],
          {
            color: gridStyle.PRIME_MERIDIAN_COLOR || 'red',
            weight: gridStyle.PRIME_MERIDIAN_WEIGHT || 2,
            opacity: gridStyle.PRIME_MERIDIAN_OPACITY || 0.8,
            dashArray: gridStyle.PRIME_MERIDIAN_DASH_ARRAY || '8, 6',
            interactive: false,
          },
        );

        // Add the newly created line to the *same* layer group
        gridLayerRef.current.addLayer(line);
      } catch (error) {
        console.error('Error calculating/drawing prime meridian:', error);
      }
    }
    // Dependencies: Include all props used in drawing logic
  }, [
    map,
    L,
    mapConfig,
    primeMeridianSvg,
    showGrid,
    showPrimeMeridian,
    // Add map zoom/move dependencies if grid spacing depends on them
    // map.getZoom(), map.getBounds() // These might cause too many redraws, consider throttling
  ]);

  // --- Effect for Position Display Control ---
  useEffect(() => {
    if (!map || !L) return;

    // Create control instance if it doesn't exist
    if (!positionDisplayControlRef.current) {
      const PositionControl = L.Control.extend({
        options: { position: 'bottomleft' },
        onAdd: function () {
          const container = L.DomUtil.create(
            'div',
            'leaflet-control-coordinates leaflet-control', // Standard Leaflet control classes
          );
          container.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
          container.style.padding = '2px 5px';
          container.style.fontSize = '11px';
          container.style.whiteSpace = 'nowrap';
          container.style.borderRadius = '3px';
          container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
          positionDisplayDivRef.current = container; // Store ref to the div
          L.DomEvent.disableClickPropagation(container);
          L.DomEvent.disableScrollPropagation(container);
          container.innerHTML = ''; // Start empty or with placeholder
          return container;
        },
        onRemove: function () {
          positionDisplayDivRef.current = null;
        },
      });
      positionDisplayControlRef.current = new PositionControl();
    }

    // Add/Remove control based on 'showPositionDisplay' prop
    const control = positionDisplayControlRef.current;
    if (showPositionDisplay) {
      map.addControl(control);
    } else {
      // Ensure removal if prop becomes false
      if (map.addControl(control)) {
        map.removeControl(control);
      }
    }

    // Cleanup: Remove control when component unmounts
    return () => {
      if (map && control && map.addControl(control)) {
        try {
          map.removeControl(control);
        } catch (e) {
          console.warn('Could not remove position control on unmount:', e);
        }
      }
    };
    // Dependencies: map, L, showPositionDisplay
  }, [map, L, showPositionDisplay]);

  // --- Effect for Mouse Move Coordinate Display ---
  useEffect(() => {
    // Only attach listener if the control should be visible and the div exists
    if (!map || !showPositionDisplay || !positionDisplayDivRef.current) {
      // Clear text if display is hidden but control might still exist briefly
      if (positionDisplayDivRef.current) {
        positionDisplayDivRef.current.innerHTML = ''; // Clear text
      }
      return; // Don't attach listener
    }

    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      if (!positionDisplayDivRef.current) return; // Check ref again

      try {
        const latLng = e.latlng;
        // Format coordinates using imported functions
        const latStr = formatLatitude(latLng.lat);
        const lonStr = formatLongitude(latLng.lng);
        positionDisplayDivRef.current.innerHTML = `Lat: ${latStr} Lon: ${lonStr}`;
      } catch (error) {
        console.error('Error formatting coordinates:', error);
        if (positionDisplayDivRef.current) {
          positionDisplayDivRef.current.innerHTML = 'Lat/Lon Error';
        }
      }
    };

    map.on('mousemove', handleMouseMove);

    // Cleanup: Remove listener and clear text
    return () => {
      map.off('mousemove', handleMouseMove);
      if (positionDisplayDivRef.current) {
        positionDisplayDivRef.current.innerHTML = '';
      }
    };
    // Dependencies: map, showPositionDisplay, L (for format funcs, though stable)
  }, [map, showPositionDisplay, L]);

  // This component manages Leaflet layers/controls directly
  return null;
};

export default GridComponent;
