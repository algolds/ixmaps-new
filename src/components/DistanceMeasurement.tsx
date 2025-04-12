// src/components/DistanceMeasurement.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapConfig, LatLng } from '@/types'; // Make sure MapConfig is imported
import { calculateDistance } from '@/lib/coordinates-system'; // Ensure correct path



// Define the props interface for this component
interface DistanceMeasurementProps {
  map: any;
  L: any;
  mapConfig: MapConfig; // <-- *** ENSURE THIS LINE EXISTS ***
}

const DistanceMeasurement: React.FC<DistanceMeasurementProps> = ({
  map,
  L,
  mapConfig, // <-- Destructure the prop
}) => {
  const drawnItemsRef = useRef<any>(null);
  const drawControlRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false); // Track if draw plugin is loaded

  // Load Leaflet.draw CSS and JS
  useEffect(() => {
    if (document.getElementById('leaflet-draw-css')) return; // Prevent duplicate loads

    const cssLink = document.createElement('link');
    cssLink.id = 'leaflet-draw-css';
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css';
    document.head.appendChild(cssLink);

    const styleTag = document.createElement('style');
    styleTag.id = 'leaflet-draw-inline-style'; // Give it an ID for removal
    styleTag.textContent = drawControlRef;
    document.head.appendChild(styleTag);

    const script = document.createElement('script');
    script.id = 'leaflet-draw-script'; // Give it an ID for removal
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js';
    script.async = true;
    script.onload = () => setIsLoaded(true);
    script.onerror = () => console.error('Failed to load Leaflet.draw');
    document.body.appendChild(script);

    return () => {
      // Cleanup script and style tags
      document.getElementById('leaflet-draw-css')?.remove();
      document.getElementById('leaflet-draw-inline-style')?.remove();
      document.getElementById('leaflet-draw-script')?.remove();
    };
  }, []);


  useEffect(() => {
    // Initialize only when everything is ready
    if (!map || !L || !L.Draw || !isLoaded || !mapConfig) return;

    // --- Cleanup previous controls/layers ---
    if (drawControlRef.current) { drawControlRef.current.remove(); drawControlRef.current = null; }
    if (drawnItemsRef.current) { drawnItemsRef.current.remove(); drawnItemsRef.current = null; }
    // --- End Cleanup ---

    drawnItemsRef.current = new L.FeatureGroup();
    map.addLayer(drawnItemsRef.current);

    drawControlRef.current = new L.Control.Draw({
      position: 'topright',
      draw: {
        polyline: { shapeOptions: { color: '#f357a1', weight: 4 }, metric: true, feet: false, showLength: true },
        polygon: false, rectangle: false, circle: false, marker: false, circlemarker: false,
      },
      edit: { featureGroup: drawnItemsRef.current, remove: true },
    });
    map.addControl(drawControlRef.current);

    const handleDrawCreated = (e: any) => {
      const type = e.layerType;
      const layer = e.layer;
      if (type === 'polyline') {
        const latlngs = layer.getLatLngs() as LatLng[];
        if (latlngs.length >= 2) {
          let totalDistanceKm = 0;
          let totalDistanceMiles = 0;
          for (let i = 1; i < latlngs.length; i++) {
             // Use the passed mapConfig for calculation
             const dist = calculateDistance(latlngs[i-1], latlngs[i], mapConfig);
             totalDistanceKm += dist.km;
             totalDistanceMiles += dist.miles;
          }
          const popupContent = `Distance:<br>${totalDistanceMiles.toFixed(2)} miles<br>${totalDistanceKm.toFixed(2)} km`;
          layer.bindPopup(popupContent).openPopup();
        }
      }
      drawnItemsRef.current.addLayer(layer);
    };

    map.on(L.Draw.Event.CREATED, handleDrawCreated);

    // Cleanup event listeners and controls
    return () => {
      if (map) {
         map.off(L.Draw.Event.CREATED, handleDrawCreated);
         if (drawControlRef.current) { try { drawControlRef.current.remove(); } catch (err) {} }
         if (drawnItemsRef.current) { try { drawnItemsRef.current.remove(); } catch (err) {} }
      }
       drawControlRef.current = null;
       drawnItemsRef.current = null;
    };
  }, [map, L, mapConfig, isLoaded]); // Include mapConfig in dependency array

  return null;
};

export default DistanceMeasurement;
