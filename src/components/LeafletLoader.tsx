// src/components/LeafletLoader.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import Script from 'next/script';
import { MapConfig } from '@/types';

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
    if (initialized.current || typeof window === 'undefined' || !window.L)
      return;

    initialized.current = true;

    const L = window.L;

    // --- Simplified CRS ---
    // Use CRS.Simple: 1 map unit = 1 pixel.
    // The transformation L.Transformation(1, 0, 1, 0) is the default for CRS.Simple
    // and maps coordinates directly.
    const customCRS = L.CRS.Simple;

    // --- Map Bounds based on SVG Dimensions ---
    // Leaflet uses [y, x] for coordinates (LatLng).
    // Top-left is (0, 0), Bottom-right is (svgHeight, svgWidth).
    // Bounds are defined by [southWest, northEast] corners.
    const southWest = L.latLng(mapConfig.svgHeight, 0); // (y, x) -> (max Y, min X)
    const northEast = L.latLng(0, mapConfig.svgWidth); // (y, x) -> (min Y, max X)
    const bounds = L.latLngBounds(southWest, northEast);

    // Initialize the map
    const map = L.map('map', {
      crs: customCRS,
      minZoom: mapConfig.minZoom, // Adjust as needed, maybe start lower
      maxZoom: mapConfig.maxZoom,
      zoomControl: false, // We add it manually later
      attributionControl: false,
      inertia: true, // Keep inertia for smoother panning
      bounceAtZoomLimits: false, // Keep false
    });

    // Add attribution control
    L.control
      .attribution({
        position: 'bottomright',
        prefix: '© IxMaps v4.0.0', // Update if needed
      })
      .addTo(map);

    // Add the base map layer using the calculated bounds
    const baseMap = L.imageOverlay(mapConfig.baseMapUrl, bounds).addTo(map);

    // Fit the map to the bounds initially
    // Use zoom 0 to display the SVG at its native pixel size initially
    map.setView(bounds.getCenter(), 0); // Center the map, zoom 0
    // map.fitBounds(bounds); // Alternative: fit bounds exactly

    // Set max bounds to prevent panning outside the main SVG area
    map.setMaxBounds(bounds);

    // Add zoom control
    L.control.zoom({ position: 'topleft' }).addTo(map);

    // Pass the map and Leaflet instance back to the parent
    onMapReady(map, L);

    // Store the map reference for cleanup
    mapRef.current = map;
  };

  useEffect(() => {
    // Cleanup function
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        console.log('Leaflet map removed.');
      }
      initialized.current = false;
      // Ensure Leaflet script/style tags are handled if necessary on unmount/re-route
      // (Next.js <Script> might handle this, but good to be aware)
    };
  }, []); // Empty dependency array ensures cleanup runs only on unmount

  return (
    <>
      {/* Consider moving CSS link to _app.tsx or layout.tsx for global scope */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css"
        crossOrigin="anonymous"
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"
        crossOrigin="anonymous"
        strategy="afterInteractive" // Load after page is interactive
        onLoad={() => {
          console.log('Leaflet script loaded.');
          initializeMap();
        }}
        onError={(e) => {
          console.error('Failed to load Leaflet script:', e);
        }}
      />
    </>
  );
};

export default LeafletLoader;

// Define window.L for TypeScript
declare global {
  interface Window {
    L: any;
  }
}
