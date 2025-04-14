// src/components/GridComponent.tsx
'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { MapConfig, SvgPoint, LatLng } from '@/types'; // Added LatLng import
import {
  svgToLatLng,
  latLngToSvg, // Keep if needed for other features, not strictly for grid drawing now
  formatLatitude,
  formatLongitude,
} from '@/lib/coordinates-system';

// Define enhanced grid styles (can be moved to MapConfig.ts if preferred)
const GRID_STYLES = {
  GRID_PANE_ZINDEX: 450, // Draw above tiles/overlays, below markers/popups

  // Regular grid
  GRID_COLOR: '#aaaaaa',
  MINOR_LINE_WEIGHT: 0.5,
  LINE_OPACITY: 0.6,
  DASH_ARRAY: '3, 5',
  MAJOR_LINE_WEIGHT: 1,
  MAJOR_DASH_ARRAY: undefined, // Use undefined for solid lines

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
  PRIME_MERIDIAN_DASH_ARRAY: undefined, // Use undefined for solid lines
};

// Define special latitudes
const NAMED_LATITUDES = [
  { lat: 23.5, name: 'Tropic of Cancer', type: 'tropic' },
  { lat: 0, name: 'Equator', type: 'equator' },
  { lat: -23.5, name: 'Tropic of Capricorn', type: 'tropic' },
  // Add circles if desired
  // { lat: 66.5, name: 'Arctic Circle', type: 'circle' },
  // { lat: -66.5, name: 'Antarctic Circle', type: 'circle' },
];
const LATITUDE_TOLERANCE = 0.1; // Tolerance for matching named latitudes

interface GridComponentProps {
  map: L.Map;
  L: typeof L;
  mapConfig: MapConfig;
  primeMeridianSvg: SvgPoint | null; // Needed for PM line calculation
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
  const gridPaneName = 'gridPane'; // Name for the custom pane

  // --- Calculate Fixed Map Image Bounds ---
  // Use useMemo to calculate only when mapConfig changes
  const mapImageBounds = useMemo<L.LatLngBounds | null>(() => {
    if (!L || !mapConfig || !mapConfig.svgWidth || !mapConfig.svgHeight)
      return null;
    try {
      const topLeft = svgToLatLng(0, 0, mapConfig);
      const bottomRight = svgToLatLng(
        mapConfig.svgWidth,
        mapConfig.svgHeight,
        mapConfig,
      );
      // Ensure coordinates are valid numbers
      if (
        isNaN(topLeft.lat) ||
        isNaN(topLeft.lng) ||
        isNaN(bottomRight.lat) ||
        isNaN(bottomRight.lng)
      ) {
        console.error('[GridComponent] Invalid LatLng calculated for bounds.');
        return null;
      }
      return L.latLngBounds(
        L.latLng(bottomRight.lat, topLeft.lng), // South-West
        L.latLng(topLeft.lat, bottomRight.lng), // North-East
      );
    } catch (e) {
      console.error('[GridComponent] Error calculating mapImageBounds:', e);
      return null;
    }
  }, [L, mapConfig]); // Dependencies: L and mapConfig

  // --- Effect to Create Grid Pane ---
  useEffect(() => {
    if (!map) return;
    // Create pane if it doesn't exist
    if (!map.getPane(gridPaneName)) {
      map.createPane(gridPaneName);
      const pane = map.getPane(gridPaneName);
      if (pane) {
        pane.style.zIndex = String(GRID_STYLES.GRID_PANE_ZINDEX);
        pane.style.pointerEvents = 'none'; // Grid shouldn't capture clicks
        console.log(`[GridComponent] Created pane: ${gridPaneName}`);
      }
    }
    // No cleanup needed for pane itself, Leaflet handles it on map.remove()
  }, [map]);

