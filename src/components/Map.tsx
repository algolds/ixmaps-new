'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapConfig, LatLng, SvgPoint } from '@/types';
import { defaultMapConfig, visibleBounds } from '@/lib/MapConfig';
import { showToast, initToasts } from '@/lib/Toast';
import { loadSVGDimensions } from '@/lib/SVGLoader';
import dynamic from 'next/dynamic';
import DistanceMeasurement from './DistanceMeasurement';
import MapScale from './MapScale';
import SVGLayerControl from './SVGLayerControl';
import GridComponent from './GridComponent';
import CoordinatesComponent from './CoordinatesComponent';
import ControlPanel from './ControlPanel';

// Import Leaflet types
import type { Map as LeafletMap, LatLngBounds, CircleMarker, LatLng as LeafletLatLng } from 'leaflet';

// Client-side only imports
const LeafletComponentLoader = dynamic(
  () => import('./LeafletLoader'),
  { ssr: false }
);

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
  const isWrappingRef = useRef<boolean>(false); // Track if we're currently wrapping
  const controlPanelAddedRef = useRef<boolean>(false);

  // State
  const [mapConfig, setMapConfig] = useState<MapConfig>({
    ...defaultMapConfig,
    ...configOverrides
  });
  const [primeMeridianSvg, setPrimeMeridianSvg] = useState<SvgPoint | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isLeafletLoaded, setIsLeafletLoaded] = useState(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showCoordinates, setShowCoordinates] = useState<boolean>(true);
  const [showPrimeMeridian, setShowPrimeMeridian] = useState<boolean>(false);

  useEffect(() => {
    // Initialize toasts
    initToasts();

    // Load SVG dimensions
    async function loadDimensions() {
      try {
        const dimensions = await loadSVGDimensions(mapConfig.masterMapPath);
        console.log(`Raw SVG dimensions from file: ${dimensions.width}x${dimensions.height}`);
        
        // Make sure dimensions are reasonable
        if (dimensions.width > 500 && dimensions.height > 500) {
          setMapConfig(prevConfig => ({
            ...prevConfig,
            svgWidth: dimensions.width,
            svgHeight: dimensions.height
          }));
          console.log(`Updated SVG dimensions: ${dimensions.width}x${dimensions.height}`);
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
    
    // Store the handler in a ref for cleanup
    resizeHandlerRef.current = handleResize;
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      // Remove event listeners
      if (resizeHandlerRef.current) {
        window.removeEventListener('resize', resizeHandlerRef.current);
        resizeHandlerRef.current = null;
      }
      
      // Clean up map instance
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
  }, [mapConfig.masterMapPath]);

  // Add control panel once map is ready
  useEffect(() => {
    if (isMapReady && mapRef.current && leafletRef.current && !controlPanelAddedRef.current) {
      // Add control panel
      controlPanelAddedRef.current = true;
      
      console.log('Adding control panel to map');
    }
  }, [isMapReady]);

  // Function to handle horizontal wraparound
  const handleMapWraparound = () => {
    const map = mapRef.current;
    if (!map) return;

    const center = map.getCenter();
    const svgWidth = mapConfig.svgWidth;

    // Calculate the new center position based on the current center
    let newCenterLng = center.lng;

    // If we've panned beyond the left edge
    if (center.lng < 0) {
      newCenterLng += svgWidth; // Wrap to the right side
    } 
    // If we've panned beyond the right edge
    else if (center.lng > svgWidth) {
      newCenterLng -= svgWidth; // Wrap to the left side
    }

    // Pan to the new center position
    if (newCenterLng !== center.lng) {
      map.panTo([center.lat, newCenterLng], {
        animate: false,
        duration: 0,
        easeLinearity: 1,
        noMoveStart: true
      });
    }
  };

  // Function to handle map initialization after Leaflet is loaded
  const handleMapInit = (L: any) => {
    if (!mapContainerRef.current || mapInitializedRef.current) {
      console.log('Map already initialized or container not available');
      return;
    }
    
    leafletRef.current = L;
    setIsLeafletLoaded(true);
    showToast('Initializing map...', 'info', 3000);

    try {
      // Mark as initialized before creating the map to prevent multiple initializations
      mapInitializedRef.current = true;
      
      console.log('Creating map with container:', mapContainerRef.current);
      
      // Create a custom simple CRS for the SVG map
      const customCRS = L.extend({}, L.CRS.Simple, {
        transformation: new L.Transformation(1, 0, 1, 0),
        wrapLng: null,
        wrapLat: null
      });

      // Initialize the map
      const map = L.map(mapContainerRef.current, {
        crs: customCRS,
        minZoom: mapConfig.minZoom,
        maxZoom: mapConfig.maxZoom,
        zoomControl: false,
        attributionControl: false,
        inertia: false,
        bounceAtZoomLimits: false
      });

      // Add attribution control
      L.control.attribution({
        position: 'bottomright',
        prefix: '© IxMaps v4.0.0'
      }).addTo(map);
      
      // Calculate bounds based on SVG dimensions
      const bounds = L.latLngBounds(
        L.latLng(mapConfig.bounds.south, mapConfig.bounds.west),
        L.latLng(mapConfig.bounds.north, mapConfig.bounds.east)
      );

      // Add the base map layer with SVG
      const baseMap = L.imageOverlay(mapConfig.baseMapUrl, bounds);
      baseMap.addTo(map);

      // Create wraparound copies of the base map
      const leftCopy = L.imageOverlay(
        mapConfig.baseMapUrl,
        L.latLngBounds(
          L.latLng(mapConfig.bounds.south, mapConfig.bounds.west - mapConfig.svgWidth),
          L.latLng(mapConfig.bounds.north, mapConfig.bounds.east - mapConfig.svgWidth)
        )
      ).addTo(map);
      
      const rightCopy = L.imageOverlay(
        mapConfig.baseMapUrl,
        L.latLngBounds(
          L.latLng(mapConfig.bounds.south, mapConfig.bounds.west + mapConfig.svgWidth),
          L.latLng(mapConfig.bounds.north, mapConfig.bounds.east + mapConfig.svgWidth)
        )
      ).addTo(map);

      // Fit to bounds
      map.fitBounds(bounds);
      
      // Set max bounds for vertical constraint only (to allow horizontal wraparound)
      const verticalBounds = L.latLngBounds(
        L.latLng(mapConfig.bounds.south, -Infinity), // Allow infinity in horizontal direction
        L.latLng(mapConfig.bounds.north, Infinity)   // Set vertical bounds to the SVG height
      );
      map.setMaxBounds(verticalBounds);
      
      // Add zoom control
      L.control.zoom({
        position: 'topleft'
      }).addTo(map);

      // Store refs
      mapRef.current = map;

      console.log('Map initialized successfully');

      // Set up event handlers
      map.on('zoomend', () => {
        console.log('Map zoom level:', map.getZoom());
      });

      map.on('moveend', () => {
        console.log('Map center:', map.getCenter());
        // Handle wraparound
        handleMapWraparound();
      });
      
      // Add continuous wraparound handler during drag
      map.on('move', () => {
        handleMapWraparound();
      });

      // Initial map setup
      setTimeout(() => {
        setIsMapReady(true);
        showToast('Map initialized successfully!', 'success', 3000);
      }, 1000);

    } catch (error) {
      console.error('Error initializing map:', error);
      showToast(`Map initialization failed: ${error}`, 'error', 5000);
      mapInitializedRef.current = false; // Reset so we can try again
    }
  };

  // Toggle handlers for controls
  const toggleGrid = (visible: boolean) => {
    setShowGrid(visible);
  };

  const toggleCoordinates = (visible: boolean) => {
    setShowCoordinates(visible);
  };

  const togglePrimeMeridian = (visible: boolean) => {
    setShowPrimeMeridian(visible);
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
      {isMapReady && mapRef.current && leafletRef.current && primeMeridianSvg && (
        <GridComponent 
          map={mapRef.current}
          L={leafletRef.current}
          primeMeridianSvg={primeMeridianSvg}
          svgToLatLng={(x, y) => {
            // Just a stub that will be replaced by the CoordinatesComponent's function
            const latRange = visibleBounds.northLat - visibleBounds.southLat;
            const lat = visibleBounds.southLat + ((mapConfig.svgHeight - y) / mapConfig.svgHeight * latRange);
            const lng = (x / mapConfig.svgWidth * 360) - 180;
            return { lat, lng };
          }}
          latLngToSvg={(lat, lng) => {
            // Just a stub that will be replaced by the CoordinatesComponent's function
            const latRange = visibleBounds.northLat - visibleBounds.southLat;
            const y = mapConfig.svgHeight - ((lat - visibleBounds.southLat) / latRange) * mapConfig.svgHeight;
            const normalizedLng = ((lng + 180) % 360) / 360;
            const x = normalizedLng * mapConfig.svgWidth;
            return { x, y };
          }}
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
      
      {/* Add the SVG Layer Control component */}
      {isMapReady && mapRef.current && leafletRef.current && (
        <SVGLayerControl 
          map={mapRef.current} 
          L={leafletRef.current} 
          mapConfig={mapConfig} 
          position="topright"
        />
      )}
      
      {/* Add the ControlPanel */}
      {isMapReady && mapRef.current && leafletRef.current && (
        <ControlPanel
          map={mapRef.current}
          L={leafletRef.current}
          onToggleGrid={toggleGrid}
          onToggleLabels={() => {}}
          onTogglePrimeMeridian={togglePrimeMeridian}
          onTogglePosition={toggleCoordinates}
        />
      )}
      
      {/* Add the MapScale component */}
      {isMapReady && mapRef.current && leafletRef.current && (
        <MapScale map={mapRef.current} L={leafletRef.current} mapConfig={mapConfig} />
      )}
      
      {/* Add the distance measurement component */}
      {isMapReady && mapRef.current && leafletRef.current && (
        <DistanceMeasurement map={mapRef.current} L={leafletRef.current} />
      )}
    </div>
  );
};

export default MapComponent;