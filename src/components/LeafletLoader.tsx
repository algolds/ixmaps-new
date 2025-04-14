// src/components/LeafletLoader.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { MapConfig } from '@/types'; // Ensure this path is correct
import L from 'leaflet';
import LeafletDebugDisplay from './LeafletDebugDisplay'; // Import the debug component
// Import the coordinate conversion function - needed for bounds/center
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
  const initFrameRef = useRef<number | null>(null);
  const initTimeoutRef = useRef<number | null>(null);
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
          (mapConfig[param] as number) <= 0
        ) {
          logWithDebug(
            `CRITICAL ERROR: mapConfig.${param} missing or invalid.`,
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
        `Map config validated: pxPerLon=${mapConfig.pixelsPerLongitude}, pxPerLat=${mapConfig.pixelsPerLatitude}, eqY=${mapConfig.equatorY}, pmX=${mapConfig.primeMeridianX}, svgW=${mapConfig.svgWidth}, svgH=${mapConfig.svgHeight}, refLng=${mapConfig.primeMeridianReferenceLng ?? 'default'}`,
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
      }
      if (failsafeTimeoutRef.current !== null) {
        clearTimeout(failsafeTimeoutRef.current);
        failsafeTimeoutRef.current = null;
      }
    };
    const checkMapContainer = () => {
      const mapContainer = externalMapContainerRef.current;
      if (!mapContainer) return false;
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
    if (checkMapContainer()) return;
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
            'CRITICAL: Ensure the PARENT component provides a valid container with height!',
            'error',
          );
        }
      }
      if (checkIntervalRef.current !== null) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    }, 8000);
    return () => clearTimers();
  }, [externalMapContainerRef]);

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

    // --- Use rAF -> setTimeout(0) ---
    initFrameRef.current = window.requestAnimationFrame(() => {
      initFrameRef.current = null;

      initTimeoutRef.current = window.setTimeout(() => {
        initTimeoutRef.current = null;

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

        // --- Final Container Check ---
        if (
          !mapContainerElement ||
          !document.body.contains(mapContainerElement)
        ) {
          logWithDebug(
            `Init Timeout(0) CRITICAL FAIL: External map container element invalid or detached.`,
            'error',
          );
          return;
        }
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

          // --- *** CRITICAL: Determine Reference Longitude Offset *** ---
          // This MUST match the offset used in your svgToLatLng function.
          // Defaulting to 30 if not specified, adjust if your default is 0 or other.
          const referenceLngOffset = mapConfig.primeMeridianReferenceLng ?? 30;
          logWithDebug(
            `Using referenceLngOffset: ${referenceLngOffset} (from mapConfig: ${mapConfig.primeMeridianReferenceLng})`,
            'info',
          );
          // --- ****************************************************** ---

          // Transformation parameters derived from latLngToSvg:
          // svgX = pmX + (lng - refLngOffset) * pxPerLng
          // svgY = eqY - lat * pxPerLat
          // Leaflet: x = a*lng + b, y = c*lat + d
          const a = pixelsPerLongitude;
          // *** THIS IS THE CORRECTED CALCULATION FOR 'b' ***
          const b = primeMeridianX - referenceLngOffset * pixelsPerLongitude;
          const c = -pixelsPerLatitude; // Y is inverted
          const d = equatorY;

          const transformation = new L.Transformation(a, b, c, d);
          logWithDebug(
            `Init Timeout(0): ALIGNED CRS defined: a=${a.toFixed(2)}, b=${b.toFixed(2)}, c=${c.toFixed(2)}, d=${d.toFixed(2)} (using refLngOffset=${referenceLngOffset})`,
          );

          const customCRS = L.extend({}, L.CRS.Simple, {
            transformation: transformation,
            // Define project/unproject using the SAME logic and offset
            unproject: function (point: L.Point): L.LatLng {
              // Inverse of: point.x = a * lng + b
              const lng = (point.x - b) / a;
              // Inverse of: point.y = c * lat + d
              const lat = (point.y - d) / c;
              return new L.LatLng(lat, lng);
            },
            project: function (latlng: L.LatLng): L.Point {
              // Matches: svgX = a * lng + b
              const x = a * latlng.lng + b;
              // Matches: svgY = c * lat + d
              const y = c * latlng.lat + d;
              return new L.Point(x, y);
            },
            wrapLng: undefined,
            wrapLat: undefined,
            infinite: true,
          });

          // --- Calculate Geographic Bounds & Center using svgToLatLng ---
          // This implicitly uses the offset defined within svgToLatLng
          const topLeftLatLng = svgToLatLng(0, 0, mapConfig);
          const bottomRightLatLng = svgToLatLng(svgWidth, svgHeight, mapConfig);
          const imageOverlayBounds = L.latLngBounds(
            L.latLng(bottomRightLatLng.lat, topLeftLatLng.lng), // South-West
            L.latLng(topLeftLatLng.lat, bottomRightLatLng.lng), // North-East
          );
          const centerLatLng = svgToLatLng(svgWidth / 2, svgHeight / 2, mapConfig);
          logWithDebug(
            `Init Timeout(0): Calculated Geographic Bounds (via svgToLatLng): ${imageOverlayBounds.toBBoxString()}`,
          );
          logWithDebug(
            `Init Timeout(0): Calculated Geographic Center (via svgToLatLng): Lat=${centerLatLng.lat.toFixed(2)}, Lng=${centerLatLng.lng.toFixed(2)}`,
          );

          // --- Create Map Instance ---
          map = L.map(mapContainerElement!, {
            crs: customCRS,
            center: centerLatLng,
            zoom: mapConfig.initialZoom ?? mapConfig.minZoom ?? 0,
            minZoom: mapConfig.minZoom ?? 0,
            maxZoom: mapConfig.maxZoom ?? 4,
            zoomControl: false,
            attributionControl: false,
            inertia: true,
            bounceAtZoomLimits: true,
            maxBounds: undefined, // Set later
          });

          if (!map) throw new Error('L.map() failed');
          logWithDebug('Init Timeout(0): L.map() (aligned CRS) returned instance.');
          mapRef.current = map;

          // --- Configure Map ---
          logWithDebug('Init Timeout(0): Configuring map instance...');
          L.control.attribution({ position: 'bottomright', prefix: '© IxMaps v4.0.0' }).addTo(map);

          // --- Base Layer ---
          const initialMapUrl = mapConfig.lodEnabled ? mapConfig.baseMapUrl : mapConfig.masterMapPath;
          if (!initialMapUrl) throw new Error('No map URL available');
          logWithDebug(`Init Timeout(0): Adding BASE map image overlay: ${initialMapUrl}`);
          const baseLayer = L.imageOverlay(initialMapUrl, imageOverlayBounds, {
            errorOverlayUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            alt: 'Error loading base map',
            interactive: false,
          });
          baseLayer.on('error', () => logWithDebug(`Init Timeout(0): Failed to load base map: ${initialMapUrl}`, 'error'));
          baseLayer.addTo(map);

          // --- Constraints & View ---
          logWithDebug(`Init Timeout(0): Setting max bounds to image overlay bounds: ${imageOverlayBounds.toBBoxString()}`);
          map.setMaxBounds(imageOverlayBounds);
          logWithDebug('Init Timeout(0): Calling invalidateSize() AFTER setup.');
          map.invalidateSize({ animate: false, pan: false });
          L.control.zoom({ position: 'topleft' }).addTo(map);

          // --- Drag Handler ---
          map.on('drag', function () {
            if (imageOverlayBounds && imageOverlayBounds.isValid()) {
              map?.panInsideBounds(imageOverlayBounds, { animate: false });
            }
          });

          // --- Manual Wraparound Logic ---
          const westLng = imageOverlayBounds.getWest();
          const eastLng = imageOverlayBounds.getEast();
          const worldWidthLng = eastLng - westLng;
          if (worldWidthLng > 0) {
            logWithDebug(`Init Timeout(0): Adding manual wraparound listener (West: ${westLng.toFixed(2)}, East: ${eastLng.toFixed(2)}, Width: ${worldWidthLng.toFixed(2)})`);
            map.on('moveend', function () {
              if (!mapRef.current) return;
              const center = mapRef.current.getCenter();
              const currentLng = center.lng;
              if (currentLng < westLng || currentLng >= eastLng) {
                const newLng = ((currentLng - westLng) % worldWidthLng + worldWidthLng) % worldWidthLng + westLng;
                if (Math.abs(newLng - currentLng) > 1e-6) {
                  const newCenter = L.latLng(center.lat, newLng);
                  logWithDebug(`Wrapping map view from lng ${currentLng.toFixed(2)} to ${newLng.toFixed(2)}`);
                  mapRef.current.setView(newCenter, mapRef.current.getZoom(), { animate: false, noMoveStart: true });
                }
              }
            });
          } else {
            logWithDebug('Init Timeout(0): Skipping manual wraparound listener - invalid geographic world width.', 'warn');
          }

          // --- Finalize ---
          setIsInitialized(true);
          logWithDebug('Init Timeout(0): Map initialization complete! Notifying parent.');
          onMapReady(map, L);

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logWithDebug(`Init Timeout(0) ERROR during map initialization: ${errorMsg}`, 'error');
          if (error instanceof Error && error.stack) {
            console.error(error.stack);
            setDebugInfo((prev) => [`[STACK] ${error.stack}`, ...prev.slice(0, 49)]);
          }
          if (mapRef.current) { try { mapRef.current.remove(); } catch (e) { /* ignore */ } }
          else if (map) { try { map.remove(); } catch (e) { /* ignore */ } }
          mapRef.current = null;
          setIsInitialized(false);
        }
      }, 0); // End setTimeout
    }); // End rAF

    // --- Effect Cleanup ---
    return () => {
      if (initFrameRef.current !== null) window.cancelAnimationFrame(initFrameRef.current);
      if (initTimeoutRef.current !== null) clearTimeout(initTimeoutRef.current);
      initFrameRef.current = null;
      initTimeoutRef.current = null;
    };
  }, [
    scriptLoaded,
    mapContainerReady,
    mapConfig, // Keep mapConfig as dependency
    onMapReady,
    isInitialized,
    externalMapContainerRef,
    // svgToLatLng is used but doesn't need to be a dependency itself
  ]);

  // 4. Effect for cleanup (Unmount) - (remains the same)
  useEffect(() => {
    const mapInstance = mapRef.current;
    return () => {
      logWithDebug('LeafletLoader unmounting. Running final cleanup...');
      cleanupInitiatedRef.current = true;
      if (initFrameRef.current !== null) window.cancelAnimationFrame(initFrameRef.current);
      if (initTimeoutRef.current !== null) clearTimeout(initTimeoutRef.current);
      if (checkIntervalRef.current !== null) clearInterval(checkIntervalRef.current);
      if (failsafeTimeoutRef.current !== null) clearTimeout(failsafeTimeoutRef.current);
      initFrameRef.current = null;
      initTimeoutRef.current = null;
      checkIntervalRef.current = null;
      failsafeTimeoutRef.current = null;

      if (mapInstance && mapInstance instanceof L.Map) {
        logWithDebug('Unmount Cleanup: Removing map instance and listeners.');
        try {
          mapInstance.off('moveend');
          mapInstance.off('drag');
          mapInstance.remove();
        } catch (e) { logWithDebug(`Unmount Cleanup: Error removing map/listeners: ${e}`, 'error'); }
      } else {
        logWithDebug('Unmount Cleanup: No valid map instance found to remove.');
      }
      mapRef.current = null;
      setIsInitialized(false);
      setMapContainerReady(false);
    };
  }, []); // Empty dependency array

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
          strategy="afterInteractive"
          onLoad={() => {
            logWithDebug('Leaflet script loaded successfully via Next/Script.');
            setTimeout(() => { // Short delay before checking window.L
              if (window.L) {
                logWithDebug('window.L confirmed after script load.');
                setScriptLoaded(true);
              } else {
                logWithDebug('Script onLoad but window.L missing! Retrying check...', 'warn');
                const checkL = setInterval(() => {
                  if (window.L) {
                    logWithDebug('window.L available after interval check');
                    clearInterval(checkL);
                    setScriptLoaded(true);
                  }
                }, 100);
                setTimeout(() => {
                  clearInterval(checkL);
                  if (!window.L) logWithDebug('window.L check timed out after 5s', 'error');
                }, 5000);
              }
            }, 50);
          }}
          onError={(e) => logWithDebug(`Leaflet script load ERROR: ${e}`, 'error')}
        />
      )}

      {/* Global loading indicator */}
      {!isInitialized && (
        <div
          style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)', zIndex: 500,
            padding: '10px 15px', backgroundColor: 'rgba(0,0,0,0.6)',
            color: 'white', borderRadius: '4px', textAlign: 'center',
            fontSize: '12px', pointerEvents: 'none',
          }}
        >
          {!scriptLoaded ? 'Loading Leaflet...' : !mapContainerReady ? 'Waiting Container...' : 'Initializing Map...'}
        </div>
      )}
    </>
  );
};

export default LeafletLoader;