  // --- Effect for Managing the Grid Layer Group ---
  useEffect(() => {
    if (!map || !L) return;
    const shouldShowLayer = showGrid || showPrimeMeridian;

    if (shouldShowLayer) {
      if (!gridLayerRef.current) {
        // Create layer group and specify the pane
        gridLayerRef.current = L.layerGroup([], { pane: gridPaneName });
        console.log('[GridComponent] Created grid LayerGroup.');
      }
      if (!map.hasLayer(gridLayerRef.current)) {
        gridLayerRef.current.addTo(map);
        console.log('[GridComponent] Added grid LayerGroup to map.');
      }
    } else {
      // Remove layer if it exists and shouldn't be shown
      if (gridLayerRef.current && map.hasLayer(gridLayerRef.current)) {
        gridLayerRef.current.remove();
        console.log('[GridComponent] Removed grid LayerGroup from map.');
        // Optionally clear the ref if you always want to recreate it
        // gridLayerRef.current = null;
      }
    }
    // Cleanup on unmount or if map/L changes
    return () => {
      if (gridLayerRef.current && map && map.hasLayer(gridLayerRef.current)) {
        try {
          gridLayerRef.current.remove();
        } catch (e) {
          console.warn('[GridComponent] Error removing grid layer group on unmount:', e);
        }
      }
    };
  }, [map, L, showGrid, showPrimeMeridian, gridPaneName]); // Dependencies

