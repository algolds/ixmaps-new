'use client';

import React, { useEffect, useState } from 'react';
import { LatLng } from 'leaflet';

interface CoordinatesComponentProps {
  map: any;
  L: any;
  svgToCustomLatLng: (x: number, y: number) => LatLng;
  formatCoord: (value: number, posLabel: string, negLabel: string) => string;
  visible: boolean;
}

const CoordinatesComponent: React.FC<CoordinatesComponentProps> = ({
  map,
  L,
  svgToCustomLatLng,
  formatCoord,
  visible
}) => {
  const [displayAdded, setDisplayAdded] = useState(false);
  
  useEffect(() => {
    if (!map || !L || displayAdded) return;
    
    // Create a custom pane with high z-index for the coordinates display
    const coordinatesPane = 'coordinates-pane';
    if (!map.getPane(coordinatesPane)) {
      map.createPane(coordinatesPane);
      map.getPane(coordinatesPane).style.zIndex = 655; // Higher than grid
    }
    
    // Create coordinate display control
    const CoordDisplay = L.Control.extend({
      options: {
        position: 'bottomleft'
      },
      
      onAdd: function() {
        const container = L.DomUtil.create('div', 'coordinates-display ixmap-coordinates-display');
        container.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        container.style.padding = '5px 10px';
        container.style.borderRadius = '4px';
        container.style.fontSize = '12px';
        container.style.fontFamily = 'monospace';
        container.style.boxShadow = '0 0 5px rgba(0, 0, 0, 0.2)';
        container.style.marginBottom = '5px';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '1000';
        container.style.maxWidth = '180px';
        container.style.display = visible ? 'block' : 'none';
        container.innerHTML = 'Coordinates: Hover on map';
        
        return container;
      }
    });
    
    // Add the control to the map
    const coordDisplay = new CoordDisplay();
    coordDisplay.addTo(map);
    setDisplayAdded(true);
    
    // Update coordinates on mousemove
    const mouseMoveHandler = (e: any) => {
      try {
        const customCoord = svgToCustomLatLng(e.latlng.lng, e.latlng.lat);
        const container = document.querySelector('.ixmap-coordinates-display');
        if (container) {
          container.innerHTML = `Lat: ${formatCoord(customCoord.lat, 'N', 'S')}<br>Lng: ${formatCoord(customCoord.lng, 'E', 'W')}`;
        }
      } catch (err) {
        console.warn('Error updating coordinates:', err);
      }
    };
    
    map.on('mousemove', mouseMoveHandler);
    
    // Cleanup
    return () => {
      map.off('mousemove', mouseMoveHandler);
      
      // Try to remove the control
      try {
        if (coordDisplay && coordDisplay.remove) {
          coordDisplay.remove();
        }
      } catch (e) {
        console.warn('Error removing coordinates display:', e);
      }
    };
  }, [map, L, svgToCustomLatLng, formatCoord, displayAdded]);
  
  // Update visibility when changed
  useEffect(() => {
    const container = document.querySelector('.ixmap-coordinates-display') as HTMLElement;
    if (container) {
      container.style.display = visible ? 'block' : 'none';
    }
  }, [visible]);
  
  return null; // Control is added directly to the map
};

export default CoordinatesComponent;