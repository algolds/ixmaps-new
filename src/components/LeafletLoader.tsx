// src/components/LeafletLoader.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import Script from 'next/script';
import { MapConfig } from '@/types';
// *** Import the necessary coordinate conversion utility ***
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
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for retry timeout

  const initializeMap = () => {
    // Clear any pending retry timeouts
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    const mapContainer = document.getElementById('map');
    // 1. Check Leaflet library
    if (typeof window === 'undefined' || !window.L) {
      console.log('LeafletLoader: Leaflet library not available yet.');
      return;
    }
    // 2. Check map container element
    if (!mapContainer) {
      console.error("LeafletLoader Error: Map container '#map' not found.");
      return;
    }
    // 3. Check map container size (with retry)
    if (mapContainer.clientHeight === 0 || mapContainer.clientWidth === 0) {
      console.warn(
        `LeafletLoader Warning: Map container has no size (H: ${mapContainer.clientHeight}, W: ${mapContainer.clientWidth}). Retrying...`
      );
      retryTimeoutRef.current = setTimeout(initializeMap, 100); // Retry
      return;
    }
    // 4. Check if already initialized
    if (initialized.current) {
      // console.log('LeafletLoader: Already initialized.');
      return;
    }

    // --- If all checks pass, proceed ---
    console.log('LeafletLoader: Container ready, initializing map...');
    initialized.current = true;
    const L = window.L;

    try {
      // --- CRS Definition (kept from your original) ---
      // Note: L.CRS.Simple is likely sufficient, but using extend is fine.
      const customCRS = L.extend({}, L.CRS.Simple, {
        transformation: new L.Transformation(1, 0, 1, 0), // Default for Simple
        wrapLng: null, // Disable Leaflet's default wrapping
        wrapLat: null,
      });
      // --- End CRS Definition ---

      // Initialize the map (kept from your original)
      const map = L.map('map', {
        crs: customCRS,
        minZoom: mapConfig.minZoom,
        maxZoom: mapConfig.maxZoom,
        zoomControl: false,
        attributionControl: false,
        inertia: true, // Changed back to true for smoother panning
        bounceAtZoomLimits: false,
        worldCopyJump: true, // Keep for wraparound
      });
      mapRef.current = map; // Store ref

      // Add attribution control (kept from your original)
      L.control.attribution({ position: 'bottomright', prefix: '© IxMaps v4.0.0' }).addTo(map);

      // --- *** MODIFIED: Calculate Bounds using svgToLatLng *** ---
      // This ensures the image overlay aligns with the coordinate system
      // used by components relying on svgToLatLng/latLngToSvg.
      const topLeftLatLng = svgToLatLng(0, 0, mapConfig);
      const bottomRightLatLng = svgToLatLng(
        mapConfig.svgWidth,
        mapConfig.svgHeight,
        mapConfig
      );
      const southWest = L.latLng(bottomRightLatLng.lat, topLeftLatLng.lng);
      const northEast = L.latLng(topLeftLatLng.lat, bottomRightLatLng.lng);
      const bounds = L.latLngBounds(southWest, northEast); // These are the *correct* bounds for the overlay
      // --- *** END MODIFICATION *** ---

      // --- Calculate Map Width for Wraparound (based on calculated bounds) ---
      const mapLngWidth = bottomRightLatLng.lng - topLeftLatLng.lng;
      // --- End Map Width Calculation ---

      // Determine Base Map URL (kept from your original, check lodEnabled logic)
      const initialMapUrl = (mapConfig as any).lodEnabled
        ? mapConfig.baseMapUrl
        : mapConfig.baseMapUrl; // Or masterMapPath if intended

      // Add the base map layer using the *correctly calculated* bounds
      const baseMap = L.imageOverlay(initialMapUrl, bounds).addTo(map);

      // --- Add wraparound layers (using calculated mapLngWidth) ---
      const leftBounds = L.latLngBounds(
          L.latLng(bounds.getSouth(), bounds.getWest() - mapLngWidth),
          L.latLng(bounds.getNorth(), bounds.getEast() - mapLngWidth)
      );
      const rightBounds = L.latLngBounds(
          L.latLng(bounds.getSouth(), bounds.getWest() + mapLngWidth),
          L.latLng(bounds.getNorth(), bounds.getEast() + mapLngWidth)
      );
      const leftCopy = L.imageOverlay(initialMapUrl, leftBounds).addTo(map);
      const rightCopy = L.imageOverlay(initialMapUrl, rightBounds).addTo(map);
      // --- End Wraparound ---

      // Fit the map to the *correctly calculated* bounds
      map.fitBounds(bounds);

      // --- Set vertical bounds only (using calculated bounds) ---
      // This enables horizontal wraparound.
      const verticalBounds = L.latLngBounds(
        L.latLng(bounds.getSouth(), -Infinity), // Use calculated South latitude
        L.latLng(bounds.getNorth(), Infinity)  // Use calculated North latitude
      );
      map.setMaxBounds(verticalBounds);
      // --- End Vertical Bounds ---

      // Add zoom control (kept from your original)
      L.control.zoom({ position: 'topleft' }).addTo(map);

      console.log('LeafletLoader: Map initialization complete.');
      onMapReady(map, L);

    } catch (error) {
      console.error('LeafletLoader Error during map initialization:', error);
      initialized.current = false; // Reset flag on error
      if (mapRef.current) { try { mapRef.current.remove(); } catch (e) {} mapRef.current = null; }
    }
  };

  useEffect(() => {
    // Attempt initialization on mount, function handles retries
    initializeMap();

    // Cleanup function
    return () => {
      if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); } // Clear retry timeout
      if (mapRef.current) {
        console.log('LeafletLoader: Cleaning up map instance.');
        try { (mapRef.current as any)._isDestroyed = true; mapRef.current.remove(); }
        catch(e) { console.error("Error removing map on cleanup:", e); }
        mapRef.current = null;
      }
      initialized.current = false;
    };
  }, []); // Run only on mount

  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css" />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log('Leaflet script loaded.');
          initializeMap(); // Initialize after script load
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