  // --- Effect for Drawing Grid and Prime Meridian ---
  useEffect(() => {
    // Exit if prerequisites aren't met or layer shouldn't be drawn
    if (
      !map ||
      !L ||
      !gridLayerRef.current ||
      !mapImageBounds ||
      (!showGrid && !showPrimeMeridian)
    ) {
      // Clear layers if they exist but shouldn't be shown
      if (gridLayerRef.current) {
        gridLayerRef.current.clearLayers();
      }
      return;
    }

    // Clear previous drawings
    gridLayerRef.current.clearLayers();
    console.log('[GridComponent] Drawing grid...');

    const zoom = map.getZoom();
    const westLng = mapImageBounds.getWest();
    const eastLng = mapImageBounds.getEast();
    const southLat = mapImageBounds.getSouth();
    const northLat = mapImageBounds.getNorth();

    // --- Draw Grid Lines (only if showGrid is true) ---
    if (showGrid) {
      try {
        // Define spacing based on zoom
        let minorLatSpacing = 15;
        let minorLngSpacing = 15;
        // Adjust spacing based on zoom (example values)
        if (zoom >= 0) { minorLatSpacing = 10; minorLngSpacing = 10; }
        if (zoom >= 2) { minorLatSpacing = 5; minorLngSpacing = 5; }
        if (zoom >= 4) { minorLatSpacing = 2; minorLngSpacing = 2; }
        if (zoom >= 5) { minorLatSpacing = 1; minorLngSpacing = 1; }

        // Calculate start/end for loops based on fixed bounds
        const startLatLoop = Math.ceil(southLat / minorLatSpacing) * minorLatSpacing;
        const endLatLoop = Math.floor(northLat / minorLatSpacing) * minorLatSpacing;
        const startLngLoop = Math.ceil(westLng / minorLngSpacing) * minorLngSpacing;
        const endLngLoop = Math.floor(eastLng / minorLngSpacing) * minorLngSpacing;

        const drawnNamedLats: number[] = []; // Track drawn named lines

        // 1. Draw Named Latitudes first
        NAMED_LATITUDES.forEach((namedLat) => {
          if (namedLat.lat >= southLat && namedLat.lat <= northLat) {
            let lineStyle: L.PolylineOptions;
            let labelClass = 'grid-label'; // Base class

            if (namedLat.type === 'equator') {
              lineStyle = { color: GRID_STYLES.EQUATOR_COLOR, weight: GRID_STYLES.EQUATOR_WEIGHT, opacity: GRID_STYLES.EQUATOR_OPACITY, dashArray: undefined };
              labelClass += ' equator-label';
            } else if (namedLat.type === 'tropic') {
              lineStyle = { color: GRID_STYLES.TROPIC_COLOR, weight: GRID_STYLES.TROPIC_WEIGHT, opacity: GRID_STYLES.TROPIC_OPACITY, dashArray: GRID_STYLES.TROPIC_DASH_ARRAY };
              labelClass += ' named-latitude-label'; // Use a generic named label class
            } else { // Circles or other types
              lineStyle = { color: GRID_STYLES.GRID_COLOR, weight: GRID_STYLES.MAJOR_LINE_WEIGHT, opacity: GRID_STYLES.LINE_OPACITY, dashArray: GRID_STYLES.MAJOR_DASH_ARRAY };
              labelClass += ' named-latitude-label';
            }

            try {
              // Draw line constrained to map bounds
              const linePoints: L.LatLngExpression[] = [[namedLat.lat, westLng], [namedLat.lat, eastLng]];
              L.polyline(linePoints, { ...lineStyle, pane: gridPaneName, interactive: false }).addTo(gridLayerRef.current!);
              drawnNamedLats.push(namedLat.lat);

              // Add Label near the west edge
              const labelLng = westLng + (eastLng - westLng) * 0.02; // Position label slightly inside west edge
              const labelPos: L.LatLngExpression = [namedLat.lat, labelLng];

              L.marker(labelPos, {
                icon: L.divIcon({
                  className: labelClass,
                  html: `<strong>${namedLat.name}</strong>`,
                  iconSize: undefined, // Let CSS handle size
                  iconAnchor: [0, 10], // Anchor bottom-leftish
                }),
                interactive: false,
                pane: gridPaneName, // Add label to the same pane
              }).addTo(gridLayerRef.current!);

            } catch (lineError) { console.warn(`Error drawing named latitude line at ${namedLat.lat}:`, lineError); }
          }
        });

        // 2. Draw Minor Latitude Lines
        for (let lat = startLatLoop; lat <= endLatLoop; lat += minorLatSpacing) {
          if (lat < southLat || lat > northLat) continue; // Ensure within bounds

          const isNearNamed = drawnNamedLats.some((namedLat) => Math.abs(lat - namedLat) < LATITUDE_TOLERANCE);
          if (isNearNamed) continue; // Skip if already drawn as named

          const isMajorLine = lat % 15 === 0;
          const lineStyle: L.PolylineOptions = {
            color: GRID_STYLES.GRID_COLOR,
            weight: isMajorLine ? GRID_STYLES.MAJOR_LINE_WEIGHT : GRID_STYLES.MINOR_LINE_WEIGHT,
            opacity: GRID_STYLES.LINE_OPACITY * (isMajorLine ? 1 : 0.7),
            dashArray: isMajorLine ? GRID_STYLES.MAJOR_DASH_ARRAY : GRID_STYLES.DASH_ARRAY,
          };

          try {
            const linePoints: L.LatLngExpression[] = [[lat, westLng], [lat, eastLng]];
            L.polyline(linePoints, { ...lineStyle, pane: gridPaneName, interactive: false }).addTo(gridLayerRef.current!);

            // Add label for major lines near west edge
            if (isMajorLine && zoom >= 0) { // Show labels at lower zoom now
              const labelLng = westLng + (eastLng - westLng) * 0.02;
              const labelPos: L.LatLngExpression = [lat, labelLng];
              L.marker(labelPos, {
                icon: L.divIcon({
                  className: 'grid-label',
                  html: formatLatitude(lat, 0), // Use formatting function, 0 precision
                  iconSize: undefined,
                  iconAnchor: [0, 10],
                }),
                interactive: false,
                pane: gridPaneName,
              }).addTo(gridLayerRef.current!);
            }
          } catch (lineError) { console.warn(`Error drawing minor latitude line at ${lat}:`, lineError); }
        }

        // --- Draw Longitude Lines ---
        let primeMeridianActualLng: number | null = null;
        if (primeMeridianSvg) { // Calculate PM Lng even if not shown, to avoid drawing it twice
          try {
            const pmPoint = svgToLatLng(primeMeridianSvg.x, mapConfig.svgHeight / 2, mapConfig);
            primeMeridianActualLng = pmPoint.lng;
            if (isNaN(primeMeridianActualLng)) primeMeridianActualLng = null; // Handle potential NaN
          } catch (e) { console.warn('Error computing prime meridian longitude:', e); }
        }

        for (let lng = startLngLoop; lng <= endLngLoop; lng += minorLngSpacing) {
          if (lng < westLng || lng > eastLng) continue; // Ensure within bounds

          // Skip if this is the prime meridian and it's being drawn separately
          if (showPrimeMeridian && primeMeridianActualLng !== null && Math.abs(lng - primeMeridianActualLng) < 0.1) {
            continue;
          }

          const isMajorLine = lng % 15 === 0;
          const isGreenwich = Math.abs(lng) < 0.1; // Check for 0 longitude

          const lineStyle: L.PolylineOptions = {
            color: (isGreenwich && !showPrimeMeridian) ? GRID_STYLES.PRIME_MERIDIAN_COLOR : GRID_STYLES.GRID_COLOR,
            weight: (isGreenwich && !showPrimeMeridian) ? GRID_STYLES.PRIME_MERIDIAN_WEIGHT : isMajorLine ? GRID_STYLES.MAJOR_LINE_WEIGHT : GRID_STYLES.MINOR_LINE_WEIGHT,
            opacity: (isGreenwich && !showPrimeMeridian) ? GRID_STYLES.PRIME_MERIDIAN_OPACITY : GRID_STYLES.LINE_OPACITY * (isMajorLine ? 1 : 0.7),
            dashArray: (isGreenwich && !showPrimeMeridian) ? GRID_STYLES.PRIME_MERIDIAN_DASH_ARRAY : isMajorLine ? GRID_STYLES.MAJOR_DASH_ARRAY : GRID_STYLES.DASH_ARRAY,
          };

          try {
            const linePoints: L.LatLngExpression[] = [[southLat, lng], [northLat, lng]];
            L.polyline(linePoints, { ...lineStyle, pane: gridPaneName, interactive: false }).addTo(gridLayerRef.current!);

            // Add label for major lines near south edge
            if ((isMajorLine || (isGreenwich && !showPrimeMeridian)) && zoom >= 0) { // Show labels at lower zoom
              const labelLat = southLat + (northLat - southLat) * 0.02; // Position slightly inside south edge
              const labelPos: L.LatLngExpression = [labelLat, lng];
              const isPmLabel = isGreenwich && !showPrimeMeridian;
              const labelHtml = isPmLabel ? '<strong>Prime Meridian (0°)</strong>' : formatLongitude(lng, 0); // Use formatting function

              L.marker(labelPos, {
                icon: L.divIcon({
                  className: isPmLabel ? 'grid-label prime-meridian-label' : 'grid-label',
                  html: labelHtml,
                  iconSize: undefined,
                  iconAnchor: [isPmLabel ? 60 : 20, 0], // Center PM label, left-align others
                }),
                interactive: false,
                pane: gridPaneName,
              }).addTo(gridLayerRef.current!);
            }
          } catch (lineError) { console.warn(`Error drawing longitude line at ${lng}:`, lineError); }
        }
      } catch (gridError) {
        console.error('Error calculating or drawing grid:', gridError);
      }
    } // End of if(showGrid)

    // --- Draw Prime Meridian Line (only if showPrimeMeridian is true) ---
    if (showPrimeMeridian && primeMeridianSvg) {
      try {
        // Calculate actual longitude of the prime meridian on the map
        const pmPoint = svgToLatLng(primeMeridianSvg.x, mapConfig.svgHeight / 2, mapConfig);
        if (isNaN(pmPoint.lng)) throw new Error("Calculated Prime Meridian longitude is NaN");

        const pmLng = pmPoint.lng;

        // Draw line constrained to map bounds
        const linePoints: L.LatLngExpression[] = [[southLat, pmLng], [northLat, pmLng]];
        L.polyline(linePoints, {
          color: GRID_STYLES.PRIME_MERIDIAN_COLOR,
          weight: GRID_STYLES.PRIME_MERIDIAN_WEIGHT,
          opacity: GRID_STYLES.PRIME_MERIDIAN_OPACITY,
          dashArray: GRID_STYLES.PRIME_MERIDIAN_DASH_ARRAY,
          pane: gridPaneName, // Draw in the correct pane
          interactive: false,
        }).addTo(gridLayerRef.current!);

        // Add Prime Meridian Label near south edge
        const pmLabelLat = southLat + (northLat - southLat) * 0.02;
        const pmLabelPos: L.LatLngExpression = [pmLabelLat, pmLng];

        L.marker(pmLabelPos, {
          icon: L.divIcon({
            className: 'grid-label prime-meridian-label',
            html: '<strong>Prime Meridian</strong>',
            iconSize: undefined,
            iconAnchor: [60, 0], // Center horizontally
          }),
          interactive: false,
          pane: gridPaneName, // Add label to the same pane
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
    mapImageBounds, // Depend on the calculated fixed bounds
    gridPaneName,
    // map?.getZoom(), // Zoom changes spacing, so keep it
    // map?.getBounds().toBBoxString(), // Don't depend on view bounds anymore
  ]);

  // --- Effect for Position Display Control (No changes needed here) ---
  useEffect(() => {
    if (!map || !L) return;
    if (!positionDisplayControlRef.current) {
      const PositionControl = L.Control.extend({
        options: { position: 'bottomleft' },
        onAdd: function () {
          const container = L.DomUtil.create('div', 'leaflet-control-coordinates leaflet-control ixmap-coordinates-display'); // Added custom class
          // Styles moved to CSS
          positionDisplayDivRef.current = container;
          L.DomEvent.disableClickPropagation(container);
          L.DomEvent.disableScrollPropagation(container);
          container.innerHTML = ''; // Clear initial text
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
      if (control && !map.addControl(control)) { // Check if control is already added
         map.addControl(control);
      }
    } else {
      if (control && map.addControl(control)) { // Check if control exists before removing
        map.removeControl(control);
      }
    }
    // Cleanup handled by Leaflet on map remove, but good practice for toggling
    return () => {
      if (map && control && map.addControl(control)) {
        try { map.removeControl(control); }
        catch (e) { console.warn('Could not remove position control on unmount/toggle:', e); }
      }
    };
  }, [map, L, showPositionDisplay]);

  // --- Effect for Mouse Move Coordinate Display (No changes needed here) ---
  useEffect(() => {
    if (!map || !showPositionDisplay) {
      if (positionDisplayDivRef.current) {
        positionDisplayDivRef.current.innerHTML = ''; // Clear text if hidden
      }
      return; // Don't attach listener if not shown
    }
    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      if (!positionDisplayDivRef.current) return;
      try {
        const latLng = e.latlng;
        const latStr = formatLatitude(latLng.lat); // Use imported formatter
        const lonStr = formatLongitude(latLng.lng); // Use imported formatter
        positionDisplayDivRef.current.innerHTML = `Lat: ${latStr} Lon: ${lonStr}`;
      } catch (error) {
        console.error('Error formatting coordinates:', error);
        if (positionDisplayDivRef.current) {
          positionDisplayDivRef.current.innerHTML = 'Lat/Lon Error';
        }
      }
    };
    map.on('mousemove', handleMouseMove);
    // Cleanup
    return () => {
      map.off('mousemove', handleMouseMove);
      if (positionDisplayDivRef.current) {
        positionDisplayDivRef.current.innerHTML = ''; // Clear text on cleanup
      }
    };
  }, [map, showPositionDisplay, L]); // L added as dependency

  // Component manages Leaflet layers/controls directly
  return null;
};

export default GridComponent;
