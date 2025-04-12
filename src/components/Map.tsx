// src/components/MapComponent.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MapConfig, SvgPoint } from '@/types';
import { defaultMapConfig } from '@/lib/MapConfig';
// Ensure correct import path for your coordinate utils
import { latLngToSvg } from '@/lib/coordinates-system';
import dynamic from 'next/dynamic';

// Import all child components
import GridComponent from './GridComponent';
import CountryLabelsComponent from './CountryLabelsComponent';
import CoordinatesComponent from './CoordinatesComponent';
import SVGLayerControl, { SVGLayerControlRef } from './SVGLayerControl';
import ControlPanel from './ControlPanel';
import MapScale from './MapScale';
import DistanceMeasurement from './DistanceMeasurement';

import { initToasts, showToast } from '@/lib/Toast';

// Dynamically load LeafletLoader
const LeafletLoader = dynamic(() => import('./LeafletLoader'), { ssr: false });

interface MapProps {
  mapConfig?: Partial<MapConfig>;
}

const MapComponent: React.FC<MapProps> = ({ mapConfig: configOverrides }) => {
  // State for map configuration
  const [mapConfig, setMapConfig] = useState<MapConfig>({
    ...defaultMapConfig,
    ...(configOverrides || {}),
  });

  // State for Leaflet map and library instances
  const [map, setMap] = useState<any>(null);
  const [leaflet, setLeaflet] = useState<any>(null);

  // State for map readiness
  const [isMapReady, setIsMapReady] = useState(false);

  // State for prime meridian SVG reference
  const [primeMeridianSvg, setPrimeMeridianSvg] = useState<SvgPoint | null>(null);

  // State for component visibility
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showCountryLabels, setShowCountryLabels] = useState<boolean>(
    mapConfig.showCountryLabels
  );
  const [showCoordinates, setShowCoordinates] = useState<boolean>(true);
  const [showPrimeMeridian, setShowPrimeMeridian] = useState<boolean>(true); // For CoordinatesComponent

  // Ref for the SVGLayerControl
  const layerControlRef = useRef<SVGLayerControlRef>(null);

  // Callback to handle Leaflet map initialization
  const handleMapReady = (mapInstance: any, L: any) => {
    setMap(mapInstance);
    setLeaflet(L);
    setIsMapReady(true);
    initToasts();

    // Calculate and set primeMeridianSvg state
    // Pass mapConfig to ensure correct calculations
    const pmSvgOrigin = latLngToSvg(0, 0, mapConfig);
    setPrimeMeridianSvg(pmSvgOrigin);
    
    showToast('Map initialized successfully!', 'success', 3000);
  };

  // Handlers for toggling visibility
  const toggleGrid = (visible: boolean) => setShowGrid(visible);
  const toggleCountryLabels = (visible: boolean) => setShowCountryLabels(visible);
  const toggleCoordinates = (visible: boolean) => setShowCoordinates(visible);
  const handleTogglePrimeMeridian = (visible: boolean) => {
    setShowPrimeMeridian(visible);
  };

  return (
    <div
      id="map"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#D5FFFF',
        position: 'relative',
      }}
    >
      {/* Load Leaflet and initialize the map */}
      <LeafletLoader mapConfig={mapConfig} onMapReady={handleMapReady} />

      {/* Render components once the map is ready */}
      {isMapReady && map && leaflet && (
        <>
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
          />

          {/* Coordinates Component - Fixed props */}
          <CoordinatesComponent
            map={map}
            L={leaflet}
            visible={showCoordinates}
            mapConfig={mapConfig}
            primeMeridianSvg={primeMeridianSvg}
            showPrimeMeridian={showPrimeMeridian}
            svgWidth={mapConfig.svgWidth}
            svgHeight={mapConfig.svgHeight}
          />

          {/* SVG Layer Control */}
          <SVGLayerControl
            ref={layerControlRef}
            map={map}
            L={leaflet}
            mapConfig={mapConfig}
            position="topright"
          />

          {/* Control Panel - Fixed with all required props */}
          <ControlPanel
            map={map}
            L={leaflet}
            mapConfig={mapConfig}
            layerControlRef={layerControlRef}
            onToggleGrid={toggleGrid}
            onToggleCountryLabels={toggleCountryLabels}
            onToggleCoordinates={toggleCoordinates}
            onTogglePrimeMeridian={handleTogglePrimeMeridian}
          />

          {/* Map Scale */}
          <MapScale
            map={map}
            L={leaflet}
            mapConfig={mapConfig}
          />

          {/* Distance Measurement */}
          <DistanceMeasurement
            map={map}
            L={leaflet}
            mapConfig={mapConfig}
          />
        </>
      )}
    </div>
  );
};

export default MapComponent;