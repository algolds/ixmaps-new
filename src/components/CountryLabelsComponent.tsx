'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Map as LeafletMap, LayerGroup, DivIcon, LatLng as LeafletLatLng, Marker } from 'leaflet';
import { MapConfig } from '@/types';

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

  useEffect(() => {
    if (!map) return;
    
    // Create a dedicated pane for labels to control z-index
    if (!map.getPane('labels-pane')) {
      const pane = map.createPane('labels-pane');
      pane.style.zIndex = '650'; // Higher than other layers
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
      console.log('Loading country labels...'); 
      const response = await fetch('/data/countries.json');
      if (!response.ok) throw new Error('Failed to load countries data');

      const data = await response.json();
      if (!data?.countries) throw new Error('Invalid data format');
      
      console.log(`Loaded ${data.countries.length} countries`);

      // Clear existing markers
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      
      // Track label positions to prevent overlaps
      const labelPositions: {x: number, y: number, width: number, height: number}[] = [];
      
      // Important: Classification function for styling
      const classifyCountry = (country: CountryData): 'capital' | 'major' | 'standard' | 'minor' => {
        // Major nations - customize as needed
        const majorCountries = ['Urcea', 'Caphiria', 'Burgundie', 'Great Levantine Empire'];
        
        // Capital markers
        const capitals = ['Urceopolis', 'Venepia', 'Solaria', 'Cana', 'Capital'];
        
        if (capitals.some(capital => 
          country.id.includes(capital) || 
          country.name.includes(capital)
        )) {
          return 'capital';
        } 
        else if (majorCountries.some(major => 
          country.id === major || 
          country.name === major
        )) {
          return 'major';
        }
        else if (
          country.id.includes('Island') || 
          country.name.includes('Island') ||
          country.id.includes('Minor')
        ) {
          return 'minor';
        }
        return 'standard';
      };

      data.countries.forEach((country: CountryData) => {
        if (!country.centerpoint || typeof country.centerpoint.x !== 'number' || typeof country.centerpoint.y !== 'number') {
          console.warn(`Skipping country ${country.name || country.id} due to invalid centerpoint`);
          return;
        }

        // Get raw SVG coordinates 
        const svgX = country.centerpoint.x;
        const svgY = country.centerpoint.y;
        
        if (isNaN(svgX) || isNaN(svgY)) {
          console.warn(`Skipping country ${country.name || country.id} due to invalid coordinates`);
          return;
        }

        // This is key: With CRS.Simple, we create the position using SVG coordinates directly
        // Using x as longitude and y as latitude (Leaflet convention)
        const position = new LeafletLatLng(svgY, svgX);
        
        // Classify the country to apply appropriate styling
        const classification = classifyCountry(country);
        
        // Create CSS classes based on classification
        const labelClass = `country-label ${classification}`;
        
        try {
          const marker = new Marker(position, {
            icon: new DivIcon({
              className: labelClass,
              html: `<div>${country.name}</div>`,
              iconSize: undefined, 
              iconAnchor: undefined, // Let CSS center or define anchor point
            }),
            pane: 'labels-pane'
          });

          if (labelsLayerRef.current) {
            marker.addTo(labelsLayerRef.current);
            marker.bindPopup(`<b>${country.name}</b><br/>[SVG: ${svgX.toFixed(1)}, ${svgY.toFixed(1)}]`);
            markersRef.current.push(marker);
          }
        } catch (markerError) {
          console.error(`Error creating marker for ${country.name || country.id}:`, markerError);
        }
      });

      setIsLoaded(true);
      console.log(`Plotted ${markersRef.current.length} country labels`);
    } catch (error) {
      console.error('Error loading country labels:', error);
    }
  };

  return null;
};

export default CountryLabelsComponent;