// src/components/CountryLabelsComponent.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
// Ensure the import path is correct for your project structure
import { svgToLatLng } from '@/lib/coordinates-system'; // Use the correct path and file name
import { MapConfig } from '@/types'; // Import MapConfig type

// Interface for the data fetched from country_positions_bbox.json
interface CountryPositionData {
  id: string;
  name: string;
  position: {
    x: number; // SVG X coordinate
    y: number; // SVG Y coordinate
  };
}

// Define props expected by this component
interface CountryLabelsProps {
  map: any;
  L: any;
  visible: boolean;
  mapConfig: MapConfig; // <-- ADD mapConfig prop
}

const CountryLabelsComponent: React.FC<CountryLabelsProps> = ({
  map,
  L,
  visible,
  mapConfig, // <-- Destructure mapConfig
}) => {
  const layerGroupRef = useRef<any>(null);
  const [countryData, setCountryData] = useState<CountryPositionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Effect 1: Fetch data (remains the same)
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      // console.log('CountryLabelsComponent: Fetching country positions...');
      try {
        const response = await fetch('/data/country_positions_bbox.json');
        if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
        const data: CountryPositionData[] = await response.json();
        // console.log(`CountryLabelsComponent: Fetched ${data.length} positions.`);
        if (!Array.isArray(data)) { throw new Error('Expected array.'); }
        const validData = data.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.position?.x === 'number' && typeof item.position?.y === 'number');
        if (validData.length !== data.length) { console.warn("CountryLabelsComponent: Some items filtered."); }
        setCountryData(validData);
      } catch (e: any) { setError(e.message || 'Failed'); setCountryData([]); }
      finally { setIsLoading(false); }
    };
    fetchData();
  }, []);

  // Effect 2: Manage Leaflet markers
  useEffect(() => {
    if (!map || !L || !mapConfig) { // Check for mapConfig too
      if (layerGroupRef.current) { layerGroupRef.current.remove(); layerGroupRef.current = null; }
      return;
    }

    // Clear previous layer
    if (layerGroupRef.current) {
      layerGroupRef.current.remove();
      layerGroupRef.current = null;
    }

    // Conditions to NOT add markers
    if (!visible || isLoading || error || countryData.length === 0) {
      return;
    }

    // --- Create and add new layer ---
    // console.log(`CountryLabelsComponent: Creating labels for ${countryData.length} countries (Custom CRS).`);
    const markers: any[] = [];
    layerGroupRef.current = L.layerGroup();

    countryData.forEach((country) => {
      // --- CONVERT SVG coordinates TO CUSTOM LatLng, passing mapConfig ---
      const customLatLng = svgToLatLng(
          country.position.x,
          country.position.y,
          mapConfig // <-- PASS mapConfig here
      );
      // --- END CONVERSION ---

      // Use the custom LatLng for the marker position
      const markerLatLng = L.latLng(customLatLng.lat, customLatLng.lng);

      const labelIcon = L.divIcon({
        className: 'country-label-icon',
        html: `<span>${country.name}</span>`,
        iconSize: undefined,
      });

      const marker = L.marker(markerLatLng, { // Use the converted LatLng
        icon: labelIcon,
        zIndexOffset: 500,
        interactive: false,
        title: country.name,
      });

      markers.push(marker);
    });

    markers.forEach((marker) => layerGroupRef.current.addLayer(marker));
    layerGroupRef.current.addTo(map);
    // console.log('CountryLabelsComponent: Labels added to map using custom LatLng.');

    // Cleanup function
    return () => {
      if (layerGroupRef.current) {
        layerGroupRef.current.remove();
        layerGroupRef.current = null;
      }
    };
  }, [map, L, visible, countryData, isLoading, error, mapConfig]); // Add mapConfig to dependency array

  return null;
};

export default CountryLabelsComponent;
