// Modified GridComponent.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { gridStyle, visibleBounds } from '@/lib/MapConfig';
import { SvgPoint, LatLng } from '@/types';

interface GridComponentProps {
  map: any;
  L: any;
  primeMeridianSvg: SvgPoint | null;
  svgToLatLng: (x: number, y: number) => LatLng;
  latLngToSvg: (lat: number, lng: number) => SvgPoint;
  visible: boolean;
  svgWidth: number;
  svgHeight: number;
}

const GridComponent: React.FC<GridComponentProps> = ({
  map,
  L,
  primeMeridianSvg,
  svgToLatLng,
  latLngToSvg,
  visible,
  svgWidth,
  svgHeight
}) => {
  const gridLayerRef = useRef<any>(null);
  const initializedRef = useRef<boolean>(false);
  
  // Initialize grid layers when component mounts
  useEffect(() => {
    if (!map || !L) return;
    
    // Create custom pane with very high z-index to ensure it's on top
    const gridPane = 'grid-pane';
    
    if (!map.getPane(gridPane)) {
      map.createPane(gridPane);
      map.getPane(gridPane).style.zIndex = 650;
    }
    
    // Create layer group in this pane
    const gridLayer = L.layerGroup([], { pane: gridPane });
    gridLayerRef.current = gridLayer;
    
    // Always add layer to map, control visibility later
    gridLayer.addTo(map);
    
    // Set up event handlers for immediate updates
    const updateGrid = () => {
      if (visible && primeMeridianSvg) {
        drawGrid();
      }
    };
    
    map.on('zoomend', updateGrid);
    map.on('moveend', updateGrid);
    map.on('move', updateGrid); // Add this for more responsive updates
    
    initializedRef.current = true;
    
    // Draw immediately if possible
    if (visible && primeMeridianSvg) {
      // Small timeout to ensure map is fully ready
      setTimeout(drawGrid, 50);
    }
    
    return () => {
      // Cleanup event handlers
      map.off('zoomend', updateGrid);
      map.off('moveend', updateGrid);
      map.off('move', updateGrid);
      
      // Remove layer
      if (gridLayerRef.current) {
        map.removeLayer(gridLayerRef.current);
      }
    };
  }, [map, L, svgWidth, svgHeight]);
  
  // Update when visibility or prime meridian changes
  useEffect(() => {
    if (!map || !gridLayerRef.current) return;
    
    if (visible && primeMeridianSvg) {
      drawGrid();
    } else if (!visible && gridLayerRef.current) {
      gridLayerRef.current.clearLayers();
    }
  }, [visible, primeMeridianSvg, map]);

  // Draw coordinate grid based on zoom level and current view
  const drawGrid = () => {
    if (!map || !gridLayerRef.current || !primeMeridianSvg || !visible) return;
    
    try {
      // Clear existing grid
      gridLayerRef.current.clearLayers();
      
      const zoom = map.getZoom();
      
      // Adjust grid spacing based on zoom - matching old implementation
      let spacing = 30; // Default 30 degree spacing for lowest zoom
      if (zoom > 2) spacing = 15; // At higher zoom, use 15 degrees
      if (zoom > 3) spacing = 10; // Even higher zoom, use 10 degrees
      if (zoom > 4) spacing = 5;  // At highest zoom, use 5 degrees
      
      // Prime meridian is our 0° longitude reference
      const primeMeridianX = primeMeridianSvg.x;
      
      // Get visible bounds in SVG coordinates
      const southPoint = latLngToSvg(visibleBounds.southLat, 0);
      const northPoint = latLngToSvg(visibleBounds.northLat, 0);
      
      // Get current view bounds
      const bounds = map.getBounds();
      const visibleWest = bounds.getWest();
      const visibleEast = bounds.getEast();
      const visibleNorth = bounds.getNorth();
      const visibleSouth = bounds.getSouth();
      
      // Add buffer for smooth appearance/disappearance (matching old implementation)
      const bufferWidth = svgWidth * 0.1; // 10% buffer
      
      // Calculate pixels per degree for longitude
      const pixelsPerDegree = svgWidth / 360;
      
      // Track labeled positions to prevent overlap
      const labeledPositions: number[] = [];
      const LABEL_MIN_DISTANCE = 40; // Minimum distance between labels in pixels
      
      // Draw the prime meridian (0°) and its wrapped instances
      const drawMeridian = (xPosition: number) => {
        // Draw the meridian line
        L.polyline([
          [southPoint.y, xPosition], // Bottom of map
          [northPoint.y, xPosition]  // Top of map
        ], {
          color: gridStyle.PRIME_MERIDIAN_COLOR,
          weight: gridStyle.PRIME_MERIDIAN_WEIGHT,
          opacity: gridStyle.PRIME_MERIDIAN_OPACITY,
          dashArray: gridStyle.PRIME_MERIDIAN_DASH_ARRAY,
          pane: 'grid-pane'
        }).addTo(gridLayerRef.current);
        
        // Add prime meridian label
        const labelPos = L.latLng(visibleSouth + (visibleNorth - visibleSouth) * 0.05, xPosition);
        
        if (!labeledPositions.some(pos => Math.abs(pos - xPosition) < LABEL_MIN_DISTANCE)) {
          L.marker(labelPos, {
            icon: L.divIcon({
              className: 'grid-label prime-meridian-label',
              html: '0°',
              iconSize: [40, 20],
              iconAnchor: [20, 0]
            }),
            pane: 'grid-pane'
          }).addTo(gridLayerRef.current);
          
          labeledPositions.push(xPosition);
        }
      };
      
      // Draw all instances of prime meridian to ensure it's always visible
      drawMeridian(primeMeridianX);           // Original
      drawMeridian(primeMeridianX + svgWidth); // Right wraparound
      drawMeridian(primeMeridianX - svgWidth); // Left wraparound
      
      // Calculate how many grid lines we need in each direction
      const maxLinesPerSide = Math.ceil(180 / spacing);
      
      // Draw longitude lines east of prime meridian
      for (let i = 1; i <= maxLinesPerSide; i++) {
        const lng = i * spacing;
        const isMajor = lng % 30 === 0;
        
        // Calculate SVG X coordinate
        const offsetPixels = lng * pixelsPerDegree;
        const svgX = primeMeridianX + offsetPixels;
        
        // Draw original line and wraparounds to ensure visibility
        const drawLongitudeLine = (x: number) => {
          // Only draw if within visible range with buffer
          if (x >= visibleWest - bufferWidth && x <= visibleEast + bufferWidth) {
            L.polyline([
              [southPoint.y, x], // Bottom of map
              [northPoint.y, x]  // Top of map
            ], {
              color: gridStyle.GRID_COLOR,
              weight: isMajor ? gridStyle.MAJOR_LINE_WEIGHT : gridStyle.MINOR_LINE_WEIGHT,
              opacity: gridStyle.LINE_OPACITY,
              dashArray: isMajor ? gridStyle.MAJOR_DASH_ARRAY : gridStyle.DASH_ARRAY,
              pane: 'grid-pane'
            }).addTo(gridLayerRef.current);
            
            // Add label for major lines
            if (isMajor) {
              const labelPos = L.latLng(visibleSouth + (visibleNorth - visibleSouth) * 0.05, x);
              
              // Check for label overlap
              if (!labeledPositions.some(pos => Math.abs(pos - x) < LABEL_MIN_DISTANCE)) {
                L.marker(labelPos, {
                  icon: L.divIcon({
                    className: 'grid-label',
                    html: `${lng}° E`,
                    iconSize: [40, 20],
                    iconAnchor: [20, 0]
                  }),
                  pane: 'grid-pane'
                }).addTo(gridLayerRef.current);
                
                labeledPositions.push(x);
              }
            }
          }
        };
        
        // Draw multiple instances to handle wraparound
        drawLongitudeLine(svgX);
        drawLongitudeLine(svgX - svgWidth);
        drawLongitudeLine(svgX + svgWidth);
      }
      
      // Draw longitude lines west of prime meridian
      for (let i = 1; i <= maxLinesPerSide; i++) {
        const lng = i * spacing;
        const isMajor = lng % 30 === 0;
        
        // Calculate SVG X coordinate
        const offsetPixels = lng * pixelsPerDegree;
        const svgX = primeMeridianX - offsetPixels;
        
        // Draw original line and wraparounds to ensure visibility
        const drawLongitudeLine = (x: number) => {
          // Only draw if within visible range with buffer
          if (x >= visibleWest - bufferWidth && x <= visibleEast + bufferWidth) {
            L.polyline([
              [southPoint.y, x], // Bottom of map
              [northPoint.y, x]  // Top of map
            ], {
              color: gridStyle.GRID_COLOR,
              weight: isMajor ? gridStyle.MAJOR_LINE_WEIGHT : gridStyle.MINOR_LINE_WEIGHT,
              opacity: gridStyle.LINE_OPACITY,
              dashArray: isMajor ? gridStyle.MAJOR_DASH_ARRAY : gridStyle.DASH_ARRAY,
              pane: 'grid-pane'
            }).addTo(gridLayerRef.current);
            
            // Add label for major lines
            if (isMajor) {
              const labelPos = L.latLng(visibleSouth + (visibleNorth - visibleSouth) * 0.05, x);
              
              // Check for label overlap
              if (!labeledPositions.some(pos => Math.abs(pos - x) < LABEL_MIN_DISTANCE)) {
                L.marker(labelPos, {
                  icon: L.divIcon({
                    className: 'grid-label',
                    html: `${lng}° W`,
                    iconSize: [40, 20],
                    iconAnchor: [20, 0]
                  }),
                  pane: 'grid-pane'
                }).addTo(gridLayerRef.current);
                
                labeledPositions.push(x);
              }
            }
          }
        };
        
        // Draw multiple instances to handle wraparound
        drawLongitudeLine(svgX);
        drawLongitudeLine(svgX - svgWidth);
        drawLongitudeLine(svgX + svgWidth);
      }
      
      // Draw latitude lines
      // Calculate reasonable bounds for latitude lines
      const startLat = Math.floor(visibleBounds.southLat / spacing) * spacing;
      const endLat = Math.ceil(visibleBounds.northLat / spacing) * spacing;
      
      for (let lat = startLat; lat <= endLat; lat += spacing) {
        const isMajor = lat % 30 === 0;
        const isEquator = lat === 0;
        
        // Get SVG y-coordinate for this latitude
        const svgY = latLngToSvg(lat, 0).y;
        
        // Draw line across full map width with extra margin
        const fullWidth = svgWidth * 3; // Three times the width for good measure
        const centerX = visibleWest + (visibleEast - visibleWest) / 2;
        const lineStart = centerX - fullWidth / 2;
        
        L.polyline([
          [svgY, lineStart], // Left edge with buffer
          [svgY, lineStart + fullWidth] // Right edge with buffer
        ], {
          color: isEquator ? gridStyle.EQUATOR_COLOR : gridStyle.GRID_COLOR,
          weight: (isMajor || isEquator) ? gridStyle.MAJOR_LINE_WEIGHT : gridStyle.MINOR_LINE_WEIGHT,
          opacity: gridStyle.LINE_OPACITY,
          dashArray: (isMajor || isEquator) ? null : gridStyle.DASH_ARRAY,
          pane: 'grid-pane'
        }).addTo(gridLayerRef.current);
        
        // Add label to each major latitude line or equator
        if (isMajor || isEquator) {
          // Position label at the left side of the visible area
          const labelPos = L.latLng(svgY, visibleWest + (visibleEast - visibleWest) * 0.05);
          
          const labelClass = isEquator ? 'grid-label equator-label' : 'grid-label';
          
          L.marker(labelPos, {
            icon: L.divIcon({
              className: labelClass,
              html: `${Math.abs(lat)}° ${lat >= 0 ? 'N' : 'S'}`,
              iconSize: [40, 20],
              iconAnchor: [0, 10]
            }),
            pane: 'grid-pane'
          }).addTo(gridLayerRef.current);
        }
      }
    } catch (error) {
      console.error('Error drawing grid:', error);
    }
  };
  
  return null; // This component doesn't render any DOM elements
};

export default GridComponent;
