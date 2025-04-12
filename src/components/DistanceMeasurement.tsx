'use client';

import { useEffect, useRef } from 'react';
import { calculateDistance } from '@/lib/DistanceCalculator';
import { defaultMapConfig } from '@/lib/MapConfig';

// Constants for scale calculations
const BASE_MILES_PER_PIXEL = 3.2; // Miles per pixel at base zoom
const MILES_TO_KM = 1.60934; // Conversion factor from miles to kilometers (linear)

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
  const totalMeasurePointsRef = useRef<any[]>([]);
  
  useEffect(() => {
    if (!map || !L) return;
    
    // Create custom pane for measurement with high z-index
    if (!map.getPane('measure-pane')) {
      map.createPane('measure-pane');
      map.getPane('measure-pane').style.zIndex = 700; // Higher than grid and other elements
    }
    
    // Create layer for measurements
    const measureLayer = L.layerGroup([], { pane: 'measure-pane' }).addTo(map);
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
        totalMeasurePointsRef.current = [];
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
        
        // Create and show measurement instructions
        showMeasureInstructions();
      }
    };
    
    // Show measurement instructions
    const showMeasureInstructions = () => {
      // Remove existing instructions
      const existingInstructions = document.getElementById('measure-instructions');
      if (existingInstructions) {
        existingInstructions.remove();
      }
      
      // Create new instructions
      const instructions = document.createElement('div');
      instructions.id = 'measure-instructions';
      instructions.innerHTML = 'Click to add measurement points. Double-click to finish.';
      instructions.style.position = 'absolute';
      instructions.style.bottom = '20px';
      instructions.style.left = '50%';
      instructions.style.transform = 'translateX(-50%)';
      instructions.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
      instructions.style.padding = '8px 12px';
      instructions.style.borderRadius = '4px';
      instructions.style.fontSize = '14px';
      instructions.style.zIndex = '1000';
      instructions.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
      
      document.body.appendChild(instructions);
    };
    
    // Hide measurement instructions
    const hideMeasureInstructions = () => {
      const instructions = document.getElementById('measure-instructions');
      if (instructions) {
        instructions.remove();
      }
    };
    
    // Clear current measurement
    const clearMeasurement = () => {
      measureLayer.clearLayers();
      markersRef.current = [];
      polylineRef.current = null;
    };
    
    // Show results toast
    const showResultToast = (miles: number, km: number) => {
      if (typeof window.showToast === 'function') {
        const message = `Total: ${miles.toFixed(2)} mi (${km.toFixed(2)} km)`;
        window.showToast(message, 'success', 5000);
      } else {
        alert(`Total: ${miles.toFixed(2)} mi (${km.toFixed(2)} km)`);
      }
    };
    
    // Handle map clicks for measurement
    const handleMapClick = (e: any) => {
      // Add point to total measurement points
      totalMeasurePointsRef.current.push(e.latlng);
      
      // Add marker at click location
      const marker = L.circleMarker(e.latlng, {
        radius: 5,
        color: '#FF4500', // Change to more visible orange/red
        fillColor: '#FFFFFF',
        fillOpacity: 1,
        weight: 2,
        pane: 'measure-pane'
      }).addTo(measureLayer);
      
      markersRef.current.push(marker);
      
      // If this is not the first point, draw the line and show distance
      if (totalMeasurePointsRef.current.length > 1) {
        const lastIdx = totalMeasurePointsRef.current.length - 1;
        const firstPoint = totalMeasurePointsRef.current[lastIdx - 1];
        const secondPoint = totalMeasurePointsRef.current[lastIdx];
        
        // Draw line between points with improved visibility
        const line = L.polyline([firstPoint, secondPoint], {
          color: '#FF4500', // Make it more visible (orange/red)
          weight: 3, // Increase weight
          opacity: 0.8, // More opaque
          dashArray: '8,4', // Adjusted dash pattern
          pane: 'measure-pane' // Use the custom pane
        }).addTo(measureLayer);
        
        // Store the line reference for the total path
        if (!polylineRef.current) {
          polylineRef.current = L.polyline(totalMeasurePointsRef.current, {
            color: '#FF4500',
            weight: 3,
            opacity: 0.6,
            dashArray: '8,4',
            pane: 'measure-pane'
          }).addTo(measureLayer);
        } else {
          polylineRef.current.setLatLngs(totalMeasurePointsRef.current);
        }
        
        // Calculate distance using the new scale implementation
        const zoom = map.getZoom();
        const milesPerPixel = BASE_MILES_PER_PIXEL / Math.pow(2, zoom);
        
        const point1 = map.latLngToContainerPoint(firstPoint);
        const point2 = map.latLngToContainerPoint(secondPoint);
        
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        const pixelDistance = Math.sqrt(dx * dx + dy * dy);
        
        const miles = pixelDistance * milesPerPixel;
        const km = miles * MILES_TO_KM;
        
        // Add distance label with more visible styling
        const midPoint = L.latLng(
          (firstPoint.lat + secondPoint.lat) / 2,
          (firstPoint.lng + secondPoint.lng) / 2
        );
        
        const label = L.marker(midPoint, {
          icon: L.divIcon({
            className: 'distance-label',
            html: `
              <div style="background: rgba(255,255,255,0.9); padding: 3px 6px; border-radius: 3px; border: 1px solid #FF4500; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
                ${miles.toFixed(2)} mi<br>${km.toFixed(2)} km
              </div>
            `,
            iconSize: [80, 40],
            iconAnchor: [40, 20]
          }),
          pane: 'measure-pane'
        }).addTo(measureLayer);
      }
    };
    
    // Handle double click to finish measuring
    const finishMeasurement = () => {
      if (!measureActiveRef.current || totalMeasurePointsRef.current.length < 2) return;
      
      // Calculate total distance
      let totalPixelDistance = 0;
      
      for (let i = 1; i < totalMeasurePointsRef.current.length; i++) {
        const point1 = map.latLngToContainerPoint(totalMeasurePointsRef.current[i-1]);
        const point2 = map.latLngToContainerPoint(totalMeasurePointsRef.current[i]);
        
        if (point1 && point2) {
          const dx = point2.x - point1.x;
          const dy = point2.y - point1.y;
          totalPixelDistance += Math.sqrt(dx * dx + dy * dy);
        }
      }
      
      // Calculate using consistent base scale
      const zoom = map.getZoom();
      const milesPerPixel = BASE_MILES_PER_PIXEL / Math.pow(2, zoom);
      const totalMiles = totalPixelDistance * milesPerPixel;
      const totalKm = totalMiles * MILES_TO_KM;
      
      // Show total and exit measurement mode
      showResultToast(totalMiles, totalKm);
      
      // Turn off measurement mode
      measureActiveRef.current = false;
      map.off('click', handleMapClick);
      map.off('dblclick', finishMeasurement);
      
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
      
      // Hide instructions
      hideMeasureInstructions();
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
    
    // Add double click to finish measurement
    map.on('dblclick', finishMeasurement);
    
    // Add styles for measurement elements
    const addDistanceStyles = () => {
      if (document.getElementById('distance-measurement-styles')) return;
      
      const style = document.createElement('style');
      style.id = 'distance-measurement-styles';
      style.textContent = `
        .distance-label {
          pointer-events: none;
          font-size: 12px;
          text-align: center;
        }
      `;
      document.head.appendChild(style);
    };
    
    addDistanceStyles();
    
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
        map.off('dblclick', finishMeasurement);
      }
      
      if (measureLayerRef.current) {
        measureLayerRef.current.clearLayers();
      }
      
      hideMeasureInstructions();
      
      // Remove added styles
      const style = document.getElementById('distance-measurement-styles');
      if (style) {
        style.remove();
      }
    };
  }, [map, L]);
  
  return null; // This component doesn't render anything itself
};

// Add the showToast to Window interface
declare global {
  interface Window {
    showToast: (message: string, type?: string, duration?: number) => string;
    hideToast: (id: string) => void;
  }
}

export default DistanceMeasurement;