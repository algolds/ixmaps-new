// src/components/GridComponent.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapConfig, SvgPoint } from '@/types';
// Import necessary coordinate functions
import {
  svgToLatLng,
  latLngToSvg,
  formatLatitude,
  formatLongitude,
} from '@/lib/coordinates-system';

// Define enhanced grid styles with more prominent highlights
const GRID_STYLES = {
  // Regular grid
  GRID_COLOR: '#aaaaaa',
  MINOR_LINE_WEIGHT: 0.5,
  LINE_OPACITY: 0.6,
  DASH_ARRAY: '3, 5',
  MAJOR_LINE_WEIGHT: 1,
  MAJOR_DASH_ARRAY: null,
  
  // Special lines
  EQUATOR_COLOR: '#ff3333',
  EQUATOR_WEIGHT: 2,
  EQUATOR_OPACITY: 0.8,
  
  TROPIC_COLOR: '#ff9900',
  TROPIC_WEIGHT: 1.5,
  TROPIC_OPACITY: 0.8,
  TROPIC_DASH_ARRAY: '5, 5',
  
  PRIME_MERIDIAN_COLOR: '#3388ff',
  PRIME_MERIDIAN_WEIGHT: 2,
  PRIME_MERIDIAN_OPACITY: 0.8,
  PRIME_MERIDIAN_DASH_ARRAY: null,
};

// Define special latitudes with enhanced data
const NAMED_LATITUDES = [
  { lat: 23.5, name: 'Tropic of Cancer', type: 'tropic' },
  { lat: 0, name: 'Equator', type: 'equator' },
  { lat: -23.5, name: 'Tropic of Capricorn', type: 'tropic' },
  { lat: 66.5, name: 'Arctic Circle', type: 'circle' },
  { lat: -66.5, name: 'Antarctic Circle', type: 'circle' },
];
const LATITUDE_TOLERANCE = 0.1; // Tolerance for matching named latitudes

interface GridComponentProps {
  map: L.Map;
  L: typeof L;
  mapConfig: MapConfig;
  primeMeridianSvg: SvgPoint | null; // Needed for PM line
  showGrid: boolean; // Controls grid lines visibility
  showPrimeMeridian: boolean; // Controls visibility of the PM line itself
  showPositionDisplay: boolean; // Controls visibility of the mouse coordinate display
}

