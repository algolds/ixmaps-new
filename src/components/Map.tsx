// src/components/MapComponent.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MapConfig } from '@/types';
import { defaultMapConfig } from '@/lib/MapConfig';
import dynamic from 'next/dynamic';
// import GridComponent from './GridComponent'; // Keep if used
import CountryLabelsComponent from './CountryLabelsComponent'; // Ensure correct import
// ... other imports ...
import { initToasts, showToast } from '@/lib/Toast';

const LeafletLoader = dynamic(() => import('./LeafletLoader'), { ssr: false });

interface MapProps {
  mapConfig?: Partial<MapConfig>;
}

const MapComponent: React.FC<MapProps> = ({ mapConfig: configOverrides }) => {
  const [mapConfig, setMapConfig] = useState<MapConfig>({
    ...defaultMapConfig,
    ...(configOverrides || {}),
  });

  const [map, setMap] = useState<any>(null);
  const [leaflet, setLeaflet] = useState<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  // const [showGrid, setShowGrid] = useState<boolean>(true); // Keep if used
  const [showCountryLabels, setShowCountryLabels] = useState<boolean>(true);

  const handleMapReady = (mapInstance: any, L: any) => {
    setMap(mapInstance);
    setLeaflet(L);
    setIsMapReady(true);
    initToasts();
    showToast('Map initialized successfully!', 'success', 3000);
  };

  const toggleCountryLabels = (visible: boolean) => setShowCountryLabels(visible);
  // const toggleGrid = (visible: boolean) => setShowGrid(visible); // Keep if used

  return (
    <div
      id="map"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#D5FFFF', // Or your preferred background
        position: 'relative',
      }}
    >
      <LeafletLoader mapConfig={mapConfig} onMapReady={handleMapReady} />

      {isMapReady && map && leaflet && (
        <>
          {/* --- Pass svgHeight to CountryLabelsComponent --- */}
          <CountryLabelsComponent
            map={map}
            L={leaflet}
            visible={showCountryLabels}
            svgHeight={mapConfig.svgHeight} // *** THIS LINE IS NEEDED ***
            // Pass actual data if loaded: countryData={countryLabelData}
          />

          {/* --- Other Components (Review/Adapt if needed) --- */}
          {/* Grid Component, Control Panel, etc. */}
          {/* <GridComponent map={map} L={leaflet} visible={showGrid} svgHeight={mapConfig.svgHeight} svgWidth={mapConfig.svgWidth} /> */}
          {/* <ControlPanel onToggleCountryLabels={toggleCountryLabels} ... /> */}
        </>
      )}
    </div>
  );
};

export default MapComponent;
