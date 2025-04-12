// src/components/CoordinatesComponent.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapConfig, SvgPoint, LatLng } from '@/types'; // Added LatLng import
// Ensure these are exported from your coordinates-system file now
import {
  svgToLatLng,
  formatLatitude,
  formatLongitude,
} from '@/lib/coordinates-system';

// Define the props interface directly in the file or import if defined elsewhere
interface CoordinatesComponentProps {
  map: L.Map;
  L: typeof L;
  visible: boolean; // Controls if the component adds its controls/listeners
  mapConfig: MapConfig; // Source for svgHeight, projection params
  primeMeridianSvg: SvgPoint | null; // SVG origin of PM
  showPrimeMeridian: boolean; // Controls visibility of the PM line itself
  setPrimeMeridianSvg: React.Dispatch<React.SetStateAction<SvgPoint | null>>; // To update PM origin if needed (e.g., on projection change)
  showPositionDisplay: boolean; // Controls visibility of the mouse coordinate display
}

const CoordinatesComponent: React.FC<CoordinatesComponentProps> = ({
  map,
  L,
  visible,
  mapConfig,
  primeMeridianSvg,
  showPrimeMeridian,
  setPrimeMeridianSvg, // Keep if PM needs recalculation based on map events
  showPositionDisplay,
}) => {
  const primeMeridianLayerRef = useRef<L.LayerGroup | null>(null);
  const positionDisplayControlRef = useRef<L.Control | null>(null); // Ref for the Leaflet control
  const positionDisplayDivRef = useRef<HTMLDivElement | null>(null); // Ref for the DOM element inside the control

  // --- Effect for Position Display Control ---
  useEffect(() => {
    if (!map || !L) return;

    // Create control instance if it doesn't exist
    if (!positionDisplayControlRef.current) {
      const PositionControl = L.Control.extend({
        // Define options, onAdd, onRemove methods for the control
        options: { position: 'bottomleft' },
        onAdd: function () {
          const container = L.DomUtil.create(
            'div',
            'leaflet-control-coordinates leaflet-control' // Standard Leaflet control classes
          );
          // Apply basic styling (consider moving to CSS)
          container.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
          container.style.padding = '2px 5px';
          container.style.fontSize = '11px';
          container.style.whiteSpace = 'nowrap';
          container.style.borderRadius = '3px';
          container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';

          positionDisplayDivRef.current = container; // Store ref to the div
          L.DomEvent.disableClickPropagation(container); // Prevent map clicks
          L.DomEvent.disableScrollPropagation(container); // Prevent map zoom
          container.innerHTML = 'Lat: --- Lon: ---'; // Initial placeholder text
          return container;
        },
        onRemove: function () {
          // Clean up the ref when the control is removed
          positionDisplayDivRef.current = null;
        },
      });
      positionDisplayControlRef.current = new PositionControl();
    }

    // Add/Remove control based on 'visible' prop
    const control = positionDisplayControlRef.current;
    if (visible) {
      // Add the control to the map. Leaflet handles checks if it's already added.
      map.addControl(control);
    }
    // Removal is handled by the cleanup function below

    // Cleanup: Remove control when component unmounts or dependencies change
    return () => {
      // Check if map exists and control is referenced before removing
      if (map && control) {
        // Use a try-catch as removeControl might throw if the control isn't on the map
        // (though it shouldn't happen with this logic, it's safer)
        try {
          map.removeControl(control);
        } catch (e) {
          console.warn('Could not remove position control:', e);
        }
      }
      // Note: We don't nullify positionDisplayControlRef here because the effect might
      // re-run and need the reference. It gets created/destroyed with the component lifecycle.
    };
  }, [map, L, visible]); // Dependencies: Re-run if map, L, or visibility changes

  // --- Effect for Mouse Move Coordinate Display ---
  useEffect(() => {
    // Only attach listener if the component is visible and the display is enabled
    if (!map || !visible || !showPositionDisplay) {
      // Clear text if display is hidden but component is visible
      if (positionDisplayDivRef.current) {
        positionDisplayDivRef.current.innerHTML = ''; // Clear text
      }
      return; // Don't attach listener
    }

    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      // Ensure the display div reference is still valid
      if (!positionDisplayDivRef.current) return;

      try {
        const latLng = e.latlng; // Get coordinates from mouse event
        // Format coordinates using imported functions
        const latStr = formatLatitude(latLng.lat);
        const lonStr = formatLongitude(latLng.lng);
        // Update the content of the display div
        positionDisplayDivRef.current.innerHTML = `Lat: ${latStr} Lon: ${lonStr}`;
      } catch (error) {
        console.error('Error converting/formatting coordinates:', error);
        // Display error message in the control
        if (positionDisplayDivRef.current) {
          positionDisplayDivRef.current.innerHTML = 'Lat: Error Lon: Error';
        }
      }
    };

    // Attach the event listener to the map
    map.on('mousemove', handleMouseMove);

    // Cleanup: Remove listener and clear text when effect cleans up
    return () => {
      map.off('mousemove', handleMouseMove);
      // Clear text when the listener is removed or display is hidden
      if (positionDisplayDivRef.current) {
        positionDisplayDivRef.current.innerHTML = '';
      }
    };
    // Re-run if visibility or showPositionDisplay changes
  }, [map, visible, showPositionDisplay, L, formatLatitude, formatLongitude]);

  // --- Effect for Prime Meridian Line ---
  useEffect(() => {
    // Exit if map/L not ready or component is hidden
    if (!map || !L || !visible) {
      // Clean up layer group if component is not visible or map/L not ready
      if (primeMeridianLayerRef.current) {
        primeMeridianLayerRef.current.remove(); // Remove group from map
        primeMeridianLayerRef.current = null; // Clear ref
      }
      return;
    }

    // Ensure the layer group exists and is added to the map
    if (!primeMeridianLayerRef.current) {
      primeMeridianLayerRef.current = L.layerGroup().addTo(map);
    }

    // Clear previous lines within the group before drawing new ones
    primeMeridianLayerRef.current.clearLayers();

    // Only draw if showPrimeMeridian is true and we have the SVG origin point
    if (showPrimeMeridian && primeMeridianSvg) {
      try {
        // Calculate the geographic coordinates for the top and bottom of the PM line
        // using the SVG origin X and the SVG height from mapConfig.
        const endPointLatLng = svgToLatLng(
          primeMeridianSvg.x,
          mapConfig.svgHeight, // Use height from config
          mapConfig
        );
        const startPointLatLng = svgToLatLng(
          primeMeridianSvg.x,
          0, // Top of the SVG
          mapConfig
        );

        // Create the polyline using the calculated LatLng points
        const line = L.polyline(
          [
            [startPointLatLng.lat, startPointLatLng.lng],
            [endPointLatLng.lat, endPointLatLng.lng],
          ],
          {
            // Style the line (consider making these configurable)
            color: 'red',
            weight: 1,
            dashArray: '5, 5',
            interactive: false, // Line should not capture mouse events
            // Consider adding to a specific pane if needed for z-index control
            // pane: 'overlayPane' // or a custom pane like 'gridPane'
          }
        );

        // Add the newly created line to the layer group
        primeMeridianLayerRef.current.addLayer(line);
      } catch (error) {
        console.error('Error calculating/drawing prime meridian:', error);
        // Handle potential errors during coordinate conversion or line creation
      }
    }
    // No return cleanup needed here for the line itself,
    // as clearing happens at the start of the effect,
    // and the layer group removal is handled by the outer visibility check.
  }, [
    map,
    L,
    visible,
    mapConfig, // Include mapConfig as it's used in calculations
    primeMeridianSvg,
    showPrimeMeridian,
    // setPrimeMeridianSvg is not needed unless this effect recalculates it
  ]);

  // This component manages Leaflet controls/layers directly and
  // does not render any React DOM elements itself.
  return null;
};

export default CoordinatesComponent;
