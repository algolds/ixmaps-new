'use client';

import React, { useEffect, useRef } from 'react';
import { gridStyle } from '@/lib/MapConfig';
import { latLngToSvg, svgToLatLng } from '@/lib/coordinates-system';
import { SvgPoint } from '@/types';

interface GridComponentProps {
  map: any; // Leaflet map instance
  L: any; // Leaflet library instance
  primeMeridianSvg: SvgPoint | null; // Prime meridian reference point in SVG space
  visible: boolean; // Whether the grid should be visible
  svgWidth: number; // Width of the SVG map
  svgHeight: number; // Height of the SVG map
}

const GridComponent: React.FC<GridComponentProps> = ({
  map,
  L,
  primeMeridianSvg,
  visible,
  svgWidth,
  svgHeight,
}) => {
  const gridLayerRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !L) return;

    // Create a custom pane for the grid
    const gridPane = 'grid-pane';
    if (!map.getPane(gridPane)) {
      map.createPane(gridPane);
      map.getPane(gridPane).style.zIndex = '650'; // Ensure the grid is above other layers
    }

    // Create a layer group for the grid
    const gridLayer = L.layerGroup([], { pane: gridPane });
    gridLayerRef.current = gridLayer;
    gridLayer.addTo(map);

    // Function to update the grid when the map changes
    const updateGrid = () => {
      if (visible && primeMeridianSvg) {
        drawGrid();
      }
    };

    // Initial grid drawing
    updateGrid();

    // Attach event listeners to update the grid on map events
    map.on('zoomend', updateGrid);
    map.on('moveend', updateGrid);

    // Cleanup on component unmount
    return () => {
      map.off('zoomend', updateGrid);
      map.off('moveend', updateGrid);
      if (gridLayerRef.current) {
        map.removeLayer(gridLayerRef.current);
      }
    };
  }, [map, L, visible, primeMeridianSvg, svgWidth, svgHeight]);

  const drawGrid = () => {
    if (!map || !gridLayerRef.current || !primeMeridianSvg || !visible) return;

    // Clear the existing grid
    gridLayerRef.current.clearLayers();

    const zoom = map.getZoom();

    // Adjust grid spacing based on zoom level
    let spacing = 30; // Default spacing in degrees
    if (zoom > 2) spacing = 15;
    if (zoom > 3) spacing = 10;
    if (zoom > 4) spacing = 5;

    // Draw longitude lines (vertical grid lines)
    for (let lng = -180; lng <= 180; lng += spacing) {
      const points = [];
      
      // Create a series of points for the longitude line
      for (let lat = -90; lat <= 90; lat += 5) {
        // Convert geographic coordinates to SVG coordinates
        const svgPoint = latLngToSvg(lat, lng);
        // Convert SVG coordinates to Leaflet coordinates (which are in the CRS.Simple system)
        points.push(L.latLng(svgPoint.y, svgPoint.x));
      }

      L.polyline(points, {
        color: gridStyle.GRID_COLOR,
        weight: gridStyle.MINOR_LINE_WEIGHT,
        opacity: gridStyle.LINE_OPACITY,
        dashArray: gridStyle.DASH_ARRAY,
        pane: 'grid-pane',
      }).addTo(gridLayerRef.current);
    }

    // Draw latitude lines (horizontal grid lines)
    for (let lat = -90; lat <= 90; lat += spacing) {
      const points = [];
      
      // Create a series of points for the latitude line
      for (let lng = -180; lng <= 180; lng += 5) {
        // Convert geographic coordinates to SVG coordinates
        const svgPoint = latLngToSvg(lat, lng);
        // Convert SVG coordinates to Leaflet coordinates (which are in the CRS.Simple system)
        points.push(L.latLng(svgPoint.y, svgPoint.x));
      }

      L.polyline(points, {
        color: gridStyle.GRID_COLOR,
        weight: gridStyle.MINOR_LINE_WEIGHT,
        opacity: gridStyle.LINE_OPACITY,
        dashArray: gridStyle.DASH_ARRAY,
        pane: 'grid-pane',
      }).addTo(gridLayerRef.current);
    }

    // Draw the prime meridian (0° longitude) - using 30° as the reference point (mirrored)
    const primeMeridianPoints = [];
    for (let lat = -90; lat <= 90; lat += 5) {
      // We use 30 as the longitude since that's the reference meridian in the coordinates system
      const svgPoint = latLngToSvg(lat, 30);
      primeMeridianPoints.push(L.latLng(svgPoint.y, svgPoint.x));
    }

    L.polyline(primeMeridianPoints, {
      color: gridStyle.PRIME_MERIDIAN_COLOR,
      weight: gridStyle.PRIME_MERIDIAN_WEIGHT,
      opacity: gridStyle.PRIME_MERIDIAN_OPACITY,
      dashArray: gridStyle.PRIME_MERIDIAN_DASH_ARRAY,
      pane: 'grid-pane',
    }).addTo(gridLayerRef.current);
  };

  return null; // This component does not render any DOM elements
};

export default GridComponent;