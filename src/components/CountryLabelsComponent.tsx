'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Map as LeafletMap, LayerGroup, DivIcon, LatLng, Marker, Popup } from 'leaflet';
import { MapConfig } from '@/types';
import { visibleBounds } from '@/lib/MapConfig';

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

  // Initialize layer
  useEffect(() => {
    if (!map) return;

    // Create pane if it doesn't exist
    if (!map.getPane('labels-pane')) {
      map.createPane('labels-pane').style.zIndex = '650';
    }

    labelsLayerRef.current = new LayerGroup([], { pane: 'labels-pane' });
    if (visible) {
      labelsLayerRef.current.addTo(map);
    }

    return () => {
      labelsLayerRef.current?.remove();
    };
  }, [map]);

  // Toggle visibility
  useEffect(() => {
    if (!labelsLayerRef.current) return;
    
    if (visible) {
      map.addLayer(labelsLayerRef.current);
      if (!isLoaded) loadLabels();
    } else {
      map.removeLayer(labelsLayerRef.current);
    }
  }, [visible]);

  const loadLabels = async () => {
    try {
      console.log('Loading country labels...');
      const response = await fetch('/data/countries.json');
      if (!response.ok) throw new Error('Failed to load countries data');
      
      const data = await response.json();
      if (!data?.countries) throw new Error('Invalid data format');

      // Clear existing markers
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];

      // Add new markers
      data.countries.forEach((country: CountryData) => {
        if (!country.centerpoint) return;

        const position = new LatLng(
          mapConfig.equatorY - country.centerpoint.y / mapConfig.pixelsPerLatitude,
          (country.centerpoint.x - mapConfig.primeMeridianX) / mapConfig.pixelsPerLongitude
        );

        const marker = new Marker(position, {
          icon: new DivIcon({
            className: 'country-label',
            html: `<div>${country.name}</div>`,
            iconSize: [100, 24],
            iconAnchor: [50, 12]
          }),
          pane: 'labels-pane'
        }).addTo(labelsLayerRef.current!);

        marker.bindPopup(`<b>${country.name}</b>`);
        markersRef.current.push(marker);
      });

      setIsLoaded(true);
      console.log(`Loaded ${markersRef.current.length} country labels`);

    } catch (error) {
      console.error('Error loading country labels:', error);
    }
  };

  return null;
};

export default CountryLabelsComponent;
