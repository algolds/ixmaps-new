'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Map as LeafletMap, LayerGroup, DivIcon, LatLng as LeafletLatLng, Marker, Popup } from 'leaflet';
import { MapConfig } from '@/types';
// We are NOT using the geographic svgToLatLng for plotting with CRS.Simple
import { svgToLatLng } from '@/lib/MapConfig'; 

interface CountryData {
  id: string;
  name: string;
  centerpoint: { x: number; y: number };
}

interface CountryLabelsComponentProps {
  map: LeafletMap;
  visible: boolean;
  mapConfig: MapConfig; 
}

const CountryLabelsComponent: React.FC<CountryLabelsComponentProps> = ({
  map,
  visible,
  mapConfig 
}) => {
  const labelsLayerRef = useRef<LayerGroup | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // (useEffect hooks remain the same as the previous version)
  useEffect(() => {
    if (!map) return;
    if (!map.getPane('labels-pane')) {
      const pane = map.createPane('labels-pane');
      pane.style.zIndex = '5000'; 
    }
    labelsLayerRef.current = new LayerGroup([], { pane: 'labels-pane' });
    if (visible) {
      labelsLayerRef.current.addTo(map);
      if (!isLoaded) {
         loadLabels();
      }
    }
    return () => {
      labelsLayerRef.current?.remove();
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      setIsLoaded(false); 
    };
  }, [map]); 

  useEffect(() => {
    if (!labelsLayerRef.current) return;
    if (visible) {
      map.addLayer(labelsLayerRef.current);
      if (!isLoaded) {
        loadLabels();
      }
    } else {
      map.removeLayer(labelsLayerRef.current);
    }
  }, [visible, isLoaded, map]);

  const loadLabels = async () => {
    if (isLoaded || !labelsLayerRef.current) return;

    try {
      console.log('Plotting country labels using direct SVG coordinates...'); 
      const response = await fetch('/data/countries.json');
      if (!response.ok) throw new Error('Failed to load countries data');

      const data = await response.json();
      if (!data?.countries) throw new Error('Invalid data format');

      console.log('Loaded country data:', data);

      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];

      data.countries.forEach((country: CountryData) => {
        if (!country.centerpoint || typeof country.centerpoint.x !== 'number' || typeof country.centerpoint.y !== 'number') {
          console.warn(`Skipping country ${country.name || country.id} due to invalid centerpoint`);
          return;
        }

        // --- Use Raw SVG Coordinates for Plotting ---
        const svgX = country.centerpoint.x;
        const svgY = country.centerpoint.y;
        
        if (isNaN(svgX) || isNaN(svgY)) {
             console.warn(`Skipping country ${country.name || country.id} due to invalid raw SVG coordinates`);
             return;
        }

        // Create Leaflet LatLng using (svgY, svgX)
        const position = new LeafletLatLng(svgY, svgX); 
        // --- End Coordinate Logic ---

        console.log(`Plotting Country: ${country.name}, SVG: (${svgX}, ${svgY}), Leaflet Pos: (${svgY}, ${svgX})`); 

        try {
          const marker = new Marker(position, {
            icon: new DivIcon({
              className: 'country-label', 
              html: `<div>${country.name}</div>`,
              // Adjust anchor if needed based on CSS/label size
              // iconAnchor: [approxLabelWidth / 2, approxLabelHeight / 2] 
              iconSize: undefined, 
              iconAnchor: undefined, // Let CSS center or define anchor point
            }),
            pane: 'labels-pane'
          });

          if (labelsLayerRef.current) {
             marker.addTo(labelsLayerRef.current);
             // Add geographic coords to popup using the conversion function (useful for display)
             // Make sure svgToLatLng is imported if you use this:
             // const geoCoords = svgToLatLng(svgX, svgY); 
             // marker.bindPopup(`<b>${country.name}</b><br/>[SVG: ${svgX.toFixed(1)}, ${svgY.toFixed(1)}]<br/>[Geo: ${geoCoords.lat.toFixed(2)}, ${geoCoords.lng.toFixed(2)}]`);
             marker.bindPopup(`<b>${country.name}</b><br/>[SVG: ${svgX.toFixed(1)}, ${svgY.toFixed(1)}]`); // Simpler popup for now
             markersRef.current.push(marker);
          }
        } catch (markerError) {
            console.error(`Error creating marker for ${country.name || country.id}:`, markerError);
        }
      });

      setIsLoaded(true); 
      console.log(`Plotted ${markersRef.current.length} country labels using direct SVG coords`); 
    } catch (error) {
      console.error('Error loading country labels:', error);
    }
  };

  return null;
};

export default CountryLabelsComponent;