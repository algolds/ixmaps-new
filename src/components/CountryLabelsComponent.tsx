// src/components/CountryLabelsComponent.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';

// Interface for the data fetched
interface CountryPositionData {
  id: string;
  name: string;
  position: {
    x: number;
    y: number;
  };
}

interface CountryLabelsProps {
  map: any;
  L: any;
  visible: boolean;
  svgHeight: number; // Add svgHeight prop
}

const CountryLabelsComponent: React.FC<CountryLabelsProps> = ({
  map,
  L,
  visible,
  svgHeight, // Destructure the prop
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
      console.log('CountryLabelsComponent: Fetching country positions...');
      try {
        const response = await fetch('/data/country_positions_bbox.json');
        if (!response.ok) { /* ... error handling ... */
           const errorText = await response.text();
           throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
        }
        const data: CountryPositionData[] = await response.json();
        console.log(`CountryLabelsComponent: Fetched ${data.length} positions.`);
        if (!Array.isArray(data)) { /* ... error handling ... */
           throw new Error('Expected an array of country positions.');
        }
        // Basic validation
         const validData = data.filter(item =>
             item && typeof item.id === 'string' && typeof item.name === 'string' &&
             typeof item.position?.x === 'number' && typeof item.position?.y === 'number'
         );
         if (validData.length !== data.length) {
             console.warn("CountryLabelsComponent: Some items filtered out.");
         }
        setCountryData(validData);
      } catch (e: any) { /* ... error handling ... */
         console.error('CountryLabelsComponent: Fetch/process error:', e);
         setError(e.message || 'Failed to load labels');
         setCountryData([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Effect 2: Manage Leaflet markers
  useEffect(() => {
    if (!map || !L || !svgHeight) { // Also check if svgHeight is available
      console.log('CountryLabelsComponent: Map, Leaflet, or svgHeight not ready.');
      // Ensure cleanup if layer exists even if we exit early
      if (layerGroupRef.current) {
          layerGroupRef.current.remove();
          layerGroupRef.current = null;
      }
      return;
    }

    // Clear previous layer
    if (layerGroupRef.current) {
      layerGroupRef.current.remove();
      layerGroupRef.current = null;
    }

    // Conditions to NOT add markers
    if (!visible || isLoading || error || countryData.length === 0) {
      // ... (logging as before) ...
      return;
    }

    // --- Create and add new layer ---
    console.log(`CountryLabelsComponent: Creating labels for ${countryData.length} countries.`);
    const markers: any[] = [];
    layerGroupRef.current = L.layerGroup();

    countryData.forEach((country) => {
      // --- *** INVERT THE Y-COORDINATE *** ---
      // Subtract the SVG Y coordinate from the total SVG height
      const invertedY = svgHeight - country.position.y;
      const latLng = L.latLng(invertedY, country.position.x);
      // --- *** END INVERSION *** ---

      const labelIcon = L.divIcon({
        className: 'country-label-icon',
        html: `<span>${country.name}</span>`,
        iconSize: undefined,
      });

      const marker = L.marker(latLng, {
        icon: labelIcon,
        zIndexOffset: 500,
        interactive: false,
        title: country.name,
      });

      markers.push(marker);
    });

    markers.forEach((marker) => layerGroupRef.current.addLayer(marker));
    layerGroupRef.current.addTo(map);
    console.log('CountryLabelsComponent: Labels added to map with inverted Y.');

    // Cleanup function
    return () => {
      if (layerGroupRef.current) {
        layerGroupRef.current.remove();
        layerGroupRef.current = null;
      }
    };
    // Add svgHeight to dependency array
  }, [map, L, visible, countryData, isLoading, error, svgHeight]);

  return null;
};

export default CountryLabelsComponent;
