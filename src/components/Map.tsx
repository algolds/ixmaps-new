'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  MapConfig,
  LatLng,
  SvgPoint
} from '@/types';
import {
  defaultMapConfig,
  visibleBounds,
  svgToLatLng,
  latLngToSvg
} from '@/lib/MapConfig';
import { showToast, initToasts } from '@/lib/Toast';
import { loadSVGDimensions } from '@/lib/SVGLoader';
import {
  getCurrentLODLevel,
  getMapPathForZoom,
  updateConfigForZoom,
  LODMapConfig
} from '@/lib/LODManager';
import dynamic from 'next/dynamic';
import DistanceMeasurement from './DistanceMeasurement';
import MapScale from './MapScale';
import SVGLayerControl, { SVGLayerControlRef } from './SVGLayerControl';
import GridComponent from './GridComponent';
import CoordinatesComponent from './CoordinatesComponent';
import ControlPanel from './ControlPanel';
import CountryLabelsComponent from './CountryLabelsComponent';

// Import Leaflet types
import type {
  Map as LeafletMap,
  LatLngBounds,
  CircleMarker,
  LatLng as LeafletLatLng
} from 'leaflet';

// Client-side only imports
const LeafletComponentLoader = dynamic(() => import('./LeafletLoader'), {
  ssr: false
});

interface MapProps {
  mapConfig?: Partial<MapConfig>;
}

