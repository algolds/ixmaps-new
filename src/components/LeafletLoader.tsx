/// <reference lib="dom" />
// LeafletLoader - Trying minimal map options and extra DOM checks
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { MapConfig } from '@/types'; // Ensure this path is correct
import L from 'leaflet';

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

    if (type === 'error' && typeof document !== 'undefined') {
      const debugEl = document.getElementById('leaflet-debug-content');
      if (debugEl) {
        const msgEl = document.createElement('p');
        msgEl.style.color = 'red';
        msgEl.textContent = `ERROR: ${message}`;
        debugEl.insertBefore(msgEl, debugEl.firstChild);
      }
    }
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

  // 1. Validate map config
  useEffect(() => {
    logWithDebug('Checking mapConfig...');
    if (!mapConfig) {
      logWithDebug('CRITICAL ERROR: mapConfig prop is missing', 'error');
      return;
    }
    if (
      !mapConfig.bounds ||
      !['north', 'south', 'east', 'west'].every(
        (k) =>
          typeof mapConfig.bounds[k as keyof MapConfig['bounds']] ===
          'number',
      )
    ) {
      logWithDebug('CRITICAL ERROR: mapConfig.bounds invalid', 'error');
      // Don't return here if we want to try minimal init later
      // return;
    }
    if (
      typeof mapConfig.minZoom !== 'number' ||
      typeof mapConfig.maxZoom !== 'number'
    ) {
      logWithDebug('WARNING: mapConfig minZoom/maxZoom invalid', 'warn');
    }
    logWithDebug(
      `Map config validated: bounds=${JSON.stringify(mapConfig.bounds)}, zoom=${mapConfig.minZoom}-${mapConfig.maxZoom}`,
    );
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

  // 3. Effect to Initialize Map (MODIFIED - Minimal Options & More Checks)
  useEffect(() => {
    logWithDebug(
      `Init Effect Run: script=${scriptLoaded}, container=${mapContainerReady}, initialized=${isInitialized}, cleanupFlag=${cleanupInitiatedRef.current}, mapExists=${!!mapRef.current}`,
    );

    // --- Pre-conditions Check ---
    if (
      !scriptLoaded ||
      !mapContainerReady ||
      isInitialized ||
      cleanupInitiatedRef.current ||
      // !mapConfig?.bounds || // Relax bounds check for minimal init test
      typeof window === 'undefined' ||
      !window.L
    ) {
      logWithDebug(
        'Init Effect: Pre-conditions NOT MET or cleanup started. Bailing out.',
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
          // !mapConfig?.bounds || // Relax bounds check
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

        // Force Reflow
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const forceLayout = mapContainerElement.offsetHeight;
        logWithDebug(`Init Timeout(0): Forced layout calculation.`);

        // Dimension Checks
        const currentWidth = mapContainerElement.clientWidth;
        const currentHeight = mapContainerElement.clientHeight;
        if (currentHeight === 0 || currentWidth === 0) {
          logWithDebug(
            `Init Timeout(0) CRITICAL FAIL: Zero dimensions (H:${currentHeight}, W:${currentWidth}) AFTER reflow.`,
            'error',
          );
          return;
        }

        // *** EXTRA DOM CHECKS ***
        const computedStyle = window.getComputedStyle(mapContainerElement);
        const display = computedStyle.display;
        const visibility = computedStyle.visibility;
        const contains = document.body.contains(mapContainerElement); // Re-check contains just in case

        logWithDebug(
          `Init Timeout(0): Pre-L.map Checks: W=${currentWidth}, H=${currentHeight}, Display=${display}, Visibility=${visibility}, In DOM=${contains}`,
          'info',
        );

        if (display === 'none') {
            logWithDebug(`Init Timeout(0) CRITICAL FAIL: Container display is 'none'.`, 'error');
            return;
        }
         if (visibility === 'hidden') {
            logWithDebug(`Init Timeout(0) CRITICAL FAIL: Container visibility is 'hidden'.`, 'error');
            return;
        }
        if (!contains) {
             logWithDebug(`Init Timeout(0) CRITICAL FAIL: Container detached from DOM just before L.map().`, 'error');
            return;
        }
        // *************************

        logWithDebug(
          `Init Timeout(0): Container checks passed. Executing L.map() with MINIMAL options...`,
          'info',
        );

        let map: L.Map | null = null;

        try {
          // --- Create Map Instance with MINIMAL options ---
          // Try initializing with just the container first.
          // If this works, the issue is likely in one of the options below.
          map = L.map(mapContainerElement); // <<< MINIMAL CALL

          /* --- Temporarily comment out original options ---
          // Ensure bounds exist before using them
          if (!mapConfig.bounds) {
            throw new Error("Map config bounds are missing, cannot initialize map options.");
          }
          const { north, south, east, west } = mapConfig.bounds;
          const customCRS = L.extend({}, L.CRS.Simple, {
            transformation: new L.Transformation(1, 0, 1, 0),
            wrapLng: [west - (east - west), east + (east - west)],
            wrapLat: false,
          });
          map = L.map(mapContainerElement, {
            crs: customCRS,
            minZoom: mapConfig.minZoom ?? 0,
            maxZoom: mapConfig.maxZoom ?? 4,
            zoomControl: false,
            attributionControl: false,
            inertia: true,
            worldCopyJump: true,
            bounceAtZoomLimits: true,
            maxBounds: undefined,
            center: [(north + south) / 2, (east + west) / 2],
            zoom: mapConfig.initialZoom ?? mapConfig.minZoom ?? 0,
          });
          */ // --- End of commented out options ---

          if (!map) {
            throw new Error('L.map() failed to return a valid map instance.');
          }
          logWithDebug('Init Timeout(0): L.map() (minimal) returned instance.');

          mapRef.current = map;

          // --- Configure Map (Add back step-by-step if minimal call works) ---
          logWithDebug('Init Timeout(0): Configuring map instance (minimal setup)...');

          // If L.map(element) worked, try adding basic view/zoom
          // You MUST have valid bounds in mapConfig for this
          if (map && mapConfig.bounds) { // Check if bounds are valid
             const { north, south, east, west } = mapConfig.bounds;
             logWithDebug('Init Timeout(0): Setting basic view/zoom...');
             map.setView([(north + south) / 2, (east + west) / 2], mapConfig.minZoom ?? 0);
             // Add a basic tile layer to see something (optional, replace with your image overlay later)
             // L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
             //     attribution: '&copy; OpenStreetMap contributors'
             // }).addTo(map);
             logWithDebug('Init Timeout(0): Basic view/zoom set.');
          } else {
             logWithDebug('Init Timeout(0): Skipping setView/zoom due to missing bounds info.', 'warn');
          }


          // --- Temporarily skip most configuration for this test ---
          /*
          // --- Attribution ---
          if (map) { // Check map exists before adding controls/layers
            L.control.attribution({
              position: 'bottomright',
              prefix: '© IxMaps v4.0.0',
            }).addTo(map);

            // --- Base Layer ---
            if (mapConfig.bounds) {
              const { north, south, east, west } = mapConfig.bounds;
              const bounds = L.latLngBounds(
                L.latLng(south, west),
                L.latLng(north, east),
              );
              const initialMapUrl = mapConfig.lodEnabled
                ? mapConfig.baseMapUrl
                : mapConfig.masterMapPath;
              if (initialMapUrl) {
                const baseLayer = L.imageOverlay(initialMapUrl, bounds, {
                  errorOverlayUrl: 'data:image/png;base64,...', // Keep placeholder
                  alt: 'Error loading base map',
                });
                baseLayer.on('error', () => logWithDebug('Base map load error', 'error'));
                baseLayer.addTo(map);

                // --- Wraparound ---
                const worldWidth = east - west;
                if (worldWidth > 0) {
                  const leftBounds = L.latLngBounds(L.latLng(south, west - worldWidth), L.latLng(north, east - worldWidth));
                  L.imageOverlay(initialMapUrl, leftBounds).addTo(map);
                  const rightBounds = L.latLngBounds(L.latLng(south, west + worldWidth), L.latLng(north, east + worldWidth));
                  L.imageOverlay(initialMapUrl, rightBounds).addTo(map);
                }
              } else {
                 logWithDebug('Skipping base layer/wraparound - no URL', 'warn');
              }

              // --- Constraints & View ---
              const verticalPadding = (north - south) * 0.05;
              const verticalOnlyMaxBounds = L.latLngBounds(
                L.latLng(south - verticalPadding, -Infinity),
                L.latLng(north + verticalPadding, Infinity),
              );
              map.setMaxBounds(verticalOnlyMaxBounds);
              // setView already attempted above

              // --- invalidateSize ---
              map.invalidateSize({ animate: false, pan: false });

              // --- Zoom Control ---
              L.control.zoom({ position: 'topleft' }).addTo(map);

              // --- Drag Handler ---
              map.on('drag', function () {
                map?.panInsideBounds(verticalOnlyMaxBounds, { animate: false });
              });
            } else {
               logWithDebug('Skipping further config - bounds missing', 'warn');
            }
          }
          */
          // --- End of skipped configuration ---


          // --- Finalize ---
          setIsInitialized(true);
          logWithDebug(
            'Init Timeout(0): Map initialization (minimal) complete! Notifying parent.',
          );
          // Pass the minimally configured map
          onMapReady(map, L);

        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          logWithDebug(
            `Init Timeout(0) ERROR during map initialization (minimal): ${errorMsg}`, // Indicate minimal attempt
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
      }, 0); // End of setTimeout(0)
    }); // End of requestAnimationFrame

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
    mapConfig, // Keep mapConfig for potential re-adding of options
    onMapReady,
    isInitialized,
    externalMapContainerRef,
  ]);

  // 4. Effect for cleanup (Unmount)
  useEffect(() => {
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

      // Remove map
      if (mapRef.current && mapRef.current instanceof L.Map) {
        logWithDebug('Unmount Cleanup: Removing map instance.');
        try { mapRef.current.remove(); } catch (e) { /* ignore */ }
        mapRef.current = null;
      } else {
        logWithDebug('Unmount Cleanup: No valid map instance found to remove.');
      }

      // Reset state
      setIsInitialized(false);
      setMapContainerReady(false);
    };
  }, []);

  // --- Render ---
  return (
    <>
      {/* Debug info display */}
      {process.env.NODE_ENV === 'development' && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 10000,
            backgroundColor: 'rgba(255,255,255,0.9)',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            maxHeight: '300px',
            maxWidth: '350px',
            overflowY: 'auto',
            fontSize: '10px',
            fontFamily: 'monospace',
            display: 'block',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          }}
        >
          <h4 style={{ margin: '0 0 5px 0', fontSize: '12px' }}>
            Leaflet Loader Debug (External Ref Mode):
          </h4>
          <div id="leaflet-status">
            <p>Script Loaded: {scriptLoaded ? '✅ Yes' : '⏳ No'}</p>
            <p>Container Ready: {mapContainerReady ? '✅ Yes' : '⏳ No'}</p>
            <p>Map Initialized: {isInitialized ? '✅ Yes' : '⏳ No'}</p>
            <p>
              Cleanup Flag: {cleanupInitiatedRef.current ? '🚫 Yes' : '✅ No'}
            </p>
            <hr style={{ margin: '5px 0' }} />
          </div>
          <div
            id="leaflet-debug-content"
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              maxHeight: '200px',
              overflowY: 'auto',
            }}
          >
            {debugInfo.map((msg, i) => (
              <div key={i}>{msg}</div>
            ))}
          </div>
        </div>
      )}

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

      {/* Display a global loading indicator if map isn't initialized */}
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