const GridComponent: React.FC<GridComponentProps> = ({
  map,
  L,
  mapConfig,
  primeMeridianSvg,
  showGrid,
  showPrimeMeridian,
  showPositionDisplay,
}) => {
  const gridLayerRef = useRef<L.LayerGroup | null>(null);
  const positionDisplayControlRef = useRef<L.Control | null>(null);
  const positionDisplayDivRef = useRef<HTMLDivElement | null>(null);

  // --- Effect for Managing the Grid Layer Group ---
  useEffect(() => {
    if (!map || !L) return;
    if (showGrid || showPrimeMeridian) {
      if (!gridLayerRef.current) {
        gridLayerRef.current = L.layerGroup();
      }
      if (!map.hasLayer(gridLayerRef.current)) {
        gridLayerRef.current.addTo(map);
      }
    } else {
      if (gridLayerRef.current && map.hasLayer(gridLayerRef.current)) {
        gridLayerRef.current.remove();
      }
    }
    return () => { // Cleanup
      if (gridLayerRef.current && map && map.hasLayer(gridLayerRef.current)) {
        try { gridLayerRef.current.remove(); } catch (e) { console.warn('Error removing grid layer group on unmount:', e); }
      }
    };
  }, [map, L, showGrid, showPrimeMeridian]);

  // --- Effect for Drawing Grid and Prime Meridian ---
  useEffect(() => {
    if (!map || !L || !gridLayerRef.current) return;

    gridLayerRef.current.clearLayers();

    const bounds = map.getBounds();
    const zoom = map.getZoom();

    // --- Draw Grid Lines (only if showGrid is true) ---
    if (showGrid) {
      try {
        // Define spacing for grid lines based on zoom level
        let minorLatSpacing = 15;
        let minorLngSpacing = 15;
        if (zoom >= 2) { minorLatSpacing = 10; minorLngSpacing = 10; }
        if (zoom >= 4) { minorLatSpacing = 5; minorLngSpacing = 5; }
        if (zoom >= 6) { minorLatSpacing = 2; minorLngSpacing = 2; }
        if (zoom >= 8) { minorLatSpacing = 1; minorLngSpacing = 1; }

        // Calculate visible area with buffer
        const northEast = bounds.getNorthEast();
        const southWest = bounds.getSouthWest();
        const buffer = Math.max(minorLatSpacing, minorLngSpacing) * 2;
        
        // Calculate grid bounds - use standard -180 to 180 longitude and -90 to 90 latitude
        const calcSouth = Math.max(-90, southWest.lat - buffer);
        const calcNorth = Math.min(90, northEast.lat + buffer);
        const calcWest = Math.max(-180, southWest.lng - buffer);
        const calcEast = Math.min(180, northEast.lng + buffer);

        // --- Draw Latitude Lines ---
        const startLat = Math.ceil(calcSouth / minorLatSpacing) * minorLatSpacing;
        const endLat = Math.floor(calcNorth / minorLatSpacing) * minorLatSpacing;
        const drawnNamedLats: number[] = []; // Keep track of drawn named lines

        // 1. Draw Named Latitudes first with enhanced styling
        NAMED_LATITUDES.forEach(namedLat => {
          // Check if within calculation bounds
          if (namedLat.lat >= calcSouth && namedLat.lat <= calcNorth) {
            // Different styling based on line type
            let lineStyle: L.PolylineOptions;
            
            if (namedLat.type === 'equator') {
              lineStyle = {
                color: GRID_STYLES.EQUATOR_COLOR,
                weight: GRID_STYLES.EQUATOR_WEIGHT,
                opacity: GRID_STYLES.EQUATOR_OPACITY,
                dashArray: null,
                interactive: false,
                bubblingMouseEvents: false,
              };
            } else if (namedLat.type === 'tropic') {
              lineStyle = {
                color: GRID_STYLES.TROPIC_COLOR,
                weight: GRID_STYLES.TROPIC_WEIGHT,
                opacity: GRID_STYLES.TROPIC_OPACITY,
                dashArray: GRID_STYLES.TROPIC_DASH_ARRAY,
                interactive: false,
                bubblingMouseEvents: false,
              };
            } else {
              // Arctic/Antarctic circles
              lineStyle = {
                color: GRID_STYLES.GRID_COLOR,
                weight: GRID_STYLES.MAJOR_LINE_WEIGHT,
                opacity: GRID_STYLES.LINE_OPACITY,
                dashArray: GRID_STYLES.MAJOR_DASH_ARRAY || undefined,
                interactive: false,
                bubblingMouseEvents: false,
              };
            }

            try {
              // Draw the line across the entire visible longitude range
              const linePoints: L.LatLngExpression[] = [
                [namedLat.lat, calcWest],
                [namedLat.lat, calcEast],
              ];
              L.polyline(linePoints, lineStyle).addTo(gridLayerRef.current!);
              drawnNamedLats.push(namedLat.lat); // Mark as drawn

              // Add Label with type-specific styling
              if (namedLat.type === 'equator' || namedLat.type === 'tropic') {
                const labelLng = calcWest + (calcEast - calcWest) * 0.02;
                const labelPos: L.LatLngExpression = [namedLat.lat, labelLng];
                const labelClass = `grid-label ${namedLat.type}-label`;
                
                L.marker(labelPos, {
                  icon: L.divIcon({
                    className: labelClass,
                    html: `<strong>${namedLat.name}</strong>`,
                    iconSize: [namedLat.name.length * 7 + 20, 20],
                    iconAnchor: [0, 10],
                  }),
                  interactive: false,
                }).addTo(gridLayerRef.current!);
              }
            } catch (lineError) {
              console.warn(`Error drawing named latitude line at ${namedLat.lat}:`, lineError);
            }
          }
        });

        // 2. Draw Minor Latitude Lines
        for (let lat = startLat; lat <= endLat; lat += minorLatSpacing) {
          if (lat < -90 || lat > 90) continue;

          // Skip if this latitude is close to an already drawn named latitude
          const isNearNamed = drawnNamedLats.some(namedLat => Math.abs(lat - namedLat) < LATITUDE_TOLERANCE);
          if (isNearNamed) continue;

          // For standard grid, every 15° should be more prominent
          const isMajorLine = lat % 15 === 0;
          
          // Draw line with appropriate styling
          const lineStyle: L.PolylineOptions = {
            color: GRID_STYLES.GRID_COLOR,
            weight: isMajorLine ? GRID_STYLES.MAJOR_LINE_WEIGHT : GRID_STYLES.MINOR_LINE_WEIGHT,
            opacity: GRID_STYLES.LINE_OPACITY * (isMajorLine ? 1 : 0.7),
            dashArray: isMajorLine ? undefined : GRID_STYLES.DASH_ARRAY,
            interactive: false,
            bubblingMouseEvents: false,
          };

          try {
            const linePoints: L.LatLngExpression[] = [
              [lat, calcWest],
              [lat, calcEast],
            ];
            L.polyline(linePoints, lineStyle).addTo(gridLayerRef.current!);
            
            // Add label for major lines
            if (isMajorLine && zoom >= 2) {
              const labelLng = calcWest + (calcEast - calcWest) * 0.02;
              const labelPos: L.LatLngExpression = [lat, labelLng];
              L.marker(labelPos, {
                icon: L.divIcon({
                  className: 'grid-label',
                  html: `${Math.abs(lat)}°${lat >= 0 ? 'N' : 'S'}`,
                  iconSize: [40, 20],
                  iconAnchor: [0, 10],
                }),
                interactive: false,
              }).addTo(gridLayerRef.current!);
            }
          } catch (lineError) {
            console.warn(`Error drawing minor latitude line at ${lat}:`, lineError);
          }
        }

        // --- Draw Longitude Lines ---
        const startLng = Math.ceil(calcWest / minorLngSpacing) * minorLngSpacing;
        const endLng = Math.floor(calcEast / minorLngSpacing) * minorLngSpacing;
        
        // Keep track of prime meridian to avoid duplicate drawing
        let primeMeridianActualLng: number | null = null;
        
        // If we're showing the prime meridian, calculate its actual longitude
        if (showPrimeMeridian && primeMeridianSvg) {
          try {
            const pmPoint = svgToLatLng(primeMeridianSvg.x, mapConfig.svgHeight / 2, mapConfig);
            primeMeridianActualLng = pmPoint.lng;
            // Allow some tolerance
            if (Math.abs(primeMeridianActualLng) < 0.1) primeMeridianActualLng = 0;
          } catch (e) { 
            console.warn('Error computing prime meridian longitude:', e);
          }
        }

        // Draw longitude lines
        for (let lng = startLng; lng <= endLng; lng += minorLngSpacing) {
          if (lng < -180 || lng > 180) continue;

          // Skip the prime meridian if it's shown separately
          if (primeMeridianActualLng !== null && Math.abs(lng - primeMeridianActualLng) < 0.1 && showPrimeMeridian) {
            continue;
          }

          // For standard grid, every 15° should be more prominent
          const isMajorLine = lng % 15 === 0;
          
          // Special style for Greenwich (0°) if not showing PM separately
          const isGreenwich = Math.abs(lng) < 0.1;
          
          const lineStyle: L.PolylineOptions = {
            color: isGreenwich && !showPrimeMeridian ? GRID_STYLES.PRIME_MERIDIAN_COLOR : GRID_STYLES.GRID_COLOR,
            weight: isGreenwich && !showPrimeMeridian ? GRID_STYLES.PRIME_MERIDIAN_WEIGHT : 
                    (isMajorLine ? GRID_STYLES.MAJOR_LINE_WEIGHT : GRID_STYLES.MINOR_LINE_WEIGHT),
            opacity: isGreenwich && !showPrimeMeridian ? GRID_STYLES.PRIME_MERIDIAN_OPACITY : 
                     GRID_STYLES.LINE_OPACITY * (isMajorLine ? 1 : 0.7),
            dashArray: isGreenwich && !showPrimeMeridian ? undefined : 
                       (isMajorLine ? undefined : GRID_STYLES.DASH_ARRAY),
            interactive: false,
            bubblingMouseEvents: false,
          };

          try {
            const linePoints: L.LatLngExpression[] = [
              [calcSouth, lng],
              [calcNorth, lng],
            ];
            L.polyline(linePoints, lineStyle).addTo(gridLayerRef.current!);

            // Add label for major lines and Greenwich
            if ((isMajorLine || isGreenwich) && zoom >= 2) {
              const labelLat = calcSouth + (calcNorth - calcSouth) * 0.02;
              const labelPos: L.LatLngExpression = [labelLat, lng];
              
              let labelHtml = `${Math.abs(lng)}°${lng > 0 ? 'E' : (lng < 0 ? 'W' : '')}`;
              if (isGreenwich && !showPrimeMeridian) {
                labelHtml = '<strong>Prime Meridian (0°)</strong>';
              }
              
              L.marker(labelPos, {
                icon: L.divIcon({
                  className: isGreenwich ? 'grid-label prime-meridian-label' : 'grid-label',
                  html: labelHtml,
                  iconSize: [isGreenwich ? 120 : 40, 20],
                  iconAnchor: [isGreenwich ? 60 : 20, 0],
                }),
                interactive: false,
              }).addTo(gridLayerRef.current!);
            }
          } catch (lineError) {
            console.warn(`Error drawing longitude line at ${lng}:`, lineError);
          }
        }
      } catch (gridError) {
        console.error('Error calculating or drawing grid:', gridError);
      }
    } // End of if(showGrid)

    // --- Draw Prime Meridian Line (only if showPrimeMeridian is true) ---
    if (showPrimeMeridian && primeMeridianSvg) {
      try {
        // For a standard grid approach, we'd expect the prime meridian to be at longitude 0
        // But the map might use a different prime meridian, so we'll calculate its actual longitude
        
        // Calculate actual longitude of the prime meridian on the map
        const startPointLatLng = svgToLatLng(primeMeridianSvg.x, 0, mapConfig);
        const endPointLatLng = svgToLatLng(primeMeridianSvg.x, mapConfig.svgHeight, mapConfig);
        
        // Create a line with enhanced prime meridian styling
        const line = L.polyline(
          [
            [bounds.getSouth(), startPointLatLng.lng],
            [bounds.getNorth(), startPointLatLng.lng],
          ],
          {
            color: GRID_STYLES.PRIME_MERIDIAN_COLOR,
            weight: GRID_STYLES.PRIME_MERIDIAN_WEIGHT,
            opacity: GRID_STYLES.PRIME_MERIDIAN_OPACITY,
            dashArray: GRID_STYLES.PRIME_MERIDIAN_DASH_ARRAY || undefined,
            interactive: false,
          },
        );
        gridLayerRef.current.addLayer(line);

        // Add Prime Meridian Label
        const pmLabelLat = bounds.getSouth() + (bounds.getNorth() - bounds.getSouth()) * 0.02;
        const pmLabelPos: L.LatLngExpression = [pmLabelLat, startPointLatLng.lng];
        
        L.marker(pmLabelPos, {
          icon: L.divIcon({
            className: 'grid-label prime-meridian-label',
            html: '<strong>Prime Meridian</strong>',
            iconSize: [120, 20],
            iconAnchor: [60, 0],
          }),
          interactive: false,
        }).addTo(gridLayerRef.current!);

      } catch (error) {
        console.error('Error calculating/drawing prime meridian:', error);
      }
    } // End of if(showPrimeMeridian)

  }, [
    map,
    L,
    mapConfig,
    primeMeridianSvg,
    showGrid,
    showPrimeMeridian,
    map?.getZoom(),
    map?.getBounds().toBBoxString(),
  ]);

  // --- Effect for Position Display Control ---
  useEffect(() => {
    if (!map || !L) return;
    if (!positionDisplayControlRef.current) {
      const PositionControl = L.Control.extend({
        options: { position: 'bottomleft' },
        onAdd: function () {
          const container = L.DomUtil.create('div', 'leaflet-control-coordinates leaflet-control');
          container.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
          container.style.padding = '2px 5px';
          container.style.fontSize = '11px';
          container.style.whiteSpace = 'nowrap';
          container.style.borderRadius = '3px';
          container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
          positionDisplayDivRef.current = container;
          L.DomEvent.disableClickPropagation(container);
          L.DomEvent.disableScrollPropagation(container);
          container.innerHTML = '';
          return container;
        },
        onRemove: function () {
          positionDisplayDivRef.current = null;
        },
      });
      positionDisplayControlRef.current = new PositionControl();
    }
    const control = positionDisplayControlRef.current;
    if (showPositionDisplay) {
      if (control && !map.hasLayer(control)) { map.addControl(control); }
    } else {
      if (control) { map.removeControl(control); }
    }
    return () => { // Cleanup
      if (map && control) { try { map.removeControl(control); } catch (e) { console.warn('Could not remove position control on unmount:', e); } }
    };
  }, [map, L, showPositionDisplay]);

  // --- Effect for Mouse Move Coordinate Display ---
  useEffect(() => {
    if (!map || !showPositionDisplay) {
      if (positionDisplayDivRef.current) { positionDisplayDivRef.current.innerHTML = ''; }
      return;
    }
    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      if (!positionDisplayDivRef.current) return;
      try {
        const latLng = e.latlng;
        const latStr = formatLatitude(latLng.lat);
        const lonStr = formatLongitude(latLng.lng);
        positionDisplayDivRef.current.innerHTML = `Lat: ${latStr} Lon: ${lonStr}`;
      } catch (error) {
        console.error('Error formatting coordinates:', error);
        if (positionDisplayDivRef.current) { positionDisplayDivRef.current.innerHTML = 'Lat/Lon Error'; }
      }
    };
    map.on('mousemove', handleMouseMove);
    return () => { // Cleanup
      map.off('mousemove', handleMouseMove);
      if (positionDisplayDivRef.current) { positionDisplayDivRef.current.innerHTML = ''; }
    };
  }, [map, showPositionDisplay, L]);

  // Component manages Leaflet layers/controls directly
  return null;
};

export default GridComponent;