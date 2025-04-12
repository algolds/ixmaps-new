'use client';

import React, { useEffect, useRef } from 'react';
import { SvgPoint } from '@/types';
import { svgToCustomLatLng } from '@/lib/coordinates-system';
import { showToast } from '@/lib/Toast';

interface CoordinatesComponentProps {
  map: any;
  L: any;
  visible: boolean;
  showPrimeMeridian: boolean;
  mapConfig: any;
  svgWidth: number;
  svgHeight: number;
  primeMeridianSvg: SvgPoint | null;
  setPrimeMeridianSvg: (point: SvgPoint | null) => void;
}

const CoordinatesComponent: React.FC<CoordinatesComponentProps> = ({
  map,
  L,
  visible,
  showPrimeMeridian,
  mapConfig,
  svgWidth,
  svgHeight,
  primeMeridianSvg,
  setPrimeMeridianSvg,
}) => {
  const clickMarkerRef = useRef<any>(null);

  const addCoordinateMarker = (e: any) => {
    if (!map || !primeMeridianSvg) return;

    try {
      if (clickMarkerRef.current) {
        map.removeLayer(clickMarkerRef.current);
      }

      const customCoord = svgToCustomLatLng(e.latlng.lng, e.latlng.lat, mapConfig, primeMeridianSvg);

      const marker = L.circleMarker(e.latlng, {
        radius: 5,
        color: '#FF4500',
        fillColor: '#FFA07A',
        fillOpacity: 1,
        weight: 2,
        pane: 'coordinate-marker-pane',
      }).addTo(map);

      clickMarkerRef.current = marker;

      const coordText = `
        <div style="text-align:center;">
          <strong>Coordinates:</strong><br>
          Lat: ${customCoord.lat.toFixed(2)}°<br>
          Lng: ${customCoord.lng.toFixed(2)}°
        </div>
      `;

      marker.bindPopup(coordText).openPopup();

      showToast(
        `Clicked at Lat: ${customCoord.lat.toFixed(2)}°, Lng: ${customCoord.lng.toFixed(2)}°`,
        'info',
        3000
      );
    } catch (e) {
      console.error('Error adding coordinate marker:', e);
    }
  };

  useEffect(() => {
    if (!map) return;

    const markerPane = 'coordinate-marker-pane';
    if (!map.getPane(markerPane)) {
      map.createPane(markerPane);
      map.getPane(markerPane).style.zIndex = '700';
    }

    map.on('click', addCoordinateMarker);

    return () => {
      map.off('click', addCoordinateMarker);
      if (clickMarkerRef.current) {
        try {
          map.removeLayer(clickMarkerRef.current);
        } catch (e) {
          console.warn('Error removing click marker:', e);
        }
      }
    };
  }, [map, primeMeridianSvg]);

  return null;
};

export default CoordinatesComponent;