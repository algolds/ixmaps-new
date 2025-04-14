// src/components/MapScale.tsx
'use client';

import { MapConfig } from '@/types'; // Import MapConfig type
import React, { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';

interface MapScaleProps {
  map: L.Map | null; // Allow null initially
  L: typeof L | null; // Allow null initially
  mapConfig: MapConfig; // Use the specific type
}

// Conversion factor (can be moved to a constants file)
const MILES_TO_KM = 1.60934;

const MapScale: React.FC<MapScaleProps> = ({ map, L, mapConfig }) => {
  const scaleControlRef = useRef<L.Control | null>(null);
  const scaleContainerRef = useRef<HTMLDivElement | null>(null);
  const scaleBarRef = useRef<HTMLDivElement | null>(null);
  const scaleDistanceRef = useRef<HTMLDivElement | null>(null);
  const scaleRatioRef = useRef<HTMLDivElement | null>(null);

  // --- Function to Update Scale Display ---
  const updateScale = useCallback(() => {
    // Ensure all refs and map data are available
    if (
      !map ||
      !mapConfig ||
      !scaleBarRef.current ||
      !scaleDistanceRef.current ||
      !scaleRatioRef.current ||
      typeof mapConfig.milesPerPixel !== 'number' || // Check if base scale is defined
      typeof mapConfig.svgWidth !== 'number' ||
      typeof mapConfig.rawWidth !== 'number' ||
      mapConfig.rawWidth === 0 // Prevent division by zero
    ) {
      // Clear display if data is missing
      if (scaleDistanceRef.current) scaleDistanceRef.current.innerHTML = '---';
      if (scaleRatioRef.current) scaleRatioRef.current.innerHTML = 'Scale: ---';
      return;
    }

    const zoom = map.getZoom();
    const baseMilesPerPixel = mapConfig.milesPerPixel; // Use the base scale from config (calculated for zoom 0 of rendered system)

    // Calculate scale for the CURRENT zoom level
    const zoomFactor = Math.pow(2, zoom); // Factor relative to zoom 0
    const currentMilesPerPixel = baseMilesPerPixel / zoomFactor;
    const currentKmPerPixel = currentMilesPerPixel * MILES_TO_KM;

    // --- Update Scale Bar Text ---
    // Determine a reasonable geographic distance for the bar based on current scale
    // Aim for a bar width around 100-150 pixels on screen
    const targetScreenWidthPx = 100; // Target width for the text label distance
    let displayMiles = targetScreenWidthPx * currentMilesPerPixel;
    let displayKm = targetScreenWidthPx * currentKmPerPixel;

    // Round to a nice number (e.g., 100, 200, 500, 1000)
    const niceMiles = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
    let bestMiles = niceMiles[niceMiles.length - 1]; // Start with largest
    for (const miles of niceMiles) {
      if (displayMiles <= miles * 1.2) { // Find smallest "nice" number >= calculated distance
        bestMiles = miles;
        break;
      }
    }
    displayMiles = bestMiles;
    displayKm = Math.round(displayMiles * MILES_TO_KM); // Recalculate km based on nice miles

    // Calculate the screen width needed for this "nice" distance
    const screenWidthForMiles = displayMiles / currentMilesPerPixel;

    // Update the scale bar width and text
    scaleBarRef.current.style.width = `${Math.round(screenWidthForMiles)}px`; // Set bar width
    scaleDistanceRef.current.innerHTML = `${displayMiles.toLocaleString()} mi (${displayKm.toLocaleString()} km)`;

    // --- Update Scale Ratio (Representative Fraction) ---
    // This is more complex and depends on screen resolution vs. real-world distance
    // A common approximation uses the center latitude
    try {
        const center = map.getCenter();
        const metersPerPixel = (Math.cos(center.lat * Math.PI / 180) * 2 * Math.PI * 6378137) / (256 * Math.pow(2, zoom)); // Leaflet's approx calculation
        const ratio = Math.round(metersPerPixel * (window.devicePixelRatio || 1) * 39.37 * 72); // Approx screen pixels per inch (adjust 72 DPI if needed)
        // Simplified: Use the pixel scale directly if appropriate for your CRS
        // const ratio = Math.round(1 / (currentMilesPerPixel * 5280 * 12)); // Rough estimate based on miles/pixel

        // Using a simpler approach based on known map width if projection is simple
        // Example: If mapConfig.svgWidth pixels represents X degrees longitude...
        // This part is highly dependent on your specific CRS and needs careful calibration.
        // For now, let's use a placeholder or the Leaflet approximation.
        scaleRatioRef.current.innerHTML = `Scale ≈ 1:${ratio.toLocaleString()}`;

    } catch (e) {
        console.warn("Could not calculate map ratio:", e);
        scaleRatioRef.current.innerHTML = `Scale: Error`;
    }


  }, [map, mapConfig, L]); // Dependencies

  // --- Effect to Create/Update Control ---
  useEffect(() => {
    if (!map || !L) return;

    // Remove existing control first to prevent duplicates on hot-reload
    if (scaleControlRef.current) {
      try {
        map.removeControl(scaleControlRef.current);
      } catch (e) { /* Ignore */ }
      scaleControlRef.current = null;
      // Clear refs to DOM elements inside the old control
      scaleContainerRef.current = null;
      scaleBarRef.current = null;
      scaleDistanceRef.current = null;
      scaleRatioRef.current = null;
    }

    // Create custom scale control class
    const CustomScaleControl = L.Control.extend({
      options: {
        position: 'bottomright', // Standard position
      },

      onAdd: function () {
        const container = L.DomUtil.create('div', 'custom-scale-control leaflet-control'); // Added leaflet-control class
        // Apply styles via CSS or inline
        container.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        container.style.padding = '5px 10px';
        container.style.border = '1px solid #ccc';
        container.style.borderRadius = '4px';
        container.style.fontSize = '11px';
        container.style.lineHeight = '1.2';
        container.style.color = '#333';
        container.style.minWidth = '150px'; // Ensure minimum width
        container.style.textAlign = 'center';
        container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';

        // Store container ref
        scaleContainerRef.current = container;

        // Scale title (Optional)
        // const title = L.DomUtil.create('div', 'scale-title', container);
        // title.innerHTML = 'Map Scale';
        // title.style.fontWeight = 'bold';
        // title.style.marginBottom = '5px';

        // Scale distance value (Text above bar)
        const distance = L.DomUtil.create('div', 'scale-distance', container);
        distance.style.marginBottom = '2px';
        scaleDistanceRef.current = distance; // Store ref

        // Scale bar element
        const barContainer = L.DomUtil.create('div', '', container); // Container for centering
        barContainer.style.height = '8px';
        barContainer.style.marginBottom = '2px';
        const scaleBar = L.DomUtil.create('div', 'scale-bar', barContainer);
        scaleBar.style.height = '100%';
        scaleBar.style.border = '1px solid #555';
        scaleBar.style.borderTop = 'none'; // Make it look like tick marks
        scaleBar.style.backgroundColor = 'rgba(255, 255, 255, 0.5)'; // Semi-transparent bar
        scaleBar.style.margin = '0 auto'; // Center the bar
        scaleBarRef.current = scaleBar; // Store ref

        // Scale ratio (Text below bar)
        const ratio = L.DomUtil.create('div', 'scale-ratio', container);
        ratio.style.fontSize = '10px';
        ratio.style.color = '#555';
        scaleRatioRef.current = ratio; // Store ref

        // Initial update
        updateScale();

        return container;
      },

      onRemove: function() {
         // Clear refs when control is removed
         scaleContainerRef.current = null;
         scaleBarRef.current = null;
         scaleDistanceRef.current = null;
         scaleRatioRef.current = null;
      }
    });

    // Add the new control instance
    const newControl = new CustomScaleControl();
    map.addControl(newControl);
    scaleControlRef.current = newControl; // Store ref to the control instance

    // Add listener for zoom events to update the scale
    map.on('zoomend', updateScale);
    // Also update on moveend if ratio depends on center latitude
    map.on('moveend', updateScale);

    // Cleanup function for the effect
    return () => {
      if (map) {
        map.off('zoomend', updateScale); // Remove listener
        map.off('moveend', updateScale);
        if (scaleControlRef.current) {
          try {
            map.removeControl(scaleControlRef.current); // Remove control from map
          } catch (e) {
            console.warn('Error removing scale control:', e);
          }
          scaleControlRef.current = null; // Clear control ref
        }
      }
    };
  }, [map, L, mapConfig, updateScale]); // Dependencies

  return null; // Control is added directly to the map
};

export default MapScale;
