'use client';

import { defaultMapConfig } from '@/lib/MapConfig';
import React, { useEffect, useState } from 'react';

interface MapScaleProps {
  map: any;
  L: any;
  mapConfig: any;
}
const BASE_MILES_PER_PIXEL = defaultMapConfig.milesPerPixel; // Ensure this is set to 10 sq mi per pixel
const MILES_TO_KM = 2.59; // Conversion factor from square miles to square kilometers

const MapScale: React.FC<MapScaleProps> = ({ map, L, mapConfig }) => {
  const [scaleAdded, setScaleAdded] = useState(false);

  useEffect(() => {
    if (!map || !L || scaleAdded) return;

    // First, remove any existing scale controls to prevent duplicates
    const existingScaleControls = document.querySelectorAll('.custom-scale-control, .leaflet-control-scale');
    existingScaleControls.forEach(control => {
      try {
        if (control.parentNode) {
          control.parentNode.removeChild(control);
        }
      } catch (e) {
        console.warn('Error removing existing scale control:', e);
      }
    });

    // Function to calculate scale factor between raw map and display
    const calculateScaleFactor = () => {
      // Use the current display size vs raw map size
      const mapWidth = map.getContainer().clientWidth;
      
      // Calculate width scale factor
      const widthScale = mapConfig.svgWidth / mapConfig.rawWidth;
      
      return widthScale;
    };

    // Create custom scale control
    const CustomScaleControl = L.Control.extend({
      options: {
        position: 'bottomright'
      },
      
      onAdd: function() {
        const container = L.DomUtil.create('div', 'custom-scale-control');
        container.style.backgroundColor = 'white';
        container.style.padding = '5px 10px';
        container.style.border = '2px solid rgba(0,0,0,0.2)';
        container.style.borderRadius = '4px';
        container.style.fontSize = '12px';
        container.style.lineHeight = '1.5';
        container.style.color = '#333';
        container.style.width = '180px';
        
        // Scale title
        const title = L.DomUtil.create('div', 'scale-title', container);
        title.innerHTML = 'Map Scale';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '5px';
        
        // Scale bar
        const scaleBar = L.DomUtil.create('div', 'scale-bar', container);
        scaleBar.style.height = '10px';
        scaleBar.style.backgroundColor = '#000';
        scaleBar.style.marginBottom = '5px';
        scaleBar.style.width = '100%';
        
        // Scale distance value
        const scaleDistance = L.DomUtil.create('div', 'scale-distance', container);
        scaleDistance.style.fontSize = '11px';
        scaleDistance.style.marginBottom = '3px';
        
        // Scale ratio
        const scaleRatio = L.DomUtil.create('div', 'scale-ratio', container);
        scaleRatio.style.fontSize = '11px';
        scaleRatio.style.color = '#666';
        
        // Function to update the scale display
        const updateScale = () => {
          if (!map) return;
          
          const zoom = map.getZoom();
          
          const baseMilesPerPixel = mapConfig.milesPerPixel || BASE_MILES_PER_PIXEL;
          
          // Calculate scale based on zoom level
          const zoomFactor = Math.pow(2, zoom);
          const milesPerPixel = baseMilesPerPixel / zoomFactor;
          const kmPerPixel = milesPerPixel * MILES_TO_KM;
          
          // Calculate scale for a 100px wide bar (for display purposes)
          const scaleBarLength = 100;
          const miles = Math.round(milesPerPixel * scaleBarLength);
          const km = Math.round(kmPerPixel * scaleBarLength);
          
          // Format the distance text
          scaleDistance.innerHTML = `${miles} mi (${km} km)`;
          
          // Calculate and display scale ratio
          const scaleFactor = calculateScaleFactor();
          const ratio = Math.round(1 / scaleFactor * 1000).toLocaleString();
          scaleRatio.innerHTML = `Map Scale: 1:${ratio}`;
        };
        
        // Initial update
        updateScale();
        
        // Listen for zoom events
        map.on('zoomend', updateScale);
        
        return container;
      }
    });
    
    // Add scale to map
    map.addControl(new CustomScaleControl());
    setScaleAdded(true);
    
  }, [map, L, mapConfig, scaleAdded]);
  
  return null; // Control is added directly to the map
};

export default MapScale;