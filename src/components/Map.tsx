// src/components/MapComponent.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import L, { Map as LeafletMap, LatLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';

import {
  MapConfig,
  SvgPoint,
  SVGLayer,
  MapBounds,
} from '@/types';
// Import the primeMeridianRef constant along with the default config
import { defaultMapConfig, primeMeridianRef as defaultPrimeMeridianRef } from '@/lib/MapConfig';
import { latLngToSvg } from '@/lib/coordinates-system';
import { parseSVGLayers } from '@/lib/SVGLayerParser';
import { initToasts, showToast } from '@/lib/Toast';
import dynamic from 'next/dynamic';

// Import child components
const GridComponent = dynamic(() => import('./GridComponent'), { ssr: false });
const CountryLabelsComponent = dynamic(() => import('./CountryLabelsComponent'), {
  ssr: false,
});
const ControlPanel = dynamic(() => import('./ControlPanel'), { ssr: false });
const MapScale = dynamic(() => import('./MapScale'), { ssr: false });
const DistanceMeasurement = dynamic(() => import('./DistanceMeasurement'), {
  ssr: false,
});
const SvgLayerManager = dynamic(() => import('./SvgLayerManager'), {
  ssr: false,
});
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
    // (Bounds logic remains the same)
    if (overrides.bounds) {
      if (
        typeof overrides.bounds.north === 'number' &&
        typeof overrides.bounds.south === 'number' &&
        typeof overrides.bounds.east === 'number' &&
        typeof overrides.bounds.west === 'number'
      ) {
        initialBounds = overrides.bounds;
        console.log('Using bounds from configOverrides:', initialBounds);
      } else {
        console.warn(
          'MapComponent: Invalid bounds format in configOverrides. Using default bounds.',
        );
        if (
          defaultMapConfig.bounds &&
          typeof defaultMapConfig.bounds.north === 'number'
        ) {
          initialBounds = defaultMapConfig.bounds;
        } else {
          console.error(
            'MapComponent: CRITICAL - Default bounds are invalid or missing! Using hardcoded fallback.',
          );
          initialBounds = { north: 85, south: -85, east: 180, west: -180 }; // Fallback geographic bounds if default is bad
        }
      }
    } else if (
      defaultMapConfig.bounds &&
      typeof defaultMapConfig.bounds.north === 'number'
    ) {
      initialBounds = defaultMapConfig.bounds;
      console.log('Using default bounds:', initialBounds);
    } else {
      console.error(
        'MapComponent: CRITICAL - No valid bounds defined in configOverrides or defaultMapConfig! Using hardcoded fallback.',
      );
      initialBounds = { north: 85, south: -85, east: 180, west: -180 }; // Fallback geographic bounds
    }


    // --- Step 2: Create the final config object ---
    const finalConfig: MapConfig = {
      ...defaultMapConfig,
      ...overrides,
      bounds: initialBounds,
      // *** FIX: Explicitly add primeMeridianRef, allowing overrides ***
      primeMeridianRef: overrides.primeMeridianRef ?? defaultPrimeMeridianRef,
    };

    // --- Step 3: Apply other defaults/checks ---
    // (Remaining logic remains the same)
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
    if (finalConfig.milesPerPixel && !finalConfig.kmPerPixel) {
      if (typeof defaultMapConfig.kmPerPixel === 'number') {
         finalConfig.kmPerPixel = defaultMapConfig.kmPerPixel;
      } else {
         finalConfig.kmPerPixel = finalConfig.milesPerPixel * 1.60934;
      }
    }

    console.log('Final computed mapConfig:', finalConfig);
    return finalConfig;
  });

  // (Rest of the MapComponent remains the same...)
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
  const addDebugMessage = useCallback(
    (message: string, type: 'info' | 'warn' | 'error' = 'info') => {
      console[type](message);
      setDebugMessages((prev) => [...prev, `[${type}] ${message}`]);
    },
    [],
  );

  // --- Initial Config Logging ---
  useEffect(() => {
    console.log('MapComponent initialized with config:', mapConfig);
    addDebugMessage(
      `Initializing MapComponent with bounds: N:${mapConfig.bounds.north}, S:${mapConfig.bounds.south}, E:${mapConfig.bounds.east}, W:${mapConfig.bounds.west}`,
    );
    addDebugMessage(
      `Map URLs - Base: ${mapConfig.baseMapUrl}, Master: ${mapConfig.masterMapPath}`,
    );
    // *** FIX: Check for primeMeridianRef in logging ***
    addDebugMessage(
        `Prime Meridian Ref LatLng: ${JSON.stringify(mapConfig.primeMeridianRef)}`
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
    // *** FIX: Check if primeMeridianRef is actually missing after merge ***
    if (!mapConfig.primeMeridianRef) {
        addDebugMessage('CRITICAL: primeMeridianRef is missing from final mapConfig', 'error');
    }
  }, [mapConfig, addDebugMessage]);

  // --- Map Initialization Callback ---
  const handleMapReady = useCallback(
    async (mapInstance: LeafletMap, LInstance: typeof L) => {
      console.log('Map is ready!', mapInstance, LInstance);
      addDebugMessage('Map is ready! Setting instances...');
      setMap(mapInstance);
      setLeaflet(LInstance);
      setIsMapReady(true);

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

      if (typeof initToasts === 'function') {
        try {
          initToasts();
          addDebugMessage('Toast notifications initialized');
        } catch (e) {
          addDebugMessage(`Toast initialization failed: ${e}`, 'warn');
        }
      }

      // Calculate PM SVG origin using the reference LatLng from config
      try {
        // *** FIX: Access primeMeridianRef directly (it should exist now) ***
        const refLat = mapConfig.primeMeridianRef?.lat;
        const refLng = mapConfig.primeMeridianRef?.lng;

        if (refLat !== undefined && refLng !== undefined) {
          // *** Ensure latLngToSvg is robust against potential errors ***
          const pmSvgOrigin = latLngToSvg(refLat, refLng, mapConfig);
          if (pmSvgOrigin && typeof pmSvgOrigin.x === 'number' && typeof pmSvgOrigin.y === 'number') {
              setPrimeMeridianSvg(pmSvgOrigin);
              addDebugMessage(
                `Prime meridian SVG origin calculated: ${JSON.stringify(
                  pmSvgOrigin,
                )} based on Ref Lat: ${refLat}, Ref Lng: ${refLng}`,
              );
          } else {
              throw new Error('latLngToSvg returned invalid result for Prime Meridian');
          }
        } else {
          // This warning should ideally not appear now if default is set
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
    [mapConfig, addDebugMessage], // mapConfig is a dependency
  );

  // (SVG Fetching, Toggles, Render logic remains the same...)
  // --- Fetch and Parse SVG ---
  useEffect(() => {
    const fetchAndParseSVG = async () => {
      if (!mapConfig.masterMapPath || !isMapReady) {
        addDebugMessage(
          `Skipping SVG fetch - ${!mapConfig.masterMapPath ? 'No masterMapPath' : 'Map not ready'}`,
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
          `Parsed SVG layers: ${Object.keys(parsedLayers).join(', ')}`,
        );
        setSvgLayers(parsedLayers);

        // Initialize visibility based on config and parsed layers
        setLayerVisibility((prevVisibility) => {
          const initialVisibility = mapConfig.initialLayerVisibility || {};
          const newVisibility: Record<string, boolean> = {};
          Object.keys(parsedLayers).forEach((id) => {
            newVisibility[id] = initialVisibility[id] ?? false;
          });
          if (
            parsedLayers['altitude-layers'] &&
            newVisibility['political'] !== undefined
          ) {
            newVisibility['altitude-layers'] = !newVisibility['political'];
          }
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

    if (isMapReady) {
      fetchAndParseSVG();
    }
  }, [
    mapConfig.masterMapPath,
    mapConfig.initialLayerVisibility,
    isMapReady,
    addDebugMessage,
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
        if (
          layerId === 'political' &&
          newState['altitude-layers'] !== undefined
        ) {
          newState['altitude-layers'] = !isVisible;
          addDebugMessage(
            `Political toggled to ${isVisible}, setting altitude-layers to ${!isVisible}`,
          );
        } else if (
          layerId === 'altitude-layers' &&
          newState['political'] !== undefined
        ) {
          if (isVisible) {
            newState['political'] = false;
            addDebugMessage(
              `Altitude toggled to ${isVisible}, setting political to false`,
            );
          }
        }
        return newState;
      });
      addDebugMessage(`Toggled layer ${layerId} to ${isVisible}`);
    },
    [addDebugMessage],
  );

  // --- Render ---
  return (
    <div
      id="map-container"
      style={{
        width: '100%',
        height: '100vh',
        backgroundColor: '#D5FFFF',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Debug Panel */}
      {process.env.NODE_ENV === 'development' && (
        <div
          id="map-debug-panel"
          style={{
            position: 'absolute',
            left: '10px',
            top: '10px',
            padding: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            border: '1px solid #ccc',
            borderRadius: '4px',
            maxWidth: '400px',
            maxHeight: '200px',
            overflowY: 'auto',
            zIndex: 1500,
            fontSize: '12px',
            fontFamily: 'monospace',
          }}
        >
          <h4 style={{ margin: '0 0 5px 0' }}>Map Debug Info:</h4>
          <p>Map Ready: {isMapReady ? 'Yes' : 'No'}</p>
          <p>SVG Loading: {isLoadingSvg ? 'Yes' : 'No'}</p>
          <p>SVG Error: {svgError || 'None'}</p>
          <p>SVG Layers: {Object.keys(svgLayers).length}</p>
          <p>PM SVG Origin: {JSON.stringify(primeMeridianSvg)}</p>
          <div>
            <h5 style={{ margin: '5px 0' }}>Log:</h5>
            <ul style={{ margin: 0, padding: '0 0 0 20px', listStyle: 'none' }}>
              {debugMessages.slice(-5).map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <LeafletLoader mapConfig={mapConfig} onMapReady={handleMapReady} />

      {isMapReady && map && leaflet && (
        <>
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
          {leafletDrawLoadedRef.current && (
            <DistanceMeasurement map={map} L={leaflet} mapConfig={mapConfig} />
          )}
        </>
      )}

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
            zIndex: 1001,
          }}
        >
          Loading Map Layers...
        </div>
      )}

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
          }}
        >
          Error loading SVG layers: {svgError}
        </div>
      )}
    </div>
  );
};

export default MapComponent;