const MapComponent: React.FC<MapProps> = ({ mapConfig: configOverrides }) => {
  // Refs
  const mapRef = useRef<LeafletMap | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInitializedRef = useRef<boolean>(false);
  const resizeHandlerRef = useRef<(() => void) | null>(null);
  const leafletRef = useRef<any>(null);
  const layerControlRef = useRef<SVGLayerControlRef>(null);
  const isWrappingRef = useRef<boolean>(false);
  const controlPanelAddedRef = useRef<boolean>(false);
  const baseLayersRef = useRef<Record<string, any>>({});
  const [showCountryPolygons, setShowCountryPolygons] = useState<boolean>(true);

  // State
  const [mapConfig, setMapConfig] = useState<MapConfig>({
    ...defaultMapConfig,
    ...configOverrides
  });
  const [primeMeridianSvg, setPrimeMeridianSvg] =
    useState<SvgPoint | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isLeafletLoaded, setIsLeafletLoaded] = useState(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showCoordinates, setShowCoordinates] = useState<boolean>(true);
  const [showPrimeMeridian, setShowPrimeMeridian] = useState<boolean>(false);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showCountryLabels, setShowCountryLabels] = useState<boolean>(true);
  const [currentZoom, setCurrentZoom] = useState<number>(
    mapConfig.initialZoom
  );
  const [currentLODLevel, setCurrentLODLevel] = useState(
    getCurrentLODLevel(mapConfig.initialZoom)
  );

  useEffect(() => {
    // Initialize toasts
    initToasts();

    // Load SVG dimensions
    async function loadDimensions() {
      try {
        // Get the appropriate LOD path based on initial zoom
        const initialPath = mapConfig.lodEnabled
          ? getMapPathForZoom(mapConfig.initialZoom)
          : mapConfig.masterMapPath;

        const dimensions = await loadSVGDimensions(initialPath);
        console.log(
          `Raw SVG dimensions from file: ${dimensions.width}x${dimensions.height}`
        );

        // Make sure dimensions are reasonable
        if (dimensions.width > 500 && dimensions.height > 500) {
          setMapConfig((prevConfig) => ({
            ...prevConfig,
            svgWidth: dimensions.width,
            svgHeight: dimensions.height
          }));
          console.log(
            `Updated SVG dimensions: ${dimensions.width}x${dimensions.height}`
          );
        } else {
          console.log('Using default dimensions');
        }
      } catch (e) {
        console.error('Error loading SVG dimensions:', e);
      }
    }

    loadDimensions();

    // Add window resize handler
    const handleResize = () => {
      if (mapRef.current) {
        try {
          mapRef.current.invalidateSize();
        } catch (e) {
          console.warn('Error during map resize:', e);
        }
      }
    };

    resizeHandlerRef.current = handleResize;
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      if (resizeHandlerRef.current) {
        window.removeEventListener('resize', resizeHandlerRef.current);
        resizeHandlerRef.current = null;
      }

      if (mapRef.current) {
        try {
          console.log('Cleaning up map instance');
          mapRef.current.remove();
          mapRef.current = null;
        } catch (e) {
          console.error('Error cleaning up map:', e);
        }
      }

      mapInitializedRef.current = false;
      isWrappingRef.current = false;
      controlPanelAddedRef.current = false;
    };
  }, [mapConfig.masterMapPath, mapConfig.initialZoom, mapConfig.lodEnabled]);

  // Initialize the prime meridian SVG point once the map is ready
  useEffect(() => {
    if (isMapReady && mapRef.current && !primeMeridianSvg) {
      setPrimeMeridianSvg({
        x: mapConfig.primeMeridianX,
        y: mapConfig.equatorY
      });
      console.log(
        'Initialized primeMeridianSvg:',
        mapConfig.primeMeridianX,
        mapConfig.equatorY
      );
    }
  }, [isMapReady, primeMeridianSvg, mapConfig]);

  // Add control panel once map is ready
  useEffect(() => {
    if (isMapReady && mapRef.current && leafletRef.current && !controlPanelAddedRef.current) {
      controlPanelAddedRef.current = true;
      console.log('Adding control panel to map');
    }
  }, [isMapReady]);

  // Handle LOD changes when zoom level changes
  useEffect(() => {
    if (!isMapReady || !mapRef.current || !leafletRef.current) return;
    if (!mapConfig.lodEnabled) return;

    const newLODLevel = getCurrentLODLevel(currentZoom);

    if (newLODLevel !== currentLODLevel) {
      console.log(
        `LOD level changed from ${currentLODLevel} to ${newLODLevel} at zoom ${currentZoom}`
      );
      setCurrentLODLevel(newLODLevel);

      const updatedConfig = updateConfigForZoom(
        mapConfig as LODMapConfig,
        currentZoom
      );

      const map = mapRef.current;
      const L = leafletRef.current;

      const bounds = L.latLngBounds(
        L.latLng(mapConfig.bounds.south, mapConfig.bounds.west),
        L.latLng(mapConfig.bounds.north, mapConfig.bounds.east)
      );

      if (baseLayersRef.current.baseMap) {
        baseLayersRef.current.baseMap.removeFrom(map);
      }
      if (baseLayersRef.current.leftCopy) {
        baseLayersRef.current.leftCopy.removeFrom(map);
      }
      if (baseLayersRef.current.rightCopy) {
        baseLayersRef.current.rightCopy.removeFrom(map);
      }

      const baseMap = L.imageOverlay(updatedConfig.baseMapUrl, bounds);
      baseMap.addTo(map);
      baseLayersRef.current.baseMap = baseMap;

      const leftCopy = L.imageOverlay(
        updatedConfig.baseMapUrl,
        L.latLngBounds(
          L.latLng(mapConfig.bounds.south, mapConfig.bounds.west - mapConfig.svgWidth),
          L.latLng(mapConfig.bounds.north, mapConfig.bounds.east - mapConfig.svgWidth)
        )
      ).addTo(map);
      baseLayersRef.current.leftCopy = leftCopy;

      const rightCopy = L.imageOverlay(
        updatedConfig.baseMapUrl,
        L.latLngBounds(
          L.latLng(mapConfig.bounds.south, mapConfig.bounds.west + mapConfig.svgWidth),
          L.latLng(mapConfig.bounds.north, mapConfig.bounds.east + mapConfig.svgWidth)
        )
      ).addTo(map);
      baseLayersRef.current.rightCopy = rightCopy;

      setMapConfig(updatedConfig);
      showToast(`Switched to ${newLODLevel} resolution map`, 'info', 2000);
    }
  }, [currentZoom, isMapReady, currentLODLevel, mapConfig]);

  // Handle horizontal wraparound
  const handleMapWraparound = () => {
    const map = mapRef.current;
    if (!map) return;

    const center = map.getCenter();
    const svgWidth = mapConfig.svgWidth;

    let newCenterLng = center.lng;

    if (center.lng < 0) {
      newCenterLng += svgWidth; // wrap to right side
    } else if (center.lng > svgWidth) {
      newCenterLng -= svgWidth; // wrap to left side
    }

    if (newCenterLng !== center.lng) {
      map.panTo([center.lat, newCenterLng], {
        animate: false,
        duration: 0,
        easeLinearity: 1,
        noMoveStart: true
      });
    }
  };

  // Map initialization after Leaflet is loaded
  const handleMapInit = (L: any) => {
    if (!mapContainerRef.current || mapInitializedRef.current) {
      console.log('Map already initialized or container not available');
      return;
    }

    leafletRef.current = L;
    setIsLeafletLoaded(true);
    showToast('Initializing map...', 'info', 3000);

    try {
      mapInitializedRef.current = true;
      console.log('Creating map with container:', mapContainerRef.current);

      // Create a custom simple CRS for the SVG map.
      const customCRS = L.extend({}, L.CRS.Simple, {
        transformation: new L.Transformation(1, 0, 1, 0),
        wrapLng: null,
        wrapLat: null
      });

      const map = L.map(mapContainerRef.current, {
        crs: customCRS,
        minZoom: mapConfig.minZoom,
        maxZoom: mapConfig.maxZoom,
        zoomControl: false,
        attributionControl: false,
        inertia: false,
        bounceAtZoomLimits: false
      });

      L.control.attribution({
        position: 'bottomright',
        prefix: '© IxMaps v4.0.0'
      }).addTo(map);

      // Calculate bounds based on SVG dimensions.
      const bounds = L.latLngBounds(
        L.latLng(mapConfig.bounds.south, mapConfig.bounds.west),
        L.latLng(mapConfig.bounds.north, mapConfig.bounds.east)
      );

      const initialMapUrl = mapConfig.lodEnabled
        ? getMapPathForZoom(mapConfig.initialZoom)
        : mapConfig.baseMapUrl;

      const baseMap = L.imageOverlay(initialMapUrl, bounds);
      baseMap.addTo(map);
      baseLayersRef.current.baseMap = baseMap;

      const leftCopy = L.imageOverlay(
        initialMapUrl,
        L.latLngBounds(
          L.latLng(mapConfig.bounds.south, mapConfig.bounds.west - mapConfig.svgWidth),
          L.latLng(mapConfig.bounds.north, mapConfig.bounds.east - mapConfig.svgWidth)
        )
      ).addTo(map);
      baseLayersRef.current.leftCopy = leftCopy;

      const rightCopy = L.imageOverlay(
        initialMapUrl,
        L.latLngBounds(
          L.latLng(mapConfig.bounds.south, mapConfig.bounds.west + mapConfig.svgWidth),
          L.latLng(mapConfig.bounds.north, mapConfig.bounds.east + mapConfig.svgWidth)
        )
      ).addTo(map);
      baseLayersRef.current.rightCopy = rightCopy;

      map.fitBounds(bounds);

      // Set vertical bounds only so horizontal wraparound is enabled.
      const verticalBounds = L.latLngBounds(
        L.latLng(mapConfig.bounds.south, -Infinity),
        L.latLng(mapConfig.bounds.north, Infinity)
      );
      map.setMaxBounds(verticalBounds);

      L.control.zoom({ position: 'topleft' }).addTo(map);

      mapRef.current = map;
      console.log('Map initialized successfully');

      map.on('zoomend', () => {
        const newZoom = map.getZoom();
        console.log('Map zoom level:', newZoom);
        setCurrentZoom(newZoom);
      });

      map.on('moveend', () => {
        console.log('Map center:', map.getCenter());
        handleMapWraparound();
      });

      map.on('move', () => {
        handleMapWraparound();
      });

      setPrimeMeridianSvg({
        x: mapConfig.primeMeridianX,
        y: mapConfig.equatorY
      });

      setTimeout(() => {
        setIsMapReady(true);
        showToast('Map initialized successfully!', 'success', 3000);
      }, 1000);
    } catch (error) {
      console.error('Error initializing map:', error);
      showToast(`Map initialization failed: ${error}`, 'error', 5000);
      mapInitializedRef.current = false;
    }
  };

  // Toggle handlers
  const toggleGrid = (visible: boolean) => {
    setShowGrid(visible);
  };

  const toggleCoordinates = (visible: boolean) => {
    setShowCoordinates(visible);
  };

  const togglePrimeMeridian = (visible: boolean) => {
    setShowPrimeMeridian(visible);
    console.log('Prime Meridian visibility toggled to:', visible);
  };

  const toggleLabels = (visible: boolean) => {
    setShowLabels(visible);
  };

  const toggleCountryLabels = (visible: boolean) => {
    setShowCountryLabels(visible);
    console.log('Country labels visibility toggled to:', visible);
  };

  return (
    <div
      ref={mapContainerRef}
      id="map"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#D5FFFF',
        position: 'relative'
      }}
    >
      {/* Load Leaflet only on client-side */}
      <LeafletComponentLoader onLeafletLoad={handleMapInit} />

      {/* Add the GridComponent */}
      {isMapReady && mapRef.current && leafletRef.current && (
        <GridComponent
          map={mapRef.current}
          L={leafletRef.current}
          primeMeridianSvg={primeMeridianSvg}
          svgToLatLng={svgToLatLng}
          latLngToSvg={latLngToSvg}
          visible={showGrid}
          svgWidth={mapConfig.svgWidth}
          svgHeight={mapConfig.svgHeight}
        />
      )}

      {/* Add the CoordinatesComponent */}
      {isMapReady && mapRef.current && leafletRef.current && (
        <CoordinatesComponent
          map={mapRef.current}
          L={leafletRef.current}
          visible={showCoordinates}
          showPrimeMeridian={showPrimeMeridian}
          mapConfig={mapConfig}
          svgWidth={mapConfig.svgWidth}
          svgHeight={mapConfig.svgHeight}
          primeMeridianSvg={primeMeridianSvg}
          setPrimeMeridianSvg={setPrimeMeridianSvg}
        />
      )}

      {/* Add the SVGLayerControl */}
      {isMapReady && mapRef.current && leafletRef.current && (
        <SVGLayerControl
          ref={layerControlRef}
          map={mapRef.current}
          L={leafletRef.current}
          mapConfig={mapConfig}
          position="topright"
        />
      )}

      {/* Add the ControlPanel */}
      <ControlPanel
        map={mapRef.current}
        L={leafletRef.current}
        onToggleGrid={toggleGrid}
        onToggleLabels={toggleLabels}
        onToggleCountryLabels={toggleCountryLabels}
        onTogglePrimeMeridian={togglePrimeMeridian}
        onTogglePosition={toggleCoordinates}
        mapConfig={mapConfig}
        layerControlRef={layerControlRef}
      />

      {/* Add the MapScale component */}
      {isMapReady && mapRef.current && leafletRef.current && (
        <MapScale map={mapRef.current} L={leafletRef.current} mapConfig={mapConfig} />
      )}

      {/* Add the distance measurement component */}
      {isMapReady && mapRef.current && leafletRef.current && (
        <DistanceMeasurement map={mapRef.current} L={leafletRef.current} />
      )}

      {/* LOD level indicator for debugging */}
      {mapConfig.lodEnabled && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            background: 'rgba(255, 255, 255, 0.7)',
            padding: '5px',
            borderRadius: '3px',
            fontSize: '12px',
            zIndex: 1000
          }}
        >
          LOD: {currentLODLevel} (Zoom: {currentZoom.toFixed(1)})
        </div>
      )}
    </div>
  );
};

export default MapComponent;
