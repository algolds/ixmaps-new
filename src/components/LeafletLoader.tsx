// src/components/LeafletLoader.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { MapConfig } from '@/types'; // Ensure this path is correct
import L from 'leaflet';
// Import the coordinate conversion function - needed for bounds/center
import { svgToLatLng } from '@/lib/coordinates-system';

interface LeafletLoaderProps {
  mapConfig: MapConfig;
  onMapReady: (map: L.Map, L: typeof window.L) => void;
  externalMapContainerRef: React.RefObject<HTMLDivElement | null>;
}

// --- Define Latitude Limits ---
const MAX_NORTH_LAT = 31;
const MAX_SOUTH_LAT = -31; // Use negative for Southern Hemisphere
// ---

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
  const initFrameRef = useRef<number | null>(null);
  const initTimeoutRef = useRef<number | null>(null);
  const cleanupInitiatedRef = useRef<boolean>(false);
  const isProgrammaticMoveRef = useRef<boolean>(false); // Flag to prevent moveend recursion
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
    // Prevent state updates during cleanup
    if (!cleanupInitiatedRef.current) {
      setDebugInfo((prev) => [
        `[${new Date().toLocaleTimeString()}] [${type.toUpperCase()}] ${message}`,
        ...prev.slice(0, 49), // Keep last 50 messages
      ]);
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
    let isValid = true;
    if (!mapConfig) {
      logWithDebug('CRITICAL ERROR: mapConfig prop is missing', 'error');
      isValid = false;
    } else {
      // Check critical projection/SVG parameters
      const requiredParams: (keyof MapConfig)[] = [
        'pixelsPerLongitude',
        'pixelsPerLatitude',
        'equatorY',
        'primeMeridianX',
        'svgWidth',
        'svgHeight',
      ];
      for (const param of requiredParams) {
        if (
          typeof mapConfig[param] !== 'number' ||
          // Allow zero for primeMeridianX if referenceLng is also 0
          (param !== 'primeMeridianX' && (mapConfig[param] as number) <= 0) ||
          (param === 'primeMeridianX' &&
            (mapConfig[param] as number) < 0 &&
            mapConfig.primeMeridianReferenceLng !== 0)
        ) {
          logWithDebug(
            `CRITICAL ERROR: mapConfig.${param} missing or invalid. Value: ${mapConfig[param]}`,
            'error',
          );
          isValid = false;
        }
      }
      // Optional check for reference longitude
      if (typeof mapConfig.primeMeridianReferenceLng !== 'number') {
        logWithDebug(
          'WARNING: mapConfig.primeMeridianReferenceLng not found. CRS will use default offset (verify consistency!).',
          'warn',
        );
      }
      // Check zoom
      if (
        typeof mapConfig.minZoom !== 'number' ||
        typeof mapConfig.maxZoom !== 'number'
      ) {
        logWithDebug('WARNING: mapConfig minZoom/maxZoom invalid', 'warn');
      }
    }

    if (isValid) {
      logWithDebug(
        `Map config validated: pxPerLon=${mapConfig.pixelsPerLongitude?.toFixed(4)}, pxPerLat=${mapConfig.pixelsPerLatitude?.toFixed(4)}, eqY=${mapConfig.equatorY}, pmX=${mapConfig.primeMeridianX}, svgW=${mapConfig.svgWidth}, svgH=${mapConfig.svgHeight}, refLng=${mapConfig.primeMeridianReferenceLng ?? 'default'}`,
      );
    } else {
      logWithDebug('Map config validation FAILED.', 'error');
    }
  }, [mapConfig]);

  // 2. Effect to check map container readiness
  useEffect(() => {
    logWithDebug(
      'Starting map container readiness check (using external ref)...',
    );
    const clearTimers = () => {
      if (checkIntervalRef.current !== null) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (failsafeTimeoutRef.current !== null) {
        clearTimeout(failsafeTimeoutRef.current);
        failsafeTimeoutRef.current = null;
      }
    };
    const checkMapContainer = () => {
      const mapContainer = externalMapContainerRef.current;
      if (!mapContainer) return false;
      // Force reflow to get accurate dimensions
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _unused = mapContainer.offsetHeight;
      if (mapContainer.clientHeight > 0 && mapContainer.clientWidth > 0) {
        logWithDebug(
          `External map container is READY (W: ${mapContainer.clientWidth}, H: ${mapContainer.clientHeight}).`,
          'info',
        );
        setMapContainerReady(true);
        clearTimers();
        return true;
      }
      return false;
    };
    // Check immediately in case it's already ready
    if (checkMapContainer()) return;
    // If not ready, start polling
    checkIntervalRef.current = window.setInterval(checkMapContainer, 150);
    // Failsafe timeout
    failsafeTimeoutRef.current = window.setTimeout(() => {
      if (!mapContainerReady) {
        logWithDebug(
          'Failsafe timeout reached. External container still not ready.',
          'error',
        );
        if (!checkMapContainer()) {
          // Final check
          const mapContainer = externalMapContainerRef.current;
          logWithDebug(
            `Final check failed. External container exists: ${!!mapContainer}, W: ${mapContainer?.clientWidth}, H: ${mapContainer?.clientHeight}`,
            'error',
          );
          logWithDebug(
            'CRITICAL: Ensure the PARENT component provides a valid container with height!',
            'error',
          );
        }
      }
      // Clear interval regardless after timeout
      if (checkIntervalRef.current !== null) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    }, 8000); // 8 second timeout

    // Cleanup timers on unmount or if container becomes ready
    return () => clearTimers();
  }, [externalMapContainerRef]); // Dependency: the ref object itself

  // 3. Effect to Initialize Map (Aligning CRS)
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

    // --- Use rAF -> setTimeout(0) to defer execution slightly ---
    initFrameRef.current = window.requestAnimationFrame(() => {
      initFrameRef.current = null; // Clear frame ref

      initTimeoutRef.current = window.setTimeout(() => {
        initTimeoutRef.current = null; // Clear timeout ref

        // --- Re-check conditions inside timeout ---
        if (
          !scriptLoaded ||
          !mapContainerReady ||
          isInitialized ||
          cleanupInitiatedRef.current ||
          !window.L ||
          !mapConfig || // Re-check config
          typeof mapConfig.pixelsPerLongitude !== 'number' ||
          typeof mapConfig.pixelsPerLatitude !== 'number' ||
          typeof mapConfig.equatorY !== 'number' ||
          typeof mapConfig.primeMeridianX !== 'number' ||
          typeof mapConfig.svgWidth !== 'number' ||
          typeof mapConfig.svgHeight !== 'number' ||
          mapRef.current // Check if map got created somehow else
        ) {
          logWithDebug(
            'Init Timeout(0): Conditions no longer met or map exists, aborting init.',
            'warn',
          );
          return;
        }

        const L = window.L;
        const mapContainerElement = externalMapContainerRef.current;

        // --- Final Container Check ---
        if (
          !mapContainerElement ||
          !document.body.contains(mapContainerElement) // Check if still in DOM
        ) {
          logWithDebug(
            `Init Timeout(0) CRITICAL FAIL: External map container element invalid or detached.`,
            'error',
          );
          return;
        }
        // Force reflow check for dimensions again
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const forceLayout = mapContainerElement.offsetHeight;
        if (
          mapContainerElement.clientHeight === 0 ||
          mapContainerElement.clientWidth === 0
        ) {
          logWithDebug(
            `Init Timeout(0) CRITICAL FAIL: Zero dimensions AFTER reflow.`,
            'error',
          );
          return;
        }

        logWithDebug(
          `Init Timeout(0): Container checks passed. Executing L.map() with ALIGNED CRS...`,
          'info',
        );

        let map: L.Map | null = null;
        let imageOverlayBounds: L.LatLngBounds | null = null; // For the image
        let constrainedMapBounds: L.LatLngBounds | null = null; // For vertical limits & initial zoom calc

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

          // --- Determine Reference Longitude Offset ---
          const referenceLngOffset = mapConfig.primeMeridianReferenceLng ?? 0; // Default to 0 if undefined
          logWithDebug(
            `Using referenceLngOffset: ${referenceLngOffset} (from mapConfig: ${mapConfig.primeMeridianReferenceLng ?? 'undefined -> 0'})`,
            'info',
          );

          // Transformation parameters derived from latLngToSvg:
          const a = pixelsPerLongitude;
          const b = primeMeridianX - referenceLngOffset * pixelsPerLongitude;
          const c = -pixelsPerLatitude; // Y is inverted in SVG vs Lat
          const d = equatorY;

          const transformation = new L.Transformation(a, b, c, d);

          // --- Calculate Geographic Bounds for Image Overlay ---
          const topLeftLatLng = svgToLatLng(0, 0, mapConfig);
          const bottomRightLatLng = svgToLatLng(svgWidth, svgHeight, mapConfig);
          imageOverlayBounds = L.latLngBounds(
            L.latLng(bottomRightLatLng.lat, topLeftLatLng.lng), // South-West corner
            L.latLng(topLeftLatLng.lat, bottomRightLatLng.lng), // North-East corner
          );
          logWithDebug(
            `Init Timeout(0): Calculated FULL Geographic Bounds (for Image): ${imageOverlayBounds.toBBoxString()}`,
          );

          // --- Calculate CONSTRAINED Geographic Bounds (for vertical limits & initial zoom) ---
          const fullWestLng = imageOverlayBounds.getWest();
          const fullEastLng = imageOverlayBounds.getEast();
          // Use defined MAX/MIN latitudes, but ensure they don't exceed the image bounds if necessary
          const constrainedSouthLat = Math.max(
            MAX_SOUTH_LAT,
            imageOverlayBounds.getSouth(),
          );
          const constrainedNorthLat = Math.min(
            MAX_NORTH_LAT,
            imageOverlayBounds.getNorth(),
          );

          constrainedMapBounds = L.latLngBounds(
            L.latLng(constrainedSouthLat, fullWestLng), // South-West (Constrained Lat)
            L.latLng(constrainedNorthLat, fullEastLng), // North-East (Constrained Lat)
          );
          logWithDebug(
            `Init Timeout(0): Calculated CONSTRAINED Geographic Bounds (for vertical limits/initial zoom): ${constrainedMapBounds.toBBoxString()}`,
          );

          // --- Define Longitude Wrapping Range ---
          const minLng = imageOverlayBounds.getWest();
          const maxLng = imageOverlayBounds.getEast();
          const lngRange = maxLng - minLng;
          logWithDebug(
            `Init Timeout(0): Longitude range for wrapping: [${minLng}, ${maxLng}], Width: ${lngRange}`,
          );

          // Define the Custom CRS extending Simple CRS with WRAPPING
          const customCRS = L.extend({}, L.CRS.Simple, {
            transformation: transformation,
            unproject: function (point: L.Point): L.LatLng {
              const lng = (point.x - b) / a;
              const lat = (point.y - d) / c;
              return new L.LatLng(lat, lng);
            },
            project: function (latlng: L.LatLng): L.Point {
              const x = a * latlng.lng + b;
              const y = c * latlng.lat + d;
              return new L.Point(x, y);
            },
            // --- ADD WRAPPING ---
            wrapLng: [minLng, maxLng], // Define the longitude range to wrap around
            wrapLat: undefined, // No latitude wrapping
            // --- END WRAPPING ---
            infinite: true, // Allow infinite panning
          });
          logWithDebug(
            `Init Timeout(0): ALIGNED CRS defined: a=${a.toFixed(4)}, b=${b.toFixed(4)}, c=${c.toFixed(4)}, d=${d.toFixed(4)} (using refLngOffset=${referenceLngOffset}) WITH wrapLng: [${minLng}, ${maxLng}]`,
          );

          // --- Create Map Instance WITHOUT Strict Bounds ---
          map = L.map(mapContainerElement!, {
            crs: customCRS,
            minZoom: mapConfig.minZoom ?? 0,
            maxZoom: mapConfig.maxZoom ?? 4,
            zoomControl: false,
            attributionControl: false,
            inertia: true,
            bounceAtZoomLimits: true, // Keep this, might help smooth zoom limits
            // maxBounds and maxBoundsViscosity are removed to allow wrapping
          });

          if (!map) throw new Error('L.map() failed to return instance');
          logWithDebug(
            'Init Timeout(0): L.map() (aligned CRS, no maxBounds) returned instance.',
          );
          mapRef.current = map; // Store map instance ref

          // --- Configure Map ---
          logWithDebug('Init Timeout(0): Configuring map instance...');
          L.control
            .attribution({ position: 'bottomright', prefix: '© IxMaps v4.0.0' })
            .addTo(map);

          // --- Base Layer (Use FULL image bounds) ---
          const initialMapUrl = mapConfig.baseMapUrl || mapConfig.masterMapPath;
          if (!initialMapUrl)
            throw new Error('No base map URL defined in mapConfig');
          logWithDebug(
            `Init Timeout(0): Adding BASE map image overlay: ${initialMapUrl}`,
          );
          const baseLayer = L.imageOverlay(
            initialMapUrl,
            imageOverlayBounds, // Use full bounds for image
            {
              errorOverlayUrl:
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
              alt: 'Error loading base map',
              interactive: false,
            },
          );
          baseLayer.on('error', () =>
            logWithDebug(
              `Init Timeout(0): Failed to load base map: ${initialMapUrl}`,
              'error',
            ),
          );
          baseLayer.addTo(map);

          // --- Constraints & View ---
          logWithDebug('Init Timeout(0): Calling invalidateSize() AFTER setup.');
          map.invalidateSize({ animate: false, pan: false }); // Ensure map knows its container size

          // --- Set Initial View using setView centered on Prime Meridian ---
          const centerLng = mapConfig.primeMeridianReferenceLng ?? 0;
          const centerLat = constrainedMapBounds.getCenter().lat; // Use vertical center of constrained bounds
          // Calculate a suitable initial zoom level based on the constrained bounds
          const initialZoom = map.getBoundsZoom(constrainedMapBounds, false); // false = inside
          logWithDebug(
            `Init Timeout(0): Setting initial view: Center=[${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}], Zoom=${initialZoom}`,
          );
          map.setView([centerLat, centerLng], initialZoom);

          // Add zoom control
          L.control.zoom({ position: 'topleft' }).addTo(map);

          // --- REFINED Manual Wraparound and Vertical Constraint Logic ---
          map.on('moveend', function () {
            const currentMapInstance = mapRef.current;
            if (!currentMapInstance) {
              logWithDebug('MoveEnd: Map instance is null, exiting.', 'warn');
              return;
            }
            // Prevent recursion if move was triggered by this handler
            if (isProgrammaticMoveRef.current) {
              logWithDebug('MoveEnd: Detected programmatic move, resetting flag and skipping handler.');
              isProgrammaticMoveRef.current = false; // Reset flag
              return;
            }

            const currentCenter = currentMapInstance.getCenter();
            const currentZoom = currentMapInstance.getZoom(); // Get current zoom

            let needsLatClamp = false;
            let needsLngWrap = false;
            let targetLat = currentCenter.lat;
            let targetLng = currentCenter.lng;

            // 1. Check Latitude Clamping
            if (targetLat > constrainedNorthLat) {
              targetLat = constrainedNorthLat;
              needsLatClamp = true;
              logWithDebug('MoveEnd: Needs clamping to North Latitude limit.');
            } else if (targetLat < constrainedSouthLat) {
              targetLat = constrainedSouthLat;
              needsLatClamp = true;
              logWithDebug('MoveEnd: Needs clamping to South Latitude limit.');
            }

            // 2. Check Longitude Wrapping (for center reset)
            // Only wrap if lngRange is valid (avoid division by zero or issues if min/max are same)
            if (lngRange > 0 && (targetLng < minLng || targetLng > maxLng)) {
              // Normalize longitude to be within [minLng, maxLng]
              targetLng =
                ((targetLng - minLng) % lngRange + lngRange) % lngRange + minLng;
              needsLngWrap = true;
              logWithDebug(
                `MoveEnd: Needs longitude wrapping. Original: ${currentCenter.lng.toFixed(4)}, Target: ${targetLng.toFixed(4)}`,
              );
            }

            // 3. Apply update ONLY if clamping or wrapping occurred
            if (needsLatClamp || needsLngWrap) {
              isProgrammaticMoveRef.current = true; // Set flag before calling setView
              logWithDebug(
                `MoveEnd: Programmatically setting view to [${targetLat.toFixed(4)}, ${targetLng.toFixed(4)}] at zoom ${currentZoom}`,
              );
              currentMapInstance.setView(
                [targetLat, targetLng], // Use potentially modified lat AND lng
                currentZoom, // Use the zoom level from before correction
                { animate: false }, // No animation for immediate correction
              );
            } else {
                 logWithDebug('MoveEnd: No clamping or wrapping needed.');
            }
          });
          logWithDebug(
            'Init Timeout(0): Added REFINED moveend listener for vertical clamping and longitude center reset.',
          );

          // --- Finalize ---
          setIsInitialized(true); // Set initialized state
          logWithDebug(
            'Init Timeout(0): Map initialization complete! Notifying parent.',
          );
          onMapReady(map, L); // Call the callback prop
        } catch (error) {
          // --- Error Handling ---
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
          // Attempt to clean up partially created map
          if (mapRef.current) {
            try {
              mapRef.current.remove();
            } catch (e) {
              /* ignore */
            }
          } else if (map) {
            try {
              map.remove();
            } catch (e) {
              /* ignore */
            }
          }
          mapRef.current = null;
          setIsInitialized(false); // Reset initialized state on error
        }
      }, 0); // End setTimeout
    }); // End rAF

    // --- Effect Cleanup for rAF/setTimeout ---
    return () => {
      if (initFrameRef.current !== null)
        window.cancelAnimationFrame(initFrameRef.current);
      if (initTimeoutRef.current !== null)
        clearTimeout(initTimeoutRef.current);
      initFrameRef.current = null;
      initTimeoutRef.current = null;
    };
  }, [
    // Dependencies for the initialization effect
    scriptLoaded,
    mapContainerReady,
    mapConfig,
    onMapReady,
    isInitialized,
    externalMapContainerRef,
    // logWithDebug removed as dependency (relies on stable setDebugInfo)
  ]);

  // 4. Effect for cleanup (Unmount)
  useEffect(() => {
    const mapInstance = mapRef.current; // Capture instance at effect setup
    return () => {
      logWithDebug('LeafletLoader unmounting. Running final cleanup...');
      cleanupInitiatedRef.current = true; // Set cleanup flag

      // Clear any pending timers/frames from initialization
      if (initFrameRef.current !== null)
        window.cancelAnimationFrame(initFrameRef.current);
      if (initTimeoutRef.current !== null)
        clearTimeout(initTimeoutRef.current);
      if (checkIntervalRef.current !== null)
        clearInterval(checkIntervalRef.current);
      if (failsafeTimeoutRef.current !== null)
        clearTimeout(failsafeTimeoutRef.current);
      initFrameRef.current = null;
      initTimeoutRef.current = null;
      checkIntervalRef.current = null;
      failsafeTimeoutRef.current = null;
      isProgrammaticMoveRef.current = false; // Reset flag on unmount

      // Remove map instance and its listeners
      if (mapInstance && mapInstance instanceof L.Map) {
        logWithDebug('Unmount Cleanup: Removing map instance and listeners.');
        try {
          // Remove specific listeners added
          mapInstance.off('moveend'); // Remove the wraparound/clamp listener
          mapInstance.remove(); // This should remove all internal listeners and the container
        } catch (e) {
          logWithDebug(
            `Unmount Cleanup: Error removing map/listeners: ${e}`,
            'error',
          );
        }
      } else {
        logWithDebug('Unmount Cleanup: No valid map instance found to remove.');
      }
      mapRef.current = null; // Clear map ref
      // Reset state flags
      setIsInitialized(false);
      setMapContainerReady(false);
      // Note: scriptLoaded state persists across unmounts if Leaflet stays loaded globally
    };
  }, []); // Empty dependency array ensures this runs only once on unmount

  // --- Render ---
  return (
    <>
      {/* Debug Component - Optional */}
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
          strategy="afterInteractive" // Load after page becomes interactive
          onLoad={() => {
            logWithDebug('Leaflet script loaded successfully via Next/Script.');
            // Use timeout to ensure window.L is available after script exec
            setTimeout(() => {
              if (window.L) {
                logWithDebug('window.L confirmed after script load.');
                setScriptLoaded(true);
              } else {
                // Fallback check if window.L isn't immediately available
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
                // Timeout for the fallback check
                setTimeout(() => {
                  clearInterval(checkL);
                  if (!window.L)
                    logWithDebug('window.L check timed out after 5s', 'error');
                }, 5000);
              }
            }, 50); // 50ms delay
          }}
          onError={(e) =>
            logWithDebug(`Leaflet script load ERROR: ${e}`, 'error')
          }
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
            zIndex: 500, // Ensure visible
            padding: '10px 15px',
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: 'white',
            borderRadius: '4px',
            textAlign: 'center',
            fontSize: '12px',
            pointerEvents: 'none', // Don't block map interaction if somehow visible later
          }}
        >
          {/* Show appropriate loading message */}
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
