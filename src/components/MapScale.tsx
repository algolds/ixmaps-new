'use client';

import React, { useEffect, useState } from 'react';

interface MapScaleProps {
  map: any;
  L: any;
  mapConfig: any;
}

const MapScale: React.FC<MapScaleProps> = ({ map, L, mapConfig }) => {
  const [scaleAdded, setScaleAdded] = useState(false);

  useEffect(() => {
    if (!map || !L || scaleAdded) return;

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
        
        // Scale values
        const scaleValue = L.DomUtil.create('div', 'scale-value', container);
        
        // Calculate scale based on map dimensions and zoom
        const updateScale = () => {
          if (!map) return;
          
          const zoom = map.getZoom();
          const scale = calculateMapScale(zoom);
          
          // Format the scale text
          const milesText = formatDistance(scale.miles, 'mi');
          const kmText = formatDistance(scale.km, 'km');
          
          scaleValue.innerHTML = `${milesText} (${kmText})`;
          
          // Also add scale ratio
          const scaleRatio = L.DomUtil.create('div', 'scale-ratio', container);
          if (!container.querySelector('.scale-ratio')) {
            container.appendChild(scaleRatio);
          } else {
            scaleRatio.innerHTML = '';
          }
          
          scaleRatio.innerHTML = `Map Scale: 1:${Math.round(scale.ratio).toLocaleString()}`;
          scaleRatio.style.fontSize = '11px';
          scaleRatio.style.color = '#666';
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
  
  // Function to calculate map scale based on zoom level
  const calculateMapScale = (zoom: number) => {
    // Base values at zoom level 0
    const baseWidth = 2000; // miles
    const basePxWidth = mapConfig.svgWidth; // pixels
    
    // Scale factor based on zoom
    const scaleFactor = Math.pow(2, zoom);
    
    // Calculate miles per pixel at current zoom
    const milesPerPixel = baseWidth / (basePxWidth * scaleFactor);
    
    // Calculate actual scale (1 pixel represents x miles)
    const scaleWidth = 150; // pixels for our scale bar
    const miles = milesPerPixel * scaleWidth;
    const km = miles * 1.60934;
    
    // Calculate scale ratio (1:x)
    // 1 inch on screen is approximately 96 pixels
    const inchesOnScreen = scaleWidth / 96;
    const milesInRealWorld = miles;
    const inchesInMile = 63360;
    const ratio = (milesInRealWorld * inchesInMile) / inchesOnScreen;
    
    return {
      miles,
      km,
      ratio
    };
  };
  
  // Format distance for display
  const formatDistance = (distance: number, unit: string) => {
    if (distance >= 1000) {
      return `${Math.round(distance / 100) / 10}k ${unit}`;
    } else if (distance >= 100) {
      return `${Math.round(distance)} ${unit}`;
    } else {
      return `${Math.round(distance * 10) / 10} ${unit}`;
    }
  };
  
  return null; // Control is added directly to the map
};

export default MapScale;