// src/components/LeafletLoader.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import Script from 'next/script';
import { MapConfig } from '@/types';
import { svgToLatLng } from '@/lib/coordinates-system'; // Import the conversion util

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
    if (initialized.current || typeof window === 'undefined' || !window.L) return;
    initialized.current = true;
    const L = window.L;

    // --- Use CRS.Simple ---
    // We will map our custom LatLng directly onto CRS.Simple's coordinate plane.
    // Leaflet's L.latLng(y, x) will correspond to our custom (lat, lng).
    const customCRS = L.CRS.Simple;

    // --- Calculate Bounds in Custom LatLng ---
    // Convert SVG corners (top-left: 0,0 and bottom-right: svgWidth, svgHeight)
    // to our custom LatLng coordinate system.
    const topLeftLatLng = svgToLatLng(0, 0); // Provides { lat, lng } for SVG top-left
    const bottomRightLatLng = svgToLatLng(mapConfig.svgWidth, mapConfig.svgHeight); // Provides { lat, lng } for SVG bottom-right

    // Leaflet bounds need [southWest, northEast] corners in LatLng(lat, lng) format.
    // Note: Lat corresponds to Y, Lng corresponds to X.
    // Southwest corner: Max Y (min Lat), Min X (min Lng)
    // Northeast corner: Min Y (max Lat), Max X (max Lng)
    const southWest = L.latLng(bottomRightLatLng.lat, topLeftLatLng.lng);
    const northEast = L.latLng(topLeftLatLng.lat, bottomRightLatLng.lng);
    const bounds = L.latLngBounds(southWest, northEast);

    console.log("Calculated Custom CRS Bounds:", bounds);

    // Initialize the map
    const map = L.map('map', {
      crs: customCRS,
      minZoom: mapConfig.minZoom,
      maxZoom: mapConfig.maxZoom,
      zoomControl: false, // Added manually later
      attributionControl: false, // Added manually later
      inertia: true, // Keep inertia
      bounceAtZoomLimits: false,
    });

    // Add attribution control
    L.control
      .attribution({
        position: 'bottomright',
        prefix: '© IxMaps v4.0.0', // Update if needed
      })
      .addTo(map);

    // Add the base map layer using the calculated custom LatLng bounds
    const baseMap = L.imageOverlay(mapConfig.baseMapUrl, bounds).addTo(map);

    // Set the initial view
    // Option 1: Fit to calculated bounds
    map.fitBounds(bounds);
    // Option 2: Set specific center and zoom (using custom LatLng)
    // const initialCenter = L.latLng(0, 0); // Example: Center on custom equator/prime meridian
    // map.setView(initialCenter, mapConfig.initialZoom);

    // Set max bounds (optional, prevents panning outside the main area)
    // Use the same calculated bounds
    map.setMaxBounds(bounds);

    // Add zoom control
    L.control.zoom({ position: 'topleft' }).addTo(map);

    // Pass the map and Leaflet instance back to the parent
    onMapReady(map, L);

    // Store the map reference for cleanup
    mapRef.current = map;
  };

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        console.log('Leaflet map removed.');
      }
      initialized.current = false;
    };
  }, []);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css"
        crossOrigin="anonymous"
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"
        crossOrigin="anonymous"
        strategy="afterInteractive"
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

declare global {
  interface Window { L: any; }
}
