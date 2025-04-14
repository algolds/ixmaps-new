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
} from '@/lib/MapConfig';
import { latLngToSvg } from '@/lib/coordinates-system';
import { parseSVGLayers } from '@/lib/SVGLayerParser';
import { initToasts, showToast } from '@/lib/Toast';
import dynamic from 'next/dynamic';

// --- Dynamic Imports for Components ---
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
const LeafletLoader = dynamic(() => import('./LeafletLoader'), { ssr: false });
// --- ADD AdminLabelEditor Dynamic Import ---
const AdminLabelEditor = dynamic(() => import('./AdminLabelEditor'), {
  ssr: false,
});

interface MapProps {
  mapConfig?: Partial<MapConfig>;
}

const MapComponent: React.FC<MapProps> = ({ mapConfig: configOverrides }) => {
  // --- State ---
  const [mapConfig, setMapConfig] = useState<MapConfig>(() => {
    // Combine default config with overrides
    const overrides = configOverrides || {};
    // Ensure bounds are correctly initialized
    let initialBounds: MapBounds;
    if (
      overrides.bounds &&
      typeof overrides.bounds.north === 'number' &&
      typeof overrides.bounds.south === 'number' &&
      typeof overrides.bounds.east === 'number' &&
      typeof overrides.bounds.west === 'number'
    ) {
      initialBounds = overrides.bounds;
    } else if (
      defaultMapConfig.bounds &&
      typeof defaultMapConfig.bounds.north === 'number'
    ) {
      initialBounds = defaultMapConfig.bounds;
    } else {
      console.error(
        'MapComponent: CRITICAL - Default bounds are invalid or missing! Using hardcoded fallback.',
      );
      // Use calculated bounds from the revised MapConfig if possible, otherwise fallback
      initialBounds = {
        north: 0,
        south: defaultMapConfig.svgHeight ?? 490, // Use calculated height
        east: defaultMapConfig.svgWidth ?? 820, // Use calculated width
        west: 0,
      };
    }
    // Create the final config object
    const finalConfig: MapConfig = {
      ...defaultMapConfig,
      ...overrides,
      bounds: initialBounds,
      primeMeridianRef: overrides.primeMeridianRef ?? defaultPrimeMeridianRef,
    };
    // Ensure essential zoom levels have defaults
    if (finalConfig.minZoom === undefined)
      finalConfig.minZoom = defaultMapConfig.minZoom ?? 0;
    if (finalConfig.maxZoom === undefined)
      finalConfig.maxZoom = defaultMapConfig.maxZoom ?? 4;
    // Check for map URL
    if (!finalConfig.baseMapUrl && !finalConfig.masterMapPath)
      console.error('MapComponent: No map URL defined!');
    // Ensure kmPerPixel is calculated if milesPerPixel exists
    if (finalConfig.milesPerPixel && !finalConfig.kmPerPixel) {
      const MILES_TO_KM = 1.60934;
      finalConfig.kmPerPixel = finalConfig.milesPerPixel * MILES_TO_KM;
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
  const [svgLayers, setSvgLayers] = useState<Record<string, SVGLayer>>({});
  const [layerVisibility, setLayerVisibility] = useState<
    Record<string, boolean>
  >(mapConfig.initialLayerVisibility || {});
  const [isLoadingSvg, setIsLoadingSvg] = useState(false);
  const [svgError, setSvgError] = useState<string | null>(null);
  // Display toggles state
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showCountryLabels, setShowCountryLabels] = useState<boolean>(
    mapConfig.showCountryLabels ?? true,
  );
  const [showPrimeMeridian, setShowPrimeMeridian] = useState<boolean>(true);
  const [showPositionDisplay, setShowPositionDisplay] = useState<boolean>(true);
  // --- ADD Admin Mode State ---
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);

  // --- Callbacks ---
  const addDebugMessage = useCallback(
    (message: string, type: 'info' | 'warn' | 'error' = 'info') => {
      console[type](`[MapComponent] ${message}`);
    },
    [],
  );

  const handleMapReady = useCallback(
    async (mapInstance: LeafletMap, LInstance: typeof L) => {
      addDebugMessage('handleMapReady called...');
      setMap(mapInstance);
      setLeaflet(LInstance);
      setIsMapReady(true);

      // Load leaflet-draw dynamically
      if (!leafletDrawLoadedRef.current) {
        try {
          addDebugMessage('Dynamically importing leaflet-draw...');
          await import('leaflet-draw');
          leafletDrawLoadedRef.current = true;
          addDebugMessage('leaflet-draw imported successfully.');
        } catch (error) {
          addDebugMessage(`Failed to load leaflet-draw: ${error}`, 'error');
        }
      }

      // Initialize toasts
      if (typeof initToasts === 'function') {
        initToasts();
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
              `Prime meridian SVG origin calculated: ${JSON.stringify(pmSvgOrigin)}`,
            );
          } else {
            throw new Error('latLngToSvg returned invalid result');
          }
        } else {
          addDebugMessage(
            'Prime meridian reference lat/lng missing in config.',
            'warn',
          );
        }
      } catch (error) {
        addDebugMessage(
          `Error calculating prime meridian SVG origin: ${error}`,
          'error',
        );
      }

      if (typeof showToast === 'function')
        showToast('Map initialized successfully!', 'success', 3000);
    },
    [mapConfig, addDebugMessage], // Dependencies
  );

  // --- Effects ---
  useEffect(() => {
    // Initial config logging effect
    addDebugMessage(
      `Initializing MapComponent with bounds: N:${mapConfig.bounds.north?.toFixed(2)}, S:${mapConfig.bounds.south?.toFixed(2)}, E:${mapConfig.bounds.east?.toFixed(2)}, W:${mapConfig.bounds.west?.toFixed(2)}`,
    );
    if (mapContainerRef.current) {
      addDebugMessage(
        `Map container initial dimensions: W=${mapContainerRef.current.clientWidth}, H=${mapContainerRef.current.clientHeight}`,
      );
    }
  }, [mapConfig, addDebugMessage]);

  useEffect(() => {
    // Fetch and parse SVG logic
    const fetchAndParseSVG = async () => {
      if (!isMapReady || !mapConfig.masterMapPath) {
        // Don't fetch if map isn't ready or no path is defined
        return;
      }
      setIsLoadingSvg(true);
      setSvgError(null);
      setSvgLayers({}); // Clear previous layers
      addDebugMessage(`Fetching SVG: ${mapConfig.masterMapPath}`);
      try {
        const response = await fetch(mapConfig.masterMapPath);
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const svgContent = await response.text();
        addDebugMessage('SVG content received, parsing layers...');
        const parsedLayers = await parseSVGLayers(svgContent); // Assuming this returns Record<string, SVGLayer>
        addDebugMessage(
          `Parsed SVG layers: ${Object.keys(parsedLayers).length} layers found.`,
        );
        setSvgLayers(parsedLayers);

        // Set initial visibility based on config and parsed layers
        setLayerVisibility((prevVisibility) => {
          const initialConfigVisibility = mapConfig.initialLayerVisibility || {};
          const newVisibility: Record<string, boolean> = {};
          Object.keys(parsedLayers).forEach((id) => {
            // Default to false if not specified in config
            newVisibility[id] = initialConfigVisibility[id] ?? false;
          });
          // Special handling for mutually exclusive political/altitude layers
          const hasPolitical = newVisibility['political'] !== undefined;
          const hasAltitude = newVisibility['altitude-layers'] !== undefined;
          if (hasPolitical && hasAltitude) {
            // If political is initially true, ensure altitude is false, and vice-versa
            if (newVisibility['political']) {
              newVisibility['altitude-layers'] = false;
            } else if (newVisibility['altitude-layers']) {
              newVisibility['political'] = false;
            }
          }
          addDebugMessage(
            `Initial layer visibility set: ${JSON.stringify(newVisibility)}`,
          );
          return newVisibility;
        });

        if (typeof showToast === 'function')
          showToast('SVG layers parsed successfully', 'success');
      } catch (err: any) {
        addDebugMessage(`Error fetching or parsing SVG: ${err.message}`, 'error');
        setSvgError(err.message || 'Failed to load SVG data');
        if (typeof showToast === 'function')
          showToast('Error loading SVG layers', 'error');
      } finally {
        setIsLoadingSvg(false);
      }
    };
    fetchAndParseSVG();
  }, [isMapReady, mapConfig.masterMapPath, mapConfig.initialLayerVisibility, addDebugMessage]);

  // --- Toggle Handlers ---
  const handleToggleGrid = (visible: boolean) => setShowGrid(visible);
  const handleToggleCountryLabels = (visible: boolean) =>
    setShowCountryLabels(visible);
  const handleTogglePrimeMeridian = (visible: boolean) =>
    setShowPrimeMeridian(visible);
  const handleTogglePosition = (visible: boolean) =>
    setShowPositionDisplay(visible);

  // Layer Toggle Handler (handles mutual exclusivity)
  const handleToggleLayer = useCallback(
    (layerId: string, isVisible: boolean) => {
      addDebugMessage(`Handling toggle for layer ${layerId} to ${isVisible}`);
      setLayerVisibility((prev) => {
        const newState = { ...prev, [layerId]: isVisible };
        const hasPolitical = newState['political'] !== undefined;
        const hasAltitude = newState['altitude-layers'] !== undefined;

        // If political/altitude layers exist, enforce mutual exclusivity
        if (hasPolitical && hasAltitude) {
          if (layerId === 'political' && isVisible) {
            newState['altitude-layers'] = false; // Turn off altitude if political is turned on
          } else if (layerId === 'altitude-layers' && isVisible) {
            newState['political'] = false; // Turn off political if altitude is turned on
          }
        }
        return newState;
      });
    },
    [addDebugMessage],
  );

  // --- Render ---
  return (
    <div
      ref={mapContainerRef}
      id="map-container" // Keep ID for potential direct targeting
      style={{
        width: '100%',
        height: '100vh', // Use viewport height
        backgroundColor: '#D5FFFF', // Use ocean color from globals.css
        position: 'relative', // Needed for absolute positioning of children
        overflow: 'hidden', // Prevent scrollbars on the container itself
      }}
    >
      {/* LeafletLoader handles map initialization */}
      <LeafletLoader
        mapConfig={mapConfig}
        onMapReady={handleMapReady}
        externalMapContainerRef={mapContainerRef}
      />

      {/* Render map-related components only when Leaflet is ready */}
      {isMapReady && map && leaflet && (
        <>
          {/* SvgLayerManager renders the actual SVG overlays */}
          <SvgLayerManager
            map={map}
            L={leaflet}
            mapConfig={mapConfig}
            layers={svgLayers}
            visibility={layerVisibility}
            isLoading={isLoadingSvg}
            error={svgError}
          />

          {/* Grid and Coordinate Display */}
          <GridComponent
            map={map}
            L={leaflet}
            mapConfig={mapConfig}
            primeMeridianSvg={primeMeridianSvg}
            showGrid={showGrid}
            showPrimeMeridian={showPrimeMeridian}
            showPositionDisplay={showPositionDisplay}
          />

          {/* Map Scale Control */}
          <MapScale map={map} L={leaflet} mapConfig={mapConfig} />

          {/* Distance Measurement Tool (only if leaflet-draw loaded) */}
          {leafletDrawLoadedRef.current && (
            <DistanceMeasurement map={map} L={leaflet} mapConfig={mapConfig} />
          )}

          {/* Control Panel for Toggles */}
          <ControlPanel
            map={map}
            L={leaflet}
            // Display Toggles
            showGrid={showGrid}
            showCountryLabels={showCountryLabels}
            showPrimeMeridian={showPrimeMeridian}
            showPosition={showPositionDisplay}
            onToggleGrid={handleToggleGrid}
            onToggleCountryLabels={handleToggleCountryLabels}
            onTogglePrimeMeridian={handleTogglePrimeMeridian}
            onTogglePosition={handleTogglePosition}
            // Layer Toggles
            layers={svgLayers}
            layerVisibility={layerVisibility}
            onToggleLayer={handleToggleLayer}
            isLoadingLayers={isLoadingSvg}
            layerError={svgError}
            // --- ADD Admin Mode Toggle ---
            isAdminMode={isAdminMode}
            onToggleAdminMode={() => setIsAdminMode((prev) => !prev)}
          />

          {/* --- Conditional Rendering for Labels/Editor --- */}
          {!isAdminMode && (
            <CountryLabelsComponent
              map={map}
              L={leaflet}
              visible={showCountryLabels} // Use state for visibility
              mapConfig={mapConfig}
            />
          )}

          {isAdminMode && (
            <AdminLabelEditor
              map={map}
              L={leaflet}
              mapConfig={mapConfig}
              isVisible={isAdminMode} // Pass admin mode state
            />
          )}
        </>
      )}

      {/* Loading/Error Indicators for SVG Layers */}
      {isLoadingSvg && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            zIndex: 1001,
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '3px',
            fontSize: '12px',
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
            zIndex: 1001,
            backgroundColor: 'rgba(200,0,0,0.7)',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '3px',
            fontSize: '12px',
          }}
        >
          Error loading SVG layers: {svgError}
        </div>
      )}
    </div>
  );
};

export default MapComponent;
