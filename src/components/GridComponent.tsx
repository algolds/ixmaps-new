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
      const start = { lat: -90, lng }; // Start at the bottom of the map
      const end = { lat: 90, lng }; // End at the top of the map

      L.polyline(
        [
          [start.lat, start.lng],
          [end.lat, end.lng],
        ],
        {
          color: gridStyle.GRID_COLOR,
          weight: gridStyle.MINOR_LINE_WEIGHT,
          opacity: gridStyle.LINE_OPACITY,
          dashArray: gridStyle.DASH_ARRAY,
          pane: 'grid-pane',
        }
      ).addTo(gridLayerRef.current);
    }

    // Draw latitude lines (horizontal grid lines)
    for (let lat = -90; lat <= 90; lat += spacing) {
      const start = { lat, lng: -180 }; // Start at the left of the map
      const end = { lat, lng: 180 }; // End at the right of the map

      L.polyline(
        [
          [start.lat, start.lng],
          [end.lat, end.lng],
        ],
        {
          color: gridStyle.GRID_COLOR,
          weight: gridStyle.MINOR_LINE_WEIGHT,
          opacity: gridStyle.LINE_OPACITY,
          dashArray: gridStyle.DASH_ARRAY,
          pane: 'grid-pane',
        }
      ).addTo(gridLayerRef.current);
    }

    // Draw the prime meridian (0° longitude)
    const primeMeridianStart = { lat: -90, lng: 0 };
    const primeMeridianEnd = { lat: 90, lng: 0 };

    L.polyline(
      [
        [primeMeridianStart.lat, primeMeridianStart.lng],
        [primeMeridianEnd.lat, primeMeridianEnd.lng],
      ],
      {
        color: gridStyle.PRIME_MERIDIAN_COLOR,
        weight: gridStyle.PRIME_MERIDIAN_WEIGHT,
        opacity: gridStyle.PRIME_MERIDIAN_OPACITY,
        dashArray: gridStyle.PRIME_MERIDIAN_DASH_ARRAY,
        pane: 'grid-pane',
      }
    ).addTo(gridLayerRef.current);
  };

  return null; // This component does not render any DOM elements
};

export default GridComponent;
