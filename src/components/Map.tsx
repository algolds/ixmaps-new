// src/components/MapComponent.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import L, { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css'; // Base Leaflet CSS is still needed

// REMOVE static import: import 'leaflet-draw';

import { MapConfig, SvgPoint, SVGLayer } from '@/types';
import { defaultMapConfig } from '@/lib/MapConfig';
import { latLngToSvg } from '@/lib/coordinates-system';
import { parseSVGLayers } from '@/lib/SVGLayerParser';
import { initToasts, showToast } from '@/lib/Toast';
import dynamic from 'next/dynamic';

// Import child components (dynamic imports remain the same)
const GridComponent = dynamic(() => import('./GridComponent'), { ssr: false });
const CountryLabelsComponent = dynamic(() => import('./CountryLabelsComponent'), {
  ssr: false,
});
const CoordinatesComponent = dynamic(() => import('./CoordinatesComponent'), {
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
    // ... (config initialization remains the same) ...
    const config = {
      ...defaultMapConfig,
      ...(configOverrides || {}),
    };
    if (!config.bounds) {
      console.error(
        'MapComponent: No bounds defined in mapConfig! Using defaults.',
      );
      config.bounds = { north: 85, south: -85, east: 180, west: -180 };
    }
    if (config.minZoom === undefined) config.minZoom = 0;
    if (config.maxZoom === undefined) config.maxZoom = 2;
    if (!config.baseMapUrl && !config.masterMapPath) {
      console.error('MapComponent: No map URL defined! Map will not display.');
    }
    return config;
  });

  const [map, setMap] = useState<LeafletMap | null>(null);
  const [leaflet, setLeaflet] = useState<typeof L | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [primeMeridianSvg, setPrimeMeridianSvg] = useState<SvgPoint | null>(
    null,
  );
  const leafletDrawLoadedRef = useRef(false); // Ref to track leaflet-draw loading

  // --- SVG Layer State ---
  // ... (state remains the same) ...
  const [svgLayers, setSvgLayers] = useState<Record<string, SVGLayer>>({});
  const [layerVisibility, setLayerVisibility] = useState<
    Record<string, boolean>
  >(mapConfig.initialLayerVisibility || {});
  const [isLoadingSvg, setIsLoadingSvg] = useState(false);
  const [svgError, setSvgError] = useState<string | null>(null);


  // --- Display Toggle State ---
  // ... (state remains the same) ...
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showCountryLabels, setShowCountryLabels] = useState<boolean>(
    mapConfig.showCountryLabels ?? true,
  );
  const [showCoordinates, setShowCoordinates] = useState<boolean>(true);
  const [showPrimeMeridian, setShowPrimeMeridian] = useState<boolean>(true);
  const [showPositionDisplay, setShowPositionDisplay] = useState<boolean>(true);


  // --- Debug State ---
  // ... (state and function remain the same) ...
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
  const addDebugMessage = useCallback(
    (message: string, type: 'info' | 'warn' | 'error' = 'info') => {
      console[type](message);
      setDebugMessages((prev) => [...prev, `[${type}] ${message}`]);
    },
    [],
  );


  // --- Initial Config Logging ---
  // ... (effect remains the same) ...
   useEffect(() => {
    console.log('MapComponent initialized with config:', mapConfig);
    addDebugMessage(
      `Initializing MapComponent with bounds: ${JSON.stringify(mapConfig.bounds)}`,
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
  }, [mapConfig, addDebugMessage]);


  // --- Map Initialization Callback (from LeafletLoader) ---
  const handleMapReady = useCallback(
    // Make the function async
    async (mapInstance: LeafletMap, LInstance: typeof L) => {
      console.log('Map is ready!', mapInstance, LInstance);
      addDebugMessage('Map is ready! Setting instances...');
      setMap(mapInstance);
      setLeaflet(LInstance); // Store the L instance
      setIsMapReady(true); // Set map ready *before* loading draw

      // Dynamically import leaflet-draw only once after L is available
      if (!leafletDrawLoadedRef.current) {
        try {
          addDebugMessage('Dynamically importing leaflet-draw...');
          await import('leaflet-draw'); // Wait for the import
          leafletDrawLoadedRef.current = true; // Mark as loaded
          addDebugMessage('leaflet-draw imported successfully.');
          // Now LInstance should definitely have Draw controls attached
        } catch (error) {
          addDebugMessage(`Failed to import leaflet-draw: ${error}`, 'error');
          if (typeof showToast === 'function') {
            showToast('Failed to load drawing tools.', 'error');
          }
          // Handle the error appropriately - maybe disable drawing features
        }
      }

      // Initialize toasts (can happen before or after draw import)
      if (typeof initToasts === 'function') {
        try {
          initToasts();
          addDebugMessage('Toast notifications initialized');
        } catch (e) {
          addDebugMessage(`Toast initialization failed: ${e}`, 'warn');
        }
      }

      // Calculate PM origin (can happen before or after draw import)
      try {
        const pmSvgOrigin = latLngToSvg(0, 0, mapConfig);
        setPrimeMeridianSvg(pmSvgOrigin);
        addDebugMessage(
          `Prime meridian SVG origin calculated: ${JSON.stringify(pmSvgOrigin)}`,
        );
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
    [mapConfig, addDebugMessage], // addDebugMessage is stable due to useCallback
  );

  // --- Fetch and Parse SVG ---
  // ... (effect remains the same) ...
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
            newVisibility[id] = initialVisibility[id] ?? false; // Default to false if not specified
          });

          // Auto-toggle altitude based on political state (if altitude exists)
          if (parsedLayers['altitude-layers']) {
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

    // Only fetch SVG *after* the map is ready
    if (isMapReady) {
       fetchAndParseSVG();
    }
  }, [
    mapConfig.masterMapPath,
    mapConfig.initialLayerVisibility,
    isMapReady, // Re-run if map readiness changes
    addDebugMessage,
  ]);


  // --- Toggle Handlers ---
  // ... (handlers remain the same) ...
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
        backgroundColor: '#D5FFFF',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Debug Panel */}
      {/* ... (JSX remains the same) ... */}
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
            zIndex: 1500, // Ensure it's above map layers but below modals if any
            fontSize: '12px',
          }}
        >
          <h4 style={{ margin: '0 0 5px 0' }}>Map Debug Info:</h4>
          <p>Map Ready: {isMapReady ? 'Yes' : 'No'}</p>
          <p>SVG Loading: {isLoadingSvg ? 'Yes' : 'No'}</p>
          <p>SVG Error: {svgError || 'None'}</p>
          <p>SVG Layers: {Object.keys(svgLayers).length}</p>
          <div>
            <h5 style={{ margin: '5px 0' }}>Log:</h5>
            <ul style={{ margin: 0, padding: '0 0 0 20px' }}>
              {debugMessages.slice(-5).map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        </div>
      )}


      {/* Load Leaflet */}
      <LeafletLoader mapConfig={mapConfig} onMapReady={handleMapReady} />

      {/* Render map elements */}
      {/* Check leafletDrawLoadedRef.current before rendering DistanceMeasurement */}
      {isMapReady && map && leaflet && (
        <>
          {/* ... (other components: SvgLayerManager, CountryLabelsComponent, etc.) ... */}
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

          {/* Grid Component */}
          <GridComponent
            map={map}
            L={leaflet}
            visible={showGrid}
            mapConfig={mapConfig}
            primeMeridianSvg={primeMeridianSvg}
          />

          {/* Coordinates Display & PM Line */}
          <CoordinatesComponent
            map={map}
            L={leaflet}
            visible={showCoordinates}
            mapConfig={mapConfig}
            primeMeridianSvg={primeMeridianSvg}
            showPrimeMeridian={showPrimeMeridian}
            setPrimeMeridianSvg={setPrimeMeridianSvg} // Pass setter if needed
            showPositionDisplay={showPositionDisplay}
          />

          {/* Unified Control Panel */}
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

          {/* Map Scale */}
          <MapScale map={map} L={leaflet} mapConfig={mapConfig} />


          {/* Distance Measurement Tool - Conditionally render or ensure L has Draw */}
          {/* The dynamic import in handleMapReady should ensure L has Draw */}
          <DistanceMeasurement map={map} L={leaflet} mapConfig={mapConfig} />
        </>
      )}

      {/* Loading Indicator */}
      {/* ... (JSX remains the same) ... */}
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
      {/* ... (JSX remains the same) ... */}
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
