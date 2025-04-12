// src/components/LeafletLoader.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import Script from 'next/script';
import { MapConfig } from '@/types';
// *** Ensure this path is correct for your coordinate utility file ***
import { svgToLatLng } from '@/lib/coordinates-system'; // Or coordinates-system.ts

interface LeafletLoaderProps {
  mapConfig: MapConfig;
  onMapReady: (map: any, L: any) => void;
}

const LeafletLoader: React.FC<LeafletLoaderProps> = ({
  mapConfig,
  onMapReady,
}) => {
  const initialized = useRef(false);
  const mapRef = useRef<any>(null);

  const initializeMap = () => {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
      console.error("LeafletLoader Error: Map container 'map' not found.");
      return;
    }
    if (initialized.current || typeof window === 'undefined' || !window.L) {
      // console.log("LeafletLoader: Skip initialization.");
      return;
    }

    // Delay initialization slightly to ensure DOM/CSS is ready
    setTimeout(() => {
      // Re-check conditions inside timeout
      if (initialized.current || !window.L || !document.getElementById('map')) {
        return;
      }

      console.log('LeafletLoader: Initializing map inside setTimeout...');
      initialized.current = true;
      const L = window.L;

      // --- CRS and Bounds Calculation ---
      const customCRS = L.CRS.Simple;
      const topLeftLatLng = svgToLatLng(0, 0, mapConfig);
      const bottomRightLatLng = svgToLatLng(
        mapConfig.svgWidth,
        mapConfig.svgHeight,
        mapConfig
      );
      const southWest = L.latLng(bottomRightLatLng.lat, topLeftLatLng.lng);
      const northEast = L.latLng(topLeftLatLng.lat, bottomRightLatLng.lng);
      const bounds = L.latLngBounds(southWest, northEast);
      const mapLngWidth = bottomRightLatLng.lng - topLeftLatLng.lng;
      // --- End CRS/Bounds ---

      try {
        const map = L.map('map', {
          crs: customCRS,
          minZoom: mapConfig.minZoom,
          maxZoom: mapConfig.maxZoom,
          zoomControl: false,
          attributionControl: false,
          inertia: true,
          bounceAtZoomLimits: false,
          worldCopyJump: true,
        });
        mapRef.current = map; // Store ref

        L.control.attribution({ position: 'bottomright', prefix: '© IxMaps v4.0.0' }).addTo(map);

        const initialMapUrl = (mapConfig as any).lodEnabled
          ? mapConfig.baseMapUrl
          : mapConfig.baseMapUrl; // Adjust as needed

        const baseMap = L.imageOverlay(initialMapUrl, bounds).addTo(map);

        // --- *** FIX: Correctly initialize wraparound bounds *** ---
        // Initialize with valid LatLng points before extending
        const leftBounds = L.latLngBounds(
            L.latLng(bottomRightLatLng.lat, topLeftLatLng.lng - mapLngWidth),
            L.latLng(topLeftLatLng.lat, bottomRightLatLng.lng - mapLngWidth)
        );
        const rightBounds = L.latLngBounds(
            L.latLng(bottomRightLatLng.lat, topLeftLatLng.lng + mapLngWidth),
            L.latLng(topLeftLatLng.lat, bottomRightLatLng.lng + mapLngWidth)
        );
        // --- *** END FIX *** ---

        const leftCopy = L.imageOverlay(initialMapUrl, leftBounds).addTo(map);
        const rightCopy = L.imageOverlay(initialMapUrl, rightBounds).addTo(map);

        // --- Set initial view and bounds ---
        // Call fitBounds AFTER layers are added
        map.fitBounds(bounds);

        const verticalBounds = L.latLngBounds(
          L.latLng(bounds.getSouth(), -Infinity),
          L.latLng(bounds.getNorth(), Infinity)
        );
        map.setMaxBounds(verticalBounds);
        // --- End initial view ---

        L.control.zoom({ position: 'topleft' }).addTo(map);

        console.log('LeafletLoader: Map initialization complete.');
        onMapReady(map, L);

      } catch (error) {
        console.error('LeafletLoader Error during map initialization:', error);
        initialized.current = false; // Reset flag on error
        if (mapRef.current) { try { mapRef.current.remove(); } catch (e) {} mapRef.current = null; }
      }
    }, 50); // Using a slightly longer delay (50ms) just in case 0ms isn't enough
  };

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        console.log('LeafletLoader: Cleaning up map instance.');
        try { mapRef.current.remove(); } catch(e) { console.error("Error removing map on cleanup:", e); }
        mapRef.current = null;
      }
      initialized.current = false;
    };
  }, []);

  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css" />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log('Leaflet script loaded, calling initializeMap...');
          initializeMap();
        }}
        onError={(e) => console.error('Leaflet script load error:', e)}
      />
    </>
  );
};

export default LeafletLoader;

declare global {
  interface Window { L: any; }
}
