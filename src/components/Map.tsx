// src/components/Map.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import L, { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import * as d3 from 'd3';

import { MapConfig, SvgPoint, SVGLayer, MapBounds } from '@/types';
import {
  defaultMapConfig,
  primeMeridianRef as defaultPrimeMeridianRef,
} from '@/lib/MapConfig';
import { latLngToSvg } from '@/lib/coordinates-system';
import { parseSVGLayers } from '@/lib/SVGLayerParser';
import { initToasts, showToast } from '@/lib/Toast';
import dynamic from 'next/dynamic';

// Import PoliticalLayerComponent directly (not dynamically loaded)
import PoliticalLayerComponent from './PoliticalLayerComponent';

// --- Dynamic Imports ---
const GridComponent = dynamic(() => import('./GridComponent'), { ssr: false });
const CountryLabelsComponent = dynamic(() => import('./CountryLabelsComponent'), { ssr: false });
const ControlPanel = dynamic(() => import('./ControlPanel'), { ssr: false });
const MapScale = dynamic(() => import('./MapScale'), { ssr: false });
const DistanceMeasurement = dynamic(() => import('./DistanceMeasurement'), { ssr: false });
const SvgLayerManager = dynamic(() => import('./SvgLayerManager'), { ssr: false });
const LeafletLoader = dynamic(() => import('./LeafletLoader'), { ssr: false });
const AdminLabelEditor = dynamic(() => import('./AdminLabelEditor'), { ssr: false });

interface MapProps {
  mapConfig?: Partial<MapConfig>;
}

