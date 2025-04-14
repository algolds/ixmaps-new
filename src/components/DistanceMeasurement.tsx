'use client';

import { useEffect, useRef } from 'react';
// Removed unused imports
// import { calculateDistance } from '@/lib/DistanceCalculator';
// import { defaultMapConfig } from '@/lib/MapConfig';

// Constants for scale calculations
const BASE_MILES_PER_PIXEL = 3.2; // Miles per pixel at base zoom
const MILES_TO_KM = 1.60934; // Conversion factor from miles to kilometers (linear)

interface DistanceMeasurementProps {
  map: any;
  L: any;
}

const DistanceMeasurement: React.FC<DistanceMeasurementProps> = ({
  map,
  L,
}) => {
  const measureControlRef = useRef<any>(null);
  const measureLayerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const measureActiveRef = useRef(false);
  const totalMeasurePointsRef = useRef<any[]>([]);

  // --- Refactored Deactivation Logic ---
  const deactivateMeasurementMode = () => {
    if (!measureActiveRef.current) return; // Already inactive

    measureActiveRef.current = false;
    map.off('click', handleMapClick);
    document.removeEventListener('keydown', handleEscapeKey); // Remove Esc listener

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

    hideMeasureInstructions();
  };

  // --- Escape Key Handler ---
  const handleEscapeKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      // console.log('Escape pressed - clearing measurement'); // For debugging
      deactivateMeasurementMode();
      clearMeasurement(); // Clear visuals
      totalMeasurePointsRef.current = []; // Reset points
    }
  };

  // --- Measurement Logic Functions (Mostly unchanged) ---
  const showMeasureInstructions = () => {
    const existingInstructions = document.getElementById('measure-instructions');
    if (existingInstructions) existingInstructions.remove();
    const instructions = document.createElement('div');
    instructions.id = 'measure-instructions';
    instructions.innerHTML =
      'Click to add points. Double-click to finish. Press Esc to cancel.'; // Updated text
    Object.assign(instructions.style, {
      position: 'absolute', bottom: '20px', left: '50%',
      transform: 'translateX(-50%)', backgroundColor: 'rgba(255, 255, 255, 0.8)',
      padding: '8px 12px', borderRadius: '4px', fontSize: '14px',
      zIndex: '1000', boxShadow: '0 0 5px rgba(0,0,0,0.3)',
    });
    document.body.appendChild(instructions);
  };

  const hideMeasureInstructions = () => {
    const instructions = document.getElementById('measure-instructions');
    if (instructions) instructions.remove();
  };

  const clearMeasurement = () => {
    if (measureLayerRef.current) {
      measureLayerRef.current.clearLayers();
    }
    markersRef.current = [];
    polylineRef.current = null;
  };

  const showResultToast = (miles: number, km: number) => {
    const message = `Total: ${miles.toFixed(2)} mi (${km.toFixed(2)} km)`;
    if (typeof window.showToast === 'function') {
      window.showToast(message, 'success', 5000);
    } else {
      alert(message);
    }
  };

  const handleMapClick = (e: any) => {
    if (!measureActiveRef.current) return; // Extra check

    totalMeasurePointsRef.current.push(e.latlng);
    const marker = L.circleMarker(e.latlng, {
      radius: 5, color: '#FF4500', fillColor: '#FFFFFF',
      fillOpacity: 1, weight: 2, pane: 'measure-pane',
    }).addTo(measureLayerRef.current); // Use ref directly
    markersRef.current.push(marker);

    if (totalMeasurePointsRef.current.length > 1) {
      const lastIdx = totalMeasurePointsRef.current.length - 1;
      const firstPoint = totalMeasurePointsRef.current[lastIdx - 1];
      const secondPoint = totalMeasurePointsRef.current[lastIdx];

      L.polyline([firstPoint, secondPoint], {
        color: '#FF4500', weight: 3, opacity: 0.8,
        dashArray: '8,4', pane: 'measure-pane',
      }).addTo(measureLayerRef.current);

      if (!polylineRef.current) {
        polylineRef.current = L.polyline(totalMeasurePointsRef.current, {
          color: '#FF4500', weight: 3, opacity: 0.6,
          dashArray: '8,4', pane: 'measure-pane',
        }).addTo(measureLayerRef.current);
      } else {
        polylineRef.current.setLatLngs(totalMeasurePointsRef.current);
      }

      const zoom = map.getZoom();
      const milesPerPixel = BASE_MILES_PER_PIXEL / Math.pow(2, zoom);
      const point1 = map.latLngToContainerPoint(firstPoint);
      const point2 = map.latLngToContainerPoint(secondPoint);
      const dx = point2.x - point1.x;
      const dy = point2.y - point1.y;
      const pixelDistance = Math.sqrt(dx * dx + dy * dy);
      const miles = pixelDistance * milesPerPixel;
      const km = miles * MILES_TO_KM;
      const midPoint = L.latLng(
        (firstPoint.lat + secondPoint.lat) / 2,
        (firstPoint.lng + secondPoint.lng) / 2,
      );

      L.marker(midPoint, {
        icon: L.divIcon({
          className: 'distance-label',
          html: `
            <div style="background: rgba(255,255,255,0.9); padding: 3px 6px; border-radius: 3px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
              ${miles.toFixed(2)} mi<br>${km.toFixed(2)} km
            </div>
          `,
          iconSize: [80, 40], iconAnchor: [40, 20],
        }),
        pane: 'measure-pane',
      }).addTo(measureLayerRef.current);
    }
  };

  const finishMeasurement = () => {
    if (!measureActiveRef.current || totalMeasurePointsRef.current.length < 2) return;

    // Calculate total distance (same as before)
    let totalPixelDistance = 0;
    for (let i = 1; i < totalMeasurePointsRef.current.length; i++) {
      const point1 = map.latLngToContainerPoint(totalMeasurePointsRef.current[i - 1]);
      const point2 = map.latLngToContainerPoint(totalMeasurePointsRef.current[i]);
      if (point1 && point2) {
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        totalPixelDistance += Math.sqrt(dx * dx + dy * dy);
      }
    }
    const zoom = map.getZoom();
    const milesPerPixel = BASE_MILES_PER_PIXEL / Math.pow(2, zoom);
    const totalMiles = totalPixelDistance * milesPerPixel;
    const totalKm = totalMiles * MILES_TO_KM;

    showResultToast(totalMiles, totalKm); // Show result

    deactivateMeasurementMode(); // Deactivate mode (removes listeners, resets state)
    // Don't clear visuals here if we want the final line to stay
    totalMeasurePointsRef.current = []; // Reset points for next measurement
    map.off('dblclick', finishMeasurement); // Ensure dblclick is off after finishing
  };

  const toggleMeasure = () => {
    if (measureActiveRef.current) {
      // Turn off measurement mode
      deactivateMeasurementMode();
      clearMeasurement(); // Clear visuals
      totalMeasurePointsRef.current = []; // Reset points
    } else {
      // Turn on measurement mode
      measureActiveRef.current = true;
      clearMeasurement(); // Clear any previous visuals
      totalMeasurePointsRef.current = [];
      map.on('click', handleMapClick);
      document.addEventListener('keydown', handleEscapeKey); // Add Esc listener

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

      showMeasureInstructions();
      // Re-add dblclick listener when activating
      map.on('dblclick', finishMeasurement);
    }
  };


  // --- useEffect Hook ---
  useEffect(() => {
    if (!map || !L) return;

    // --- Pane and Layer Setup ---
    if (!map.getPane('measure-pane')) {
      map.createPane('measure-pane');
      map.getPane('measure-pane').style.zIndex = 700;
    }
    // Ensure layer ref is set up correctly
    if (!measureLayerRef.current) {
        measureLayerRef.current = L.layerGroup([], { pane: 'measure-pane' }).addTo(map);
    }


    // --- Control Creation and Addition ---
    const MeasureControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: function () {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control measure-control');
        const button = L.DomUtil.create('a', 'measure-button', container);
        Object.assign(button, { href: '#', title: 'Measure distance (Esc to cancel)', innerHTML: '📏' }); // Updated title
        Object.assign(button.style, {
          fontSize: '18px', fontWeight: 'bold', lineHeight: '26px',
          textAlign: 'center', width: '26px', height: '26px', display: 'block',
        });
        L.DomEvent
          .on(button, 'click', L.DomEvent.stopPropagation)
          .on(button, 'click', L.DomEvent.preventDefault)
          .on(button, 'click', toggleMeasure);
        L.DomEvent.disableClickPropagation(container);
        return container;
      },
    });

    if (!measureControlRef.current) {
      const measureControl = new MeasureControl();
      map.addControl(measureControl);
      measureControlRef.current = measureControl;
    }

    // --- Event Listeners and Styles ---
    // Dblclick listener is now added/removed in toggleMeasure/finishMeasurement

    const addDistanceStyles = () => {
      if (document.getElementById('distance-measurement-styles')) return;
      const style = document.createElement('style');
      style.id = 'distance-measurement-styles';
      style.textContent = `
        .distance-label { pointer-events: none; font-size: 12px; text-align: center; }
        .measure-control a { background-color: white; border-bottom: 1px solid #ccc; }
        .measure-control a:hover { background-color: #f4f4f4; }
      `;
      document.head.appendChild(style);
    };
    addDistanceStyles();

    // --- Cleanup ---
    return () => {
      // Deactivate mode if active (removes listeners, resets state)
      deactivateMeasurementMode();
      map.off('dblclick', finishMeasurement); // Ensure dblclick is off

      // Remove the control
      if (map && measureControlRef.current) {
        try {
          map.removeControl(measureControlRef.current);
        } catch (e) { console.warn('Error removing measure control:', e); }
        measureControlRef.current = null;
      }

      // Clear layers
      if (measureLayerRef.current) {
        measureLayerRef.current.clearLayers();
        // Optionally remove the layer group itself if it won't be reused
        // map.removeLayer(measureLayerRef.current);
        measureLayerRef.current = null;
      }

      // Remove added styles
      const style = document.getElementById('distance-measurement-styles');
      if (style) style.remove();
    };
  }, [map, L]); // Dependencies

  return null;
};

// Add the showToast to Window interface if not already globally defined
declare global {
  interface Window {
    showToast: (message: string, type?: string, duration?: number) => string;
    hideToast: (id: string) => void;
  }
}

export default DistanceMeasurement;
