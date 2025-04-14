// src/components/LeafletLoader.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { MapConfig } from '@/types'; // Ensure this path is correct
import L from 'leaflet';
import LeafletDebugDisplay from './LeafletDebugDisplay'; // Import the debug component
// Import the coordinate conversion function
import { svgToLatLng } from '@/lib/coordinates-system';

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

  // 1. Validate map config - ADD checks for ALL projection params
  useEffect(() => {
    logWithDebug('Checking mapConfig...');
    let isValid = true;
    if (!mapConfig) {
      logWithDebug('CRITICAL ERROR: mapConfig prop is missing', 'error');
      isValid = false;
    } else {
      // Check bounds (assuming they are SVG bounds initially, will be converted later)
      if (
        !mapConfig.bounds ||
        !['north', 'south', 'east', 'west'].every(
          (k) =>
            typeof mapConfig.bounds[k as keyof MapConfig['bounds']] ===
            'number',
        )
      ) {
        logWithDebug('WARNING: mapConfig.bounds look invalid', 'warn');
        // Not critical error yet, as we might derive bounds differently
      }
      // Check zoom
      if (
        typeof mapConfig.minZoom !== 'number' ||
        typeof mapConfig.maxZoom !== 'number'
      ) {
        logWithDebug('WARNING: mapConfig minZoom/maxZoom invalid', 'warn');
      }
      // *** CRITICAL checks for required transformation parameters ***
      if (
        typeof mapConfig.pixelsPerLongitude !== 'number' ||
        mapConfig.pixelsPerLongitude <= 0
      ) {
        logWithDebug(
          'CRITICAL ERROR: mapConfig.pixelsPerLongitude missing or invalid.',
          'error',
        );
        isValid = false;
      }
      if (
        typeof mapConfig.pixelsPerLatitude !== 'number' ||
        mapConfig.pixelsPerLatitude <= 0
      ) {
        logWithDebug(
          'CRITICAL ERROR: mapConfig.pixelsPerLatitude missing or invalid.',
          'error',
        );
        isValid = false;
      }
      if (typeof mapConfig.equatorY !== 'number') {
        logWithDebug(
          'CRITICAL ERROR: mapConfig.equatorY missing or invalid.',
          'error',
        );
        isValid = false;
      }
      if (typeof mapConfig.primeMeridianX !== 'number') {
        logWithDebug(
          'CRITICAL ERROR: mapConfig.primeMeridianX missing or invalid.',
          'error',
        );
        isValid = false;
      }
      // SVG dimensions are needed to calculate geographic bounds
      if (
        typeof mapConfig.svgWidth !== 'number' ||
        mapConfig.svgWidth <= 0
      ) {
        logWithDebug(
          'CRITICAL ERROR: mapConfig.svgWidth missing or invalid.',
          'error',
        );
        isValid = false;
      }
      if (
        typeof mapConfig.svgHeight !== 'number' ||
        mapConfig.svgHeight <= 0
      ) {
        logWithDebug(
          'CRITICAL ERROR: mapConfig.svgHeight missing or invalid.',
          'error',
        );
        isValid = false;
      }
    }

    if (isValid) {
      logWithDebug(
        `Map config validated: pxPerLon=${mapConfig.pixelsPerLongitude}, pxPerLat=${mapConfig.pixelsPerLatitude}, eqY=${mapConfig.equatorY}, pmX=${mapConfig.primeMeridianX}, svgW=${mapConfig.svgWidth}, svgH=${mapConfig.svgHeight}`,
      );
    } else {
      logWithDebug('Map config validation FAILED.', 'error');
    }
  }, [mapConfig]);

  // 2. Effect to check map container readiness (remains the same)
  useEffect(() => {
    logWithDebug(
      'Starting map container readiness check (using external ref)...',
    );

    const clearTimers = () => {
      if (checkIntervalRef.current !== null) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
        // logWithDebug('Cleared container check interval.'); // Less verbose
      }
      if (failsafeTimeoutRef.current !== null) {
        clearTimeout(failsafeTimeoutRef.current);
        failsafeTimeoutRef.current = null;
        // logWithDebug('Cleared container failsafe timeout.'); // Less verbose
      }
    };

    const checkMapContainer = () => {
      const mapContainer = externalMapContainerRef.current;
      if (!mapContainer) {
        // logWithDebug('External map container ref not available yet.'); // Less verbose
        return false;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _unused = mapContainer.offsetHeight; // Force reflow

      if (mapContainer.clientHeight > 0 && mapContainer.clientWidth > 0) {
        logWithDebug(
          `External map container is READY (W: ${mapContainer.clientWidth}, H: ${mapContainer.clientHeight}).`,
          'info',
        );
        setMapContainerReady(true);
        clearTimers();
        return true;
      } else {
        // logWithDebug(`External map container found, but zero dimensions (W: ${mapContainer.clientWidth}, H: ${mapContainer.clientHeight}). Retrying...`, 'warn'); // Less verbose
        return false;
      }
    };

    if (checkMapContainer()) return;

    // logWithDebug('Starting interval check for external map container dimensions.'); // Less verbose
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
      // logWithDebug('Cleaning up map container checker effect.'); // Less verbose
      clearTimers();
    };
  }, [externalMapContainerRef]);

  // 3. Effect to Initialize Map (Aligning CRS)
  useEffect(() => {
    logWithDebug(
      `Init Effect Run: script=${scriptLoaded}, container=${mapContainerReady}, initialized=${isInitialized}, cleanupFlag=${cleanupInitiatedRef.current}, mapExists=${!!mapRef.current}`,
    );

    // --- Pre-conditions Check ---
    // Check for ALL required mapConfig properties needed for CRS and bounds
    if (
      !scriptLoaded ||
      !mapContainerReady ||
      isInitialized ||
      cleanupInitiatedRef.current ||
      !mapConfig || // General check
      typeof mapConfig.pixelsPerLongitude !== 'number' ||
      typeof mapConfig.pixelsPerLatitude !== 'number' ||
      typeof mapConfig.equatorY !== 'number' ||
      typeof mapConfig.primeMeridianX !== 'number' ||
      typeof mapConfig.svgWidth !== 'number' ||
      typeof mapConfig.svgHeight !== 'number' ||
      typeof window === 'undefined' ||
      !window.L
    ) {
      logWithDebug(
        'Init Effect: Pre-conditions NOT MET (check mapConfig projection/SVG params!) or cleanup started. Bailing out.',
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
      // logWithDebug('Init Frame Fired. Queuing L.map() with setTimeout(0)...'); // Less verbose

      initTimeoutRef.current = window.setTimeout(() => {
        initTimeoutRef.current = null;
        // logWithDebug(`Init Timeout(0) Fired...`); // Less verbose

        // --- Re-check conditions ---
        if (
          !scriptLoaded ||
          !mapContainerReady ||
          isInitialized ||
          cleanupInitiatedRef.current ||
          !window.L ||
          !mapConfig || // Re-check
          typeof mapConfig.pixelsPerLongitude !== 'number' ||
          typeof mapConfig.pixelsPerLatitude !== 'number' ||
          typeof mapConfig.equatorY !== 'number' ||
          typeof mapConfig.primeMeridianX !== 'number' ||
          typeof mapConfig.svgWidth !== 'number' ||
          typeof mapConfig.svgHeight !== 'number' ||
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

        // --- Final Container & Dimension Check ---
        if (
          !mapContainerElement ||
          !document.body.contains(mapContainerElement)
        ) {
          logWithDebug(
            `Init Timeout(0) CRITICAL FAIL: External map container element invalid or detached just before L.map().`,
            'error',
          );
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const forceLayout = mapContainerElement.offsetHeight; // Force reflow
        const currentWidth = mapContainerElement.clientWidth;
        const currentHeight = mapContainerElement.clientHeight;
        if (currentHeight === 0 || currentWidth === 0) {
          logWithDebug(
            `Init Timeout(0) CRITICAL FAIL: Zero dimensions (H:${currentHeight}, W:${currentWidth}) AFTER reflow.`,
            'error',
          );
          return;
        }
        // logWithDebug(`Init Timeout(0): Pre-L.map Checks: W=${currentWidth}, H=${currentHeight}`); // Less verbose

        logWithDebug(
          `Init Timeout(0): Container checks passed. Executing L.map() with ALIGNED CRS...`,
          'info',
        );

        let map: L.Map | null = null;

        try {
          // --- Define Transformation based on coordinates-system.ts logic ---
          const {
            pixelsPerLongitude,
            pixelsPerLatitude,
            primeMeridianX,
            equatorY,
            svgWidth,
            svgHeight,
          } = mapConfig;
          // Use the same reference longitude offset as in coordinates-system.ts
          const referenceLngOffset =
            mapConfig.primeMeridianReferenceLng ?? 30; // Default to 30 if not in config

          // Transformation parameters derived from latLngToSvg:
          // svgX = a * lng + b  => a = pxPerLng, b = pmX - refLngOffset * pxPerLng
          // svgY = c * lat + d  => c = -pxPerLat, d = eqY
          const a = pixelsPerLongitude;
          const b = primeMeridianX - referenceLngOffset * pixelsPerLongitude;
          const c = -pixelsPerLatitude; // Y is inverted between Lat and SVG Y
          const d = equatorY;

          const transformation = new L.Transformation(a, b, c, d);
          logWithDebug(
            `Init Timeout(0): ALIGNED CRS defined: a=${a.toFixed(2)}, b=${b.toFixed(2)}, c=${c.toFixed(2)}, d=${d.toFixed(2)} (refLngOffset=${referenceLngOffset})`,
          );

          const customCRS = L.extend({}, L.CRS.Simple, {
            transformation: transformation,
            // We need the inverse functions for Leaflet internal use (e.g., getCenter)
            // These should match svgToLatLng
            unproject: function (point: L.Point): L.LatLng {
              const lng =
                (point.x - b) / a; // Inverse of: point.x = a * lng + b
              const lat =
                (point.y - d) / c; // Inverse of: point.y = c * lat + d
              return new L.LatLng(lat, lng);
            },
            // This should match latLngToSvg
            project: function (latlng: L.LatLng): L.Point {
              const x = a * latlng.lng + b;
              const y = c * latlng.lat + d;
              return new L.Point(x, y);
            },
            wrapLng: undefined, // Disable standard wrapping initially
            wrapLat: undefined, // Disable standard wrapping
            infinite: true, // Allow map to extend beyond initial bounds if needed
          });

          // --- Calculate Geographic Bounds from SVG Corners ---
          // Use the imported svgToLatLng function
          const topLeftLatLng = svgToLatLng(0, 0, mapConfig);
          const bottomRightLatLng = svgToLatLng(svgWidth, svgHeight, mapConfig);

          // Leaflet bounds: L.latLngBounds(southWest, northEast)
          const imageOverlayBounds = L.latLngBounds(
            L.latLng(bottomRightLatLng.lat, topLeftLatLng.lng), // South-West corner
            L.latLng(topLeftLatLng.lat, bottomRightLatLng.lng), // North-East corner
          );
          logWithDebug(
            `Init Timeout(0): Calculated Geographic Bounds: ${imageOverlayBounds.toBBoxString()}`,
          );

          // --- Calculate Geographic Center ---
          const centerLatLng = svgToLatLng(
            svgWidth / 2,
            svgHeight / 2,
            mapConfig,
          );
          logWithDebug(
            `Init Timeout(0): Calculated Geographic Center: Lat=${centerLatLng.lat.toFixed(2)}, Lng=${centerLatLng.lng.toFixed(2)}`,
          );

          // --- Create Map Instance ---
          map = L.map(mapContainerElement!, {
            crs: customCRS, // Use the ALIGNED CRS
            center: centerLatLng, // Use GEOGRAPHIC center
            zoom: mapConfig.initialZoom ?? mapConfig.minZoom ?? 0,
            minZoom: mapConfig.minZoom ?? 0,
            maxZoom: mapConfig.maxZoom ?? 4,
            zoomControl: false, // Added later
            attributionControl: false, // Added later
            inertia: true,
            bounceAtZoomLimits: true,
            // Set maxBounds later AFTER the map is created
            maxBounds: undefined,
          });

          if (!map) throw new Error('L.map() failed');
          logWithDebug('Init Timeout(0): L.map() (aligned CRS) returned instance.');
          mapRef.current = map;

          // --- Configure Map ---
          logWithDebug('Init Timeout(0): Configuring map instance...');

          // --- Attribution ---
          L.control.attribution({
            position: 'bottomright',
            prefix: '© IxMaps v4.0.0', // Example prefix
          }).addTo(map);

          // --- Base Layer ---
          const initialMapUrl = mapConfig.lodEnabled
            ? mapConfig.baseMapUrl // Assuming baseMapUrl is LOD template or initial low-res
            : mapConfig.masterMapPath; // Fallback to master SVG path
          if (!initialMapUrl) throw new Error('No map URL available');

          logWithDebug(
            `Init Timeout(0): Adding BASE map image overlay: ${initialMapUrl}`,
          );
          const baseLayer = L.imageOverlay(
            initialMapUrl,
            imageOverlayBounds, // Use CALCULATED GEOGRAPHIC bounds
            {
              errorOverlayUrl:
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
              alt: 'Error loading base map',
              interactive: false, // Usually base maps aren't interactive
            },
          );
          baseLayer.on('error', () => {
            logWithDebug(
              `Init Timeout(0): Failed to load base map: ${initialMapUrl}`,
              'error',
            );
          });
          baseLayer.addTo(map);

          // --- Constraints & View ---
          // Set maxBounds to the calculated geographic bounds of the image
          logWithDebug(
            `Init Timeout(0): Setting max bounds to image overlay bounds: ${imageOverlayBounds.toBBoxString()}`,
          );
          map.setMaxBounds(imageOverlayBounds);

          // --- invalidateSize ---
          logWithDebug('Init Timeout(0): Calling invalidateSize() AFTER setup.');
          map.invalidateSize({ animate: false, pan: false });

          // --- Zoom Control ---
          L.control.zoom({ position: 'topleft' }).addTo(map);

          // --- Drag Handler (for maxBounds) ---
          // Leaflet's built-in maxBounds handling should work better now with the correct CRS
          // The custom drag handler might not be strictly necessary unless specific panning behavior is needed.
          // Keeping it for now, but ensure it uses the correct bounds object.
          map.on('drag', function () {
            // Use the same bounds object set in setMaxBounds
            if (imageOverlayBounds && imageOverlayBounds.isValid()) {
              map?.panInsideBounds(imageOverlayBounds, { animate: false });
            }
          });

          // --- Manual Wraparound Logic (Adjusted for Geographic Coordinates) ---
          const westLng = imageOverlayBounds.getWest();
          const eastLng = imageOverlayBounds.getEast();
          const worldWidthLng = eastLng - westLng;

          if (worldWidthLng > 0) {
            logWithDebug(
              `Init Timeout(0): Adding manual wraparound listener (West: ${westLng.toFixed(2)}, East: ${eastLng.toFixed(2)}, Width: ${worldWidthLng.toFixed(2)})`,
            );
            map.on('moveend', function () {
              if (!mapRef.current) return;
              const center = mapRef.current.getCenter();
              const currentLng = center.lng;

              // Check if longitude is outside the primary map bounds
              if (currentLng < westLng || currentLng >= eastLng) {
                // Normalize longitude to wrap around within the bounds
                const newLng =
                  ((currentLng - westLng) % worldWidthLng + worldWidthLng) %
                    worldWidthLng +
                  westLng;

                // Avoid unnecessary setView if the change is negligible
                if (Math.abs(newLng - currentLng) > 1e-6) {
                  const newCenter = L.latLng(center.lat, newLng);
                  logWithDebug(
                    `Wrapping map view from lng ${currentLng.toFixed(2)} to ${newLng.toFixed(2)}`,
                  );
                  // Use flyTo for smoother wrap? Or setView with noMoveStart
                  mapRef.current.setView(newCenter, mapRef.current.getZoom(), {
                    animate: false,
                    noMoveStart: true, // Prevent firing another moveend immediately
                  });
                }
              }
            });
          } else {
            logWithDebug(
              'Init Timeout(0): Skipping manual wraparound listener - invalid geographic world width.',
              'warn',
            );
          }
          // **********************************

          // --- Finalize ---
          setIsInitialized(true);
          logWithDebug(
            'Init Timeout(0): Map initialization complete! Notifying parent.',
          );
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
          // Cleanup partially created map
          if (mapRef.current && mapRef.current instanceof L.Map) {
            try {
              mapRef.current.remove();
            } catch (e) {
              /* ignore */
            }
            mapRef.current = null;
          } else if (map && map instanceof L.Map) {
            try {
              map.remove();
            } catch (e) {
              /* ignore */
            }
          }
          mapRef.current = null;
          setIsInitialized(false);
        }
      }, 0); // End setTimeout
    }); // End rAF

    // --- Effect Cleanup ---
    return () => {
      // logWithDebug('Cleaning up map initialization effect (cancelling frame/timeout)...'); // Less verbose
      if (initFrameRef.current !== null) {
        window.cancelAnimationFrame(initFrameRef.current);
        // logWithDebug('Cancelled pending init animation frame.'); // Less verbose
        initFrameRef.current = null;
      }
      if (initTimeoutRef.current !== null) {
        clearTimeout(initTimeoutRef.current);
        // logWithDebug('Cleared pending init timeout(0).'); // Less verbose
        initTimeoutRef.current = null;
      }
    };
  }, [
    scriptLoaded,
    mapContainerReady,
    mapConfig, // Keep mapConfig as dependency
    onMapReady,
    isInitialized,
    externalMapContainerRef,
    // svgToLatLng is used implicitly via mapConfig parameters now
  ]);

  // 4. Effect for cleanup (Unmount) - (remains the same)
  useEffect(() => {
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
          mapInstance.off('moveend');
          mapInstance.off('drag');
          mapInstance.remove();
        } catch (e) {
          logWithDebug(
            `Unmount Cleanup: Error removing map/listeners: ${e}`,
            'error',
          );
        }
      } else {
        logWithDebug('Unmount Cleanup: No valid map instance found to remove.');
      }
      mapRef.current = null;

      // Reset state
      setIsInitialized(false);
      setMapContainerReady(false);
      // Don't reset scriptLoaded here, Leaflet script stays loaded globally
    };
  }, []); // Empty dependency array ensures this runs only on unmount

  // --- Render ---
  return (
    <>
      {/* Debug Component - Keep if useful */}
      {/* <LeafletDebugDisplay debugInfo={debugInfo} /> */}

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
            // Add a small delay before setting state, sometimes window.L isn't immediately available
            setTimeout(() => {
              if (window.L) {
                logWithDebug('window.L confirmed after script load.');
                setScriptLoaded(true);
              } else {
                logWithDebug(
                  'Script onLoad but window.L missing! Retrying check...',
                  'warn',
                );
                // Fallback check interval
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
            }, 50); // 50ms delay
          }}
          onError={(e) => {
            logWithDebug(`Leaflet script load ERROR: ${e}`, 'error');
          }}
        />
      )}

      {/* Global loading indicator */}
      {!isInitialized && (
        <div
          style={{
            position: 'absolute',
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
            pointerEvents: 'none', // Prevent interaction
          }}
        >
          {!scriptLoaded
            ? 'Loading Leaflet...'
            : !mapContainerReady
              ? 'Waiting Container...'
              : 'Initializing Map...'}
        </div>
      )}
    </>
  );
};

export default LeafletLoader;
