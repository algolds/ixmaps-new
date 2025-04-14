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
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: CountryPositionData[] = await response.json();
        // console.log(`CountryLabelsComponent: Fetched ${data.length} positions.`);
        if (!Array.isArray(data)) {
          throw new Error('Expected array.');
        }
        const validData = data.filter(
          (item) =>
            item &&
            typeof item.id === 'string' &&
            typeof item.name === 'string' &&
            typeof item.position?.x === 'number' &&
            typeof item.position?.y === 'number'
        );
        if (validData.length !== data.length) {
          console.warn('CountryLabelsComponent: Some items filtered.');
        }
        setCountryData(validData);
      } catch (e: any) {
        setError(e.message || 'Failed');
        setCountryData([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Effect 2: Manage Leaflet markers
  useEffect(() => {
    // Ensure map, L, and mapConfig are available
    if (!map || !L || !mapConfig) {
      if (layerGroupRef.current) {
        layerGroupRef.current.remove();
        layerGroupRef.current = null;
      }
      return;
    }

    // Clear previous layer if it exists
    if (layerGroupRef.current) {
      layerGroupRef.current.remove();
      layerGroupRef.current = null;
    }

    // Conditions to NOT add markers
    if (!visible || isLoading || error || countryData.length === 0) {
      return;
    }

    // --- Get the offset from mapConfig, providing defaults ---
    const { countryLabelOffset = { x: 0, y: 0 } } = mapConfig;

    // --- Create and add new layer ---
    // console.log(`CountryLabelsComponent: Creating labels for ${countryData.length} countries (Custom CRS).`);
    const markers: any[] = [];
    layerGroupRef.current = L.layerGroup();

    countryData.forEach((country) => {
      // --- APPLY OFFSET to SVG coordinates ---
      const adjustedX = country.position.x + countryLabelOffset.x;
      const adjustedY = country.position.y + countryLabelOffset.y;
      // --- END OFFSET APPLICATION ---

      // --- CONVERT ADJUSTED SVG coordinates TO CUSTOM LatLng ---
      const customLatLng = svgToLatLng(
        adjustedX, // Use adjusted X
        adjustedY, // Use adjusted Y
        mapConfig // Pass mapConfig for conversion context
      );
      // --- END CONVERSION ---

      // Use the custom LatLng for the marker position
      const markerLatLng = L.latLng(customLatLng.lat, customLatLng.lng);

      const labelIcon = L.divIcon({
        className: mapConfig.labelClassName || 'country-label-icon', // Use class from config or default
        html: `<span>${country.name}</span>`,
        iconSize: undefined, // Let CSS handle size
      });

      const marker = L.marker(markerLatLng, {
        icon: labelIcon,
        zIndexOffset: 500, // Keep labels above most layers
        interactive: false, // Labels typically aren't interactive
        title: country.name, // Tooltip on hover
      });

      markers.push(marker);
    });

    // Add all markers to the layer group at once
    markers.forEach((marker) => layerGroupRef.current.addLayer(marker));
    // Add the layer group to the map
    layerGroupRef.current.addTo(map);
    // console.log('CountryLabelsComponent: Labels added to map using custom LatLng.');

    // Cleanup function: remove the layer group when dependencies change or component unmounts
    return () => {
      if (layerGroupRef.current) {
        // console.log('CountryLabelsComponent: Cleaning up labels.');
        layerGroupRef.current.remove();
        layerGroupRef.current = null;
      }
    };
    // Dependencies: Re-run effect if map, Leaflet, visibility, data, loading state, error state, or mapConfig changes
  }, [map, L, visible, countryData, isLoading, error, mapConfig]);

  // This component doesn't render anything itself, it manages Leaflet layers
  return null;
};

export default CountryLabelsComponent;
