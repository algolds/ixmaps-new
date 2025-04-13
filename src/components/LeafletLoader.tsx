// Modified LeafletLoader.tsx with improved debugging and initialization
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { MapConfig } from '@/types'; // Ensure this path is correct

interface LeafletLoaderProps {
  mapConfig: MapConfig;
  onMapReady: (map: L.Map, L: typeof window.L) => void; // Use Leaflet types
}

// Ensure global L type declaration if not already present elsewhere
// You might need to install @types/leaflet
// npm install --save-dev @types/leaflet
declare global {
  interface Window {
    L: typeof import('leaflet');
  }
}

const LeafletLoader: React.FC<LeafletLoaderProps> = ({
  mapConfig,
  onMapReady,
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [mapContainerReady, setMapContainerReady] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false); // Track initialization state

  // Add explicit debugging state to track initialization stages
  const [debugInfo, setDebugInfo] = useState<string[]>(['Starting...']);

  // Enhanced logging
  const logWithDebug = (
    message: string,
    type: 'info' | 'warn' | 'error' = 'info',
  ) => {
    console[type](`[LeafletLoader] ${message}`);
    setDebugInfo((prev) => [...prev, `[${type.toUpperCase()}] ${message}`]);

    // Also show critical errors in DOM debug element
    if (type === 'error') {
      const debugEl = document.getElementById('leaflet-debug-content');
      if (debugEl) {
        const msgEl = document.createElement('p');
        msgEl.style.color = 'red';
        msgEl.textContent = message;
        debugEl.appendChild(msgEl);
      }
    }
  };

  // 1. Validate map config as soon as it's available
  useEffect(() => {
    logWithDebug('Checking mapConfig...');
    if (!mapConfig) {
      logWithDebug('CRITICAL ERROR: mapConfig prop is missing or undefined', 'error');
      return;
    }

    const missingProps: string[] = [];
    if (mapConfig.bounds === undefined) missingProps.push('bounds');
    else {
      if (mapConfig.bounds.north === undefined) missingProps.push('bounds.north');
      if (mapConfig.bounds.south === undefined) missingProps.push('bounds.south');
      if (mapConfig.bounds.east === undefined) missingProps.push('bounds.east');
      if (mapConfig.bounds.west === undefined) missingProps.push('bounds.west');
    }
    if (mapConfig.minZoom === undefined) missingProps.push('minZoom');
    if (mapConfig.maxZoom === undefined) missingProps.push('maxZoom');
    if (!mapConfig.baseMapUrl && !mapConfig.masterMapPath) {
      missingProps.push('baseMapUrl or masterMapPath');
    }

    if (missingProps.length > 0) {
      logWithDebug(
        `CRITICAL ERROR: Missing mapConfig properties: ${missingProps.join(', ')}`,
        'error',
      );
    } else {
      logWithDebug(
        `Map config validated: bounds=${JSON.stringify(mapConfig.bounds)}, zoom=${mapConfig.minZoom}-${mapConfig.maxZoom}`,
      );
    }
  }, [mapConfig]); // Re-validate if mapConfig changes

  // 2. Effect to check if the map container DOM element is ready and has size
  useEffect(() => {
    logWithDebug('Checking map container readiness...');
    let observer: MutationObserver | null = null;
    let containerCheckInterval: NodeJS.Timeout | null = null;
    let failsafeTimeout: NodeJS.Timeout | null = null;

    const checkMapContainer = (): boolean => {
      const mapContainer = document.getElementById('map');
      if (
        mapContainer &&
        mapContainer.clientHeight > 0 &&
        mapContainer.clientWidth > 0
      ) {
        logWithDebug(
          `Map container #${mapContainer.id} is ready (W: ${mapContainer.clientWidth}, H: ${mapContainer.clientHeight}).`,
        );
        setMapContainerReady(true);
        // Cleanup timers/observers once ready
        if (containerCheckInterval) clearInterval(containerCheckInterval);
        if (failsafeTimeout) clearTimeout(failsafeTimeout);
        observer?.disconnect();
        return true;
      }
      logWithDebug('Map container not ready or has no dimensions yet.');
      return false;
    };

    // Initial check
    if (checkMapContainer()) return;

    // Interval check
    containerCheckInterval = setInterval(() => {
      if (checkMapContainer()) {
        // Cleanup done inside checkMapContainer
      }
    }, 250); // Check less frequently

    // Observer check
    observer = new MutationObserver(() => {
      checkMapContainer(); // No need to clear interval here, checkMapContainer handles it
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'id'], // Watch for id changes too
    });

    // Failsafe timeout
    failsafeTimeout = setTimeout(() => {
      if (!mapContainerReady) { // Check state, not just DOM
        logWithDebug('Failsafe: Container detection timed out.', 'warn');
        // Attempt one last check, maybe force style if needed
        const mapContainer = document.getElementById('map');
        if (mapContainer && (mapContainer.clientHeight === 0 || mapContainer.clientWidth === 0)) {
           logWithDebug('Failsafe: Forcing container size.', 'warn');
           mapContainer.style.width = '100%';
           mapContainer.style.height = '100%';
           mapContainer.style.position = 'relative'; // Ensure positioning
           // Give browser time to reflow
           setTimeout(checkMapContainer, 100);
        } else if (!mapContainer) {
            logWithDebug('Failsafe ERROR: Map container #map not found in DOM.', 'error');
        }
      }
    }, 7000); // Increased timeout

    // Cleanup function for this effect
    return () => {
      logWithDebug('Cleaning up map container checker effect.');
      observer?.disconnect();
      if (containerCheckInterval) clearInterval(containerCheckInterval);
      if (failsafeTimeout) clearTimeout(failsafeTimeout);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []); // Run only once on mount

  // 3. Effect to Initialize Map when Script and Container are Ready
  useEffect(() => {
    // --- Pre-conditions Check ---
    if (!scriptLoaded) {
      logWithDebug('Initialization skipped: Script not loaded yet.');
      return;
    }
    if (!mapContainerReady) {
      logWithDebug('Initialization skipped: Map container not ready yet.');
      return;
    }
    if (isInitialized) {
      logWithDebug('Initialization skipped: Map already initialized.');
      return;
    }
    if (!mapConfig || !mapConfig.bounds) {
      logWithDebug('Initialization skipped: mapConfig or bounds missing.', 'error');
      return;
    }
    if (typeof window === 'undefined' || !window.L) {
      logWithDebug('Initialization skipped: window.L not available.', 'error');
      // This case should ideally be prevented by scriptLoaded state, but double-check
      return;
    }

    const L = window.L;
    logWithDebug('Conditions met (Script loaded, Container ready). Initializing map...');

    const mapContainer = document.getElementById('map');
    if (!mapContainer || mapContainer.clientHeight === 0 || mapContainer.clientWidth === 0) {
       logWithDebug('Initialization Error: Map container invalid size or not found just before init.', 'error');
       // Maybe retry container check? Or force size again?
       // For now, just log error and bail.
       return;
    }

    // --- Initialize ---
    try {
      // Validate bounds are numeric and sensible
      const { north, south, east, west } = mapConfig.bounds;
      if (
        typeof north !== 'number' ||
        typeof south !== 'number' ||
        typeof east !== 'number' ||
        typeof west !== 'number'
      ) {
        throw new Error(
          `Invalid bounds values: ${JSON.stringify(mapConfig.bounds)}`,
        );
      }

      // --- Create Map Instance ---
      // Using CRS.Simple: Assumes a flat plane.
      // Transformation(1, 0, 1, 0): Maps coordinates directly?
      // L.latLng(y, x) convention seems to be used based on bounds (north=0, south=4900).
      // Point (0,0) is top-left. Y increases downwards, X increases rightwards.
      const customCRS = L.extend({}, L.CRS.Simple, {
        transformation: new L.Transformation(1, 0, 1, 0),
      });

      logWithDebug('Creating map instance with L.map()');
      const map = L.map('map', {
        crs: customCRS,
        minZoom: mapConfig.minZoom ?? 0, // Use nullish coalescing for defaults
        maxZoom: mapConfig.maxZoom ?? 2,
        zoomControl: false, // Add later
        attributionControl: false, // Add later
        inertia: false,
        bounceAtZoomLimits: false,
        worldCopyJump: false, // Important for CRS.Simple
      });

      // Store ref immediately
      mapRef.current = map;

      // --- Configure Map ---
      logWithDebug('Adding attribution control');
      L.control
        .attribution({
          position: 'bottomright',
          prefix: '© IxMaps GOOD VERSION v4.0.0', // Consider making this dynamic
        })
        .addTo(map);

      // Calculate bounds object for Leaflet
      // L.latLng(y, x) -> L.latLng(south, west) for bottom-left
      // L.latLng(y, x) -> L.latLng(north, east) for top-right
      logWithDebug(`Creating LatLngBounds with: ${JSON.stringify(mapConfig.bounds)}`);
      const bounds = L.latLngBounds(
        L.latLng(mapConfig.bounds.south, mapConfig.bounds.west), // Bottom-left
        L.latLng(mapConfig.bounds.north, mapConfig.bounds.east), // Top-right
      );

      // Determine which map URL to use
      const initialMapUrl = mapConfig.lodEnabled
        ? mapConfig.baseMapUrl
        : mapConfig.masterMapPath;

      if (!initialMapUrl) {
        throw new Error('No map URL available (baseMapUrl or masterMapPath)');
      }

      logWithDebug(`Adding base map image overlay: ${initialMapUrl}`);
      const baseLayer = L.imageOverlay(initialMapUrl, bounds);
      baseLayer.addTo(map);

      // --- Add Wraparound Layers (Optional, based on config) ---
      // This manual wrapping is complex. Ensure it's really needed and calculations are correct.
      // It assumes the map width corresponds directly to the east-west coordinate range.
      if (mapConfig.svgWidth && mapConfig.svgWidth > 0) {
        logWithDebug('Adding wraparound image overlays (manual)');
        const mapCoordWidth = mapConfig.bounds.east - mapConfig.bounds.west;

        // Left copy bounds
        const leftBounds = L.latLngBounds(
          L.latLng(mapConfig.bounds.south, mapConfig.bounds.west - mapCoordWidth),
          L.latLng(mapConfig.bounds.north, mapConfig.bounds.east - mapCoordWidth),
        );
        L.imageOverlay(initialMapUrl, leftBounds).addTo(map);

        // Right copy bounds
        const rightBounds = L.latLngBounds(
          L.latLng(mapConfig.bounds.south, mapConfig.bounds.west + mapCoordWidth),
          L.latLng(mapConfig.bounds.north, mapConfig.bounds.east + mapCoordWidth),
        );
        L.imageOverlay(initialMapUrl, rightBounds).addTo(map);
      }

      // --- Set Initial View and Constraints ---
      logWithDebug('Invalidating map size...');
      map.invalidateSize(); // Recalculate container size

      logWithDebug(`Fitting map view to bounds: ${bounds.toBBoxString()}`);
      map.fitBounds(bounds);

      // Set vertical bounds only to allow horizontal panning/wrapping
      // Use -Infinity and +Infinity for the longitude component.
      const verticalBounds = L.latLngBounds(
        L.latLng(mapConfig.bounds.south, -Infinity),
        L.latLng(mapConfig.bounds.north, Infinity),
      );
      logWithDebug('Setting max bounds (vertical only)');
      map.setMaxBounds(verticalBounds);

      // Add zoom control
      logWithDebug('Adding zoom control');
      L.control.zoom({ position: 'topleft' }).addTo(map);

      // --- Finalize ---
      setIsInitialized(true); // Set initialization state
      logWithDebug('Map initialization complete! Notifying parent.');
      onMapReady(map, L); // Notify parent component

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logWithDebug(`ERROR during map initialization: ${errorMsg}`, 'error');
      setIsInitialized(false); // Reset flag on error

      // Clean up partially created map if it exists
      if (mapRef.current) {
        try {
          logWithDebug('Attempting to remove map instance after init error.');
          mapRef.current.remove();
        } catch (removeError) {
          logWithDebug(
            `Error removing map during init error handling: ${removeError}`,
            'error',
          );
        } finally {
           mapRef.current = null;
        }
      }
    }
  }, [scriptLoaded, mapContainerReady, mapConfig, onMapReady, isInitialized]); // Dependencies that trigger initialization

  // 4. Effect for cleanup when the component unmounts
  useEffect(() => {
    return () => {
      logWithDebug('LeafletLoader unmounting. Cleaning up...');
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (mapRef.current) {
        logWithDebug('Removing map instance on unmount.');
        try {
          mapRef.current.remove();
        } catch (e) {
          logWithDebug(`Error removing map on cleanup: ${e}`, 'error');
        }
        mapRef.current = null;
      }
      // Reset state flags on unmount might not be necessary unless the component
      // could be remounted with old state, but generally okay.
      setScriptLoaded(false);
      setMapContainerReady(false);
      setIsInitialized(false);
    };
  }, []); // Empty dependency array means this runs only on unmount

  return (
    <>
      {/* Debug info display */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1000,
          backgroundColor: 'rgba(255,255,255,0.9)',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          maxHeight: '250px', // Increased height
          maxWidth: '300px',
          overflowY: 'auto',
          fontSize: '10px', // Smaller font
          fontFamily: 'monospace',
          display: 'block', // Always show
        }}
      >
        <h4 style={{ margin: '0 0 5px 0', fontSize: '12px' }}>
          Leaflet Loader Debug:
        </h4>
        <div id="leaflet-status">
          <p>Script Loaded: {scriptLoaded ? 'Yes' : 'No'}</p>
          <p>Container Ready: {mapContainerReady ? 'Yes' : 'No'}</p>
          <p>Map Initialized: {isInitialized ? 'Yes' : 'No'}</p>
          <hr style={{ margin: '5px 0' }} />
        </div>
        <div id="leaflet-debug-content" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {/* Log messages will be appended here by logWithDebug */}
          {debugInfo.join('\n')}
        </div>
      </div>

      {/* Load Leaflet CSS (using Link is generally preferred in Next.js) */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossOrigin=""
      />

      {/* Load Leaflet JS */}
      <Script
        src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        crossOrigin=""
        strategy="lazyOnload" // Changed strategy: Loads after hydration + idle
        onLoad={() => {
          logWithDebug('Leaflet script loaded successfully via Next/Script.');
          setScriptLoaded(true);
        }}
        onError={(e) => {
          logWithDebug(`Leaflet script load ERROR: ${e}`, 'error');
          // Consider setting an error state here
        }}
      />

      {/* The map container div */}
      <div
        id="map"
        style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#eee' }} // Added background color for visibility
      >
        {/* Optional: Loading indicator inside the map div */}
        {!isInitialized && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 500 }}>
            Loading Map...
          </div>
        )}
      </div>
    </>
  );
};

export default LeafletLoader;
