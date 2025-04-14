// src/components/DistanceMeasurement.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import type { MapConfig } from '@/types'; // Assuming types are defined here
import { calculateDistance } from '@/lib/DistanceCalculator'; // Use the refined calculator

// Import Leaflet types/base
import type L from 'leaflet';
// Import Leaflet Draw CSS ONLY (JS should be loaded globally or via MapComponent)
import 'leaflet-draw/dist/leaflet.draw.css';

// Define the props interface for this component
interface DistanceMeasurementProps {
  map: L.Map | null;
  L: typeof window.L | null; // Pass the Leaflet instance (L)
  mapConfig: MapConfig | null; // Pass map config for context/dependency
}

const DistanceMeasurement: React.FC<DistanceMeasurementProps> = ({
  map,
  L: LeafletInstance, // Use the passed L instance
  mapConfig, // Include mapConfig as a dependency for the effect
}) => {
  // Refs to keep track of the draw control and the layer group for drawn items
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);

  // Effect to initialize and manage the Leaflet Draw controls
  useEffect(() => {
    // --- Pre-conditions Check ---
    const LRef = LeafletInstance; // Use the L instance passed from parent
    if (!map || !LRef) {
      console.log(
        '[DistanceMeasurement] Skipping draw init: Map or L not ready.',
      );
      return; // Exit if map or Leaflet instance isn't available
    }

    // Check if Leaflet Draw's Control is available on the passed L instance
    // This ensures Leaflet Draw JS has been loaded before this component runs
    if (!LRef.Control.Draw) {
      console.error(
        '[DistanceMeasurement] L.Control.Draw not found! Ensure Leaflet Draw JS is loaded globally or in the parent Map component before this component mounts.',
      );
      return; // Stop if Draw control is missing
    }

    console.log('[DistanceMeasurement] Initializing draw controls...');

    // --- Cleanup Previous Instances ---
    // Remove existing draw control from map if it exists
    if (drawControlRef.current) {
      console.log('[DistanceMeasurement] Removing previous draw control.');
      try {
        drawControlRef.current.remove(); // Use Leaflet's remove method
      } catch (err) {
        console.warn('Error removing previous draw control:', err);
      }
      drawControlRef.current = null; // Clear the ref
    }
    // Remove and clear the layer group for previously drawn items
    if (drawnItemsRef.current) {
      console.log('[DistanceMeasurement] Removing previous drawn items layer.');
      try {
        drawnItemsRef.current.remove(); // Remove layer from map
        drawnItemsRef.current.clearLayers(); // Clear features within the layer
      } catch (err) {
        console.warn('Error removing/clearing previous drawn items:', err);
      }
      drawnItemsRef.current = null; // Clear the ref
    }

    // --- Initialize ---
    // Create a new FeatureGroup to hold the items drawn by the user
    drawnItemsRef.current = new LRef.FeatureGroup();
    map.addLayer(drawnItemsRef.current); // Add this group to the map

    // Create the Draw control instance
    drawControlRef.current = new LRef.Control.Draw({
      position: 'topleft', // Position the control on the map
      draw: {
        // Configure drawing options
        polyline: {
          shapeOptions: {
            // Style for the line being drawn
            color: '#f357a1', // Pink color
            weight: 4,
          },
          metric: true, // Show distances in kilometers in the default tooltip
          feet: false, // Do not show distances in feet
          showLength: true, // Show length tooltip while drawing
          repeatMode: true, // Allow drawing multiple polylines without re-clicking the button
        },
        // Disable other drawing tools
        polygon: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
      edit: {
        // Configure editing options
        featureGroup: drawnItemsRef.current, // Specify the layer group to edit
        remove: true, // Allow deleting drawn features
      },
    });
    map.addControl(drawControlRef.current); // Add the control to the map
    console.log('[DistanceMeasurement] Draw controls added to map.');

    // --- Event Handler for Feature Creation ---
    const handleDrawCreated = (e: L.LeafletEvent) => {
      // Type assertion is often needed with Leaflet Draw events
      const layer = (e as L.DrawEvents.Created).layer;
      const layerType = (e as L.DrawEvents.Created).layerType;

      // Check if the created layer is a polyline
      if (layerType === 'polyline' && layer instanceof LRef.Polyline) {
        const polylineLayer = layer as L.Polyline; // Type cast for clarity
        const latlngs = polylineLayer.getLatLngs() as L.LatLng[]; // Get vertices

        // Ensure there are at least two points to measure a distance
        if (latlngs.length >= 2) {
          let totalDistanceKm = 0;
          let totalDistanceMiles = 0;

          // Calculate distance segment by segment
          for (let i = 1; i < latlngs.length; i++) {
            try {
              // Use the imported calculateDistance function, passing map instance
              const segmentDistance = calculateDistance(
                latlngs[i - 1],
                latlngs[i],
                map, // Pass the map object
              );
              totalDistanceKm += segmentDistance.kilometers;
              totalDistanceMiles += segmentDistance.miles;
            } catch (calcError) {
              console.error('Error calculating distance segment:', calcError);
              // Display error in the popup if calculation fails
              polylineLayer
                .bindPopup('Error calculating distance for this segment.')
                .openPopup();
              // Optionally remove the problematic layer or handle error differently
              // if (drawnItemsRef.current) drawnItemsRef.current.removeLayer(polylineLayer);
              return; // Stop processing this polyline on error
            }
          }

          // Format the final distance for the popup
          const popupContent = `Distance:<br>${totalDistanceMiles.toFixed(
            2,
          )} miles<br>${totalDistanceKm.toFixed(2)} km`;

          // Bind the popup with the total distance to the drawn polyline
          polylineLayer.bindPopup(popupContent).openPopup();
          console.log(
            `[DistanceMeasurement] Polyline drawn. Distance: ${totalDistanceKm.toFixed(2)} km (${totalDistanceMiles.toFixed(2)} miles)`,
          );
        }
      }

      // Add the newly drawn and processed layer to our feature group
      if (drawnItemsRef.current) {
        drawnItemsRef.current.addLayer(layer);
      } else {
        // This case should ideally not happen if initialization is correct
        console.error(
          '[DistanceMeasurement] drawnItemsRef is null when trying to add layer.',
        );
        // Fallback: add directly to map? Or log error.
        // map.addLayer(layer);
      }
    };

    // Register the event listener for when a feature is created
    map.on(LRef.Draw.Event.CREATED, handleDrawCreated);
    console.log('[DistanceMeasurement] CREATED event listener added.');

    // --- Cleanup Function for this Effect ---
    // This function runs when the component unmounts or dependencies change
    return () => {
      console.log('[DistanceMeasurement] Cleaning up draw controls effect...');
      if (map) {
        // Remove the event listener to prevent memory leaks
        console.log('[DistanceMeasurement] Removing CREATED event listener.');
        map.off(LRef.Draw.Event.CREATED, handleDrawCreated);

        // Remove the draw control from the map
        if (drawControlRef.current) {
          console.log('[DistanceMeasurement] Removing draw control from map.');
          try {
            drawControlRef.current.remove();
          } catch (err) {
            console.warn('Error removing draw control on cleanup:', err);
          }
        }
        // Remove the layer group for drawn items
        if (drawnItemsRef.current) {
          console.log(
            '[DistanceMeasurement] Removing drawn items layer from map.',
          );
          try {
            drawnItemsRef.current.remove();
          } catch (err) {
            console.warn(
              'Error removing drawn items layer on cleanup:',
              err,
            );
          }
        }
      }
      // Nullify refs after cleanup
      drawControlRef.current = null;
      drawnItemsRef.current = null;
      console.log('[DistanceMeasurement] Cleanup complete.');
    };
    // Dependencies for the useEffect hook:
    // Re-run the effect if the map instance, Leaflet instance, or mapConfig changes.
  }, [map, LeafletInstance, mapConfig]);

  // This component manages map controls and layers, it doesn't render any direct UI
  return null;
};

export default DistanceMeasurement;
