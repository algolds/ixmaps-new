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
// Import grid styles
import { gridStyle } from '@/lib/MapConfig';

// Define special latitudes
const NAMED_LATITUDES = [
  { lat: 23.5, name: 'Tropic of Cancer' },
  { lat: 0, name: 'Equator' },
  { lat: -23.5, name: 'Tropic of Capricorn' },
  // Add Arctic/Antarctic Circles if needed:
  // { lat: 66.5, name: 'Arctic Circle' },
  // { lat: -66.5, name: 'Antarctic Circle' },
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
        // Define spacing for MINOR grid lines
        let minorLatSpacing = 15;
        let minorLngSpacing = 15;
        if (zoom >= 2) { minorLatSpacing = 10; minorLngSpacing = 10; }
        if (zoom >= 4) { minorLatSpacing = 5; minorLngSpacing = 5; }

        const northEast = bounds.getNorthEast();
        const southWest = bounds.getSouthWest();
        const buffer = Math.max(minorLatSpacing, minorLngSpacing) * 2;
        const calcSouth = Math.max(mapConfig.bounds.south, southWest.lat - buffer);
        const calcNorth = Math.min(mapConfig.bounds.north, northEast.lat + buffer);
        const calcWest = Math.max(mapConfig.bounds.west, southWest.lng - buffer);
        const calcEast = Math.min(mapConfig.bounds.east, northEast.lng + buffer);

        // --- Draw Latitude Lines ---
        const startLat = Math.ceil(calcSouth / minorLatSpacing) * minorLatSpacing;
        const endLat = Math.floor(calcNorth / minorLatSpacing) * minorLatSpacing;
        const drawnNamedLats: number[] = []; // Keep track of drawn named lines

        // 1. Draw Named Latitudes first
        NAMED_LATITUDES.forEach(namedLat => {
          // Check if within calculation bounds
          if (namedLat.lat >= calcSouth && namedLat.lat <= calcNorth) {
            const isEquator = Math.abs(namedLat.lat) < LATITUDE_TOLERANCE;
            const lineStyle: L.PolylineOptions = {
              color: isEquator ? gridStyle.EQUATOR_COLOR : gridStyle.GRID_COLOR, // Use specific color for Equator
              weight: gridStyle.MAJOR_LINE_WEIGHT, // Use major weight
              opacity: gridStyle.LINE_OPACITY,
              dashArray: gridStyle.MAJOR_DASH_ARRAY || undefined, // Use major dash (solid)
              interactive: false,
              bubblingMouseEvents: false,
            };

            try {
              const linePoints: L.LatLngExpression[] = [
                [namedLat.lat, bounds.getWest()],
                [namedLat.lat, bounds.getEast()],
              ];
              L.polyline(linePoints, lineStyle).addTo(gridLayerRef.current!);
              drawnNamedLats.push(namedLat.lat); // Mark as drawn

              // Add Label
              const labelLng = bounds.getWest() + (bounds.getEast() - bounds.getWest()) * 0.01;
              const labelPos: L.LatLngExpression = [namedLat.lat, labelLng];
              const labelClass = isEquator ? 'grid-label equator-label' : 'grid-label tropic-label'; // Specific class for tropics?

              L.marker(labelPos, {
                icon: L.divIcon({
                  className: labelClass,
                  html: namedLat.name,
                  iconSize: [namedLat.name.length * 6 + 10, 20], // Auto-adjust width roughly
                  iconAnchor: [0, 10],
                }),
                interactive: false,
              }).addTo(gridLayerRef.current!);

            } catch (lineError) {
              console.warn(`Error drawing named latitude line at ${namedLat.lat}:`, lineError);
            }
          }
        });

        // 2. Draw Minor Latitude Lines
        for (let lat = startLat; lat <= endLat; lat += minorLatSpacing) {
          if (lat < mapConfig.bounds.south || lat > mapConfig.bounds.north) continue;

          // Skip if this latitude is close to an already drawn named latitude
          const isNearNamed = drawnNamedLats.some(namedLat => Math.abs(lat - namedLat) < LATITUDE_TOLERANCE);
          if (isNearNamed) continue;

          // Draw as a minor line
          const lineStyle: L.PolylineOptions = {
            color: gridStyle.GRID_COLOR,
            weight: gridStyle.MINOR_LINE_WEIGHT,
            opacity: gridStyle.LINE_OPACITY * 0.7, // Make minor lines fainter
            dashArray: gridStyle.DASH_ARRAY,
            interactive: false,
            bubblingMouseEvents: false,
          };

          try {
            const linePoints: L.LatLngExpression[] = [
              [lat, bounds.getWest()],
              [lat, bounds.getEast()],
            ];
            L.polyline(linePoints, lineStyle).addTo(gridLayerRef.current!);
          } catch (lineError) {
            console.warn(`Error drawing minor latitude line at ${lat}:`, lineError);
          }
        }

        // --- Draw Longitude Lines ---
        const startLng = Math.ceil(calcWest / minorLngSpacing) * minorLngSpacing;
        const endLng = Math.floor(calcEast / minorLngSpacing) * minorLngSpacing;

        for (let lng = startLng; lng <= endLng; lng += minorLngSpacing) {
          if (lng < mapConfig.bounds.west || lng > mapConfig.bounds.east) continue;

          // Check if this longitude corresponds to the Prime Meridian's visual line
          let isPrimeMeridianLng = false;
          if (primeMeridianSvg) {
             try {
                const svgPointForLng = latLngToSvg(bounds.getCenter().lat, lng, mapConfig);
                if (Math.abs(svgPointForLng.x - primeMeridianSvg.x) < 1) {
                    isPrimeMeridianLng = true;
                }
             } catch (e) { /* Ignore */ }
          }

          // Skip drawing this grid line if it's the Prime Meridian AND PM is shown separately
          if (isPrimeMeridianLng && showPrimeMeridian) {
              continue;
          }

          // Draw all non-PM longitude lines as minor lines
          const lineStyle: L.PolylineOptions = {
            color: gridStyle.GRID_COLOR,
            weight: gridStyle.MINOR_LINE_WEIGHT,
            opacity: gridStyle.LINE_OPACITY * 0.7, // Make minor lines fainter
            dashArray: gridStyle.DASH_ARRAY,
            interactive: false,
            bubblingMouseEvents: false,
          };

          try {
            const linePoints: L.LatLngExpression[] = [
              [bounds.getSouth(), lng],
              [bounds.getNorth(), lng],
            ];
            L.polyline(linePoints, lineStyle).addTo(gridLayerRef.current!);

            // Optional: Add labels for minor longitude lines if needed (e.g., every 30 deg)
            if (lng % 30 === 0 && !isPrimeMeridianLng) { // Example: Label every 30 deg minor line
                 const labelLat = bounds.getSouth() + (bounds.getNorth() - bounds.getSouth()) * 0.02;
                 const labelPos: L.LatLngExpression = [labelLat, lng];
                 L.marker(labelPos, {
                    icon: L.divIcon({
                       className: 'grid-label minor-label', // Style minor labels differently?
                       html: `${Math.abs(lng).toFixed(0)}°${lng >= 0 ? 'E' : 'W'}`,
                       iconSize: [40, 20],
                       iconAnchor: [20, 0],
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
        const startPointLatLng = svgToLatLng(primeMeridianSvg.x, 0, mapConfig);
        const endPointLatLng = svgToLatLng(primeMeridianSvg.x, mapConfig.svgHeight, mapConfig);

        const line = L.polyline(
          [
            [startPointLatLng.lat, startPointLatLng.lng],
            [endPointLatLng.lat, endPointLatLng.lng],
          ],
          { // Use specific PM styles
            color: gridStyle.PRIME_MERIDIAN_COLOR,
            weight: gridStyle.PRIME_MERIDIAN_WEIGHT,
            opacity: gridStyle.PRIME_MERIDIAN_OPACITY,
            dashArray: gridStyle.PRIME_MERIDIAN_DASH_ARRAY || undefined,
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
              html: 'Prime Meridian', // Use full name?
              iconSize: [100, 20], // Adjust size
              iconAnchor: [50, 0], // Center above line
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
    // ... (Position display control logic remains the same) ...
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
      if (control && !map.addControl(control)) { map.addControl(control); }
    } else {
      if (control) { map.removeControl(control); }
    }
    return () => { // Cleanup
      if (map && control) { try { map.removeControl(control); } catch (e) { console.warn('Could not remove position control on unmount:', e); } }
    };
  }, [map, L, showPositionDisplay]);

  // --- Effect for Mouse Move Coordinate Display ---
  useEffect(() => {
    // ... (Mouse move coordinate display logic remains the same) ...
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
