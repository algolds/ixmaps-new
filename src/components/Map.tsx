// src/components/MapComponent.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import L, { Map as LeafletMap, LatLngBounds } from 'leaflet'; // Import Map type
import { MapConfig, SvgPoint, SVGLayer } from '@/types';
import { defaultMapConfig } from '@/lib/MapConfig';
import { latLngToSvg, svgToLatLng } from '@/lib/coordinates-system';
import { parseSVGLayers, svgToDataUrl } from '@/lib/SVGLayerParser';
import { initToasts, showToast } from '@/lib/Toast';
import dynamic from 'next/dynamic';

// Import child components
import GridComponent from './GridComponent'; // Corrected GridComponent import
import CountryLabelsComponent from './CountryLabelsComponent';
import CoordinatesComponent from './CoordinatesComponent';
import ControlPanel from './ControlPanel';
import MapScale from './MapScale';
import DistanceMeasurement from './DistanceMeasurement';
import SvgLayerManager from './SvgLayerManager';

// Dynamically load LeafletLoader
const LeafletLoader = dynamic(() => import('./LeafletLoader'), { ssr: false });

interface MapProps {
  mapConfig?: Partial<MapConfig>;
}

const MapComponent: React.FC<MapProps> = ({ mapConfig: configOverrides }) => {
  // --- Core State ---
  const [mapConfig, setMapConfig] = useState<MapConfig>({
    ...defaultMapConfig,
    ...(configOverrides || {}),
  });
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [leaflet, setLeaflet] = useState<typeof L | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [primeMeridianSvg, setPrimeMeridianSvg] = useState<SvgPoint | null>(
    null
  );

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
    mapConfig.showCountryLabels
  );
  const [showCoordinates, setShowCoordinates] = useState<boolean>(true);
  const [showPrimeMeridian, setShowPrimeMeridian] = useState<boolean>(true); // Controls PM line in CoordinatesComponent
  const [showPositionDisplay, setShowPositionDisplay] = useState<boolean>(true); // Controls mouse pos display

  // --- Map Initialization ---
  const handleMapReady = useCallback(
    (mapInstance: LeafletMap, LInstance: typeof L) => {
      setMap(mapInstance);
      setLeaflet(LInstance);
      setIsMapReady(true);
      initToasts();

      try {
        // Calculate PM SVG origin once map config is stable
        const pmSvgOrigin = latLngToSvg(0, 0, mapConfig); // Assuming PM LatLng is 0,0
        setPrimeMeridianSvg(pmSvgOrigin);
      } catch (error) {
        console.error('Error calculating prime meridian SVG origin:', error);
        setPrimeMeridianSvg(null);
        showToast('Error initializing map projection.', 'error');
      }

      showToast('Map initialized successfully!', 'success', 3000);
    },
    [mapConfig] // Recalculate if mapConfig changes fundamentally
  );

  // --- Fetch and Parse SVG ---
  useEffect(() => {
    const fetchAndParseSVG = async () => {
      if (!mapConfig.masterMapPath || !isMapReady) return;

      setIsLoadingSvg(true);
      setSvgError(null);
      setSvgLayers({});

      try {
        console.log('Fetching SVG:', mapConfig.masterMapPath);
        const response = await fetch(mapConfig.masterMapPath);
        if (!response.ok) {
          throw new Error(
            `Failed to load SVG: ${response.status} ${response.statusText}`
          );
        }
        const svgContent = await response.text();
        console.log('Parsing SVG layers...');
        const parsedLayers = await parseSVGLayers(svgContent);
        console.log('Parsed SVG layers:', Object.keys(parsedLayers));
        setSvgLayers(parsedLayers);

        // Initialize visibility based on config and parsed layers
        setLayerVisibility((prevVisibility) => {
          const initialVisibility = {
            ...(mapConfig.initialLayerVisibility || {}),
          };
          const newVisibility: Record<string, boolean> = {};
          Object.keys(parsedLayers).forEach((id) => {
            newVisibility[id] = initialVisibility[id] ?? false;
          });
          // Special handling for altitude based on initial political state
          if (newVisibility['political'] === true) {
            newVisibility['altitude-layers'] = false;
          } else if (parsedLayers['altitude-layers']) {
            newVisibility['altitude-layers'] = true;
          }
          return newVisibility;
        });

        showToast('SVG layers parsed successfully', 'success');
      } catch (err) {
        console.error('Error fetching or parsing SVG:', err);
        const errorMsg =
          err instanceof Error ? err.message : 'Unknown error loading SVG';
        setSvgError(errorMsg);
        showToast(`Error loading SVG: ${errorMsg}`, 'error');
      } finally {
        setIsLoadingSvg(false);
      }
    };

    fetchAndParseSVG();
  }, [mapConfig.masterMapPath, mapConfig.initialLayerVisibility, isMapReady]);

  // --- Toggle Handlers ---
  const handleToggleGrid = (visible: boolean) => setShowGrid(visible);
  const handleToggleCountryLabels = (visible: boolean) =>
    setShowCountryLabels(visible);
  // const handleToggleCoordinates = (visible: boolean) => setShowCoordinates(visible); // If needed
  const handleTogglePrimeMeridian = (visible: boolean) =>
    setShowPrimeMeridian(visible); // Toggles PM line in CoordinatesComponent
  const handleTogglePosition = (visible: boolean) =>
    setShowPositionDisplay(visible); // Toggles mouse pos display

  const handleToggleLayer = useCallback(
    (layerId: string, isVisible: boolean) => {
      setLayerVisibility((prev) => {
        const newState = { ...prev, [layerId]: isVisible };
        // Auto-toggle altitude layer based on political layer
        if (layerId === 'political' && newState['altitude-layers'] !== undefined) {
          newState['altitude-layers'] = !isVisible;
          console.log(
            `Political toggled to ${isVisible}, setting altitude-layers to ${!isVisible}`
          );
        }
        return newState;
      });
      console.log(`Toggled layer ${layerId} to ${isVisible}`);
    },
    [] // No external dependencies needed here
  );

  return (
    <div
      id="map-container"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#D5FFFF',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Load Leaflet */}
      <LeafletLoader mapConfig={mapConfig} onMapReady={handleMapReady} />

      {/* Render map elements once ready */}
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

          {/* Grid Component - Pass correct props */}
          <GridComponent
            map={map}
            L={leaflet}
            visible={showGrid}
            mapConfig={mapConfig} // Pass the full config
            primeMeridianSvg={primeMeridianSvg} // Pass the calculated PM origin
          />

          {/* Coordinates Display & PM Line */}
          <CoordinatesComponent
            map={map}
            L={leaflet}
            visible={showCoordinates} // Controls if component adds controls/listeners
            mapConfig={mapConfig}
            primeMeridianSvg={primeMeridianSvg}
            showPrimeMeridian={showPrimeMeridian} // Controls PM line visibility
            setPrimeMeridianSvg={setPrimeMeridianSvg}
            showPositionDisplay={showPositionDisplay} // Controls mouse pos visibility
          />

          {/* Unified Control Panel */}
          <ControlPanel
            map={map}
            L={leaflet}
            // Display Toggles
            showGrid={showGrid}
            showCountryLabels={showCountryLabels}
            showPrimeMeridian={showPrimeMeridian} // For the PM line toggle
            showPosition={showPositionDisplay} // For the mouse pos toggle
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
          />

          {/* Map Scale */}
          <MapScale map={map} L={leaflet} mapConfig={mapConfig} />

          {/* Distance Measurement Tool */}
          <DistanceMeasurement map={map} L={leaflet} mapConfig={mapConfig} />
        </>
      )}

      {/* Optional Loading/Error Overlay */}
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
            zIndex: 1000,
          }}
        >
          Loading Map Layers...
        </div>
      )}
      {svgError && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            padding: '10px',
            background: 'rgba(255, 0, 0, 0.8)',
            color: 'white',
            borderRadius: '5px',
            zIndex: 1000,
          }}
        >
          Error loading SVG layers: {svgError}
        </div>
      )}
    </div>
  );
};

export default MapComponent;
