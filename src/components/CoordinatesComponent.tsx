'use client';

import React, { useEffect, useState, useRef } from 'react';
import { LatLng } from 'leaflet';
import { SvgPoint } from '@/types';
import { visibleBounds } from '@/lib/MapConfig';
import { showToast } from '@/lib/Toast';

interface CoordinatesComponentProps {
  map: any;
  L: any;
  visible: boolean;
  showPrimeMeridian: boolean;
  mapConfig: any;
  svgWidth: number;
  svgHeight: number;
  primeMeridianSvg: SvgPoint | null;
  setPrimeMeridianSvg: (point: SvgPoint | null) => void;
}

const CoordinatesComponent: React.FC<CoordinatesComponentProps> = ({
  map,
  L,
  visible,
  showPrimeMeridian,
  mapConfig,
  svgWidth,
  svgHeight,
  primeMeridianSvg,
  setPrimeMeridianSvg
}) => {
  const [displayAdded, setDisplayAdded] = useState(false);
  const clickMarkerRef = useRef<any>(null);
  const isWrappingRef = useRef<boolean>(false);
  const initialCenterAppliedRef = useRef<boolean>(false);
  const primeMeridianLayerRef = useRef<any>(null);
  
  // Initialize prime meridian coordinates if not already set
  useEffect(() => {
    if (!primeMeridianSvg && mapConfig.primeMeridianX && mapConfig.equatorY) {
      console.log('Setting initial prime meridian position');
      setPrimeMeridianSvg({ 
        x: mapConfig.primeMeridianX, 
        y: mapConfig.equatorY 
      });
    }
  }, [mapConfig, primeMeridianSvg, setPrimeMeridianSvg]);

  // Effect to handle prime meridian updates and centering
  useEffect(() => {
    if (map && primeMeridianSvg && primeMeridianSvg.x && !initialCenterAppliedRef.current) {
      // Center on prime meridian when it changes
      centerOnPrimeMeridian();
    }
  }, [primeMeridianSvg, map]);
  
  // Function to center map on prime meridian
  const centerOnPrimeMeridian = () => {
    if (map && primeMeridianSvg && primeMeridianSvg.x) {
      // Center vertically in the middle of the map, horizontally at prime meridian
      const centerY = mapConfig.svgHeight / 2;
      isWrappingRef.current = true; // Prevent wraparound during centering
      map.panTo([centerY, primeMeridianSvg.x], {animate: true, duration: 1});
      console.log('Map centered on prime meridian', primeMeridianSvg.x);
      initialCenterAppliedRef.current = true;
      
      // Reset wrapping flag after animation completes
      setTimeout(() => {
        isWrappingRef.current = false;
      }, 1100);
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
    
    // Return a Leaflet LatLng instance instead of a plain object
    return L.latLng(lat, lng);
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
      return L.latLng(standardLatLng.lat, standardLatLng.lng); // Return as Leaflet LatLng
    }
    
    // The latitude remains the same
    const lat = standardLatLng.lat;
    
    // Calculate longitude relative to prime meridian
    // First normalize both x coordinates to 0-mapWidth range
    const normalizedX = ((x % svgWidth) + svgWidth) % svgWidth;
    const normalizedPrimeMeridianX = ((primeMeridianSvg.x % svgWidth) + svgWidth) % svgWidth;
    
    // Calculate the offset, taking into account possible wraparound
    let lngOffset = normalizedX - normalizedPrimeMeridianX;
    
    // If the offset is more than half the map width, it's shorter to go the other way around
    if (Math.abs(lngOffset) > svgWidth / 2) {
      if (lngOffset > 0) {
        lngOffset -= svgWidth;
      } else {
        lngOffset += svgWidth;
      }
    }
    
    // Convert offset to longitude degrees
    const lngScale = 360 / svgWidth;
    const lng = lngOffset * lngScale;
    
    // Return as a Leaflet LatLng
    return L.latLng(lat, lng);
  };
  
  // Format coordinate for display
  const formatCoord = (value: number, posLabel: string, negLabel: string): string => {
    const absValue = Math.abs(value);
    const direction = value >= 0 ? posLabel : negLabel;
    return `${absValue.toFixed(2)}° ${direction}`;
  };

  // Add coordinate marker when clicking on map
  const addCoordinateMarker = (e: any) => {
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

  // Setup click handler on map
  useEffect(() => {
    if (!map) return;
    
    map.on('click', addCoordinateMarker);
    
    return () => {
      map.off('click', addCoordinateMarker);
      if (clickMarkerRef.current) {
        try {
          map.removeLayer(clickMarkerRef.current);
        } catch (e) {
          console.warn('Error removing click marker:', e);
        }
      }
    };
  }, [map, primeMeridianSvg]);

  // Effect to handle Prime Meridian visibility
  useEffect(() => {
    if (!map || !primeMeridianSvg || !primeMeridianLayerRef.current) return;
    
    // Toggle visibility based on showPrimeMeridian prop
    if (showPrimeMeridian) {
      // Make sure the Prime Meridian layer is added to the map
      if (!map.hasLayer(primeMeridianLayerRef.current)) {
        primeMeridianLayerRef.current.addTo(map);
      }
      console.log('Showing Prime Meridian');
    } else {
      // Remove the Prime Meridian layer from the map
      if (map.hasLayer(primeMeridianLayerRef.current)) {
        primeMeridianLayerRef.current.removeFrom(map);
      }
      console.log('Hiding Prime Meridian');
    }
  }, [showPrimeMeridian, map, primeMeridianSvg]);

  // Create Prime Meridian layer
  useEffect(() => {
    if (!map || !L || !primeMeridianSvg) return;
    
    // Create Prime Meridian layer if it doesn't exist
    if (!primeMeridianLayerRef.current) {
      // Create a pane for the Prime Meridian with high z-index
      const meridianPane = 'prime-meridian-pane';
      if (!map.getPane(meridianPane)) {
        map.createPane(meridianPane);
        map.getPane(meridianPane).style.zIndex = 651; // Higher than grid
      }
      
      // Create layer group for Prime Meridian
      const primeMeridianLayer = L.layerGroup([], { pane: meridianPane });
      primeMeridianLayerRef.current = primeMeridianLayer;
      
      // Draw Prime Meridian Line
      drawPrimeMeridian();
      
      // Only add to map if visibility is enabled
      if (showPrimeMeridian) {
        primeMeridianLayer.addTo(map);
      }
    } else {
      // Update existing layer
      redrawPrimeMeridian();
    }
  }, [map, L, primeMeridianSvg]);
  
  // Draw Prime Meridian lines and labels
  const drawPrimeMeridian = () => {
    if (!map || !L || !primeMeridianSvg || !primeMeridianLayerRef.current) return;
    
    try {
      // Clear existing prime meridian
      primeMeridianLayerRef.current.clearLayers();
      
      // Get SVG coordinates for visible bounds
      const southPoint = latLngToSvg(visibleBounds.southLat, 0);
      const northPoint = latLngToSvg(visibleBounds.northLat, 0);
      
      // Function to draw a meridian instance
      const drawMeridianLine = (xPosition: number): void => {
        // Draw the meridian line
        L.polyline([
          [southPoint.y, xPosition], 
          [northPoint.y, xPosition]
        ], {
          color: '#FF8000',
          weight: 2.5,
          opacity: 0.8,
          dashArray: '8,6',
          pane: 'prime-meridian-pane'
        }).addTo(primeMeridianLayerRef.current);
        
        // Get current view bounds
        const bounds = map.getBounds();
        const southBound = bounds.getSouth();
        const northBound = bounds.getNorth();
        
        // Add meridian label
        L.marker(L.latLng(southBound + (northBound - southBound) * 0.1, xPosition), {
          icon: L.divIcon({
            className: 'prime-meridian-label',
            html: 'Prime Meridian (0°)',
            iconSize: [120, 30],
            iconAnchor: [60, 15]
          }),
          pane: 'prime-meridian-pane'
        }).addTo(primeMeridianLayerRef.current);
        
        // Add reference point marker if in view
        const markerY = primeMeridianSvg.y;
        if (markerY >= southBound && markerY <= northBound) {
          L.circleMarker(L.latLng(markerY, xPosition), {
            radius: 8,
            color: '#FF8000',
            fillColor: '#FFFF00',
            fillOpacity: 0.7,
            weight: 2,
            pane: 'prime-meridian-pane'
          }).bindPopup(`
            <strong>Prime Meridian Reference</strong><br>
            Map Reference: 0° Longitude
          `).addTo(primeMeridianLayerRef.current);
        }
      };
      
      // Draw all instances of the meridian (original + wraparounds)
      drawMeridianLine(primeMeridianSvg.x);           // Original
      drawMeridianLine(primeMeridianSvg.x + svgWidth); // Right wraparound
      drawMeridianLine(primeMeridianSvg.x - svgWidth); // Left wraparound
    } catch (error) {
      console.error('Error drawing prime meridian:', error);
    }
  };
  
  // Redraw Prime Meridian when map view changes
  const redrawPrimeMeridian = () => {
    if (!showPrimeMeridian) return;
    drawPrimeMeridian();
  };
  
  // Set up coordinate display control
  useEffect(() => {
    if (!map || !L || displayAdded) return;
    
    // Create a custom pane with high z-index for the coordinates display
    const coordinatesPane = 'coordinates-pane';
    if (!map.getPane(coordinatesPane)) {
      map.createPane(coordinatesPane);
      map.getPane(coordinatesPane).style.zIndex = 655; // Higher than grid
    }
    
    // Create coordinate display control
    const CoordDisplay = L.Control.extend({
      options: {
        position: 'bottomleft'
      },
      
      onAdd: function() {
        const container = L.DomUtil.create('div', 'coordinates-display ixmap-coordinates-display');
        container.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        container.style.padding = '5px 10px';
        container.style.borderRadius = '4px';
        container.style.fontSize = '12px';
        container.style.fontFamily = 'monospace';
        container.style.boxShadow = '0 0 5px rgba(0, 0, 0, 0.2)';
        container.style.marginBottom = '5px';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '1000';
        container.style.maxWidth = '180px';
        container.style.display = visible ? 'block' : 'none';
        container.innerHTML = 'Coordinates: Hover on map';
        
        return container;
      }
    });
    
    // Add the control to the map
    const coordDisplay = new CoordDisplay();
    coordDisplay.addTo(map);
    setDisplayAdded(true);
    
    // Update coordinates on mousemove
    const mouseMoveHandler = (e: any) => {
      try {
        const customCoord = svgToCustomLatLng(e.latlng.lng, e.latlng.lat);
        const container = document.querySelector('.ixmap-coordinates-display');
        if (container) {
          container.innerHTML = `Lat: ${formatCoord(customCoord.lat, 'N', 'S')}<br>Lng: ${formatCoord(customCoord.lng, 'E', 'W')}`;
        }
      } catch (err) {
        console.warn('Error updating coordinates:', err);
      }
    };
    
    map.on('mousemove', mouseMoveHandler);
    
    // Update Prime Meridian on map view changes
    map.on('moveend', redrawPrimeMeridian);
    map.on('zoomend', redrawPrimeMeridian);
    
    // Cleanup
    return () => {
      map.off('mousemove', mouseMoveHandler);
      map.off('moveend', redrawPrimeMeridian);
      map.off('zoomend', redrawPrimeMeridian);
      
      // Try to remove the control
      try {
        if (coordDisplay && coordDisplay.remove) {
          coordDisplay.remove();
        }
      } catch (e) {
        console.warn('Error removing coordinates display:', e);
      }
    };
  }, [map, L, visible, displayAdded]);
  
  // Update visibility when changed
  useEffect(() => {
    const container = document.querySelector('.ixmap-coordinates-display') as HTMLElement;
    if (container) {
      container.style.display = visible ? 'block' : 'none';
    }
  }, [visible]);
  
  return null; // Control is added directly to the map
};

export default CoordinatesComponent;