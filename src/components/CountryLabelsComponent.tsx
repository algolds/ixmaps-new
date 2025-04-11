'use client';
import React, { useEffect, useRef, useState } from 'react';
import {
  Map as LeafletMap,
  LayerGroup,
  DivIcon,
  LatLng as LeafletLatLng,
  Marker
} from 'leaflet';
import { basePath } from '@/lib/config';

interface CountryData {
  id: string;
  name?: string;
  labelPosition: {
    lat: number;
    lng: number;
  };
  bbox?: {
    xy: [number, number];
    wh: [number, number];
  };
}

interface CountryLabelsComponentProps {
  map: LeafletMap;
  visible: boolean;
}

/**
 * CountryLabelsComponent loads country data from JSON (new format)
 * and displays each country's label on the map using the provided 
 * geographic coordinates (labelPosition). This version uses the new JSON 
 * properties directly without further coordinate conversion.
 *
 * You can disable any extra logging or cleanup by commenting out the 
 * relevant sections.
 */
const CountryLabelsComponent: React.FC<CountryLabelsComponentProps> = ({
  map,
  visible
}) => {
  // Reference to the LayerGroup for labels
  const labelsLayerRef = useRef<LayerGroup | null>(null);
  const markersRef = useRef<Marker[]>([]);
  // Flag to ensure we only load data once.
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!map) return;

    // --- Setup Labels Pane ---
    if (!map.getPane('labels-pane')) {
      const pane = map.createPane('labels-pane');
      pane.style.zIndex = '650';
    }

    // Create the labels layer only once if not already created.
    if (!labelsLayerRef.current) {
      labelsLayerRef.current = new LayerGroup([], { pane: 'labels-pane' });
    }

    // --- Show or hide the labels layer based on 'visible' prop ---
    if (visible) {
      map.addLayer(labelsLayerRef.current);
      // Load data only once when visible.
      if (!hasLoaded) {
        loadCountryData();
      }
    } else {
      map.removeLayer(labelsLayerRef.current);
    }

    // Cleanup when component unmounts.
    return () => {
      if (labelsLayerRef.current) {
        labelsLayerRef.current.remove();
      }
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
    };
  }, [map, visible, hasLoaded]);

  /**
   * loadCountryData fetches the country data and creates a marker for each
   * country using the new JSON property "labelPosition". Minimal data validation
   * is performed.
   */
  const loadCountryData = async () => {
    try {
      console.log('Loading country data...');
      const response = await fetch(`${basePath}/data/countries.json`);
      if (!response.ok) {
        throw new Error('Failed to fetch country data');
      }
      const data = await response.json();
      if (!data?.countries) {
        throw new Error('No country data found');
      }
      console.log(`Loaded ${data.countries.length} countries`);

      // Clean up any previous markers.
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];

      data.countries.forEach((country: CountryData) => {
        if (
          !country.labelPosition ||
          typeof country.labelPosition.lat !== 'number' ||
          typeof country.labelPosition.lng !== 'number'
        ) {
          console.warn(`Skipping ${country.id} due to missing labelPosition`);
          return;
        }
        // Use the provided geographic coordinate directly.
        const position = new LeafletLatLng(
          country.labelPosition.lat,
          country.labelPosition.lng
        );
        const displayName = country.name || country.id;
        const marker = new Marker(position, {
          icon: new DivIcon({
            className: 'country-label',
            html: `<div>${displayName}</div>`
          }),
          pane: 'labels-pane'
        });
        marker.addTo(labelsLayerRef.current!);
        markersRef.current.push(marker);
      });

      setHasLoaded(true);
      console.log(`Displayed ${markersRef.current.length} country labels`);
    } catch (error) {
      console.error('Error loading country data:', error);
    }
  };

  return null;
};

export default CountryLabelsComponent;
  