'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapConfig, LatLng, SvgPoint } from '@/types';
import { defaultMapConfig, gridStyle, visibleBounds } from '@/lib/MapConfig';
import { showToast, initToasts } from '@/lib/Toast';
import { loadSVGDimensions } from '@/lib/SVGLoader';
import dynamic from 'next/dynamic';
import DistanceMeasurement from './DistanceMeasurement';
import MapScale from './MapScale';

// Import Leaflet types
import type { Map as LeafletMap, LatLngBounds, LayerGroup, CircleMarker } from 'leaflet';

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
  const gridLayerRef = useRef<LayerGroup | null>(null);
  const primeMeridianLayerRef = useRef<LayerGroup | null>(null);
  const clickMarkerRef = useRef<CircleMarker | null>(null);
  const mapInitializedRef = useRef<boolean>(false);
  const resizeHandlerRef = useRef<(() => void) | null>(null);
  const leafletRef = useRef<any>(null);
  const initialCenterAppliedRef = useRef<boolean>(false);
  const isWrappingRef = useRef<boolean>(false); // Track if we're currently wrapping

  // State
  const [mapConfig, setMapConfig] = useState<MapConfig>({
    ...defaultMapConfig,
    ...configOverrides
  });
  const [primeMeridianSvg, setPrimeMeridianSvg] = useState<SvgPoint | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isLeafletLoaded, setIsLeafletLoaded] = useState(false);

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
    };
  }, [mapConfig.masterMapPath]);

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

      // Create layer groups
      const gridLayer = L.layerGroup().addTo(map);
      const primeMeridianLayer = L.layerGroup().addTo(map);

      // Store refs
      mapRef.current = map;
      gridLayerRef.current = gridLayer;
      primeMeridianLayerRef.current = primeMeridianLayer;

      console.log('Map initialized successfully');

      // Add coordinates display control
      const CoordDisplay = L.Control.extend({
        options: {
          position: 'bottomleft'
        },
        
        onAdd: function() {
          const container = L.DomUtil.create('div', 'coordinates-display');
          container.innerHTML = 'Coordinates: Hover over the map';
          return container;
        }
      });
      
      // Add the coordinates display to the map
      const coordDisplay = new CoordDisplay();
      coordDisplay.addTo(map);
      
      // Update coordinates on mousemove
      map.on('mousemove', (e: { latlng: { lng: number; lat: number; }; }) => {
        try {
          const customCoord = svgToCustomLatLng(e.latlng.lng, e.latlng.lat);
          const container = document.querySelector('.coordinates-display');
          if (container) {
            container.innerHTML = `Coordinates:<br>Lat: ${formatCoord(customCoord.lat, 'N', 'S')}, Lng: ${formatCoord(customCoord.lng, 'E', 'W')}`;
          }
        } catch (err) {
          console.warn('Error updating coordinates:', err);
        }
      });

      // Set up event handlers
      map.on('zoomend', () => {
        console.log('Map zoom level:', map.getZoom());
        // Only try to draw grid if prime meridian is set
        if (primeMeridianSvg) {
          drawGrid(L);
        }
      });

      map.on('moveend', () => {
        console.log('Map center:', map.getCenter());
        // Handle wraparound
        handleMapWraparound();
        
        // Only try to draw grid if prime meridian is set
        if (primeMeridianSvg) {
          drawGrid(L);
        }
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

      // Initial draw with a slight delay to ensure the map is fully ready
      setTimeout(() => {
        // Only draw if prime meridian is ready
        if (primeMeridianSvg) {
          try {
            drawGrid(L);
            drawPrimeMeridian(L);
            
            // Center on prime meridian after initial drawing
            centerOnPrimeMeridian();
          } catch (e) {
            console.error('Error during initial grid drawing:', e);
          }
        }
        setIsMapReady(true);
        showToast('Map initialized successfully!', 'success', 3000);
      }, 1000);

    } catch (error) {
      console.error('Error initializing map:', error);
      showToast(`Map initialization failed: ${error}`, 'error', 5000);
      mapInitializedRef.current = false; // Reset so we can try again
    }
  };

  // Check if a new label position would overlap with existing ones
  const isLabelPositionSafe = (position: number, labeledPositions: number[], minDistance: number): boolean => {
    for (let i = 0; i < labeledPositions.length; i++) {
      if (Math.abs(position - labeledPositions[i]) < minDistance) {
        return false;
      }
    }
    return true;
  };

  // Helper function to add a longitude label and track its position
  const addLongitudeLabel = (
    L: any, 
    gridLayer: any, 
    labelPos: any, 
    labelText: string, 
    labeledPositions: number[], 
    xPosition: number
  ): void => {
    L.marker(labelPos, {
      icon: L.divIcon({
        className: 'grid-label',
        html: labelText,
        iconSize: [40, 20],
        iconAnchor: [20, 0]
      })
    }).addTo(gridLayer);
    
    labeledPositions.push(xPosition);
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

  // Draw coordinate grid based on zoom level
  const drawGrid = (L: any) => {
    const map = mapRef.current;
    const gridLayer = gridLayerRef.current;
    
    if (!map || !gridLayer || !primeMeridianSvg) {
      console.log("Cannot draw grid: Map, grid layer, or prime meridian not initialized", {
        map: !!map,
        gridLayer: !!gridLayer,
        primeMeridianSvg: !!primeMeridianSvg
      });
      return;
    }

    try {
      // Clear existing grid
      gridLayer.clearLayers();
      
      const zoom = map.getZoom();
      
      // Adjust grid spacing based on zoom
      let spacing = 30; // Default 30 degree spacing
      if (zoom > 3) spacing = 15; // At higher zoom, use 15 degrees
      if (zoom > 4) spacing = 10; // Even higher zoom, use 10 degrees
      if (zoom > 5) spacing = 5;  // At highest zoom, use 5 degrees
      
      // Prime meridian is our 0° longitude reference
      const primeMeridianX = primeMeridianSvg.x;
      
      // Get visible bounds in SVG coordinates
      const southPoint = latLngToSvg(visibleBounds.southLat, 0);
      const northPoint = latLngToSvg(visibleBounds.northLat, 0);
      
      // Get current view bounds for clipping
      const bounds = map.getBounds();
      const visibleWest = bounds.getWest();
      const visibleEast = bounds.getEast();
      
      // Add buffer to ensure grid lines appear smoothly when scrolling
      const bufferWidth = mapConfig.svgWidth * 0.1; // 10% buffer
      
      // Calculate pixels per degree for longitude
      const pixelsPerDegree = mapConfig.svgWidth / 360;
      
      // Track labeled positions to prevent overlap
      const labeledPositions: number[] = [];
      const LABEL_MIN_DISTANCE = 50; // Minimum distance between labels in pixels
      
      // Draw the prime meridian (0°) and its wrapped instances
      const drawMeridian = (xPosition: number): void => {
        if (xPosition >= visibleWest - bufferWidth && xPosition <= visibleEast + bufferWidth) {
          L.polyline([
            [southPoint.y, xPosition], // Bottom of visible map
            [northPoint.y, xPosition]  // Top of visible map
          ], {
            color: '#FF8000', // Orange for prime meridian
            weight: 2,
            opacity: 0.8,
            dashArray: '8,6'
          }).addTo(gridLayer);
          
          // Prime meridian label
          const meridianLabelPos = L.latLng(southPoint.y + 20, xPosition);
          // Add label only if it won't overlap with existing ones
          if (isLabelPositionSafe(xPosition, labeledPositions, LABEL_MIN_DISTANCE)) {
            L.marker(meridianLabelPos, {
              icon: L.divIcon({
                className: 'grid-label prime-meridian-label',
                html: '0°',
                iconSize: [40, 20],
                iconAnchor: [20, 0]
              })
            }).addTo(gridLayer);
            
            // Record this position
            labeledPositions.push(xPosition);
          }
        }
      };
      
      // Draw all instances of prime meridian
      drawMeridian(primeMeridianX);
      drawMeridian(primeMeridianX + mapConfig.svgWidth);  // Right wraparound
      drawMeridian(primeMeridianX - mapConfig.svgWidth);  // Left wraparound
      
      // Calculate how many grid lines we need
      const maxLines = Math.ceil(360 / spacing);
      
      // First pass: Draw all grid lines
      // Draw lines east of prime meridian
      for (let i = 1; i <= maxLines; i++) {
        const lng = i * spacing;
        const isMajor = lng % 30 === 0;
        
        // Calculate pixels from prime meridian
        const offsetPixels = lng * pixelsPerDegree;
        
        // Draw original line and wraparounds
        const svgX = primeMeridianX + offsetPixels;
        
        // Draw lines without labels first
        L.polyline([
          [southPoint.y, svgX], // Bottom of visible map
          [northPoint.y, svgX]  // Top of visible map
        ], {
          color: gridStyle.GRID_COLOR,
          weight: isMajor ? gridStyle.MAJOR_LINE_WEIGHT : gridStyle.MINOR_LINE_WEIGHT,
          opacity: gridStyle.LINE_OPACITY,
          dashArray: isMajor ? undefined : gridStyle.DASH_ARRAY
        }).addTo(gridLayer);
        
        L.polyline([
          [southPoint.y, svgX - mapConfig.svgWidth], // Bottom of visible map
          [northPoint.y, svgX - mapConfig.svgWidth]  // Top of visible map
        ], {
          color: gridStyle.GRID_COLOR,
          weight: isMajor ? gridStyle.MAJOR_LINE_WEIGHT : gridStyle.MINOR_LINE_WEIGHT,
          opacity: gridStyle.LINE_OPACITY,
          dashArray: isMajor ? undefined : gridStyle.DASH_ARRAY
        }).addTo(gridLayer);
        
        L.polyline([
          [southPoint.y, svgX + mapConfig.svgWidth], // Bottom of visible map
          [northPoint.y, svgX + mapConfig.svgWidth]  // Top of visible map
        ], {
          color: gridStyle.GRID_COLOR,
          weight: isMajor ? gridStyle.MAJOR_LINE_WEIGHT : gridStyle.MINOR_LINE_WEIGHT,
          opacity: gridStyle.LINE_OPACITY,
          dashArray: isMajor ? undefined : gridStyle.DASH_ARRAY
        }).addTo(gridLayer);
      }
      
      // Draw lines west of prime meridian
      for (let i = 1; i <= maxLines; i++) {
        const lng = i * spacing;
        const isMajor = lng % 30 === 0;
        
        // Calculate pixels from prime meridian
        const offsetPixels = lng * pixelsPerDegree;
        
        // Draw original line and wraparounds
        const svgX = primeMeridianX - offsetPixels;
        
        // Draw lines without labels first
        L.polyline([
          [southPoint.y, svgX], // Bottom of visible map
          [northPoint.y, svgX]  // Top of visible map
        ], {
          color: gridStyle.GRID_COLOR,
          weight: isMajor ? gridStyle.MAJOR_LINE_WEIGHT : gridStyle.MINOR_LINE_WEIGHT,
          opacity: gridStyle.LINE_OPACITY,
          dashArray: isMajor ? undefined : gridStyle.DASH_ARRAY
        }).addTo(gridLayer);
        
        L.polyline([
          [southPoint.y, svgX - mapConfig.svgWidth], // Bottom of visible map
          [northPoint.y, svgX - mapConfig.svgWidth]  // Top of visible map
        ], {
          color: gridStyle.GRID_COLOR,
          weight: isMajor ? gridStyle.MAJOR_LINE_WEIGHT : gridStyle.MINOR_LINE_WEIGHT,
          opacity: gridStyle.LINE_OPACITY,
          dashArray: isMajor ? undefined : gridStyle.DASH_ARRAY
        }).addTo(gridLayer);
        
        L.polyline([
          [southPoint.y, svgX + mapConfig.svgWidth], // Bottom of visible map
          [northPoint.y, svgX + mapConfig.svgWidth]  // Top of visible map
        ], {
          color: gridStyle.GRID_COLOR,
          weight: isMajor ? gridStyle.MAJOR_LINE_WEIGHT : gridStyle.MINOR_LINE_WEIGHT,
          opacity: gridStyle.LINE_OPACITY,
          dashArray: isMajor ? undefined : gridStyle.DASH_ARRAY
        }).addTo(gridLayer);
      }
      
      // Second pass: Add labels with overlap prevention
      // Draw labels for east lines
      for (let i = 1; i <= maxLines; i++) {
        const lng = i * spacing;
        const isMajor = lng % 30 === 0;
        if (!isMajor) continue;
        
        const offsetPixels = lng * pixelsPerDegree;
        const svgX = primeMeridianX + offsetPixels;
        
        // Try all three possible positions (original, left wrap, right wrap)
        // in order of visibility priority
        if (svgX >= visibleWest && svgX <= visibleEast && isLabelPositionSafe(svgX, labeledPositions, LABEL_MIN_DISTANCE)) {
          const labelPos = L.latLng(southPoint.y + 20, svgX);
          addLongitudeLabel(L, gridLayer, labelPos, `${lng}° E`, labeledPositions, svgX);
        } else if (svgX - mapConfig.svgWidth >= visibleWest && svgX - mapConfig.svgWidth <= visibleEast && 
                 isLabelPositionSafe(svgX - mapConfig.svgWidth, labeledPositions, LABEL_MIN_DISTANCE)) {
          const labelPos = L.latLng(southPoint.y + 20, svgX - mapConfig.svgWidth);
          addLongitudeLabel(L, gridLayer, labelPos, `${lng}° E`, labeledPositions, svgX - mapConfig.svgWidth);
        } else if (svgX + mapConfig.svgWidth >= visibleWest && svgX + mapConfig.svgWidth <= visibleEast && 
                 isLabelPositionSafe(svgX + mapConfig.svgWidth, labeledPositions, LABEL_MIN_DISTANCE)) {
          const labelPos = L.latLng(southPoint.y + 20, svgX + mapConfig.svgWidth);
          addLongitudeLabel(L, gridLayer, labelPos, `${lng}° E`, labeledPositions, svgX + mapConfig.svgWidth);
        }
      }
      
      // Draw labels for west lines
      for (let i = 1; i <= maxLines; i++) {
        const lng = i * spacing;
        const isMajor = lng % 30 === 0;
        if (!isMajor) continue;
        
        const offsetPixels = lng * pixelsPerDegree;
        const svgX = primeMeridianX - offsetPixels;
        
        // Try all three possible positions (original, left wrap, right wrap)
        // in order of visibility priority
        if (svgX >= visibleWest && svgX <= visibleEast && isLabelPositionSafe(svgX, labeledPositions, LABEL_MIN_DISTANCE)) {
          const labelPos = L.latLng(southPoint.y + 20, svgX);
          addLongitudeLabel(L, gridLayer, labelPos, `${lng}° W`, labeledPositions, svgX);
        } else if (svgX - mapConfig.svgWidth >= visibleWest && svgX - mapConfig.svgWidth <= visibleEast && 
                 isLabelPositionSafe(svgX - mapConfig.svgWidth, labeledPositions, LABEL_MIN_DISTANCE)) {
          const labelPos = L.latLng(southPoint.y + 20, svgX - mapConfig.svgWidth);
          addLongitudeLabel(L, gridLayer, labelPos, `${lng}° W`, labeledPositions, svgX - mapConfig.svgWidth);
        } else if (svgX + mapConfig.svgWidth >= visibleWest && svgX + mapConfig.svgWidth <= visibleEast && 
                 isLabelPositionSafe(svgX + mapConfig.svgWidth, labeledPositions, LABEL_MIN_DISTANCE)) {
          const labelPos = L.latLng(southPoint.y + 20, svgX + mapConfig.svgWidth);
          addLongitudeLabel(L, gridLayer, labelPos, `${lng}° W`, labeledPositions, svgX + mapConfig.svgWidth);
        }
      }
      
      // Draw latitude lines - only within visible bounds
      for (let lat = Math.ceil(visibleBounds.southLat / spacing) * spacing; 
           lat <= visibleBounds.northLat; 
           lat += spacing) {
        
        const isMajor = lat % 30 === 0;
        const isEquator = Math.abs(lat) < 0.001;
        
        // Get SVG coordinates for this latitude
        const svgY = latLngToSvg(lat, 0).y;
        
        // Draw the line across the full visible width
        const visibleWidth = visibleEast - visibleWest + (2 * bufferWidth);
        const lineStart = visibleWest - bufferWidth;
        
        L.polyline([
          [svgY, lineStart], // Left side of visible area with buffer
          [svgY, lineStart + visibleWidth] // Right side of visible area with buffer
        ], {
          color: isEquator ? gridStyle.EQUATOR_COLOR : gridStyle.GRID_COLOR,
          weight: (isMajor || isEquator) ? gridStyle.MAJOR_LINE_WEIGHT : gridStyle.MINOR_LINE_WEIGHT,
          opacity: gridStyle.LINE_OPACITY,
          dashArray: (isMajor || isEquator) ? undefined : gridStyle.DASH_ARRAY
        }).addTo(gridLayer);
        
        // Add label if needed
        if ((isMajor || isEquator)) {
          const labelPos = L.latLng(svgY, visibleWest + 20);
          
          // The display of N/S labels
          L.marker(labelPos, {
            icon: L.divIcon({
              className: 'grid-label',
              html: `${Math.abs(lat)}° ${lat >= 0 ? 'N' : 'S'}`,
              iconSize: [40, 20],
              iconAnchor: [0, 10]
            })
          }).addTo(gridLayer);
        }
      }
    } catch (error) {
      console.error('Error drawing grid:', error);
    }
  };

  // Draw prime meridian with proper wraparound
  const drawPrimeMeridian = (L: any) => {
    const map = mapRef.current;
    const primeMeridianLayer = primeMeridianLayerRef.current;
    
    if (!map || !primeMeridianLayer || !primeMeridianSvg) {
      console.log("Cannot draw prime meridian: Map, layer, or prime meridian not initialized", {
        map: !!map,
        primeMeridianLayer: !!primeMeridianLayer,
        primeMeridianSvg: !!primeMeridianSvg
      });
      return;
    }

    try {
      // Clear existing layers
      primeMeridianLayer.clearLayers();
      
      // Get SVG coordinates for visible bounds
      const southPoint = latLngToSvg(visibleBounds.southLat, 0);
      const northPoint = latLngToSvg(visibleBounds.northLat, 0);
      
      // Get current map view bounds
      const bounds = map.getBounds();
      const westBound = bounds.getWest();
      const eastBound = bounds.getEast();
      
      // Add buffer for smooth appearance/disappearance
      const bufferWidth = mapConfig.svgWidth * 0.1;
      
      // Function to draw a meridian instance
      const drawMeridianLine = (xPosition: number): void => {
        // Only draw if in visible area (with buffer)
        if (xPosition >= westBound - bufferWidth && xPosition <= eastBound + bufferWidth) {
          // Draw the meridian line
          L.polyline([
            [southPoint.y, xPosition], 
            [northPoint.y, xPosition]
          ], {
            color: gridStyle.PRIME_MERIDIAN_COLOR,
            weight: gridStyle.PRIME_MERIDIAN_WEIGHT,
            opacity: gridStyle.PRIME_MERIDIAN_OPACITY,
            dashArray: gridStyle.PRIME_MERIDIAN_DASH_ARRAY
          }).addTo(primeMeridianLayer);
          
          // Add meridian label
          L.marker(L.latLng(southPoint.y - 20, xPosition), {
            icon: L.divIcon({
              className: 'prime-meridian-label',
              html: 'Prime Meridian (0°)',
              iconSize: [120, 30],
              iconAnchor: [60, 15]
            })
          }).addTo(primeMeridianLayer);
          
          // Add reference point marker
          const markerY = primeMeridianSvg.y;
          if (markerY >= southPoint.y && markerY <= northPoint.y) {
            L.circleMarker(L.latLng(markerY, xPosition), {
              radius: 8,
              color: gridStyle.PRIME_MERIDIAN_COLOR,
              fillColor: '#FFFF00',
              fillOpacity: 0.7,
              weight: 2
            }).bindPopup(`
              <strong>Prime Meridian Reference</strong><br>
              Map Reference: 0° Longitude
            `).addTo(primeMeridianLayer);
          }
        }
      };
      
      // Draw all instances of the meridian
      drawMeridianLine(primeMeridianSvg.x);  // Original
      drawMeridianLine(primeMeridianSvg.x + mapConfig.svgWidth);  // Right wraparound
      drawMeridianLine(primeMeridianSvg.x - mapConfig.svgWidth);  // Left wraparound
    } catch (error) {
      console.error('Error drawing prime meridian:', error);
    }
  };

  // Effect to handle prime meridian updates and centering
  useEffect(() => {
    if (mapRef.current && primeMeridianSvg && primeMeridianSvg.x && !initialCenterAppliedRef.current) {
      // Center on prime meridian when it changes
      centerOnPrimeMeridian();
      
      // Redraw grid and meridian
      if (leafletRef.current) {
        try {
          drawGrid(leafletRef.current);
          drawPrimeMeridian(leafletRef.current);
        } catch (e) {
          console.error('Error redrawing after prime meridian update:', e);
        }
      }
    }
  }, [primeMeridianSvg]);

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