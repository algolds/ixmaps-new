// src/components/CoordinatesComponent.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { MapConfig, SvgPoint, LatLng } from '@/types';
// *** Ensure this path is correct for your project ***
import { svgToLatLng, latLngToSvg } from '@/lib/coordinates-system'; // Or coordinates-system.ts

interface CoordinatesComponentProps {
  map: any;
  L: any;
  visible: boolean;
  mapConfig: MapConfig;
  primeMeridianSvg: SvgPoint | null;
  showPrimeMeridian: boolean;
  svgWidth: number; // Keep if used for positioning
  svgHeight: number; // Keep if used for positioning
  // NOTE: setPrimeMeridianSvg is NOT included here
}

const CoordinatesComponent: React.FC<CoordinatesComponentProps> = ({
  map,
  L,
  visible,
  mapConfig,
  primeMeridianSvg,
  showPrimeMeridian,
  svgWidth,
  svgHeight,
}) => {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [svgCoords, setSvgCoords] = useState<SvgPoint | null>(null);

  useEffect(() => {
    if (!map || !visible) {
      if (map) { map.off('mousemove'); }
      setCoords(null);
      setSvgCoords(null);
      return;
    }

    const handleMouseMove = (e: any) => {
      const customLatLng = e.latlng;
      setCoords({ lat: customLatLng.lat, lng: customLatLng.lng });
      const currentSvgCoords = latLngToSvg(customLatLng.lat, customLatLng.lng, mapConfig);
      setSvgCoords(currentSvgCoords);
    };

    map.on('mousemove', handleMouseMove);

    return () => {
      if (map) { map.off('mousemove', handleMouseMove); }
    };
  }, [map, L, visible, mapConfig]);

  if (!visible || !coords) {
    return null;
  }

  // --- *** DEFINE THE STYLE OBJECT *** ---
  const displayStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '10px',
    left: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.75)', // Example style
    padding: '3px 8px',
    borderRadius: '3px',
    fontSize: '12px',
    fontFamily: 'monospace',
    zIndex: 1000, // Ensure it's above map tiles
    color: '#333',
    border: '1px solid #aaa',
  };

  return (
    // --- *** ASSIGN THE STYLE OBJECT *** ---
    <div style={displayStyle}>
      Lat: {coords.lat.toFixed(2)}, Lng: {coords.lng.toFixed(2)}
      {/* Optional: Display SVG coordinates for debugging */}
      {/* {svgCoords && ` (SVG X: ${svgCoords.x.toFixed(0)}, Y: ${svgCoords.y.toFixed(0)})`} */}
    </div>
  );
};

export default CoordinatesComponent;
