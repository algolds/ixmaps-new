// src/components/DistanceMeasurement.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapConfig } from '@/types';
import { calculateDistance } from '@/lib/DistanceCalculator';

// Import Leaflet types/base
import L from 'leaflet';
// REMOVED: import 'leaflet-draw'; // <-- *** REMOVE THIS LINE ***

// Import the Leaflet Draw CSS ONLY
import 'leaflet-draw/dist/leaflet.draw.css'; // <-- *** KEEP THIS LINE ***

// Define the props interface for this component
interface DistanceMeasurementProps {
  map: L.Map | null;
  L: typeof window.L | null; // Or typeof L if you prefer consistency
  mapConfig: MapConfig | null;
}

const DistanceMeasurement: React.FC<DistanceMeasurementProps> = ({
  map,
  L: LeafletInstance, // Use the passed L instance
  mapConfig,
}) => {
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);

  // Initialize Draw Controls when map/L are ready
  useEffect(() => {
    // --- Pre-conditions Check ---
    const LRef = LeafletInstance; // Use the L instance passed from MapComponent
    if (!map || !LRef) {
      console.log(
        '[DistanceMeasurement] Skipping draw control initialization (Map or L not ready).',
        { hasMap: !!map, hasL: !!LRef },
      );
      return;
    }

    // Check if L.Control.Draw is available (should be, as import is now in MapComponent)
    // This check is still good as a safeguard
    if (!LRef.Control.Draw) {
      console.error(
        '[DistanceMeasurement] L.Control.Draw not found! Check import order in parent component.',
      );
      return; // Stop if Draw is still missing
    }

    console.log('[DistanceMeasurement] Initializing draw controls...');

    // --- Cleanup previous instances ---
    // ... (cleanup code remains the same) ...
     if (drawControlRef.current) {
      console.log('[DistanceMeasurement] Removing previous draw control.');
      try {
        drawControlRef.current.remove();
      } catch (err) {
        console.warn('Error removing previous draw control:', err);
      }
      drawControlRef.current = null;
    }
    if (drawnItemsRef.current) {
      console.log('[DistanceMeasurement] Removing previous drawn items layer.');
      try {
        drawnItemsRef.current.remove();
        drawnItemsRef.current.clearLayers();
      } catch (err) {
        console.warn('Error removing previous drawn items:', err);
      }
      drawnItemsRef.current = null;
    }


    // --- Initialize ---
    drawnItemsRef.current = new LRef.FeatureGroup();
    map.addLayer(drawnItemsRef.current);

    drawControlRef.current = new LRef.Control.Draw({
      // ... (options remain the same) ...
       position: 'topleft',
      draw: {
        polyline: {
          shapeOptions: { color: '#f357a1', weight: 4 },
          metric: true,
          feet: false,
          showLength: true,
          repeatMode: true,
        },
        polygon: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
      edit: {
        featureGroup: drawnItemsRef.current,
        remove: true,
      },
    });
    map.addControl(drawControlRef.current);
    console.log('[DistanceMeasurement] Draw controls added to map.');

    // --- Event Handler ---
    const handleDrawCreated = (e: L.LeafletEvent) => {
       // ... (handler code remains the same, using LRef if needed for types) ...
       const layer = (e as any).layer;
      const layerType = (e as any).layerType;

      if (layerType === 'polyline' && layer instanceof LRef.Polyline) {
        const polylineLayer = layer as L.Polyline;
        const latlngs = polylineLayer.getLatLngs() as L.LatLng[];

        if (latlngs.length >= 2) {
          let totalDistanceKm = 0;
          let totalDistanceMiles = 0;

          for (let i = 1; i < latlngs.length; i++) {
            try {
              // calculateDistance now expects the map object
              const dist = calculateDistance(latlngs[i - 1], latlngs[i], map);
              totalDistanceKm += dist.kilometers;
              totalDistanceMiles += dist.miles;
            } catch (calcError) {
              console.error('Error calculating distance segment:', calcError);
              layer.bindPopup('Error calculating distance.').openPopup();
              return;
            }
          }

          const popupContent = `Distance:<br>${totalDistanceMiles.toFixed(
            2,
          )} miles<br>${totalDistanceKm.toFixed(2)} km`;
          layer.bindPopup(popupContent).openPopup();
          console.log(
            `[DistanceMeasurement] Polyline drawn. Distance: ${totalDistanceKm.toFixed(2)} km`,
          );
        }
      }
      if (drawnItemsRef.current) {
        drawnItemsRef.current.addLayer(layer);
      } else {
        console.error(
          '[DistanceMeasurement] drawnItemsRef is null, cannot add layer.',
        );
      }
    };

    // Use LRef here too
    map.on(LRef.Draw.Event.CREATED, handleDrawCreated);
    console.log('[DistanceMeasurement] CREATED event listener added.');

    // --- Cleanup for this effect ---
    return () => {
      // ... (cleanup code remains the same, using LRef if needed) ...
       console.log('[DistanceMeasurement] Cleaning up draw controls effect...');
      if (map) {
        console.log('[DistanceMeasurement] Removing CREATED event listener.');
        // Use LRef here too
        map.off(LRef.Draw.Event.CREATED, handleDrawCreated);

        if (drawControlRef.current) {
          console.log('[DistanceMeasurement] Removing draw control from map.');
          try {
            drawControlRef.current.remove();
          } catch (err) {
            console.warn('Error removing draw control on cleanup:', err);
          }
        }
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
      drawControlRef.current = null;
      drawnItemsRef.current = null;
    };
  }, [map, LeafletInstance, mapConfig]); // Dependencies remain the same

  // This component doesn't render anything itself
  return null;
};

export default DistanceMeasurement;
