// src/components/MapComponent.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import L, { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css'; // Import leaflet-draw CSS

import { MapConfig, SvgPoint, SVGLayer, MapBounds } from '@/types';
import {
  defaultMapConfig,
  primeMeridianRef as defaultPrimeMeridianRef,
} from '@/lib/MapConfig'; // Corrected import name
import { latLngToSvg } from '@/lib/coordinates-system';
import { parseSVGLayers } from '@/lib/SVGLayerParser';
import { initToasts, showToast } from '@/lib/Toast';
import dynamic from 'next/dynamic';

// Import child components using dynamic import for code splitting and SSR safety
const GridComponent = dynamic(() => import('./GridComponent'), { ssr: false });
const CountryLabelsComponent = dynamic(
  () => import('./CountryLabelsComponent'),
  {
    ssr: false,
  },
);
const ControlPanel = dynamic(() => import('./ControlPanel'), { ssr: false });
const MapScale = dynamic(() => import('./MapScale'), { ssr: false });
const DistanceMeasurement = dynamic(() => import('./DistanceMeasurement'), {
  ssr: false,
});
const SvgLayerManager = dynamic(() => import('./SvgLayerManager'), {
  ssr: false,
});
// Ensure LeafletLoader is imported correctly
const LeafletLoader = dynamic(() => import('./LeafletLoader'), { ssr: false });

interface MapProps {
  mapConfig?: Partial<MapConfig>;
}

