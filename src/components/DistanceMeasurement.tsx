'use client';

import { useEffect, useRef } from 'react';
import { calculateDistance } from '@/lib/DistanceCalculator';

interface DistanceMeasurementProps {
  map: any;
  L: any;
}

const DistanceMeasurement: React.FC<DistanceMeasurementProps> = ({ map, L }) => {
  const measureControlRef = useRef<any>(null);
  const measureLayerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const measureActiveRef = useRef(false);
  
  useEffect(() => {
    if (!map || !L) return;
    
    // Create layer for measurements
    const measureLayer = L.layerGroup().addTo(map);
    measureLayerRef.current = measureLayer;
    
    // Define the toggle measure function first
    const toggleMeasure = () => {
      if (measureActiveRef.current) {
        // Turn off measurement mode
        measureActiveRef.current = false;
        clearMeasurement();
        map.off('click', handleMapClick);
        
        // Change cursor back to normal
        const mapContainer = map.getContainer();
        if (mapContainer) {
          mapContainer.style.cursor = '';
        }
        
        // Update button style
        const button = document.querySelector('.measure-button');
        if (button) {
          (button as HTMLElement).style.backgroundColor = '';
        }
      } else {
        // Turn on measurement mode
        measureActiveRef.current = true;
        clearMeasurement();
        map.on('click', handleMapClick);
        
        // Change cursor to crosshair
        const mapContainer = map.getContainer();
        if (mapContainer) {
          mapContainer.style.cursor = 'crosshair';
        }
        
        // Update button style
        const button = document.querySelector('.measure-button');
        if (button) {
          (button as HTMLElement).style.backgroundColor = '#f4f4f4';
        }
      }
    };
    
    // Clear current measurement
    const clearMeasurement = () => {
      measureLayer.clearLayers();
      markersRef.current = [];
      polylineRef.current = null;
    };
    
    // Handle map clicks for measurement
    const handleMapClick = (e: any) => {
      // Add marker at click location
      const marker = L.circleMarker(e.latlng, {
        radius: 4,
        color: '#0078A8',
        fillColor: '#FFFFFF',
        fillOpacity: 1,
        weight: 2
      }).addTo(measureLayer);
      
      markersRef.current.push(marker);
      
      // If this is the second point, draw the line and show distance
      if (markersRef.current.length === 2) {
        const firstPoint = markersRef.current[0].getLatLng();
        const secondPoint = markersRef.current[1].getLatLng();
        
        // Draw line between points
        const line = L.polyline([firstPoint, secondPoint], {
          color: '#0078A8',
          weight: 2,
          dashArray: '5,5'
        }).addTo(measureLayer);
        
        polylineRef.current = line;
        
        // Calculate distance
        const distance = calculateDistance(firstPoint, secondPoint, map);
        
        // Add distance label
        const midPoint = L.latLng(
          (firstPoint.lat + secondPoint.lat) / 2,
          (firstPoint.lng + secondPoint.lng) / 2
        );
        
        const label = L.marker(midPoint, {
          icon: L.divIcon({
            className: 'distance-label',
            html: `${distance.miles.toFixed(2)} mi<br>${distance.kilometers.toFixed(2)} km`,
            iconSize: [80, 40],
            iconAnchor: [40, 20]
          })
        }).addTo(measureLayer);
        
        markersRef.current.push(label);
        
        // Turn off measurement mode after completing one measurement
        measureActiveRef.current = false;
        map.off('click', handleMapClick);
        
        // Change cursor back to normal
        const mapContainer = map.getContainer();
        if (mapContainer) {
          mapContainer.style.cursor = '';
        }
        
        // Update button style
        const button = document.querySelector('.measure-button');
        if (button) {
          (button as HTMLElement).style.backgroundColor = '';
        }
      }
    };
    
    // Create custom control
    const MeasureControl = L.Control.extend({
      options: {
        position: 'topleft'
      },
      
      onAdd: function() {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control measure-control');
        const button = L.DomUtil.create('a', 'measure-button', container);
        button.href = '#';
        button.title = 'Measure distance';
        button.innerHTML = '📏';
        button.style.fontSize = '18px';
        button.style.fontWeight = 'bold';
        button.style.lineHeight = '26px';
        button.style.textAlign = 'center';
        
        L.DomEvent
          .on(button, 'click', L.DomEvent.stopPropagation)
          .on(button, 'click', L.DomEvent.preventDefault)
          .on(button, 'click', toggleMeasure);
        
        L.DomEvent.disableClickPropagation(container);
        
        return container;
      }
    });
    
    // Add the control to the map
    const measureControl = new MeasureControl();
    map.addControl(measureControl);
    measureControlRef.current = measureControl;
    
    // Add double click to clear
    map.on('dblclick', () => {
      if (markersRef.current.length > 0) {
        clearMeasurement();
      }
    });
    
    // Cleanup
    return () => {
      if (map && measureControlRef.current) {
        try {
          map.removeControl(measureControlRef.current);
        } catch (e) {
          console.warn('Error removing measure control:', e);
        }
      }
      
      if (map) {
        map.off('click', handleMapClick);
        map.off('dblclick');
      }
      
      if (measureLayerRef.current) {
        measureLayerRef.current.clearLayers();
      }
    };
  }, [map, L]);
  
  return null; // This component doesn't render anything itself
};

export default DistanceMeasurement;