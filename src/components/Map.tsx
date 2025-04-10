'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapConfig, LatLng, SvgPoint } from '@/types';
import { defaultMapConfig, visibleBounds } from '@/lib/MapConfig';
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
  const layerControlRef = useRef<SVGLayerControlRef>(null);
  const isWrappingRef = useRef<boolean>(false); // Track if we're currently wrapping
  const controlPanelAddedRef = useRef<boolean>(false);
  const baseLayersRef = useRef<Record<string, any>>({});

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
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showCountryLabels, setShowCountryLabels] = useState<boolean>(true);
  const [currentZoom, setCurrentZoom] = useState<number>(mapConfig.initialZoom);
  const [currentLODLevel, setCurrentLODLevel] = useState(getCurrentLODLevel(mapConfig.initialZoom));

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
  }, [mapConfig.masterMapPath, mapConfig.initialZoom, mapConfig.lodEnabled]);

  // Initialize the prime meridian SVG point once the map is ready
  useEffect(() => {
    if (isMapReady && mapRef.current && !primeMeridianSvg) {
      // Initialize the prime meridian SVG point directly from the mapConfig
      setPrimeMeridianSvg({
        x: mapConfig.primeMeridianX,
        y: mapConfig.equatorY
      });
      console.log('Initialized primeMeridianSvg:', mapConfig.primeMeridianX, mapConfig.equatorY);
    }
  }, [isMapReady, primeMeridianSvg, mapConfig]);

  // Add control panel once map is ready
  useEffect(() => {
    if (isMapReady && mapRef.current && leafletRef.current && !controlPanelAddedRef.current) {
      // Add control panel
      controlPanelAddedRef.current = true;
      
      console.log('Adding control panel to map');
    }
  }, [isMapReady]);

  // Handle LOD changes when zoom level changes
  useEffect(() => {
    if (!isMapReady || !mapRef.current || !leafletRef.current) return;
    
    // Skip if LOD is not enabled
    if (!mapConfig.lodEnabled) return;
    
    // Get the new LOD level based on current zoom
    const newLODLevel = getCurrentLODLevel(currentZoom);
    
    // If LOD level changed, update the map
    if (newLODLevel !== currentLODLevel) {
      console.log(`LOD level changed from ${currentLODLevel} to ${newLODLevel} at zoom ${currentZoom}`);
      setCurrentLODLevel(newLODLevel);
      
      // Update map config with new LOD paths
      const updatedConfig = updateConfigForZoom(mapConfig as LODMapConfig, currentZoom);
      
      // Handle layer replacement if necessary
      if (updatedConfig.baseMapUrl !== mapConfig.baseMapUrl) {
        console.log(`Switching base map to: ${updatedConfig.baseMapUrl}`);
        
        const map = mapRef.current;
        const L = leafletRef.current;
        
        // Calculate bounds based on SVG dimensions
        const bounds = L.latLngBounds(
          L.latLng(mapConfig.bounds.south, mapConfig.bounds.west),
          L.latLng(mapConfig.bounds.north, mapConfig.bounds.east)
        );

        // Remove existing base layers
        if (baseLayersRef.current.baseMap) {
          baseLayersRef.current.baseMap.removeFrom(map);
        }
        if (baseLayersRef.current.leftCopy) {
          baseLayersRef.current.leftCopy.removeFrom(map);
        }
        if (baseLayersRef.current.rightCopy) {
          baseLayersRef.current.rightCopy.removeFrom(map);
        }

        // Add new base map layer with updated SVG
        const baseMap = L.imageOverlay(updatedConfig.baseMapUrl, bounds);
        baseMap.addTo(map);
        baseLayersRef.current.baseMap = baseMap;

        // Create wraparound copies of the base map
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
        
        // Update config state
        setMapConfig(updatedConfig);
        
        showToast(`Switched to ${newLODLevel} resolution map`, 'info', 2000);
      }
    }
  }, [currentZoom, isMapReady, currentLODLevel, mapConfig]);

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

      // Get initial map URL based on LOD if enabled
      const initialMapUrl = mapConfig.lodEnabled
        ? getMapPathForZoom(mapConfig.initialZoom)
        : mapConfig.baseMapUrl;

      // Add the base map layer with SVG
      const baseMap = L.imageOverlay(initialMapUrl, bounds);
      baseMap.addTo(map);
      baseLayersRef.current.baseMap = baseMap;

      // Create wraparound copies of the base map
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
        const newZoom = map.getZoom();
        console.log('Map zoom level:', newZoom);
        setCurrentZoom(newZoom);
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

      // Initialize the prime meridian SVG point
      setPrimeMeridianSvg({
        x: mapConfig.primeMeridianX,
        y: mapConfig.equatorY
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
    console.log('Prime Meridian visibility toggled to:', visible);
  };
  
  const toggleLabels = (visible: boolean) => {
    setShowLabels(visible);
  };
  
  const toggleCountryLabels = (visible: boolean) => {
    setShowCountryLabels(visible);
    console.log('Country labels visibility toggled to:', visible);
  };

  // Convert SVG coordinates to geographic coordinates - helper function
  const svgToLatLng = (x: number, y: number): LatLng => {
    // Map y-coordinate to latitude range with proper N/S orientation
    const latRange = visibleBounds.northLat - visibleBounds.southLat;
    // Calculate latitude with southLat as the base
    const lat = visibleBounds.southLat + ((mapConfig.svgHeight - y) / mapConfig.svgHeight * latRange);
    
    // Calculate longitude with prime meridian offset (30°E)
    // First convert to 0-360 range
    const rawLng = (x / mapConfig.svgWidth * 360);
    // Then shift by 30 degrees (prime meridian offset) and normalize to -180 to 180
    const lng = ((rawLng + 30) % 360) - 180;
    
    return { lat, lng };
  };

  // Convert geographic coordinates to SVG coordinates - helper function
  const latLngToSvg = (lat: number, lng: number): SvgPoint => {
    // Convert latitude to y coordinate with proper orientation
    const latRange = visibleBounds.northLat - visibleBounds.southLat;
    const y = mapConfig.svgHeight - ((lat - visibleBounds.southLat) / latRange) * mapConfig.svgHeight;
    
    // Convert longitude to x coordinate with wraparound and prime meridian adjustment
    // First shift to 0-360 range with prime meridian (30°E) at 0
    const adjustedLng = ((lng - 30 + 540) % 360);
    // Then normalize to 0-1 range and scale to SVG width
    const x = (adjustedLng / 360) * mapConfig.svgWidth;
    
    return { x, y };
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
      
      {/* Add the ControlPanel with layer control reference */}
      {isMapReady && mapRef.current && leafletRef.current && (
        <ControlPanel
          map={mapRef.current}
          L={leafletRef.current}
          onToggleGrid={toggleGrid}
          onToggleLabels={toggleLabels}
          onTogglePrimeMeridian={togglePrimeMeridian}
          onTogglePosition={toggleCoordinates}
          onToggleCountryLabels={toggleCountryLabels}
          mapConfig={mapConfig}
          layerControlRef={layerControlRef}
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
      
      {/* Optional: LOD level indicator for debugging */}
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