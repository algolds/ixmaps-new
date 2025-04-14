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
const ControlPanel = dynamic(() => import('./ControlPanel'), { ssr: false }); // Keep this
const MapScale = dynamic(() => import('./MapScale'), { ssr: false });
const DistanceMeasurement = dynamic(() => import('./DistanceMeasurement'), {
  ssr: false,
});
const SvgLayerManager = dynamic(() => import('./SvgLayerManager'), {
  ssr: false,
});
const LeafletLoader = dynamic(() => import('./LeafletLoader'), { ssr: false });
// *** REMOVE LayerToggleUI import ***
// const LayerToggleUI = dynamic(() => import('./LayerToggleUI'), { ssr: false });

interface MapProps {
  mapConfig?: Partial<MapConfig>;
}

const MapComponent: React.FC<MapProps> = ({ mapConfig: configOverrides }) => {
  // --- State (remains the same) ---
  const [mapConfig, setMapConfig] = useState<MapConfig>(() => {
    // (Initialization logic remains the same)
    const overrides = configOverrides || {};
    let initialBounds: MapBounds;
    if (
      overrides.bounds &&
      typeof overrides.bounds.north === 'number' &&
      typeof overrides.bounds.south === 'number' &&
      typeof overrides.bounds.east === 'number' &&
      typeof overrides.bounds.west === 'number'
    ) {
      initialBounds = overrides.bounds;
    } else {
      if (
        defaultMapConfig.bounds &&
        typeof defaultMapConfig.bounds.north === 'number'
      ) {
        initialBounds = defaultMapConfig.bounds;
      } else {
        console.error(
          'MapComponent: CRITICAL - Default bounds are invalid or missing! Using hardcoded fallback.',
        );
        initialBounds = { north: 0, south: 4900, east: 8200, west: 0 };
      }
    }
    const finalConfig: MapConfig = {
      ...defaultMapConfig,
      ...overrides,
      bounds: initialBounds,
      primeMeridianRef: overrides.primeMeridianRef ?? defaultPrimeMeridianRef,
    };
    if (finalConfig.minZoom === undefined)
      finalConfig.minZoom = defaultMapConfig.minZoom ?? 0;
    if (finalConfig.maxZoom === undefined)
      finalConfig.maxZoom = defaultMapConfig.maxZoom ?? 4;
    if (!finalConfig.baseMapUrl && !finalConfig.masterMapPath)
      console.error('MapComponent: No map URL defined!');
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
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showCountryLabels, setShowCountryLabels] = useState<boolean>(
    mapConfig.showCountryLabels ?? true,
  );
  const [showPrimeMeridian, setShowPrimeMeridian] = useState<boolean>(true);
  const [showPositionDisplay, setShowPositionDisplay] = useState<boolean>(true);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // --- Callbacks and Effects (remain the same) ---
  const addDebugMessage = useCallback(
    (message: string, type: 'info' | 'warn' | 'error' = 'info') => {
      console[type](`[MapComponent] ${message}`);
    },
    [],
  );

  useEffect(() => {
    // Initial config logging effect
    addDebugMessage(
      `Initializing MapComponent with bounds: N:${mapConfig.bounds.north}, S:${mapConfig.bounds.south}, E:${mapConfig.bounds.east}, W:${mapConfig.bounds.west}`,
    );
    // ... other logs
    if (mapContainerRef.current) {
       addDebugMessage(`Map container initial dimensions: W=${mapContainerRef.current.clientWidth}, H=${mapContainerRef.current.clientHeight}`);
    }
  }, [mapConfig, addDebugMessage]);

  const handleMapReady = useCallback(
    async (mapInstance: LeafletMap, LInstance: typeof L) => {
      // Map ready logic remains the same
      addDebugMessage('handleMapReady called...');
      setMap(mapInstance);
      setLeaflet(LInstance);
      setIsMapReady(true);
      // ... (load leaflet-draw, init toasts, calculate PM origin)
      if (!leafletDrawLoadedRef.current) {
        try {
          addDebugMessage('Dynamically importing leaflet-draw...');
          await import('leaflet-draw');
          leafletDrawLoadedRef.current = true;
          addDebugMessage('leaflet-draw imported successfully.');
        } catch (error) { /* ... */ }
      }
      if (typeof initToasts === 'function') { /* ... */ }
      try {
        const refLat = mapConfig.primeMeridianRef?.lat;
        const refLng = mapConfig.primeMeridianRef?.lng;
        if (refLat !== undefined && refLng !== undefined) {
          const pmSvgOrigin = latLngToSvg(refLat, refLng, mapConfig);
          if (pmSvgOrigin && typeof pmSvgOrigin.x === 'number' && typeof pmSvgOrigin.y === 'number') {
            setPrimeMeridianSvg(pmSvgOrigin);
            addDebugMessage(`Prime meridian SVG origin calculated: ${JSON.stringify(pmSvgOrigin)}`);
          } else { throw new Error('latLngToSvg returned invalid result'); }
        } else { /* ... */ }
      } catch (error) { /* ... */ }
      if (typeof showToast === 'function') showToast('Map initialized successfully!', 'success', 3000);
    },
    [mapConfig, addDebugMessage],
  );

  useEffect(() => {
    // Fetch and parse SVG logic remains the same
    const fetchAndParseSVG = async () => {
      if (!isMapReady || !mapConfig.masterMapPath) { /* ... */ return; }
      setIsLoadingSvg(true);
      setSvgError(null);
      setSvgLayers({});
      addDebugMessage(`Fetching SVG: ${mapConfig.masterMapPath}`);
      try {
        const response = await fetch(mapConfig.masterMapPath);
        if (!response.ok) throw new Error(/* ... */);
        const svgContent = await response.text();
        addDebugMessage('SVG content received, parsing layers...');
        const parsedLayers = await parseSVGLayers(svgContent);
        addDebugMessage(`Parsed SVG layers: ${Object.keys(parsedLayers).length} layers found.`);
        setSvgLayers(parsedLayers);
        setLayerVisibility((prevVisibility) => {
          const initialConfigVisibility = mapConfig.initialLayerVisibility || {};
          const newVisibility: Record<string, boolean> = {};
          Object.keys(parsedLayers).forEach((id) => {
            newVisibility[id] = initialConfigVisibility[id] ?? false;
          });
          if (parsedLayers['altitude-layers'] && newVisibility['political'] !== undefined) {
            newVisibility['altitude-layers'] = !newVisibility['political'];
          } else if (parsedLayers['political'] && newVisibility['altitude-layers'] !== undefined) {
             if (newVisibility['altitude-layers']) newVisibility['political'] = false;
          }
          addDebugMessage(`Initial layer visibility set: ${JSON.stringify(newVisibility)}`);
          return newVisibility;
        });
        if (typeof showToast === 'function') showToast('SVG layers parsed successfully', 'success');
      } catch (err) { /* ... */ }
      finally { setIsLoadingSvg(false); }
    };
    fetchAndParseSVG();
  }, [isMapReady, mapConfig.masterMapPath, mapConfig.initialLayerVisibility, addDebugMessage]);

  // Toggle Handlers (Grid, Labels, etc. - remain the same)
  const handleToggleGrid = (visible: boolean) => setShowGrid(visible);
  const handleToggleCountryLabels = (visible: boolean) => setShowCountryLabels(visible);
  const handleTogglePrimeMeridian = (visible: boolean) => setShowPrimeMeridian(visible);
  const handleTogglePosition = (visible: boolean) => setShowPositionDisplay(visible);

  // Layer Toggle Handler (remains the same, updates state)
  const handleToggleLayer = useCallback(
    (layerId: string, isVisible: boolean) => {
      addDebugMessage(`Handling toggle for layer ${layerId} to ${isVisible}`);
      setLayerVisibility((prev) => {
        const newState = { ...prev, [layerId]: isVisible };
        const hasPolitical = newState['political'] !== undefined;
        const hasAltitude = newState['altitude-layers'] !== undefined;
        if (hasPolitical && hasAltitude) {
            if (layerId === 'political') newState['altitude-layers'] = !isVisible;
            else if (layerId === 'altitude-layers') newState['political'] = !isVisible;
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
      id="map-container"
      style={{
        width: '100%', height: '100vh', backgroundColor: '#add8e6',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <LeafletLoader
        mapConfig={mapConfig}
        onMapReady={handleMapReady}
        externalMapContainerRef={mapContainerRef}
      />

      {isMapReady && map && leaflet && (
        <>
          {/* SvgLayerManager still handles the actual overlays */}
          <SvgLayerManager
            map={map}
            L={leaflet}
            mapConfig={mapConfig}
            layers={svgLayers}
            visibility={layerVisibility}
            isLoading={isLoadingSvg}
            error={svgError}
          />

          {/* Other map components */}
          <CountryLabelsComponent map={map} L={leaflet} visible={showCountryLabels} mapConfig={mapConfig} />
          <GridComponent map={map} L={leaflet} mapConfig={mapConfig} primeMeridianSvg={primeMeridianSvg} showGrid={showGrid} showPrimeMeridian={showPrimeMeridian} showPositionDisplay={showPositionDisplay} />
          <MapScale map={map} L={leaflet} mapConfig={mapConfig} />
          {leafletDrawLoadedRef.current && <DistanceMeasurement map={map} L={leaflet} mapConfig={mapConfig} />}

          {/* *** PASS LAYER PROPS BACK TO ControlPanel *** */}
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
            layers={svgLayers} // Pass parsed layers
            layerVisibility={layerVisibility} // Pass current visibility state
            onToggleLayer={handleToggleLayer} // Pass the handler function
            isLoadingLayers={isLoadingSvg} // Pass loading state
            layerError={svgError} // Pass error state
          />

          {/* *** REMOVE LayerToggleUI Rendering *** */}
          {/* {Object.keys(svgLayers).length > 0 && (
            <LayerToggleUI ... />
          )} */}
        </>
      )}

      {/* Loading/Error Indicators (remain the same) */}
      {isLoadingSvg && ( <div style={{ /* ... styles ... */ }}>Loading Map Layers...</div> )}
      {svgError && !isLoadingSvg && ( <div style={{ /* ... styles ... */ }}>Error loading SVG layers: {svgError}</div> )}
    </div>
  );
};

export default MapComponent;