const MapComponent: React.FC<MapProps> = ({ mapConfig: configOverrides }) => {
  // --- Core State ---
  const [mapConfig, setMapConfig] = useState<MapConfig>(() => {
    const overrides = configOverrides || {};
    let initialBounds: MapBounds;

    // --- Step 1: Determine the correct bounds object ---
    if (
      overrides.bounds &&
      typeof overrides.bounds.north === 'number' &&
      typeof overrides.bounds.south === 'number' &&
      typeof overrides.bounds.east === 'number' &&
      typeof overrides.bounds.west === 'number'
    ) {
      initialBounds = overrides.bounds;
      console.log('Using bounds from configOverrides:', initialBounds);
    } else {
      if (overrides.bounds) {
        console.warn(
          'MapComponent: Invalid bounds format in configOverrides. Using default bounds.',
        );
      }
      if (
        defaultMapConfig.bounds &&
        typeof defaultMapConfig.bounds.north === 'number'
      ) {
        initialBounds = defaultMapConfig.bounds;
        console.log('Using default bounds:', initialBounds);
      } else {
        console.error(
          'MapComponent: CRITICAL - Default bounds are invalid or missing! Using hardcoded fallback.',
        );
        // Fallback geographic bounds if default is bad - adjust if needed
        initialBounds = { north: 0, south: 4900, east: 8200, west: 0 };
      }
    }

    // --- Step 2: Create the final config object ---
    const finalConfig: MapConfig = {
      ...defaultMapConfig,
      ...overrides,
      bounds: initialBounds,
      // Explicitly add primeMeridianRef, allowing overrides
      primeMeridianRef: overrides.primeMeridianRef ?? defaultPrimeMeridianRef,
    };

    // --- Step 3: Apply other defaults/checks ---
    if (finalConfig.minZoom === undefined) {
      finalConfig.minZoom = defaultMapConfig.minZoom ?? 0;
    }
    if (finalConfig.maxZoom === undefined) {
      finalConfig.maxZoom = defaultMapConfig.maxZoom ?? 4;
    }
    if (!finalConfig.baseMapUrl && !finalConfig.masterMapPath) {
      console.error(
        'MapComponent: No map URL defined (baseMapUrl or masterMapPath)! Map may not display.',
      );
    }
    // Ensure kmPerPixel is calculated if only milesPerPixel is provided
    if (finalConfig.milesPerPixel && !finalConfig.kmPerPixel) {
      if (typeof defaultMapConfig.kmPerPixel === 'number') {
        finalConfig.kmPerPixel = defaultMapConfig.kmPerPixel;
      } else if (typeof finalConfig.milesPerPixel === 'number') {
        // Ensure MILES_TO_KM is defined or provide a fallback
        const MILES_TO_KM = 1.60934; // Standard conversion factor
        finalConfig.kmPerPixel = finalConfig.milesPerPixel * MILES_TO_KM;
        console.warn(
          `Calculated kmPerPixel (${finalConfig.kmPerPixel}) from milesPerPixel (${finalConfig.milesPerPixel}). Ensure MILES_TO_KM constant is accurate.`,
        );
      }
    }

    console.log('Final computed mapConfig:', finalConfig);
    return finalConfig;
  });

  const [map, setMap] = useState<LeafletMap | null>(null);
  const [leaflet, setLeaflet] = useState<typeof L | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [primeMeridianSvg, setPrimeMeridianSvg] = useState<SvgPoint | null>(
    null,
  );
  const leafletDrawLoadedRef = useRef(false);

  // --- SVG Layer State ---
  const [svgLayers, setSvgLayers] = useState<Record<string, SVGLayer>>({});
  const [layerVisibility, setLayerVisibility] = useState<
    Record<string, boolean>
  >(mapConfig.initialLayerVisibility || {});
  const [isLoadingSvg, setIsLoadingSvg] = useState(false);
  const [svgError, setSvgError] = useState<string | null>(null);

  // --- Display Toggle State ---
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showCountryLabels, setShowCountryLabels] = useState<boolean>(
    mapConfig.showCountryLabels ?? true,
  );
  const [showPrimeMeridian, setShowPrimeMeridian] = useState<boolean>(true);
  const [showPositionDisplay, setShowPositionDisplay] = useState<boolean>(true);

  // --- Debug State ---
  const [debugMessages, setDebugMessages] = useState<string[]>([]);

  // --- Ref for the main map container ---
  const mapContainerRef = useRef<HTMLDivElement>(null); // <<< DEFINED REF

  // --- Callbacks and Effects ---
  const addDebugMessage = useCallback(
    (message: string, type: 'info' | 'warn' | 'error' = 'info') => {
      console[type](`[MapComponent] ${message}`); // Add prefix for clarity
      setDebugMessages((prev) => [
        `[${new Date().toLocaleTimeString()}] [${type.toUpperCase()}] ${message}`,
        ...prev.slice(0, 49), // Keep last 50 messages
      ]);
    },
    [],
  );

  // --- Initial Config Logging ---
  useEffect(() => {
    addDebugMessage(
      `Initializing MapComponent with bounds: N:${mapConfig.bounds.north}, S:${mapConfig.bounds.south}, E:${mapConfig.bounds.east}, W:${mapConfig.bounds.west}`,
    );
    addDebugMessage(
      `Map URLs - Base: ${mapConfig.baseMapUrl}, Master: ${mapConfig.masterMapPath}`,
    );
    addDebugMessage(
      `Prime Meridian Ref LatLng: ${JSON.stringify(mapConfig.primeMeridianRef)}`,
    );
    if (!mapConfig.baseMapUrl && !mapConfig.masterMapPath) {
      addDebugMessage(
        'CRITICAL: No map URL defined (baseMapUrl or masterMapPath)',
        'error',
      );
    }
    if (!mapConfig.bounds) {
      addDebugMessage('CRITICAL: No bounds defined in mapConfig', 'error');
    }
    if (!mapConfig.primeMeridianRef) {
      addDebugMessage(
        'CRITICAL: primeMeridianRef is missing from final mapConfig',
        'error',
      );
    }
    // Log container dimensions on mount/update for debugging
    if (mapContainerRef.current) {
       addDebugMessage(`Map container initial dimensions: W=${mapContainerRef.current.clientWidth}, H=${mapContainerRef.current.clientHeight}`);
    } else {
       addDebugMessage(`Map container ref not yet available on initial log.`);
    }
  }, [mapConfig, addDebugMessage]); // Only run when mapConfig changes

  // --- Map Initialization Callback ---
  const handleMapReady = useCallback(
    async (mapInstance: LeafletMap, LInstance: typeof L) => {
      addDebugMessage('handleMapReady called. Setting map and leaflet instances...');
      setMap(mapInstance);
      setLeaflet(LInstance);
      setIsMapReady(true); // Set ready state *after* setting map/leaflet

      // Load leaflet-draw dynamically only once
      if (!leafletDrawLoadedRef.current) {
        try {
          addDebugMessage('Dynamically importing leaflet-draw...');
          await import('leaflet-draw');
          leafletDrawLoadedRef.current = true;
          addDebugMessage('leaflet-draw imported successfully.');
        } catch (error) {
          addDebugMessage(`Failed to import leaflet-draw: ${error}`, 'error');
          if (typeof showToast === 'function') {
            showToast('Failed to load drawing tools.', 'error');
          }
        }
      }

      // Initialize toasts if available
      if (typeof initToasts === 'function') {
        try {
          initToasts();
          addDebugMessage('Toast notifications initialized');
        } catch (e) {
          addDebugMessage(`Toast initialization failed: ${e}`, 'warn');
        }
      }

      // Calculate Prime Meridian SVG origin
      try {
        const refLat = mapConfig.primeMeridianRef?.lat;
        const refLng = mapConfig.primeMeridianRef?.lng;

        if (refLat !== undefined && refLng !== undefined) {
          const pmSvgOrigin = latLngToSvg(refLat, refLng, mapConfig);
          if (
            pmSvgOrigin &&
            typeof pmSvgOrigin.x === 'number' &&
            typeof pmSvgOrigin.y === 'number'
          ) {
            setPrimeMeridianSvg(pmSvgOrigin);
            addDebugMessage(
              `Prime meridian SVG origin calculated: ${JSON.stringify(
                pmSvgOrigin,
              )} based on Ref Lat: ${refLat}, Ref Lng: ${refLng}`,
            );
          } else {
            throw new Error(
              'latLngToSvg returned invalid result for Prime Meridian',
            );
          }
        } else {
          addDebugMessage(
            'Prime meridian reference (primeMeridianRef) lat/lng is undefined in mapConfig. Cannot calculate PM origin.',
            'warn',
          );
          setPrimeMeridianSvg(null);
        }
      } catch (error) {
        addDebugMessage(
          `Error calculating prime meridian SVG origin: ${error}`,
          'error',
        );
        setPrimeMeridianSvg(null);
        if (typeof showToast === 'function') {
          showToast('Error initializing map projection.', 'error');
        }
      }

      if (typeof showToast === 'function') {
        showToast('Map initialized successfully!', 'success', 3000);
      }
    },
    [mapConfig, addDebugMessage], // Dependencies for the callback
  );

  // --- Fetch and Parse SVG ---
  useEffect(() => {
    const fetchAndParseSVG = async () => {
      // Ensure map is ready and we have a path
      if (!isMapReady || !mapConfig.masterMapPath) {
        addDebugMessage(
          `Skipping SVG fetch - Map Ready: ${isMapReady}, Path: ${!!mapConfig.masterMapPath}`,
        );
        return;
      }

      setIsLoadingSvg(true);
      setSvgError(null);
      addDebugMessage(`Fetching SVG: ${mapConfig.masterMapPath}`);

      try {
        const response = await fetch(mapConfig.masterMapPath);
        if (!response.ok) {
          throw new Error(
            `Failed to load SVG: ${response.status} ${response.statusText}`,
          );
        }
        const svgContent = await response.text();
        addDebugMessage('SVG content received, parsing layers...');

        const parsedLayers = await parseSVGLayers(svgContent);
        addDebugMessage(
          `Parsed SVG layers: ${Object.keys(parsedLayers).length} layers found.`,
        );
        setSvgLayers(parsedLayers);

        // Initialize visibility based on config and parsed layers
        setLayerVisibility((prevVisibility) => {
          const initialVisibility = mapConfig.initialLayerVisibility || {};
          const newVisibility: Record<string, boolean> = {};
          Object.keys(parsedLayers).forEach((id) => {
            // Default to false if not specified in initial config
            newVisibility[id] = initialVisibility[id] ?? false;
          });
          // Special handling for linked layers (e.g., political/altitude)
          if (
            parsedLayers['altitude-layers'] &&
            newVisibility['political'] !== undefined
          ) {
            // If political is initially true, altitude should be false, and vice-versa
            newVisibility['altitude-layers'] = !newVisibility['political'];
          }
          addDebugMessage(
            `Initial layer visibility set: ${JSON.stringify(newVisibility)}`,
          );
          return newVisibility;
        });

        if (typeof showToast === 'function') {
          showToast('SVG layers parsed successfully', 'success');
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Unknown error loading SVG';
        addDebugMessage(`Error fetching or parsing SVG: ${errorMsg}`, 'error');
        setSvgError(errorMsg);
        if (typeof showToast === 'function') {
          showToast(`Error loading SVG: ${errorMsg}`, 'error');
        }
      } finally {
        setIsLoadingSvg(false);
      }
    };

    // Trigger fetch only when map is ready and path exists
    fetchAndParseSVG();
  }, [
    isMapReady, // Re-run if map readiness changes
    mapConfig.masterMapPath, // Re-run if the path changes
    mapConfig.initialLayerVisibility, // Re-run if initial visibility config changes
    addDebugMessage, // Dependency for logging
  ]);

  // --- Toggle Handlers ---
  const handleToggleGrid = (visible: boolean) => setShowGrid(visible);
  const handleToggleCountryLabels = (visible: boolean) =>
    setShowCountryLabels(visible);
  const handleTogglePrimeMeridian = (visible: boolean) =>
    setShowPrimeMeridian(visible);
  const handleTogglePosition = (visible: boolean) =>
    setShowPositionDisplay(visible);

  const handleToggleLayer = useCallback(
    (layerId: string, isVisible: boolean) => {
      setLayerVisibility((prev) => {
        const newState = { ...prev, [layerId]: isVisible };
        // Handle linked visibility (political vs altitude)
        if (
          layerId === 'political' &&
          newState['altitude-layers'] !== undefined
        ) {
          newState['altitude-layers'] = !isVisible; // Altitude is opposite of political
          addDebugMessage(
            `Political toggled to ${isVisible}, setting altitude-layers to ${!isVisible}`,
          );
        } else if (
          layerId === 'altitude-layers' &&
          newState['political'] !== undefined
        ) {
          // If altitude is turned on, ensure political is off
          if (isVisible) {
            newState['political'] = false;
            addDebugMessage(
              `Altitude toggled to ${isVisible}, setting political to false`,
            );
          }
          // Note: If altitude is turned *off*, we don't automatically turn political *on*.
        }
        return newState;
      });
      addDebugMessage(`Toggled layer ${layerId} visibility to ${isVisible}`);
    },
    [addDebugMessage],
  );

  // --- Render ---
  return (
    // Use the ref on the main container div
    <div
      ref={mapContainerRef} // <<< ASSIGN REF HERE
      id="map-container"
      style={{
        width: '100%',
        // ***** USE FIXED HEIGHT FOR TESTING *****
       // height: '600px', // Use a fixed pixel height for testing
        height: '100vh', // Original line - comment out or remove
        // ***************************************
        backgroundColor: '#D5FFFF', // Example background
        position: 'relative', // Needed for absolute positioning of children
        overflow: 'hidden', // Prevent scrollbars on the container itself
        border: '3px solid red', // Make border more prominent for visual debugging
      }}
    >
      {/* Debug Panel (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <div
          id="map-debug-panel"
          style={{
            position: 'absolute',
            left: '10px',
            top: '10px',
            padding: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            border: '1px solid #ccc',
            borderRadius: '4px',
            maxWidth: '400px',
            maxHeight: '250px',
            overflowY: 'auto',
            zIndex: 1500,
            fontSize: '11px',
            fontFamily: 'monospace',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          }}
        >
          <h4 style={{ margin: '0 0 5px 0', fontSize: '13px' }}>
            Map Debug Info:
          </h4>
          <p style={{ margin: '2px 0' }}>
            Map Ready: {isMapReady ? '✅ Yes' : '⏳ No'}
          </p>
          <p style={{ margin: '2px 0' }}>
            SVG Loading: {isLoadingSvg ? '⏳ Yes' : '✅ No'}
          </p>
          <p style={{ margin: '2px 0' }}>
            SVG Error: {svgError ? `❌ ${svgError}` : '✅ None'}
          </p>
          <p style={{ margin: '2px 0' }}>
            SVG Layers: {Object.keys(svgLayers).length}
          </p>
          <p style={{ margin: '2px 0' }}>
            PM SVG Origin: {JSON.stringify(primeMeridianSvg)}
          </p>
          <hr style={{ margin: '5px 0' }} />
          <div>
            <h5 style={{ margin: '5px 0 2px 0' }}>Log:</h5>
            <div
              style={{ maxHeight: '100px', overflowY: 'auto', paddingRight: '5px' }}
            >
              {debugMessages.map((msg, i) => (
                <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{msg}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Leaflet Loader - Pass the container ref */}
      {/* Render LeafletLoader unconditionally, let it handle its checks */}
      <LeafletLoader
        mapConfig={mapConfig}
        onMapReady={handleMapReady}
        // Pass the ref of the div Leaflet should initialize on
        externalMapContainerRef={mapContainerRef} // <<< PASS REF AS PROP
      />

      {/* Render map elements only when map is ready */}
      {/* These elements are positioned relative to the main container */}
      {isMapReady && map && leaflet && (
        <>
          {/* SvgLayerManager, CountryLabelsComponent, GridComponent etc. */}
          {/* These components receive the 'map' instance and add layers/controls */}
          {/* Their positioning is handled by Leaflet relative to the map container */}
          <SvgLayerManager
            map={map}
            L={leaflet}
            mapConfig={mapConfig}
            layers={svgLayers}
            visibility={layerVisibility}
            isLoading={isLoadingSvg}
            error={svgError}
          />
          <CountryLabelsComponent
            map={map}
            L={leaflet}
            visible={showCountryLabels}
            mapConfig={mapConfig}
          />
          <GridComponent
            map={map}
            L={leaflet}
            mapConfig={mapConfig}
            primeMeridianSvg={primeMeridianSvg}
            showGrid={showGrid}
            showPrimeMeridian={showPrimeMeridian}
            showPositionDisplay={showPositionDisplay}
          />
          <ControlPanel
            map={map}
            L={leaflet}
            showGrid={showGrid}
            showCountryLabels={showCountryLabels}
            showPrimeMeridian={showPrimeMeridian}
            showPosition={showPositionDisplay}
            onToggleGrid={handleToggleGrid}
            onToggleCountryLabels={handleToggleCountryLabels}
            onTogglePrimeMeridian={handleTogglePrimeMeridian}
            onTogglePosition={handleTogglePosition}
            layers={svgLayers}
            layerVisibility={layerVisibility}
            onToggleLayer={handleToggleLayer}
            isLoadingLayers={isLoadingSvg}
            layerError={svgError}
          />
          <MapScale map={map} L={leaflet} mapConfig={mapConfig} />
          {/* Conditionally render DistanceMeasurement only after leaflet-draw is loaded */}
          {leafletDrawLoadedRef.current && (
            <DistanceMeasurement map={map} L={leaflet} mapConfig={mapConfig} />
          )}
        </>
      )}

      {/* Loading Indicator for SVG */}
      {isLoadingSvg && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '10px 20px',
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            borderRadius: '5px',
            zIndex: 1001, // Above map layers but below debug/controls
            textAlign: 'center',
          }}
        >
          Loading Map Layers...
        </div>
      )}

      {/* Error Indicator for SVG */}
      {svgError && !isLoadingSvg && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            padding: '10px',
            background: 'rgba(255, 0, 0, 0.8)',
            color: 'white',
            borderRadius: '5px',
            zIndex: 1001,
            maxWidth: 'calc(100% - 20px)', // Prevent overflow on small screens
          }}
        >
          Error loading SVG layers: {svgError}
        </div>
      )}
    </div>
  );
};

export default MapComponent;
