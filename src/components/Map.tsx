'use client';

import React, { useState, useRef } from 'react';
import { MapConfig, SvgPoint } from '@/types';
import { defaultMapConfig } from '@/lib/MapConfig';
import dynamic from 'next/dynamic';
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
    ...configOverrides,
  });

  // State for Leaflet map and library instances
  const [map, setMap] = useState<any>(null);
  const [leaflet, setLeaflet] = useState<any>(null);

  // State for map readiness
  const [isMapReady, setIsMapReady] = useState(false);

  // State for prime meridian SVG reference
  const [primeMeridianSvg, setPrimeMeridianSvg] = useState<SvgPoint | null>(null);

  // State for grid visibility
  const [showGrid, setShowGrid] = useState<boolean>(true);

  // State for country labels visibility
  const [showCountryLabels, setShowCountryLabels] = useState<boolean>(true);

  // Ref for the SVGLayerControl
  const layerControlRef = useRef<SVGLayerControlRef>(null);

  // Callback to handle Leaflet map initialization
  const handleMapReady = (mapInstance: any, L: any) => {
    setMap(mapInstance);
    setLeaflet(L);
    setIsMapReady(true);

    // Initialize toasts
    initToasts();

    // Set the prime meridian SVG point
    setPrimeMeridianSvg({
      x: mapConfig.primeMeridianX,
      y: mapConfig.equatorY,
    });

    showToast('Map initialized successfully!', 'success', 3000);
  };

  // Handlers for toggling visibility
  const toggleGrid = (visible: boolean) => setShowGrid(visible);
  const toggleCountryLabels = (visible: boolean) => setShowCountryLabels(visible);

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
            svgWidth={mapConfig.svgWidth}
            svgHeight={mapConfig.svgHeight}
          />

          {/* Grid Component */}
          <GridComponent
            map={map}
            L={leaflet}
            primeMeridianSvg={primeMeridianSvg}
            visible={showGrid}
            svgWidth={mapConfig.svgWidth}
            svgHeight={mapConfig.svgHeight}
          />

          {/* Coordinates Component */}
          <CoordinatesComponent
            map={map}
            L={leaflet}
            visible={true}
            showPrimeMeridian={true}
            mapConfig={mapConfig}
            svgWidth={mapConfig.svgWidth}
            svgHeight={mapConfig.svgHeight}
            primeMeridianSvg={primeMeridianSvg}
            setPrimeMeridianSvg={setPrimeMeridianSvg}
          />

          {/* SVG Layer Control */}
          <SVGLayerControl
            ref={layerControlRef}
            map={map}
            L={leaflet}
            mapConfig={mapConfig}
            position="topright"
          />

          {/* Control Panel */}
          <ControlPanel
            map={map}
            L={leaflet}
            mapConfig={mapConfig}
            layerControlRef={layerControlRef}
            onToggleGrid={toggleGrid}
            onToggleLabels={toggleCountryLabels}
            onToggleCountryLabels={toggleCountryLabels}
            onTogglePrimeMeridian={(visible) => console.log('Prime Meridian toggled:', visible)}
            onTogglePosition={(visible) => console.log('Position toggled:', visible)}
          />

          {/* Map Scale */}
          <MapScale map={map} L={leaflet} mapConfig={mapConfig} />

          {/* Distance Measurement */}
          <DistanceMeasurement map={map} L={leaflet} />
        </>
      )}
    </div>
  );
};

export default MapComponent;