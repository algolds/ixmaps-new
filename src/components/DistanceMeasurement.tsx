// src/components/DistanceMeasurement.tsx
'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import { MapConfig } from '@/types'; // Import MapConfig type
import { MILES_TO_KM } from '@/lib/MapConfig'; // Use the value from MapConfig

// --- Update Props Interface ---
interface DistanceMeasurementProps {
  map: L.Map | null; // Allow null for initial render
  L: typeof L | null; // Allow null for initial render
  mapConfig: MapConfig; // Add mapConfig prop back
}

const DistanceMeasurement: React.FC<DistanceMeasurementProps> = ({
  map,
  L,
  mapConfig, // Destructure mapConfig
}) => {
  const measureControlRef = useRef<L.Control | null>(null);
  const measureLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]); // Use specific type
  const measureActiveRef = useRef<boolean>(false);
  const totalMeasurePointsRef = useRef<L.LatLng[]>([]); // Store LatLng points

  // --- Refactored Deactivation Logic ---
  const deactivateMeasurementMode = useCallback(() => {
    if (!measureActiveRef.current || !map) return; // Already inactive or map gone

    measureActiveRef.current = false;
    map.off('click', handleMapClick);
    map.off('dblclick', finishMeasurement); // Ensure dblclick is off
    document.removeEventListener('keydown', handleEscapeKey);

    const mapContainer = map.getContainer();
    if (mapContainer) {
      mapContainer.style.cursor = ''; // Reset cursor
    }

    // Update button style (safer check)
    if (measureControlRef.current) {
      const button = measureControlRef.current
        .getContainer()
        ?.querySelector('.measure-button');
      if (button) {
        (button as HTMLElement).style.backgroundColor = ''; // Reset button background
      }
    }

    hideMeasureInstructions();
  }, [map]); // Dependency: map instance

  // --- Escape Key Handler ---
  const handleEscapeKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        console.log('[Measure] Escape pressed - clearing measurement');
        deactivateMeasurementMode();
        clearMeasurement(); // Clear visuals
        totalMeasurePointsRef.current = []; // Reset points
      }
    },
    [deactivateMeasurementMode], // Pass dependencies in array
  );

  // --- UI Functions ---
  const showMeasureInstructions = () => {
    hideMeasureInstructions(); // Remove existing first
    const instructions = document.createElement('div');
    instructions.id = 'measure-instructions';
    instructions.innerHTML =
      'Click to add points. Double-click last point to finish. Press Esc to cancel.';
    Object.assign(instructions.style, {
      position: 'absolute',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      padding: '8px 12px',
      borderRadius: '4px',
      fontSize: '14px',
      zIndex: '1000',
      boxShadow: '0 0 5px rgba(0,0,0,0.3)',
      pointerEvents: 'none',
    });
    document.body.appendChild(instructions);
  };

  const hideMeasureInstructions = () => {
    const instructions = document.getElementById('measure-instructions');
    if (instructions) instructions.remove();
  };

  const clearMeasurement = () => {
    if (measureLayerRef.current) {
      measureLayerRef.current.clearLayers(); // Clear all markers, lines, labels
    }
    markersRef.current = []; // Reset marker array
  };

  const showResultToast = (miles: number, km: number) => {
    const message = `Total Distance: ${miles.toFixed(1)} mi (${km.toFixed(1)} km)`; // Slightly less precision
    if (typeof window.showToast === 'function') {
      window.showToast(message, 'info', 5000); // Use 'info' type
    } else {
      alert(message); // Fallback
    }
  };

  // --- Core Measurement Logic ---
  const handleMapClick = useCallback(
    (e: L.LeafletMouseEvent) => {
      if (
        !measureActiveRef.current ||
        !map ||
        !L ||
        !measureLayerRef.current ||
        !mapConfig || // Check mapConfig
        typeof mapConfig.milesPerPixel !== 'number' // Check base scale
      )
        return;

      const clickedLatLng = e.latlng;
      totalMeasurePointsRef.current.push(clickedLatLng);

      // Add marker
      const marker = L.circleMarker(clickedLatLng, {
        radius: 5,
        color: '#FF4500',
        fillColor: '#FFFFFF',
        fillOpacity: 1,
        weight: 2,
        pane: 'measure-pane', // Ensure it's in the correct pane
      }).addTo(measureLayerRef.current);
      markersRef.current.push(marker);

      // Draw segment line and label if more than one point
      if (totalMeasurePointsRef.current.length > 1) {
        const lastIdx = totalMeasurePointsRef.current.length - 1;
        const prevLatLng = totalMeasurePointsRef.current[lastIdx - 1];
        const currentLatLng = totalMeasurePointsRef.current[lastIdx];

        // Draw line segment
        L.polyline([prevLatLng, currentLatLng], {
          color: '#FF4500',
          weight: 3,
          opacity: 0.8,
          dashArray: '8,4',
          pane: 'measure-pane', // Use correct pane
        }).addTo(measureLayerRef.current);

        // --- Calculate Distance based on Pixels and Scale ---
        let miles = 0;
        let km = 0;
        try {
          const point1 = map.latLngToLayerPoint(prevLatLng); // Use LayerPoint for current zoom
          const point2 = map.latLngToLayerPoint(currentLatLng);
          const dx = point2.x - point1.x;
          const dy = point2.y - point1.y;
          const pixelDistance = Math.sqrt(dx * dx + dy * dy);

          if (!isNaN(pixelDistance)) {
            const zoom = map.getZoom();
            const baseMilesPerPixel = mapConfig.milesPerPixel; // Base scale at zoom 0
            const currentMilesPerPixel = baseMilesPerPixel / Math.pow(2, zoom); // Scale for current zoom

            miles = pixelDistance * currentMilesPerPixel;
            km = miles * MILES_TO_KM; // Use imported constant
          } else {
            console.warn('Could not calculate pixel distance for segment');
          }
        } catch (calcError) {
          console.error('Error calculating segment distance:', calcError);
        }
        // --- End Pixel/Scale Calculation ---

        // Calculate midpoint for label
        const midPoint = L.latLng(
          (prevLatLng.lat + currentLatLng.lat) / 2,
          (prevLatLng.lng + currentLatLng.lng) / 2,
        );

        // Add distance label
        L.marker(midPoint, {
          icon: L.divIcon({
            className: 'distance-label',
            html: `
              <div style="background: rgba(255,255,255,0.9); padding: 2px 5px; border-radius: 3px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
                ${miles.toFixed(1)} mi<br>${km.toFixed(1)} km
              </div>
            `,
            iconSize: undefined,
            iconAnchor: [40, 15],
          }),
          pane: 'measure-pane',
          interactive: false,
        }).addTo(measureLayerRef.current);
      }
    },
    [map, L, mapConfig], // Add mapConfig dependency
  );

  const finishMeasurement = useCallback(() => {
    if (
      !measureActiveRef.current ||
      totalMeasurePointsRef.current.length < 2 ||
      !map ||
      !mapConfig || // Check mapConfig
      typeof mapConfig.milesPerPixel !== 'number' // Check base scale
    )
      return;

    console.log('[Measure] Finishing measurement...');

    // --- Calculate TOTAL Distance based on Pixels and Scale ---
    let totalPixelDistance = 0;
    try {
      for (let i = 1; i < totalMeasurePointsRef.current.length; i++) {
        const point1 = map.latLngToLayerPoint(
          totalMeasurePointsRef.current[i - 1],
        );
        const point2 = map.latLngToLayerPoint(
          totalMeasurePointsRef.current[i],
        );
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        const segmentPixelDistance = Math.sqrt(dx * dx + dy * dy);
        if (!isNaN(segmentPixelDistance)) {
          totalPixelDistance += segmentPixelDistance;
        } else {
          console.warn(`Could not calculate pixel distance for segment ${i}`);
        }
      }

      const zoom = map.getZoom();
      const baseMilesPerPixel = mapConfig.milesPerPixel;
      const currentMilesPerPixel = baseMilesPerPixel / Math.pow(2, zoom);

      const totalMiles = totalPixelDistance * currentMilesPerPixel;
      const totalKm = totalMiles * MILES_TO_KM; // Use imported constant

      showResultToast(totalMiles, totalKm); // Show result
    } catch (calcError) {
      console.error('Error calculating total distance:', calcError);
      showResultToast(0, 0); // Show zero on error
    }
    // --- End Total Pixel/Scale Calculation ---

    deactivateMeasurementMode();
    totalMeasurePointsRef.current = [];
  }, [map, mapConfig, deactivateMeasurementMode]); // Add mapConfig dependency

  // --- Toggle Measurement Mode ---
  const toggleMeasure = useCallback(() => {
    if (!map || !L) return; // Need map and L

    if (measureActiveRef.current) {
      // --- Turn OFF ---
      console.log('[Measure] Deactivating...');
      deactivateMeasurementMode();
      clearMeasurement(); // Clear visuals immediately when toggling off
      totalMeasurePointsRef.current = []; // Reset points
    } else {
      // --- Turn ON ---
      console.log('[Measure] Activating...');
      measureActiveRef.current = true;
      clearMeasurement(); // Clear any previous visuals
      totalMeasurePointsRef.current = [];

      // Add listeners
      map.on('click', handleMapClick);
      map.on('dblclick', finishMeasurement); // Finish on double-click
      document.addEventListener('keydown', handleEscapeKey);

      // Update UI
      const mapContainer = map.getContainer();
      if (mapContainer) mapContainer.style.cursor = 'crosshair';
      if (measureControlRef.current) {
        const button = measureControlRef.current
          .getContainer()
          ?.querySelector('.measure-button');
        if (button) (button as HTMLElement).style.backgroundColor = '#f4f4f4'; // Indicate active
      }
      showMeasureInstructions();
    }
  }, [ // Pass dependencies in array
    map,
    L,
    handleMapClick,
    finishMeasurement,
    handleEscapeKey,
    deactivateMeasurementMode,
  ]);

  // --- useEffect Hook for Setup and Cleanup ---
  useEffect(() => {
    if (!map || !L) return; // Exit if map or L not ready

    // --- Pane and Layer Setup ---
    const paneName = 'measure-pane';
    if (!map.getPane(paneName)) {
      map.createPane(paneName);
      const pane = map.getPane(paneName);
      // Ensure pane exists before setting style
      if (pane) pane.style.zIndex = '650'; // Above grid/overlays, below popups/tooltips
    }
    // Ensure layer ref is set up correctly
    if (!measureLayerRef.current) {
      measureLayerRef.current = L.layerGroup([], { pane: paneName }).addTo(map);
    }

    // --- Control Creation and Addition ---
    const MeasureControl = L.Control.extend({
      options: { position: 'topleft' }, // Standard position
      onAdd: function () {
        const container = L.DomUtil.create(
          'div',
          'leaflet-bar leaflet-control measure-control',
        ); // Use standard Leaflet classes
        const button = L.DomUtil.create('a', 'measure-button', container);
        Object.assign(button, {
          href: '#',
          title: 'Measure distance (Esc to cancel)',
          innerHTML: '📏', // Ruler emoji
        });
        // Apply styles directly or rely on CSS
        Object.assign(button.style, {
          fontSize: '18px', // Adjust size as needed
          fontWeight: 'bold',
          lineHeight: '26px', // Match height
          textAlign: 'center',
          width: '26px', // Standard Leaflet control size
          height: '26px',
          display: 'block',
          textDecoration: 'none',
          color: '#333', // Standard icon color
          backgroundColor: 'white', // Ensure default background
          borderBottom: '1px solid #ccc', // Consistent border
        });
        // Add event listeners using L.DomEvent
        L.DomEvent.on(button, 'click', L.DomEvent.stopPropagation)
          .on(button, 'click', L.DomEvent.preventDefault)
          .on(button, 'click', toggleMeasure); // Call the memoized toggle function
        L.DomEvent.disableClickPropagation(container); // Prevent map clicks on the control
        return container;
      },
      onRemove: function () {
        // Optional: Cleanup specific to the control if needed
      },
    });

    // Add control only if it doesn't exist
    if (!measureControlRef.current) {
      const measureControl = new MeasureControl();
      map.addControl(measureControl);
      measureControlRef.current = measureControl;
    }

    // --- Add Required CSS Styles ---
    // It's better to put these in your global CSS file, but adding dynamically for completeness
    const addDistanceStyles = () => {
      if (document.getElementById('distance-measurement-styles')) return;
      const style = document.createElement('style');
      style.id = 'distance-measurement-styles';
      // Simplified styles, rely more on inline styles set above if needed
      style.textContent = `
        .distance-label { pointer-events: none; font-size: 11px; text-align: center; white-space: nowrap; }
        .measure-control a.measure-button:hover { background-color: #f4f4f4 !important; } /* Use !important if needed */
      `;
      document.head.appendChild(style);
    };
    addDistanceStyles();

    // --- Cleanup ---
    return () => {
      console.log('[Measure] Cleaning up DistanceMeasurement...');
      // Deactivate mode if active (removes listeners, resets state)
      deactivateMeasurementMode(); // Use the memoized version

      // Remove the control
      if (map && measureControlRef.current) {
        try {
          map.removeControl(measureControlRef.current);
        } catch (e) {
          console.warn('Error removing measure control:', e);
        }
        measureControlRef.current = null;
      }

      // Clear layers and remove layer group
      if (measureLayerRef.current) {
        measureLayerRef.current.clearLayers();
        if (map && map.hasLayer(measureLayerRef.current)) {
          try {
            map.removeLayer(measureLayerRef.current);
          } catch (e) {
            /*ignore*/
          }
        }
        measureLayerRef.current = null;
      }

      // Remove added styles
      const style = document.getElementById('distance-measurement-styles');
      if (style) style.remove();
    };
    // Ensure toggleMeasure and deactivateMeasurementMode are stable refs
  }, [map, L, toggleMeasure, deactivateMeasurementMode]);

  // Component renders nothing directly, manages Leaflet elements
  return null;
};

// Add the showToast to Window interface if not already globally defined
// Ensure this matches your actual Toast implementation signature
declare global {
  interface Window {
    showToast: (
      message: string,
      type?: string,
      duration?: number,
    ) => string | void; // Allow void return
    hideToast?: (id: string) => void; // Make hideToast optional if not always present
  }
}

export default DistanceMeasurement;
