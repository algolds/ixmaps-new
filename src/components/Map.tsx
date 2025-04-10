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
import type { Map as LeafletMap, LatLngBounds, CircleMarker } from 'leaflet';

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
  const clickMarkerRef = useRef<CircleMarker | null>(null);
  const mapInitializedRef = useRef<boolean>(false);
  const resizeHandlerRef = useRef<(() => void) | null>(null);
  const leafletRef = useRef<any>(null);
  const initialCenterAppliedRef = useRef<boolean>(false);
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

  // Init the prime meridian with default values immediately to prevent race conditions
  useEffect(() => {
    if (!primeMeridianSvg && mapConfig.primeMeridianX && mapConfig.equatorY) {
      console.log('Setting initial prime meridian position');
      setPrimeMeridianSvg({ 
        x: mapConfig.primeMeridianX, 
        y: mapConfig.equatorY 
      });
    }
  }, [mapConfig]);

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
      initialCenterAppliedRef.current = false;
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

  // Function to center map on prime meridian
  const centerOnPrimeMeridian = () => {
    if (mapRef.current && primeMeridianSvg && primeMeridianSvg.x) {
      // Center vertically in the middle of the map, horizontally at prime meridian
      const centerY = mapConfig.svgHeight / 2;
      isWrappingRef.current = true; // Prevent wraparound during centering
      mapRef.current.panTo([centerY, primeMeridianSvg.x], {animate: true, duration: 1});
      console.log('Map centered on prime meridian', primeMeridianSvg.x);
      initialCenterAppliedRef.current = true;
      
      // Reset wrapping flag after animation completes
      setTimeout(() => {
        isWrappingRef.current = false;
      }, 1100);
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

      // Fit to bounds - don't immediately center as we'll do that later on the prime meridian
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

      map.on('click', (e: any) => {
        addCoordinateMarker(e, L);
      });

      // Initialize prime meridian coordinates if not already set
      if (!primeMeridianSvg) {
        setPrimeMeridianSvg({ 
          x: mapConfig.primeMeridianX, 
          y: mapConfig.equatorY 
        });
      }

      // Initial centering with a slight delay to ensure the map is fully ready
      setTimeout(() => {
        // Center on prime meridian after initial drawing
        centerOnPrimeMeridian();
        
        setIsMapReady(true);
        showToast('Map initialized successfully!', 'success', 3000);
      }, 1000);

    } catch (error) {
      console.error('Error initializing map:', error);
      showToast(`Map initialization failed: ${error}`, 'error', 5000);
      mapInitializedRef.current = false; // Reset so we can try again
    }
  };

  // Convert SVG coordinates to geographic coordinates
  const svgToLatLng = (x: number, y: number): LatLng => {
    // Map y-coordinate to latitude range with proper N/S orientation
    const latRange = visibleBounds.northLat - visibleBounds.southLat;
    // Calculate latitude with southLat as the base
    const lat = visibleBounds.southLat + ((mapConfig.svgHeight - y) / mapConfig.svgHeight * latRange);
    
    // Calculate longitude in standard way
    const lng = (x / mapConfig.svgWidth * 360) - 180;
    
    return { lat, lng };
  };

  // Convert geographic coordinates to SVG coordinates
  const latLngToSvg = (lat: number, lng: number): SvgPoint => {
    // Convert latitude to y coordinate with proper orientation
    const latRange = visibleBounds.northLat - visibleBounds.southLat;
    const y = mapConfig.svgHeight - ((lat - visibleBounds.southLat) / latRange) * mapConfig.svgHeight;
    
    // Convert longitude to x coordinate with wraparound
    const normalizedLng = ((lng + 180) % 360) / 360;
    const x = normalizedLng * mapConfig.svgWidth;
    
    return { x, y };
  };

  // Convert SVG coordinates to custom lat/lng using prime meridian as reference
  const svgToCustomLatLng = (x: number, y: number): LatLng => {
    // Calculate standard lat/lng first
    const standardLatLng = svgToLatLng(x, y);
    
    // Ensure prime meridian reference exists
    if (!primeMeridianSvg || !primeMeridianSvg.x) {
      console.error("Prime meridian reference not initialized");
      return standardLatLng;
    }
    
    // The latitude remains the same
    const lat = standardLatLng.lat;
    
    // Calculate longitude relative to prime meridian
    // First normalize both x coordinates to 0-mapWidth range
    const normalizedX = ((x % mapConfig.svgWidth) + mapConfig.svgWidth) % mapConfig.svgWidth;
    const normalizedPrimeMeridianX = ((primeMeridianSvg.x % mapConfig.svgWidth) + mapConfig.svgWidth) % mapConfig.svgWidth;
    
    // Calculate the offset, taking into account possible wraparound
    let lngOffset = normalizedX - normalizedPrimeMeridianX;
    
    // If the offset is more than half the map width, it's shorter to go the other way around
    if (Math.abs(lngOffset) > mapConfig.svgWidth / 2) {
      if (lngOffset > 0) {
        lngOffset -= mapConfig.svgWidth;
      } else {
        lngOffset += mapConfig.svgWidth;
      }
    }
    
    // Convert offset to longitude degrees
    const lngScale = 360 / mapConfig.svgWidth;
    const lng = lngOffset * lngScale;
    
    return { lat, lng };
  };
  
  // Format coordinate for display
  const formatCoord = (value: number, posLabel: string, negLabel: string): string => {
    const absValue = Math.abs(value);
    const direction = value >= 0 ? posLabel : negLabel;
    return `${absValue.toFixed(2)}° ${direction}`;
  };

  // Add coordinate marker when clicking on map
  const addCoordinateMarker = (e: any, L: any) => {
    const map = mapRef.current;
    if (!map || !primeMeridianSvg) return;

    try {
      // Remove existing marker
      if (clickMarkerRef.current) {
        map.removeLayer(clickMarkerRef.current);
      }
      
      // Get coordinates using custom system
      const customCoord = svgToCustomLatLng(e.latlng.lng, e.latlng.lat);
      
      // Create marker
      const marker = L.circleMarker(e.latlng, {
        radius: 5,
        color: '#FF4500',
        fillColor: '#FFA07A',
        fillOpacity: 1,
        weight: 2
      }).addTo(map);
      
      // Store marker in ref
      clickMarkerRef.current = marker;
      
      // Create popup with coordinates
      const coordText = `
        <div style="text-align:center;">
          <strong>Coordinates:</strong><br>
          Lat: ${formatCoord(customCoord.lat, 'N', 'S')}<br>
          Lng: ${formatCoord(customCoord.lng, 'E', 'W')}
        </div>
      `;
      
      marker.bindPopup(coordText).openPopup();
      
      // Show toast notification
      showToast(`Clicked at Lat: ${formatCoord(customCoord.lat, 'N', 'S')}, Lng: ${formatCoord(customCoord.lng, 'E', 'W')}`, 'info', 3000);
    } catch (e) {
      console.error('Error adding coordinate marker:', e);
    }
  };

  // Effect to handle prime meridian updates and centering
  useEffect(() => {
    if (mapRef.current && primeMeridianSvg && primeMeridianSvg.x && !initialCenterAppliedRef.current) {
      // Center on prime meridian when it changes
      centerOnPrimeMeridian();
    }
  }, [primeMeridianSvg]);

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
          svgToLatLng={svgToLatLng}
          latLngToSvg={latLngToSvg}
          visible={showGrid}
          svgWidth={mapConfig.svgWidth}
          svgHeight={mapConfig.svgHeight}
        />
      )}
      
      {/* Add the CoordinatesComponent */}
      {isMapReady && mapRef.current && leafletRef.current && primeMeridianSvg && (
        <CoordinatesComponent
          map={mapRef.current}
          L={leafletRef.current}
          svgToCustomLatLng={svgToCustomLatLng}
          formatCoord={formatCoord}
          visible={showCoordinates}
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