// src/components/MapComponent.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import L, { Map as LeafletMap, LatLngBounds } from 'leaflet'; // Import LatLngBounds if needed locally
import 'leaflet/dist/leaflet.css';

import {
  MapConfig,
  SvgPoint,
  SVGLayer,
  MapBounds, // Import MapBounds type
} from '@/types';
import { defaultMapConfig } from '@/lib/MapConfig';
import { latLngToSvg } from '@/lib/coordinates-system';
import { parseSVGLayers } from '@/lib/SVGLayerParser';
import { initToasts, showToast } from '@/lib/Toast';
import dynamic from 'next/dynamic';

// Import child components
const GridComponent = dynamic(() => import('./GridComponent'), { ssr: false }); // Now handles Grid, PM, Coords Display
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
    let initialBounds: MapBounds; // Variable to hold the validated bounds

    // --- Step 1: Determine the correct bounds object ---
    if (overrides.bounds) {
      // Check if the provided override bounds are in the correct {N,S,E,W} format
      if (
        typeof overrides.bounds.north === 'number' &&
        typeof overrides.bounds.south === 'number' &&
        typeof overrides.bounds.east === 'number' &&
        typeof overrides.bounds.west === 'number'
      ) {
        // Valid format, use the override bounds
        initialBounds = overrides.bounds;
        console.log('Using bounds from configOverrides:', initialBounds);
      } else {
        // Invalid format in overrides (e.g., might be LatLngBounds)
        console.warn(
          'MapComponent: Invalid bounds format in configOverrides. Using default bounds.',
        );
        // Ensure defaultMapConfig.bounds exists and is valid before assigning
        if (
          defaultMapConfig.bounds &&
          typeof defaultMapConfig.bounds.north === 'number'
        ) {
          initialBounds = defaultMapConfig.bounds;
        } else {
          console.error(
            'MapComponent: CRITICAL - Default bounds are invalid or missing! Using hardcoded fallback.',
          );
          initialBounds = { north: 85, south: -85, east: 180, west: -180 };
        }
      }
    } else if (
      defaultMapConfig.bounds &&
      typeof defaultMapConfig.bounds.north === 'number'
    ) {
      // No bounds in overrides, use the default config bounds if valid
      initialBounds = defaultMapConfig.bounds;
      console.log('Using default bounds:', initialBounds);
    } else {
      // Critical fallback: No bounds in overrides OR default config is invalid/missing
      console.error(
        'MapComponent: CRITICAL - No valid bounds defined in configOverrides or defaultMapConfig! Using hardcoded fallback.',
      );
      initialBounds = { north: 85, south: -85, east: 180, west: -180 };
    }

    // --- Step 2: Create the final config object ---
    // Start with defaults, spread overrides (excluding bounds), then set validated bounds
    const finalConfig: MapConfig = {
      ...defaultMapConfig, // Apply defaults first
      ...overrides, // Apply overrides (this might temporarily include incorrect bounds type)
      bounds: initialBounds, // **Explicitly set the validated MapBounds object**
    };

    // --- Step 3: Apply other defaults/checks ---
    if (finalConfig.minZoom === undefined) {
      finalConfig.minZoom = defaultMapConfig.minZoom ?? 0; // Use default if available
    }
    if (finalConfig.maxZoom === undefined) {
      finalConfig.maxZoom = defaultMapConfig.maxZoom ?? 4; // Use default if available
    }
    if (!finalConfig.baseMapUrl && !finalConfig.masterMapPath) {
      console.error(
        'MapComponent: No map URL defined (baseMapUrl or masterMapPath)! Map may not display.',
      );
    }
    // Ensure kmPerPixel is calculated if using the getter in defaultMapConfig
    // This might not be strictly necessary if the getter works, but ensures the value exists
    // Check if kmPerPixel is missing or potentially zero from overrides
    if (finalConfig.milesPerPixel && !finalConfig.kmPerPixel) {
      // Use the getter from defaultMapConfig if available, otherwise calculate
      if (typeof defaultMapConfig.kmPerPixel === 'number') {
         finalConfig.kmPerPixel = defaultMapConfig.kmPerPixel;
      } else {
         // Fallback calculation (ensure correct conversion factor)
         finalConfig.kmPerPixel = finalConfig.milesPerPixel * 1.60934;
      }
    }

    console.log('Final computed mapConfig:', finalConfig);
    return finalConfig; // Return the fully validated and typed config
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
  const [showGrid, setShowGrid] = useState<boolean>(true); // Controls grid lines
  const [showCountryLabels, setShowCountryLabels] = useState<boolean>(
    mapConfig.showCountryLabels ?? true,
  );
  const [showPrimeMeridian, setShowPrimeMeridian] = useState<boolean>(true); // Controls PM line visibility
  const [showPositionDisplay, setShowPositionDisplay] = useState<boolean>(true); // Controls mouse coordinate display

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
    // Log the N/S/E/W bounds directly
    addDebugMessage(
      `Initializing MapComponent with bounds: N:${mapConfig.bounds.north}, S:${mapConfig.bounds.south}, E:${mapConfig.bounds.east}, W:${mapConfig.bounds.west}`,
    );
    addDebugMessage(
      `Map URLs - Base: ${mapConfig.baseMapUrl}, Master: ${mapConfig.masterMapPath}`,
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
  }, [mapConfig, addDebugMessage]); // mapConfig dependency is correct

  // --- Map Initialization Callback ---
  const handleMapReady = useCallback(
    async (mapInstance: LeafletMap, LInstance: typeof L) => {
      console.log('Map is ready!', mapInstance, LInstance);
      addDebugMessage('Map is ready! Setting instances...');
      setMap(mapInstance);
      setLeaflet(LInstance);
      setIsMapReady(true);

      // Dynamically import leaflet-draw
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

      // Initialize toasts
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
        // Use optional chaining (?.) as primeMeridianRef is optional in the type
        const refLat = mapConfig.primeMeridianRef?.lat;
        const refLng = mapConfig.primeMeridianRef?.lng;

        if (refLat !== undefined && refLng !== undefined) {
          const pmSvgOrigin = latLngToSvg(refLat, refLng, mapConfig);
          setPrimeMeridianSvg(pmSvgOrigin);
          addDebugMessage(
            `Prime meridian SVG origin calculated: ${JSON.stringify(
              pmSvgOrigin,
            )} based on Ref Lat: ${refLat}, Ref Lng: ${refLng}`,
          );
        } else {
          // Handle case where primeMeridianRef is not defined in config
          addDebugMessage(
            'Prime meridian reference (primeMeridianRef) not found in mapConfig. Cannot calculate PM origin.',
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
            // Default to false if not specified in initial config
            newVisibility[id] = initialVisibility[id] ?? false;
          });

          // Auto-toggle altitude based on political state (if altitude exists)
          // Ensure political layer exists before trying to access its visibility
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
    mapConfig.initialLayerVisibility, // Add dependency
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
    setShowPositionDisplay(visible); // Renamed handler for clarity

  const handleToggleLayer = useCallback(
    (layerId: string, isVisible: boolean) => {
      setLayerVisibility((prev) => {
        const newState = { ...prev, [layerId]: isVisible };
        // Auto-toggle altitude layer based on political layer
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
          // If altitude is manually toggled, ensure political is off
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
        backgroundColor: '#D5FFFF', // Consider making this configurable
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

      {/* Load Leaflet and Initialize Map */}
      <LeafletLoader mapConfig={mapConfig} onMapReady={handleMapReady} />

      {/* Render map elements only when map is ready */}
      {isMapReady && map && leaflet && (
        <>
          {/* Manages SVG Overlays */}
          <SvgLayerManager
            map={map}
            L={leaflet}
            mapConfig={mapConfig}
            layers={svgLayers}
            visibility={layerVisibility}
            isLoading={isLoadingSvg}
            error={svgError}
          />

          {/* Country Labels */}
          <CountryLabelsComponent
            map={map}
            L={leaflet}
            visible={showCountryLabels}
            mapConfig={mapConfig}
          />

          {/* Grid Component (Includes PM Line and Position Display) */}
          <GridComponent
            map={map}
            L={leaflet}
            mapConfig={mapConfig}
            primeMeridianSvg={primeMeridianSvg}
            showGrid={showGrid} // Pass grid visibility
            showPrimeMeridian={showPrimeMeridian} // Pass PM visibility
            showPositionDisplay={showPositionDisplay} // Pass position display visibility
          />

          {/* Unified Control Panel */}
          <ControlPanel
            map={map}
            L={leaflet}
            showGrid={showGrid} // For Grid toggle
            showCountryLabels={showCountryLabels} // For Labels toggle
            showPrimeMeridian={showPrimeMeridian} // For PM toggle
            showPosition={showPositionDisplay} // For Position Display toggle
            onToggleGrid={handleToggleGrid}
            onToggleCountryLabels={handleToggleCountryLabels}
            onTogglePrimeMeridian={handleTogglePrimeMeridian}
            onTogglePosition={handleTogglePosition} // Use the correct handler
            layers={svgLayers}
            layerVisibility={layerVisibility}
            onToggleLayer={handleToggleLayer}
            isLoadingLayers={isLoadingSvg}
            layerError={svgError}
          />

          {/* Map Scale */}
          <MapScale map={map} L={leaflet} mapConfig={mapConfig} />

          {/* Distance Measurement Tool */}
          {/* Ensure leaflet-draw is loaded before rendering */}
          {leafletDrawLoadedRef.current && (
            <DistanceMeasurement map={map} L={leaflet} mapConfig={mapConfig} />
          )}
        </>
      )}

      {/* Loading Indicator */}
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
            zIndex: 1001, // Above map layers, below debug/controls
          }}
        >
          Loading Map Layers...
        </div>
      )}

      {/* Error message */}
      {svgError && !isLoadingSvg && ( // Show only if not loading
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
