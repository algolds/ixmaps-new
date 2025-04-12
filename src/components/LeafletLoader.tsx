// src/components/LeafletLoader.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { MapConfig } from '@/types';
// Keep svgToLatLng import if needed elsewhere, but it's primarily used
// by components *consuming* the map, like CountryLabelsComponent.
// import { svgToLatLng } from '@/lib/coordinates-system';

interface LeafletLoaderProps {
  mapConfig: MapConfig; // Use the mapConfig passed from the parent
  onMapReady: (map: any, L: any) => void;
}

const LeafletLoader: React.FC<LeafletLoaderProps> = ({
  mapConfig, // Receive the single source of truth for map config
  onMapReady,
}) => {
  const initialized = useRef(false);
  const mapRef = useRef<any>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scriptLoaded = useRef(false);
  const [mapContainerReady, setMapContainerReady] = useState(false);

  // Effect to check if the map container DOM element is ready and has size
  useEffect(() => {
    const checkMapContainer = () => {
      const mapContainer = document.getElementById('map');
      if (
        mapContainer &&
        mapContainer.clientHeight > 0 &&
        mapContainer.clientWidth > 0
      ) {
        console.log(
          `LeafletLoader: Map container #${mapContainer.id} is ready (W: ${mapContainer.clientWidth}, H: ${mapContainer.clientHeight}).`
        );
        setMapContainerReady(true);
        return true;
      }
      return false;
    };

    if (checkMapContainer()) return;

    let observer: MutationObserver | null = null;
    const containerCheckInterval = setInterval(() => {
      if (checkMapContainer()) {
        clearInterval(containerCheckInterval);
        observer?.disconnect();
      }
    }, 150);

    observer = new MutationObserver(() => {
      if (checkMapContainer()) {
        clearInterval(containerCheckInterval);
        observer?.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    return () => {
      observer?.disconnect();
      clearInterval(containerCheckInterval);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Initialize map using the "current" logic + robustness checks
  const initializeMap = () => {
    // Clear any pending retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // --- Pre-conditions Check ---
    if (typeof window === 'undefined' || !window.L) {
      console.log('LeafletLoader: Leaflet library (window.L) not available yet.');
      retryTimeoutRef.current = setTimeout(initializeMap, 100);
      return;
    }
    const L = window.L;

    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
      console.error("LeafletLoader Error: Map container '#map' not found.");
      retryTimeoutRef.current = setTimeout(initializeMap, 100);
      return;
    }

    if (mapContainer.clientHeight === 0 || mapContainer.clientWidth === 0) {
      console.warn(
        `LeafletLoader Warning: Map container has zero size (H: ${mapContainer.clientHeight}, W: ${mapContainer.clientWidth}) during init attempt. Waiting for mapContainerReady state.`
      );
      return; // Rely on mapContainerReady state change
    }

    if (initialized.current) {
      console.log('LeafletLoader: Map already initialized.');
      return;
    }

    console.log('LeafletLoader: Conditions met, initializing map (using preferred bounds config)...');

    try {
      // --- Create Map Instance ---
      const customCRS = L.extend({}, L.CRS.Simple, {
        transformation: new L.Transformation(1, 0, 1, 0),
        wrapLng: null, // Disable Leaflet's default wrapping
        wrapLat: null,
      });

      const map = L.map('map', {
        crs: customCRS,
        minZoom: mapConfig.minZoom,
        maxZoom: mapConfig.maxZoom,
        zoomControl: false, // Added separately
        attributionControl: false, // Added separately
        inertia: false, // As per your 'current' config
        bounceAtZoomLimits: false,
        worldCopyJump: false, // Explicitly false for Simple CRS
      });

      // Store ref immediately after creation
      mapRef.current = map;
      // Set initialized flag *before* potential errors in configuration
      initialized.current = true;

      // --- Configure Map ---
      L.control
        .attribution({
          position: 'bottomright',
          // Use the prefix from your 'current' config
          prefix: '© IxMaps GOOD VERSION v4.0.0',
        })
        .addTo(map);

      // Calculate bounds based on PRE-DEFINED values in mapConfig
      // This is the core part of your 'current' logic
      const bounds = L.latLngBounds(
        L.latLng(mapConfig.bounds.south, mapConfig.bounds.west),
        L.latLng(mapConfig.bounds.north, mapConfig.bounds.east)
      );

      // Add the base map layer
      const initialMapUrl = mapConfig.lodEnabled
        ? mapConfig.baseMapUrl // Assuming this is correct based on your config logic
        : mapConfig.masterMapPath; // Assuming this is correct

      L.imageOverlay(initialMapUrl, bounds).addTo(map);

      // --- Add Wraparound Layers (Manual Wrapping) ---
      // This requires mapConfig.svgWidth to be correctly set for the offset calculation
      if (mapConfig.svgWidth && mapConfig.svgWidth > 0) {
         // Calculate the longitude range based on the provided bounds
         const mapLngWidth = mapConfig.bounds.east - mapConfig.bounds.west;

         // Left copy bounds calculation (Shift west boundary by map width)
         const leftBounds = L.latLngBounds(
           L.latLng(mapConfig.bounds.south, mapConfig.bounds.west - mapLngWidth),
           L.latLng(mapConfig.bounds.north, mapConfig.bounds.east - mapLngWidth)
         );
         L.imageOverlay(initialMapUrl, leftBounds).addTo(map);

         // Right copy bounds calculation (Shift west boundary by map width)
         const rightBounds = L.latLngBounds(
           L.latLng(mapConfig.bounds.south, mapConfig.bounds.west + mapLngWidth),
           L.latLng(mapConfig.bounds.north, mapConfig.bounds.east + mapLngWidth)
         );
         L.imageOverlay(initialMapUrl, rightBounds).addTo(map);

         console.log("LeafletLoader: Added manual wraparound image overlays.");
      } else {
          console.warn("LeafletLoader: mapConfig.svgWidth not provided or zero, cannot add wraparound layers accurately.");
          // Alternative based on svgWidth if bounds aren't reliable for width?
          // Need to ensure mapConfig.svgWidth corresponds correctly to the LatLng width
          // if (mapConfig.svgWidth) {
          //    const leftBounds = L.latLngBounds( ... using mapConfig.svgWidth for offset ...);
          //    const rightBounds = L.latLngBounds( ... using mapConfig.svgWidth for offset ...);
          // }
      }


      // --- Set Initial View and Constraints ---
      // **CRITICAL FIX:** Ensure Leaflet knows the container size *before* fitting bounds.
      map.invalidateSize();

      // Fit the map view to the calculated bounds
      map.fitBounds(bounds);

      // Set vertical bounds only so horizontal wraparound is enabled
      const verticalBounds = L.latLngBounds(
        L.latLng(mapConfig.bounds.south, -Infinity), // Allow infinite horizontal scroll
        L.latLng(mapConfig.bounds.north, Infinity)
      );
      map.setMaxBounds(verticalBounds);

      // Add zoom control
      L.control.zoom({ position: 'topleft' }).addTo(map);

      console.log('LeafletLoader: Map initialization complete.');
      onMapReady(map, L); // Notify parent component

    } catch (error) {
      console.error('LeafletLoader Error during map initialization:', error);
      initialized.current = false; // Reset flag on error
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (removeError) {
           console.error('LeafletLoader: Error removing map during init error handling:', removeError);
        }
        mapRef.current = null;
      }
      // Optionally retry or notify user
    }
  };

  // Effect to trigger map initialization when script and container are ready
  useEffect(() => {
    if (scriptLoaded.current && mapContainerReady) {
      initializeMap();
    }
  }, [scriptLoaded.current, mapContainerReady]); // Depend on readiness flags

  // Effect for cleanup when the component unmounts
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (mapRef.current) {
        console.log('LeafletLoader: Cleaning up map instance on unmount.');
        try {
          mapRef.current.remove();
        } catch (e) {
          console.error('LeafletLoader: Error removing map on cleanup:', e);
        }
        mapRef.current = null;
      }
      initialized.current = false;
      scriptLoaded.current = false;
    };
  }, []);

  return (
    <>
      {/* Load Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css"
        integrity="sha512-Zcn6bjR/8RZbLEpLIeOwNtzREBAJnUKESxces60Mpoj+2okopNZ6pcBERuFldpAVnWBG0KVNsw0GClwQubKIpw=="
        crossOrigin=""
      />
      {/* Load Leaflet JS */}
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"
        integrity="sha512-BwHfrr4c9kmRkLw6iXFdzcdWV/PGkVgiIyIWLLlTSXzWQzxuSg4DiQUCpauz/EWjgk5TYQqX/kvn9pG1NpYfqg=="
        crossOrigin=""
        strategy="afterInteractive"
        onLoad={() => {
          console.log('LeafletLoader: Leaflet script loaded successfully.');
          scriptLoaded.current = true;
        }}
        onError={(e) => {
          console.error('LeafletLoader: Leaflet script load error:', e);
        }}
      />
    </>
  );
};

export default LeafletLoader;

// Ensure global L type declaration if not already present elsewhere
declare global {
  interface Window {
    L: any;
  }
}
