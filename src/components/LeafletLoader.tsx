'use client';

import React, { useEffect, useRef } from 'react';
import Script from 'next/script';
import { MapConfig } from '@/types';

interface LeafletLoaderProps {
  mapConfig: MapConfig;
  onMapReady: (map: any, L: any) => void;
}

const LeafletLoader: React.FC<LeafletLoaderProps> = ({ mapConfig, onMapReady }) => {
  const initialized = useRef(false);
  const mapRef = useRef<any>(null);

  const initializeMap = () => {
    if (initialized.current || typeof window === 'undefined' || !window.L) return;

    initialized.current = true;

    const L = window.L;

    // Create a custom CRS for the SVG map
    const customCRS = L.extend({}, L.CRS.Simple, {
      transformation: new L.Transformation(1, 0, 1, 0),
      wrapLng: null,
      wrapLat: null,
    });

    // Initialize the map
    const map = L.map('map', {
      crs: customCRS,
      minZoom: mapConfig.minZoom,
      maxZoom: mapConfig.maxZoom,
      zoomControl: false,
      attributionControl: false,
      inertia: false,
      bounceAtZoomLimits: false,
    });

    // Add attribution control
    L.control
      .attribution({
        position: 'bottomright',
        prefix: '© IxMaps v4.0.0',
      })
      .addTo(map);

    // Calculate bounds based on SVG dimensions
    const bounds = L.latLngBounds(
      L.latLng(mapConfig.bounds.south, mapConfig.bounds.west),
      L.latLng(mapConfig.bounds.north, mapConfig.bounds.east)
    );

    // Add the base map layer
    const initialMapUrl = mapConfig.lodEnabled
      ? mapConfig.baseMapUrl
      : mapConfig.masterMapPath;

    const baseMap = L.imageOverlay(initialMapUrl, bounds);
    baseMap.addTo(map);

    // Add wraparound layers
    const leftCopy = L.imageOverlay(
      initialMapUrl,
      L.latLngBounds(
        L.latLng(mapConfig.bounds.south, mapConfig.bounds.west - mapConfig.svgWidth),
        L.latLng(mapConfig.bounds.north, mapConfig.bounds.east - mapConfig.svgWidth)
      )
    ).addTo(map);

    const rightCopy = L.imageOverlay(
      initialMapUrl,
      L.latLngBounds(
        L.latLng(mapConfig.bounds.south, mapConfig.bounds.west + mapConfig.svgWidth),
        L.latLng(mapConfig.bounds.north, mapConfig.bounds.east + mapConfig.svgWidth)
      )
    ).addTo(map);

    // Fit the map to the bounds
    map.fitBounds(bounds);

    // Set vertical bounds only so horizontal wraparound is enabled
    const verticalBounds = L.latLngBounds(
      L.latLng(mapConfig.bounds.south, -Infinity),
      L.latLng(mapConfig.bounds.north, Infinity)
    );
    map.setMaxBounds(verticalBounds);

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
        onLoad={initializeMap} // Ensure Leaflet is initialized only after the script is loaded
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
