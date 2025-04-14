/// <reference lib="dom" />
// LeafletLoader - Aligning CRS Transformation with external coordinate logic
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { MapConfig } from '@/types'; // Ensure this path is correct
import L from 'leaflet';
import LeafletDebugDisplay from './LeafletDebugDisplay'; // Import the debug component

interface LeafletLoaderProps {
  mapConfig: MapConfig;
  onMapReady: (map: L.Map, L: typeof window.L) => void;
  externalMapContainerRef: React.RefObject<HTMLDivElement | null>;
}

// Global L type declaration
declare global {
  interface Window {
    L: typeof import('leaflet');
  }
}

const LeafletLoader: React.FC<LeafletLoaderProps> = ({
  mapConfig,
  onMapReady,
  externalMapContainerRef,
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const checkIntervalRef = useRef<number | null>(null);
  const failsafeTimeoutRef = useRef<number | null>(null);
  const initFrameRef = useRef<number | null>(null); // For requestAnimationFrame
  const initTimeoutRef = useRef<number | null>(null); // For setTimeout(0)
  const cleanupInitiatedRef = useRef<boolean>(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [mapContainerReady, setMapContainerReady] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const [debugInfo, setDebugInfo] = useState<string[]>(['Starting...']);

  // Enhanced logging
  const logWithDebug = (
    message: string,
    type: 'info' | 'warn' | 'error' = 'info',
  ) => {
    const logMsg = `[LeafletLoader] ${message}`;
    console[type](logMsg);
    setDebugInfo((prev) => [
      `[${new Date().toLocaleTimeString()}] [${type.toUpperCase()}] ${message}`,
      ...prev.slice(0, 49),
    ]);
    // Error display is handled by LeafletDebugDisplay component
  };

  // Reset cleanupInitiatedRef on mount
  useEffect(() => {
    cleanupInitiatedRef.current = false;
    logWithDebug('Component mounted, reset cleanup flag');
  }, []);

  // Check if Leaflet already loaded
  useEffect(() => {
    if (typeof window !== 'undefined' && window.L) {
      logWithDebug('Leaflet already available, setting scriptLoaded state');
      setScriptLoaded(true);
    }
  }, []);

  // 1. Validate map config - ADD checks for projection params
  useEffect(() => {
    logWithDebug('Checking mapConfig...');
    let isValid = true;
    if (!mapConfig) {
      logWithDebug('CRITICAL ERROR: mapConfig prop is missing', 'error');
      isValid = false;
    }
    if (!mapConfig?.bounds || !['north', 'south', 'east', 'west'].every(k => typeof mapConfig.bounds[k as keyof MapConfig['bounds']] === 'number')) {
      logWithDebug('CRITICAL ERROR: mapConfig.bounds invalid', 'error');
      isValid = false;
    }
    if (typeof mapConfig?.minZoom !== 'number' || typeof mapConfig?.maxZoom !== 'number') {
      logWithDebug('WARNING: mapConfig minZoom/maxZoom invalid', 'warn');
    }
    // *** Add checks for required transformation parameters ***
    if (typeof mapConfig?.pixelsPerLongitude !== 'number' || mapConfig.pixelsPerLongitude <= 0) {
        logWithDebug('CRITICAL ERROR: mapConfig.pixelsPerLongitude missing or invalid.', 'error');
        isValid = false;
    }
    if (typeof mapConfig?.pixelsPerLatitude !== 'number' || mapConfig.pixelsPerLatitude <= 0) {
        logWithDebug('CRITICAL ERROR: mapConfig.pixelsPerLatitude missing or invalid.', 'error');
        isValid = false;
    }
    // svgHeight might be needed depending on the exact transformation 'd' parameter logic
    // if (typeof mapConfig.svgHeight !== 'number') {
    //    logWithDebug('WARNING: mapConfig.svgHeight missing or invalid, CRS transformation might be incorrect.', 'warn');
    // }

    if (isValid) {
        logWithDebug(
          `Map config validated: bounds=${JSON.stringify(mapConfig.bounds)}, zoom=${mapConfig.minZoom}-${mapConfig.maxZoom}, pxPerLon=${mapConfig.pixelsPerLongitude}, pxPerLat=${mapConfig.pixelsPerLatitude}`,
        );
    } else {
        logWithDebug('Map config validation FAILED.', 'error');
    }
  }, [mapConfig]);

  // 2. Effect to check map container readiness
  useEffect(() => {
    logWithDebug('Starting map container readiness check (using external ref)...');

    const clearTimers = () => {
      if (checkIntervalRef.current !== null) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
        logWithDebug('Cleared container check interval.');
      }
      if (failsafeTimeoutRef.current !== null) {
        clearTimeout(failsafeTimeoutRef.current);
        failsafeTimeoutRef.current = null;
        logWithDebug('Cleared container failsafe timeout.');
      }
    };

    const checkMapContainer = () => {
      const mapContainer = externalMapContainerRef.current;
      if (!mapContainer) {
        logWithDebug('External map container ref not available yet.');
        return false;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _unused = mapContainer.offsetHeight; // Force reflow

      if (
        mapContainer.clientHeight > 0 &&
        mapContainer.clientWidth > 0
      ) {
        logWithDebug(
          `External map container is READY (W: ${mapContainer.clientWidth}, H: ${mapContainer.clientHeight}).`,
          'info',
        );
        setMapContainerReady(true);
        clearTimers();
        return true;
      } else {
        logWithDebug(
          `External map container found, but zero dimensions (W: ${mapContainer.clientWidth}, H: ${mapContainer.clientHeight}). Retrying...`,
          'warn',
        );
        if (mapContainer.parentElement) {
          logWithDebug(
            `External container's parent dimensions: W=${mapContainer.parentElement.clientWidth}, H=${mapContainer.parentElement.clientHeight}`,
            'warn',
          );
        }
        return false;
      }
    };

    if (checkMapContainer()) return;

    logWithDebug('Starting interval check for external map container dimensions.');
    checkIntervalRef.current = window.setInterval(checkMapContainer, 150);

    failsafeTimeoutRef.current = window.setTimeout(() => {
      if (!mapContainerReady) {
        logWithDebug(
          'Failsafe timeout reached. External container still not ready.',
          'error',
        );
        if (!checkMapContainer()) {
          const mapContainer = externalMapContainerRef.current;
          logWithDebug(
            `Final check failed. External container exists: ${!!mapContainer}, W: ${mapContainer?.clientWidth}, H: ${mapContainer?.clientHeight}`,
            'error',
          );
          logWithDebug(
            'CRITICAL: Ensure the PARENT component (<MapComponent>) provides a valid container with height!',
            'error',
          );
        }
      }
      if (checkIntervalRef.current !== null) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    }, 8000);

    return () => {
      logWithDebug('Cleaning up map container checker effect.');
      clearTimers();
    };
  }, [externalMapContainerRef]);

  // 3. Effect to Initialize Map (Aligning CRS)
  useEffect(() => {
    logWithDebug(
      `Init Effect Run: script=${scriptLoaded}, container=${mapContainerReady}, initialized=${isInitialized}, cleanupFlag=${cleanupInitiatedRef.current}, mapExists=${!!mapRef.current}`,
    );

    // --- Pre-conditions Check ---
    // Add checks for projection params needed for CRS
    if (
      !scriptLoaded ||
      !mapContainerReady ||
      isInitialized ||
      cleanupInitiatedRef.current ||
      !mapConfig?.bounds ||
      typeof mapConfig?.pixelsPerLongitude !== 'number' || // Check added
      typeof mapConfig?.pixelsPerLatitude !== 'number' || // Check added
      typeof window === 'undefined' ||
      !window.L
    ) {
      logWithDebug(
        'Init Effect: Pre-conditions NOT MET (check bounds/projection params!) or cleanup started. Bailing out.',
      );
      return;
    }

    if (mapRef.current) {
      logWithDebug('Init Effect: Map instance already exists, skipping.', 'warn');
      return;
    }

    logWithDebug(
      'Init Effect: Conditions met. Queuing map initialization via rAF -> setTimeout(0)...',
      'info',
    );

    // --- Use rAF -> setTimeout(0) ---
    initFrameRef.current = window.requestAnimationFrame(() => {
      initFrameRef.current = null;
      logWithDebug('Init Frame Fired. Queuing L.map() with setTimeout(0)...');

      initTimeoutRef.current = window.setTimeout(() => {
        initTimeoutRef.current = null;
        logWithDebug(`Init Timeout(0) Fired...`);

        // --- Re-check conditions ---
        if (
          !scriptLoaded ||
          !mapContainerReady ||
          isInitialized ||
          cleanupInitiatedRef.current ||
          !window.L ||
          !mapConfig?.bounds ||
          typeof mapConfig?.pixelsPerLongitude !== 'number' || // Re-check
          typeof mapConfig?.pixelsPerLatitude !== 'number' || // Re-check
          mapRef.current
        ) {
          logWithDebug(
            'Init Timeout(0): Conditions no longer met or map exists, aborting init.',
            'warn',
          );
          return;
        }

        const L = window.L;
        const mapContainerElement = externalMapContainerRef.current;

        // --- Final Container & Dimension Check + FORCE REFLOW + EXTRA CHECKS ---
        if (!mapContainerElement || !document.body.contains(mapContainerElement)) {
           logWithDebug(
            `Init Timeout(0) CRITICAL FAIL: External map container element invalid (null?) or detached just before L.map().`,
            'error',
          );
           return;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const forceLayout = mapContainerElement.offsetHeight;
        logWithDebug(`Init Timeout(0): Forced layout calculation.`);
        const currentWidth = mapContainerElement.clientWidth;
        const currentHeight = mapContainerElement.clientHeight;
        if (currentHeight === 0 || currentWidth === 0) {
          logWithDebug(
            `Init Timeout(0) CRITICAL FAIL: Zero dimensions (H:${currentHeight}, W:${currentWidth}) AFTER reflow.`,
            'error',
          );
          return;
        }
        const computedStyle = window.getComputedStyle(mapContainerElement);
        const display = computedStyle.display;
        const visibility = computedStyle.visibility;
        const contains = document.body.contains(mapContainerElement);
        logWithDebug(
          `Init Timeout(0): Pre-L.map Checks: W=${currentWidth}, H=${currentHeight}, Display=${display}, Visibility=${visibility}, In DOM=${contains}`,
          'info',
        );
        if (display === 'none' || visibility === 'hidden' || !contains) {
           logWithDebug(`Init Timeout(0) CRITICAL FAIL: Container state invalid (display=${display}, visibility=${visibility}, contains=${contains}).`, 'error');
           return;
        }
        // *************************

        logWithDebug(
          `Init Timeout(0): Container checks passed. Executing L.map() with aligned CRS...`,
          'info',
        );

        let map: L.Map | null = null;

        try {
          // --- Create Map Instance with Aligned CRS ---
          const { north, south, east, west } = mapConfig.bounds;
          const { pixelsPerLongitude, pixelsPerLatitude } = mapConfig; // Destructure needed params

          // *** Define the Transformation based on mapConfig ***
          // This assumes standard SVG origin (top-left) and Leaflet Lat increasing upwards
          const a = pixelsPerLongitude;
          const b = -west * pixelsPerLongitude;
          const c = -pixelsPerLatitude; // Flip Y axis
          const d = north * pixelsPerLatitude; // Offset for north bound at top

          // ** IMPORTANT: Verify a, b, c, d against your svgToLatLng/latLngToSvg logic **
          // If your logic is different (e.g., uses primeMeridianRef, doesn't flip Y), adjust a,b,c,d here!

          const transformation = new L.Transformation(a, b, c, d);

          const customCRS = L.extend({}, L.CRS.Simple, {
            transformation: transformation,
            wrapLat: false, // Usually false for Simple CRS
            // wrapLng: [west, east], // Define the longitude range for potential wrapping/bounds checks
          });
          logWithDebug(`Init Timeout(0): Aligned CRS defined: a=${a}, b=${b}, c=${c}, d=${d}`);

          map = L.map(mapContainerElement!, { // Non-null assertion
            crs: customCRS, // Use the aligned CRS
            // Keep other options
            minZoom: mapConfig.minZoom ?? 0,
            maxZoom: mapConfig.maxZoom ?? 4,
            zoomControl: false,
            attributionControl: false,
            inertia: true,
            bounceAtZoomLimits: true,
            maxBounds: undefined, // Set later
            center: [(north + south) / 2, (east + west) / 2],
            zoom: mapConfig.initialZoom ?? mapConfig.minZoom ?? 0,
          });

          if (!map) throw new Error('L.map() failed');
          logWithDebug('Init Timeout(0): L.map() (aligned CRS) returned instance.');
          mapRef.current = map;

          // --- Configure Map (Full configuration) ---
          logWithDebug('Init Timeout(0): Configuring map instance...');

          // --- Attribution ---
          L.control.attribution({
            position: 'bottomright',
            prefix: '© IxMaps v4.0.0',
          }).addTo(map);

          // --- Base Layer ---
          // The bounds here MUST match the LatLng coordinates that the CRS maps
          // to the corners of your image.
          const boundsLatLng = L.latLngBounds(L.latLng(south, west), L.latLng(north, east));
          const initialMapUrl = mapConfig.lodEnabled ? mapConfig.baseMapUrl : mapConfig.masterMapPath;
          if (!initialMapUrl) throw new Error('No map URL available');
          logWithDebug(`Init Timeout(0): Adding BASE map image overlay: ${initialMapUrl}`);
          const baseLayer = L.imageOverlay(initialMapUrl, boundsLatLng, {
            errorOverlayUrl:
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            alt: 'Error loading base map',
          });
          baseLayer.on('error', () => {
             logWithDebug(`Init Timeout(0): Failed to load base map: ${initialMapUrl}`, 'error');
          });
          baseLayer.addTo(map);

          // --- REMOVE Manual Wraparound Overlays ---
          // (Already removed in previous step)

          // --- Constraints & View ---
          // MaxBounds should now work more predictably with the aligned CRS
          const verticalPadding = Math.abs(north - south) * 0.05;
          const verticalOnlyMaxBounds = L.latLngBounds(
            L.latLng(Math.min(north, south) - verticalPadding, -Infinity), // Use min/max for safety
            L.latLng(Math.max(north, south) + verticalPadding, Infinity),
          );
          logWithDebug(`Init Timeout(0): Setting VERTICAL max bounds: ${verticalOnlyMaxBounds.toBBoxString()}`);
          map.setMaxBounds(verticalOnlyMaxBounds);
          // setView is handled by L.map options

          // --- invalidateSize ---
          logWithDebug('Init Timeout(0): Calling invalidateSize() AFTER setup.');
          map.invalidateSize({ animate: false, pan: false });

          // --- Zoom Control ---
          L.control.zoom({ position: 'topleft' }).addTo(map);

          // --- Drag Handler (for vertical bounds) ---
          map.on('drag', function () {
            if (verticalOnlyMaxBounds && verticalOnlyMaxBounds.isValid()) {
                map?.panInsideBounds(verticalOnlyMaxBounds, { animate: false });
            }
          });

          // --- Manual Wraparound Logic (Keep this) ---
          const worldWidthLng = east - west;
          if (worldWidthLng > 0) {
            logWithDebug('Init Timeout(0): Adding manual wraparound listener');
            map.on('moveend', function () {
              if (!mapRef.current) return;
              const center = mapRef.current.getCenter();
              const lng = center.lng;
              if (lng < west || lng >= east) {
                const newLng = ((lng - west) % worldWidthLng + worldWidthLng) % worldWidthLng + west;
                const newCenter = L.latLng(center.lat, newLng);
                logWithDebug(`Wrapping map view from lng ${lng.toFixed(2)} to ${newLng.toFixed(2)}`);
                mapRef.current.setView(newCenter, mapRef.current.getZoom(), {
                  animate: false,
                  noMoveStart: true,
                });
              }
            });
          } else {
             logWithDebug('Init Timeout(0): Skipping manual wraparound listener - invalid world width.', 'warn');
          }
          // **********************************

          // --- Finalize ---
          setIsInitialized(true);
          logWithDebug('Init Timeout(0): Map initialization complete! Notifying parent.');
          onMapReady(map, L);

        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          logWithDebug(
            `Init Timeout(0) ERROR during map initialization: ${errorMsg}`,
            'error',
          );
          if (error instanceof Error && error.stack) {
            console.error(error.stack);
            setDebugInfo((prev) => [
              `[STACK] ${error.stack}`,
              ...prev.slice(0, 49),
            ]);
          }
          // Cleanup
          if (mapRef.current && mapRef.current instanceof L.Map) {
            try { mapRef.current.remove(); } catch (e) { /* ignore */ }
            mapRef.current = null;
          } else if (map && map instanceof L.Map) {
            try { map.remove(); } catch (e) { /* ignore */ }
          }
          mapRef.current = null;
          setIsInitialized(false);
        }
      }, 0); // End setTimeout
    }); // End rAF

    // --- Effect Cleanup ---
    return () => {
      logWithDebug(
        'Cleaning up map initialization effect (cancelling frame/timeout)...',
      );
      if (initFrameRef.current !== null) {
        window.cancelAnimationFrame(initFrameRef.current);
        logWithDebug('Cancelled pending init animation frame.');
        initFrameRef.current = null;
      }
      if (initTimeoutRef.current !== null) {
        clearTimeout(initTimeoutRef.current);
        logWithDebug('Cleared pending init timeout(0).');
        initTimeoutRef.current = null;
      }
    };
  }, [
    scriptLoaded,
    mapContainerReady,
    mapConfig,
    onMapReady,
    isInitialized,
    externalMapContainerRef,
  ]);

  // 4. Effect for cleanup (Unmount)
  useEffect(() => {
    // Capture instance for cleanup closure
    const mapInstance = mapRef.current;
    return () => {
      logWithDebug('LeafletLoader unmounting. Running final cleanup...');
      cleanupInitiatedRef.current = true;

      // Cancel pending timers/frames
      if (initFrameRef.current !== null) {
        window.cancelAnimationFrame(initFrameRef.current);
        initFrameRef.current = null;
      }
      if (initTimeoutRef.current !== null) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      if (checkIntervalRef.current !== null) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (failsafeTimeoutRef.current !== null) {
        clearTimeout(failsafeTimeoutRef.current);
        failsafeTimeoutRef.current = null;
      }

      // Remove map and listeners
      if (mapInstance && mapInstance instanceof L.Map) {
        logWithDebug('Unmount Cleanup: Removing map instance and listeners.');
        try {
          // Remove specific listeners if possible, otherwise remove all for the event
          mapInstance.off('moveend'); // Remove our custom listener
          mapInstance.off('drag');    // Remove drag listener
          mapInstance.remove();       // Remove map itself
        } catch (e) {
           logWithDebug(`Unmount Cleanup: Error removing map/listeners: ${e}`, 'error');
        }
        // mapRef.current = null; // Ref should be cleared by React on unmount anyway
      } else {
        logWithDebug('Unmount Cleanup: No valid map instance found to remove.');
      }
      mapRef.current = null; // Explicitly clear ref just in case

      // Reset state
      setIsInitialized(false);
      setMapContainerReady(false);
    };
  }, []); // Empty dependency array ensures this runs only on unmount

  // --- Render ---
  return (
    <>
      {/* Use the new Debug Component */}
 

      {/* Load Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossOrigin=""
      />

      {/* Load Leaflet JS */}
      {!scriptLoaded && typeof window !== 'undefined' && !window.L && (
        <Script
          src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
          crossOrigin=""
          strategy="afterInteractive"
          onLoad={() => {
            logWithDebug('Leaflet script loaded successfully via Next/Script.');
            setTimeout(() => {
              if (window.L) {
                logWithDebug('window.L confirmed after script load.');
                setScriptLoaded(true);
              } else {
                logWithDebug(
                  'Script onLoad but window.L missing! Retrying check...',
                  'warn',
                );
                const checkL = setInterval(() => {
                  if (window.L) {
                    logWithDebug('window.L available after interval check');
                    clearInterval(checkL);
                    setScriptLoaded(true);
                  }
                }, 100);
                setTimeout(() => {
                  clearInterval(checkL);
                  if (!window.L) {
                    logWithDebug('window.L check timed out after 5s', 'error');
                  }
                }, 5000);
              }
            }, 50);
          }}
          onError={(e) => {
            logWithDebug(`Leaflet script load ERROR: ${e}`, 'error');
          }}
        />
      )}

      {/* No map container div rendered here anymore */}

      {/* Global loading indicator */}
      {!isInitialized && (
         <div
            style={{
              position: 'absolute', // Position relative to the parent container (#map-container)
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 500,
              padding: '10px 15px',
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: 'white',
              borderRadius: '4px',
              textAlign: 'center',
              fontSize: '12px',
            }}
          >
            {!scriptLoaded
              ? 'Loading Leaflet...'
              : !mapContainerReady
                ? 'Waiting Container...' // Waiting for the external container
                : 'Initializing Map...'}
          </div>
       )}
    </>
  );
};

export default LeafletLoader;