const MapComponent: React.FC<MapProps> = ({ mapConfig: configOverrides }) => {
  // --- Map Configuration State ---
  const [mapConfig, setMapConfig] = useState<MapConfig>(() => {
    const overrides = configOverrides || {};
    let initialBounds: MapBounds;
    if (
      overrides.bounds && typeof overrides.bounds.north === 'number' &&
      typeof overrides.bounds.south === 'number' && typeof overrides.bounds.east === 'number' &&
      typeof overrides.bounds.west === 'number'
    ) {
      initialBounds = overrides.bounds;
    } else if (defaultMapConfig.bounds && typeof defaultMapConfig.bounds.north === 'number') {
      initialBounds = defaultMapConfig.bounds;
    } else {
      console.error('MapComponent: CRITICAL - Default bounds invalid! Using fallback.');
      initialBounds = { north: 0, south: 490, east: 820, west: 0 };
    }
    const finalConfig: MapConfig = {
      ...defaultMapConfig, ...overrides, bounds: initialBounds,
      primeMeridianRef: overrides.primeMeridianRef ?? defaultPrimeMeridianRef,
    };
    if (finalConfig.minZoom === undefined) finalConfig.minZoom = defaultMapConfig.minZoom ?? 0;
    if (finalConfig.maxZoom === undefined) finalConfig.maxZoom = defaultMapConfig.maxZoom ?? 4;
    if (!finalConfig.baseMapUrl && !finalConfig.masterMapPath) console.error('MapComponent: No map URL!');
    if (finalConfig.milesPerPixel && !finalConfig.kmPerPixel) {
      finalConfig.kmPerPixel = finalConfig.milesPerPixel * 1.60934;
    }
    return finalConfig;
  });

  // --- Map Instance State ---
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [leaflet, setLeaflet] = useState<typeof L | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [primeMeridianSvg, setPrimeMeridianSvg] = useState<SvgPoint | null>(null);
  const leafletDrawLoadedRef = useRef(false);

  // --- SVG Layer State ---
  const [svgLayers, setSvgLayers] = useState<Record<string, SVGLayer>>({});
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>(mapConfig.initialLayerVisibility || {});
  const [isLoadingSvg, setIsLoadingSvg] = useState(false);
  const [svgError, setSvgError] = useState<string | null>(null);

  // --- UI Toggles State ---
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showCountryLabels, setShowCountryLabels] = useState<boolean>(mapConfig.showCountryLabels ?? true);
  const [showPrimeMeridian, setShowPrimeMeridian] = useState<boolean>(true);
  const [showPositionDisplay, setShowPositionDisplay] = useState<boolean>(true);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  
  // --- Political Vector Layer State ---
  const [showPoliticalVectors, setShowPoliticalVectors] = useState<boolean>(false);
  const [highlightedCountry, setHighlightedCountry] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);

  // --- Callbacks ---
  const addDebugMessage = useCallback((message: string, type: 'info' | 'warn' | 'error' = 'info') => {
    console[type](`[MapComponent] ${message}`);
  }, []);

  const handleMapReady = useCallback(async (mapInstance: LeafletMap, LInstance: typeof L) => {
    addDebugMessage('handleMapReady called...');
    setMap(mapInstance);
    setLeaflet(LInstance);
    setIsMapReady(true);
    if (!leafletDrawLoadedRef.current) {
      try {
        addDebugMessage('Dynamically importing leaflet-draw...');
        await import('leaflet-draw');
        leafletDrawLoadedRef.current = true;
        addDebugMessage('leaflet-draw imported successfully.');
      } catch (error) { addDebugMessage(`Failed to load leaflet-draw: ${error}`, 'error'); }
    }
    if (typeof initToasts === 'function') initToasts();
    try {
      const refLat = mapConfig.primeMeridianRef?.lat; const refLng = mapConfig.primeMeridianRef?.lng;
      if (refLat !== undefined && refLng !== undefined) {
        const pmSvgOrigin = latLngToSvg(refLat, refLng, mapConfig);
        if (pmSvgOrigin && typeof pmSvgOrigin.x === 'number' && typeof pmSvgOrigin.y === 'number') {
          setPrimeMeridianSvg(pmSvgOrigin);
        } else { throw new Error('latLngToSvg returned invalid result'); }
      } else { addDebugMessage('Prime meridian reference lat/lng missing.', 'warn'); }
    } catch (error) { addDebugMessage(`Error calculating prime meridian SVG origin: ${error}`, 'error'); }
  }, [mapConfig, addDebugMessage]);

  // --- Effects ---
  useEffect(() => {
    addDebugMessage(`Initializing MapComponent...`);
    if (mapContainerRef.current) {
      addDebugMessage(`Map container initial dimensions: W=${mapContainerRef.current.clientWidth}, H=${mapContainerRef.current.clientHeight}`);
    }
  }, [addDebugMessage]);

  useEffect(() => {
    const fetchAndParseSVG = async () => {
      if (!isMapReady || !mapConfig.masterMapPath) return;
      setIsLoadingSvg(true); setSvgError(null); setSvgLayers({});
      addDebugMessage(`Fetching SVG: ${mapConfig.masterMapPath}`);
      try {
        const response = await fetch(mapConfig.masterMapPath);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const svgContent = await response.text();
        addDebugMessage('SVG content received, parsing layers...');
        const parsedLayers = await parseSVGLayers(svgContent);
        addDebugMessage(`Parsed SVG layers: ${Object.keys(parsedLayers).length} layers found. Keys: ${Object.keys(parsedLayers).join(', ')}`);
        if (Object.keys(parsedLayers).length === 0) { addDebugMessage('parseSVGLayers returned an empty object!', 'warn'); }
        setSvgLayers(parsedLayers);
        setLayerVisibility((prevVisibility) => {
          const initialConfigVisibility = mapConfig.initialLayerVisibility || {};
          const newVisibility: Record<string, boolean> = {};
          Object.keys(parsedLayers).forEach((id) => { newVisibility[id] = initialConfigVisibility[id] ?? false; });
          const hasPolitical = newVisibility['political'] !== undefined; const hasAltitude = newVisibility['altitude-layers'] !== undefined;
          if (hasPolitical && hasAltitude) {
            if (newVisibility['political']) newVisibility['altitude-layers'] = false;
            else if (newVisibility['altitude-layers']) newVisibility['political'] = false;
          }
          return newVisibility;
        });
      } catch (err: any) {
        addDebugMessage(`Error fetching or parsing SVG: ${err.message}`, 'error');
        setSvgError(err.message || 'Failed to load SVG data');
        if (typeof showToast === 'function') showToast('Error loading SVG layers', 'error');
      } finally { setIsLoadingSvg(false); }
    };
    fetchAndParseSVG();
  }, [isMapReady, mapConfig.masterMapPath, mapConfig.initialLayerVisibility, addDebugMessage]);

  // --- Toggle Handlers ---
  const handleToggleGrid = (visible: boolean) => setShowGrid(visible);
  const handleToggleCountryLabels = (visible: boolean) => setShowCountryLabels(visible);
  const handleTogglePrimeMeridian = (visible: boolean) => setShowPrimeMeridian(visible);
  const handleTogglePosition = (visible: boolean) => setShowPositionDisplay(visible);
  
  const handleToggleLayer = useCallback((layerId: string, isVisible: boolean) => {
    setLayerVisibility((prev) => {
      const newState = { ...prev, [layerId]: isVisible };
      const hasPolitical = newState['political'] !== undefined; 
      const hasAltitude = newState['altitude-layers'] !== undefined;
      
      if (hasPolitical && hasAltitude) {
        if (layerId === 'political' && isVisible) newState['altitude-layers'] = false;
        else if (layerId === 'altitude-layers' && isVisible) newState['political'] = false;
      }
      
      // Turn off vector layer if enabling SVG political layer
      if (layerId === 'political' && isVisible) {
        setShowPoliticalVectors(false);
      }
      
      return newState;
    });
  }, []);

  // --- Political Vector Layer Toggle Handler ---
  const handleTogglePoliticalVectors = useCallback((visible: boolean) => {
    setShowPoliticalVectors(visible);
    
    // When enabling vector layer, turn off the SVG overlay political layer
    if (visible) {
      setLayerVisibility(prev => ({
        ...prev,
        political: false
      }));
    }
  }, []);

  // --- Country Click Handler ---
  const handleCountryClick = useCallback((id: string, name: string, e: L.LeafletMouseEvent) => {
    addDebugMessage(`Clicked on country: ${name} (${id})`);
    
    // Toggle highlight for the clicked country
    setHighlightedCountry(prevId => prevId === id ? null : id);
    
    // Show a toast with the country name
    if (typeof showToast === 'function') {
      showToast(`Selected: ${name}`, 'info', 2000);
    }
  }, [addDebugMessage]);

  // --- Admin Mode Logic ---
  const handleToggleAdminMode = useCallback(() => {
    setIsAdminMode((prev) => {
      const nextState = !prev;
      addDebugMessage(`Toggling Admin Mode to: ${nextState}`);
      if (nextState) {
        setShowCountryLabels(false); // Hide labels in admin mode
        if (typeof showToast === 'function') showToast('Label Editor Activated', 'info');
      } else {
        setShowCountryLabels(mapConfig.showCountryLabels ?? true);
        if (typeof showToast === 'function') showToast('Label Editor Deactivated', 'info');
      }
      return nextState;
    });
  }, [addDebugMessage, mapConfig.showCountryLabels]);

  // --- Admin Save Success Handler ---
  const handleAdminSaveSuccess = useCallback(() => {
    addDebugMessage('Admin save successful, exiting admin mode.');
    if (typeof showToast === 'function') showToast('Label positions saved!', 'success');
    setIsAdminMode(false);
    setShowCountryLabels(mapConfig.showCountryLabels ?? true);
  }, [addDebugMessage, mapConfig.showCountryLabels]);

  // --- Render ---
  return (
    <div ref={mapContainerRef} id="map-container" style={{ width: '100%', height: '100vh', backgroundColor: '#D5FFFF', position: 'relative', overflow: 'hidden' }}>
      <LeafletLoader mapConfig={mapConfig} onMapReady={handleMapReady} externalMapContainerRef={mapContainerRef} />

      {isMapReady && map && leaflet && (
        <>
          {!isLoadingSvg && Object.keys(svgLayers).length > 0 && (
            <SvgLayerManager map={map} L={leaflet} mapConfig={mapConfig} layers={svgLayers} visibility={layerVisibility} isLoading={false} error={svgError} />
          )}
          
          {/* Interactive Political Vector Layer */}
          <PoliticalLayerComponent 
  map={map} 
  L={leaflet} 
  visible={showPoliticalVectors}
  mapConfig={mapConfig}
  highlight={highlightedCountry}
  onClick={handleCountryClick}
/>
          
          <GridComponent map={map} L={leaflet} mapConfig={mapConfig} primeMeridianSvg={primeMeridianSvg} showGrid={showGrid} showPrimeMeridian={showPrimeMeridian} showPositionDisplay={showPositionDisplay} />
          <MapScale map={map} L={leaflet} mapConfig={mapConfig} />
          {leafletDrawLoadedRef.current && <DistanceMeasurement map={map} L={leaflet} mapConfig={mapConfig} />}

          <ControlPanel
            map={map} 
            L={leaflet}
            showGrid={showGrid} 
            showCountryLabels={showCountryLabels} 
            showPrimeMeridian={showPrimeMeridian} 
            showPosition={showPositionDisplay}
            showPoliticalVectors={showPoliticalVectors}
            onToggleGrid={handleToggleGrid} 
            onToggleCountryLabels={handleToggleCountryLabels} 
            onTogglePrimeMeridian={handleTogglePrimeMeridian} 
            onTogglePosition={handleTogglePosition}
            onTogglePoliticalVectors={handleTogglePoliticalVectors}
            layers={svgLayers} 
            layerVisibility={layerVisibility} 
            onToggleLayer={handleToggleLayer} 
            isLoadingLayers={isLoadingSvg} 
            layerError={svgError}
            isAdminMode={isAdminMode}
            onToggleAdminMode={handleToggleAdminMode}
            isAdminToggleDisabled={false}
          />

          {/* Show labels unless explicitly in admin mode */}
          {!isAdminMode && <CountryLabelsComponent map={map} L={leaflet} visible={showCountryLabels} mapConfig={mapConfig} />}

          {/* Render AdminLabelEditor only when isAdminMode is true */}
          {isAdminMode && (
            <AdminLabelEditor map={map} L={leaflet} mapConfig={mapConfig} isVisible={isAdminMode} onSaveSuccess={handleAdminSaveSuccess} />
          )}
        </>
      )}

      {/* Loading/Error indicators */}
      {isLoadingSvg && (
        <div style={{ position: 'absolute', bottom: '10px', left: '10px', zIndex: 1001, backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', padding: '5px 10px', borderRadius: '3px', fontSize: '12px' }}>
          Loading Map Layers...
        </div>
      )}
      
      {svgError && !isLoadingSvg && (
        <div style={{ position: 'absolute', bottom: '10px', left: '10px', zIndex: 1001, backgroundColor: 'rgba(200,0,0,0.7)', color: 'white', padding: '5px 10px', borderRadius: '3px', fontSize: '12px' }}>
          Error loading SVG layers: {svgError}
        </div>
      )}
    </div>
  );
};

export default MapComponent;