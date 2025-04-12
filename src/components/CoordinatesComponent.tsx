// src/components/CoordinatesComponent.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { MapConfig, SvgPoint, LatLng } from '@/types';
// *** Verify this path points to your coordinate utility file ***
import { latLngToSvg } from '@/lib/coordinates-system'; // Or coordinates-system.ts etc.

// Define the props expected by this component
interface CoordinatesComponentProps {
  map: any;
  L: any;
  visible: boolean;
  mapConfig: MapConfig;
  primeMeridianSvg: SvgPoint | null; // SVG coords of custom (0,0) if needed
  showPrimeMeridian: boolean; // Controls display related to PM
  svgWidth: number; // Potentially used for positioning the display element
  svgHeight: number; // Potentially used for positioning the display element
  // Note: setPrimeMeridianSvg is intentionally excluded
}

const CoordinatesComponent: React.FC<CoordinatesComponentProps> = ({
  map,
  L,
  visible,
  mapConfig,
  primeMeridianSvg, // Destructure props
  showPrimeMeridian,
  svgWidth,
  svgHeight,
}) => {
  // State to hold the current custom coordinates under the mouse
  const [coords, setCoords] = useState<LatLng | null>(null);
  // State to hold the calculated SVG coordinates (optional, for display/debug)
  const [svgCoords, setSvgCoords] = useState<SvgPoint | null>(null);

  useEffect(() => {
    // If the map isn't ready or the component isn't visible, remove listener and clear state
    if (!map || !visible) {
      if (map) {
        map.off('mousemove', handleMouseMove); // Ensure listener is removed
      }
      setCoords(null);
      setSvgCoords(null);
      return; // Exit effect
    }

    // Handler for mouse movement on the map
    const handleMouseMove = (e: any) => {
      // Leaflet's event latlng corresponds to our custom coordinate system
      const customLatLng = e.latlng;
      setCoords({ lat: customLatLng.lat, lng: customLatLng.lng });

      // Optionally convert custom LatLng back to SVG coordinates
      // Pass mapConfig to ensure correct parameters are used
      const currentSvgCoords = latLngToSvg(
        customLatLng.lat,
        customLatLng.lng,
        mapConfig
      );
      setSvgCoords(currentSvgCoords);
    };

    // Add the event listener
    map.on('mousemove', handleMouseMove);

    // Cleanup function: remove the event listener when effect dependencies change or component unmounts
    return () => {
      if (map) {
        map.off('mousemove', handleMouseMove);
      }
    };
    // Dependencies for the effect
  }, [map, L, visible, mapConfig]);

  // Do not render the component if it's not visible or no coordinates are available yet
  if (!visible || !coords) {
    return null;
  }

  // Define the style for the coordinate display element
  const displayStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '10px', // Position at bottom-left
    left: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace',
    zIndex: 1001, // Ensure it's above map layers but potentially below controls
    color: '#333',
    border: '1px solid #aaa',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    pointerEvents: 'none', // Prevent interfering with map interactions
  };

  // Render the coordinate display
  return (
    <div style={displayStyle}>
      Lat: {coords.lat.toFixed(2)}, Lng: {coords.lng.toFixed(2)}
      {/* Optional: Uncomment to display calculated SVG coordinates */}
      {/* {svgCoords && (
        <span style={{ marginLeft: '10px', color: '#555' }}>
          (SVG X: {svgCoords.x.toFixed(0)}, Y: {svgCoords.y.toFixed(0)})
        </span>
      )} */}
      {/* Optional: Display info relative to prime meridian */}
      {/* {showPrimeMeridian && primeMeridianSvg && svgCoords && (
         <span style={{ marginLeft: '10px', color: '#007700' }}>
           (Dist from PM_X: {(svgCoords.x - primeMeridianSvg.x).toFixed(0)})
         </span>
      )} */}
    </div>
  );
};

export default CoordinatesComponent;
