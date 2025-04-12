// src/components/GridComponent.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import { MapConfig, SvgPoint, LatLng } from '@/types'; // Make sure MapConfig is imported
import { latLngToSvg, svgToLatLng } from '@/lib/coordinates-system';
import { gridStyle, visibleBounds } from '@/lib/MapConfig';

interface GridComponentProps {
  map: any;
  L: any;
  visible: boolean;
  mapConfig: MapConfig; // <-- ADD THIS LINE
  // primeMeridianSvg?: SvgPoint | null; // Optional
}

const GridComponent: React.FC<GridComponentProps> = ({
  map,
  L,
  visible,
  mapConfig, // <-- Destructure it
  // primeMeridianSvg,
}) => {
  const gridLayerRef = useRef<any>(null);

  useEffect(() => {
    // Use mapConfig here for calculations if needed
    // ... (rest of the component logic from previous example) ...
  }, [map, L, visible, mapConfig]); // Add mapConfig to dependencies

  return null;
};

export default GridComponent;
