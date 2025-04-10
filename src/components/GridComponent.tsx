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
  const primeMeridianLayerRef = useRef<any>(null);
  
  // Initialize grid layers when component mounts
  useEffect(() => {
    if (!map || !L) return;
    
    // Create custom panes with very high z-index to ensure they're on top
    // Leaflet default panes are typically 400-700, so we go well above that
    const gridPane = 'grid-pane';
    const meridianPane = 'meridian-pane';
    
    if (!map.getPane(gridPane)) {
      map.createPane(gridPane);
      map.getPane(gridPane).style.zIndex = 650; // Very high z-index
    }
    
    if (!map.getPane(meridianPane)) {
      map.createPane(meridianPane);
      map.getPane(meridianPane).style.zIndex = 651; // Even higher z-index
    }
    
    // Create layer groups in these panes
    const gridLayer = L.layerGroup([], { pane: gridPane });
    const primeMeridianLayer = L.layerGroup([], { pane: meridianPane });
    
    // Only add to map if visible
    if (visible) {
      gridLayer.addTo(map);
      primeMeridianLayer.addTo(map);
    }
    
    gridLayerRef.current = gridLayer;
    primeMeridianLayerRef.current = primeMeridianLayer;
    
    // Set up event handlers for dynamic updates
    map.on('zoomend', () => {
      if (visible && primeMeridianSvg) {
        drawGrid();
        drawPrimeMeridian();
      }
    });

    map.on('moveend', () => {
      if (visible && primeMeridianSvg) {
        drawGrid();
        drawPrimeMeridian();
      }
    });
    
    // Add immediate grid updates during dragging for smoother experience
    map.on('move', () => {
      if (visible && primeMeridianSvg) {
        // Use requestAnimationFrame for better performance
        requestAnimationFrame(() => {
          drawGrid();
        });
      }
    });
    
    // Initial draw with slight delay to ensure map is ready
    if (visible && primeMeridianSvg) {
      setTimeout(() => {
        drawGrid();
        drawPrimeMeridian();
      }, 100);
    }
    
    return () => {
      // Cleanup event handlers
      map.off('zoomend');
      map.off('moveend');
      map.off('move');
      
      // Remove layers
      if (gridLayerRef.current) {
        map.removeLayer(gridLayerRef.current);
      }
      
      if (primeMeridianLayerRef.current) {
        map.removeLayer(primeMeridianLayerRef.current);
      }
    };
  }, [map, L, visible, primeMeridianSvg, svgWidth, svgHeight]);
  
  // Update when visibility changes
  useEffect(() => {
    if (!map || !gridLayerRef.current || !primeMeridianLayerRef.current) return;
    
    if (visible) {
      // Add layers to map if they aren't already
      if (!map.hasLayer(gridLayerRef.current)) {
        gridLayerRef.current.addTo(map);
      }
      if (!map.hasLayer(primeMeridianLayerRef.current)) {
        primeMeridianLayerRef.current.addTo(map);
      }
      
      if (primeMeridianSvg) {
        drawGrid();
        drawPrimeMeridian();
      }
    } else {
      // Remove layers from map
      gridLayerRef.current.removeFrom(map);
      primeMeridianLayerRef.current.removeFrom(map);
    }
  }, [visible, map, primeMeridianSvg]);

  // Draw coordinate grid based on zoom level and current view
  const drawGrid = () => {
    if (!map || !gridLayerRef.current || !primeMeridianSvg || !visible) return;
    
    try {
      // Clear existing grid
      gridLayerRef.current.clearLayers();
      
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
      
      // Get current view bounds for reference (but draw beyond these for complete grid)
      const bounds = map.getBounds();
      const visibleWest = bounds.getWest();
      const visibleEast = bounds.getEast();
      const visibleNorth = bounds.getNorth();
      const visibleSouth = bounds.getSouth();
      
      // Add buffer to ensure grid lines appear smoothly when scrolling
      const bufferWidth = svgWidth * 0.5; // 50% buffer to ensure full grid
      const bufferHeight = svgHeight * 0.5; // 50% buffer to ensure full grid
      
      // Calculate pixels per degree for longitude
      const pixelsPerDegree = svgWidth / 360;
      
      // Track labeled positions to prevent overlap
      const labeledPositions: number[] = [];
      const LABEL_MIN_DISTANCE = 40; // Minimum distance between labels in pixels
      
      // Draw the prime meridian (0°) and its wrapped instances
      const drawMeridian = (xPosition: number): void => {
        L.polyline([
          [southPoint.y, xPosition], // Bottom of map
          [northPoint.y, xPosition]  // Top of map
        ], {
          color: '#FF8000', // Orange for prime meridian
          weight: 2,
          opacity: 0.8,
          dashArray: '8,6',
          pane: 'grid-pane'
        }).addTo(gridLayerRef.current);
        
        // Prime meridian label - position near the bottom
        const meridianLabelPos = L.latLng(visibleSouth + (visibleNorth - visibleSouth) * 0.05, xPosition);
        
        // Add label only if it won't overlap
        if (!labeledPositions.some(pos => Math.abs(pos - xPosition) < LABEL_MIN_DISTANCE)) {
          L.marker(meridianLabelPos, {
            icon: L.divIcon({
              className: 'grid-label prime-meridian-label',
              html: '0°',
              iconSize: [40, 20],
              iconAnchor: [20, 0]
            }),
            pane: 'grid-pane'
          }).addTo(gridLayerRef.current);
          
          // Record this position
          labeledPositions.push(xPosition);
        }
      };
      
      // Draw all instances of prime meridian
      drawMeridian(primeMeridianX);
      drawMeridian(primeMeridianX + svgWidth);
      drawMeridian(primeMeridianX - svgWidth);
      
      // Calculate how many grid lines we need
      const maxLines = Math.ceil(360 / spacing);
      
      // Draw lines east of prime meridian
      for (let i = 1; i < maxLines; i++) {
        const lng = i * spacing;
        const isMajor = lng % 30 === 0;
        
        // Calculate pixels from prime meridian
        const offsetPixels = lng * pixelsPerDegree;
        
        // Draw original line and two wraparounds
        [-svgWidth, 0, svgWidth].forEach(offset => {
          const svgX = primeMeridianX + offsetPixels + offset;
          
          L.polyline([
            [southPoint.y, svgX], // Bottom
            [northPoint.y, svgX]  // Top
          ], {
            color: gridStyle.GRID_COLOR,
            weight: isMajor ? gridStyle.MAJOR_LINE_WEIGHT : gridStyle.MINOR_LINE_WEIGHT,
            opacity: gridStyle.LINE_OPACITY,
            dashArray: isMajor ? undefined : gridStyle.DASH_ARRAY,
            pane: 'grid-pane'
          }).addTo(gridLayerRef.current);
          
          // Add label if it's a major line and won't overlap
          if (isMajor && !labeledPositions.some(pos => Math.abs(pos - svgX) < LABEL_MIN_DISTANCE)) {
            const labelPos = L.latLng(visibleSouth + (visibleNorth - visibleSouth) * 0.05, svgX);
            
            L.marker(labelPos, {
              icon: L.divIcon({
                className: 'grid-label',
                html: `${lng}° E`,
                iconSize: [40, 20],
                iconAnchor: [20, 0]
              }),
              pane: 'grid-pane'
            }).addTo(gridLayerRef.current);
            
            labeledPositions.push(svgX);
          }
        });
      }
      
      // Draw lines west of prime meridian
      for (let i = 1; i < maxLines; i++) {
        const lng = i * spacing;
        const isMajor = lng % 30 === 0;
        
        // Calculate pixels from prime meridian
        const offsetPixels = lng * pixelsPerDegree;
        
        // Draw original line and two wraparounds
        [-svgWidth, 0, svgWidth].forEach(offset => {
          const svgX = primeMeridianX - offsetPixels + offset;
          
          L.polyline([
            [southPoint.y, svgX], // Bottom
            [northPoint.y, svgX]  // Top
          ], {
            color: gridStyle.GRID_COLOR,
            weight: isMajor ? gridStyle.MAJOR_LINE_WEIGHT : gridStyle.MINOR_LINE_WEIGHT,
            opacity: gridStyle.LINE_OPACITY,
            dashArray: isMajor ? undefined : gridStyle.DASH_ARRAY,
            pane: 'grid-pane'
          }).addTo(gridLayerRef.current);
          
          // Add label if it's a major line and won't overlap
          if (isMajor && !labeledPositions.some(pos => Math.abs(pos - svgX) < LABEL_MIN_DISTANCE)) {
            const labelPos = L.latLng(visibleSouth + (visibleNorth - visibleSouth) * 0.05, svgX);
            
            L.marker(labelPos, {
              icon: L.divIcon({
                className: 'grid-label',
                html: `${lng}° W`,
                iconSize: [40, 20],
                iconAnchor: [20, 0]
              }),
              pane: 'grid-pane'
            }).addTo(gridLayerRef.current);
            
            labeledPositions.push(svgX);
          }
        });
      }
      
      // Draw latitude lines - use full range
      // Calculate reasonable bounds for latitude lines
      const startLat = Math.max(visibleBounds.southLat + 5, -85); // Avoid exact pole
      const endLat = Math.min(visibleBounds.northLat - 5, 85);    // Avoid exact pole
      
      for (let lat = startLat; lat <= endLat; lat += spacing) {
        const isMajor = lat % 30 === 0;
        const isEquator = Math.abs(lat) < 0.001;
        
        // Get SVG coordinates for this latitude
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
          dashArray: (isMajor || isEquator) ? undefined : gridStyle.DASH_ARRAY,
          pane: 'grid-pane'
        }).addTo(gridLayerRef.current);
        
        // Add label
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
  
  // Draw prime meridian with proper wraparound
  const drawPrimeMeridian = () => {
    if (!map || !primeMeridianLayerRef.current || !primeMeridianSvg || !visible) return;

    try {
      // Clear existing layers
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
          color: gridStyle.PRIME_MERIDIAN_COLOR,
          weight: gridStyle.PRIME_MERIDIAN_WEIGHT,
          opacity: gridStyle.PRIME_MERIDIAN_OPACITY,
          dashArray: gridStyle.PRIME_MERIDIAN_DASH_ARRAY,
          pane: 'meridian-pane'
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
          pane: 'meridian-pane'
        }).addTo(primeMeridianLayerRef.current);
        
        // Add reference point marker if in view
        const markerY = primeMeridianSvg.y;
        if (markerY >= southBound && markerY <= northBound) {
          L.circleMarker(L.latLng(markerY, xPosition), {
            radius: 8,
            color: gridStyle.PRIME_MERIDIAN_COLOR,
            fillColor: '#FFFF00',
            fillOpacity: 0.7,
            weight: 2,
            pane: 'meridian-pane'
          }).bindPopup(`
            <strong>Prime Meridian Reference</strong><br>
            Map Reference: 0° Longitude
          `).addTo(primeMeridianLayerRef.current);
        }
      };
      
      // Draw all instances of the meridian
      drawMeridianLine(primeMeridianSvg.x);           // Original
      drawMeridianLine(primeMeridianSvg.x + svgWidth); // Right wraparound
      drawMeridianLine(primeMeridianSvg.x - svgWidth); // Left wraparound
    } catch (error) {
      console.error('Error drawing prime meridian:', error);
    }
  };
  
  return null; // This component doesn't render any DOM elements
};

export default GridComponent;