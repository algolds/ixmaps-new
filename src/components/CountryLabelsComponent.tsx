// src/components/CountryLabelsComponent.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import getConfig from 'next/config'; // <--- 1. Import getConfig
import { svgToLatLng } from '@/lib/coordinates-system';
import { MapConfig } from '@/types';

// Interface for the data fetched
interface CountryPositionData {
  id: string;
  name: string;
  position: {
    x: number;
    y: number;
  };
}

// Props interface
interface CountryLabelsProps {
  map: any; // Consider using L.Map type if L is globally available or passed differently
  L: any; // Consider using typeof L type
  visible: boolean;
  mapConfig: MapConfig;
}

// --- 2. Get publicRuntimeConfig and basePath ---
// It's generally safe to call getConfig outside the component if the config doesn't change dynamically
const { publicRuntimeConfig } = getConfig() || {}; // Add fallback for safety
const basePath = publicRuntimeConfig?.basePath || ''; // Default to empty string if not found

const CountryLabelsComponent: React.FC<CountryLabelsProps> = ({
  map,
  L,
  visible,
  mapConfig,
}) => {
  const layerGroupRef = useRef<any>(null); // Consider L.LayerGroup type
  const [countryData, setCountryData] = useState<CountryPositionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Effect 1: Fetch data ---
  useEffect(() => {
    const fetchData = async () => {
      // --- 3. Construct the URL using basePath ---
      const dataUrl = `${basePath}/data/political_layer_shapes_ctm.json`;
      console.log('[Labels] Effect 1: Starting data fetch from:', dataUrl); // Log fetch start with full URL
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(dataUrl); // Use the constructed URL
        console.log(`[Labels] Effect 1: Fetch response status: ${response.status}`); // Log status
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: CountryPositionData[] = await response.json();
        console.log(`[Labels] Effect 1: Fetched ${data.length} raw items.`); // Log raw count

        if (!Array.isArray(data)) {
          console.error('[Labels] Effect 1: Fetched data is not an array!', data);
          throw new Error('Fetched data is not an array.');
        }

        // Detailed validation and logging
        const validData = data.filter((item, index) => {
          const isValid =
            item &&
            typeof item.id === 'string' &&
            typeof item.name === 'string' &&
            typeof item.position?.x === 'number' &&
            !isNaN(item.position.x) && // Check for NaN explicitly
            typeof item.position?.y === 'number' &&
            !isNaN(item.position.y); // Check for NaN explicitly
          if (!isValid) {
            console.warn(
              `[Labels] Effect 1: Filtering out invalid item at index ${index}:`,
              item,
            );
          }
          return isValid;
        });

        if (validData.length !== data.length) {
          console.warn(
            `[Labels] Effect 1: Filtered ${data.length - validData.length} invalid items.`,
          );
        }
        console.log(`[Labels] Effect 1: Setting ${validData.length} valid items to state.`);
        setCountryData(validData);
      } catch (e: any) {
        console.error('[Labels] Effect 1: Fetch or processing error:', e); // Log error
        setError(e.message || 'Failed to fetch country positions');
        setCountryData([]); // Clear data on error
      } finally {
        console.log('[Labels] Effect 1: Fetch finished, setting isLoading to false.');
        setIsLoading(false);
      }
    };
    fetchData();
  }, []); // Empty dependency array: runs only once on mount

  // --- Effect 2: Manage Leaflet markers ---
  useEffect(() => {
    console.log('[Labels] Effect 2: Running...'); // Log effect start
    console.log(
      `[Labels] Effect 2: State - visible=${visible}, isLoading=${isLoading}, error=${error}, countryData.length=${countryData.length}`,
    );
    console.log(
      `[Labels] Effect 2: Props - map=${!!map}, L=${!!L}, mapConfig=${!!mapConfig}`,
    );

    // --- Pre-checks ---
    if (!map || !L || !mapConfig) {
      console.log('[Labels] Effect 2: Exiting - map, L, or mapConfig missing.');
      // Clean up existing layer if map/L becomes unavailable
      if (layerGroupRef.current) {
        console.log('[Labels] Effect 2: Cleaning up layer due to missing map/L/config.');
        layerGroupRef.current.remove();
        layerGroupRef.current = null;
      }
      return;
    }

    // --- Clear previous layer ---
    if (layerGroupRef.current) {
      console.log('[Labels] Effect 2: Clearing previous layer group.');
      layerGroupRef.current.remove();
      layerGroupRef.current = null;
    }

    // --- Conditions to NOT add markers ---
    if (!visible) {
      console.log('[Labels] Effect 2: Exiting - Component is not visible.');
      return;
    }
    if (isLoading) {
      console.log('[Labels] Effect 2: Exiting - Data is loading.');
      return;
    }
    if (error) {
      console.log(`[Labels] Effect 2: Exiting - Error exists: ${error}`);
      return;
    }
    if (countryData.length === 0) {
      console.log('[Labels] Effect 2: Exiting - No country data.');
      return;
    }

    // --- Log MapConfig parameters used for conversion ---
    console.log('[Labels] Effect 2: MapConfig for conversion:', {
      pixelsPerLatitude: mapConfig.pixelsPerLatitude,
      pixelsPerLongitude: mapConfig.pixelsPerLongitude,
      equatorY: mapConfig.equatorY,
      primeMeridianX: mapConfig.primeMeridianX,
      primeMeridianReferenceLng: mapConfig.primeMeridianReferenceLng,
    });

    // --- Get offset ---
    const { countryLabelOffset = { x: 0, y: 0 } } = mapConfig;
    console.log('[Labels] Effect 2: Using countryLabelOffset:', countryLabelOffset);

    // --- Create and add new layer ---
    console.log(`[Labels] Effect 2: Creating markers for ${countryData.length} countries...`);
    const markers: any[] = []; // Consider L.Marker[] type
    layerGroupRef.current = L.layerGroup(); // Create new layer group

    countryData.forEach((country, index) => {
      try {
        // --- Apply Offset ---
        const adjustedX = country.position.x + countryLabelOffset.x;
        const adjustedY = country.position.y + countryLabelOffset.y;

        // --- Convert ---
        const customLatLng = svgToLatLng(adjustedX, adjustedY, mapConfig);

        // --- Validate Conversion ---
        if (
          !customLatLng ||
          typeof customLatLng.lat !== 'number' ||
          isNaN(customLatLng.lat) ||
          typeof customLatLng.lng !== 'number' ||
          isNaN(customLatLng.lng)
        ) {
          console.warn(
            `[Labels] Effect 2: Invalid LatLng for ${country.name} (ID: ${country.id}). SVG(adj): ${adjustedX.toFixed(2)},${adjustedY.toFixed(2)}. Result:`,
            customLatLng,
          );
          return; // Skip this marker
        }

        // --- Create Leaflet LatLng ---
        const markerLatLng = L.latLng(customLatLng.lat, customLatLng.lng);

        // --- Log Coordinates (Sample every 20 or for specific countries) ---
        if (index % 20 === 0 || country.id === 'Kagazi') {
          // Example specific ID check
          console.log(
            `[Labels] Effect 2: [${index}] ${country.name} (ID: ${country.id}) - SVG: ${country.position.x.toFixed(2)},${country.position.y.toFixed(2)} -> Adj SVG: ${adjustedX.toFixed(2)},${adjustedY.toFixed(2)} -> LatLng: ${customLatLng.lat.toFixed(4)}, ${customLatLng.lng.toFixed(4)}`,
          );
        }

        // --- Create Icon & Marker ---
        const labelIcon = L.divIcon({
          className: mapConfig.labelClassName || 'country-label-icon',
          html: `<span>${country.name}</span>`,
          iconSize: undefined, // Let CSS handle size
        });

        const marker = L.marker(markerLatLng, {
          icon: labelIcon,
          zIndexOffset: 500, // Ensure labels are above most layers
          interactive: false, // Labels usually aren't interactive
          title: country.name, // Tooltip on hover
        });

        markers.push(marker);
      } catch (conversionError: any) {
        // Catch errors specifically from svgToLatLng or L.latLng/L.marker
        console.error(
          `[Labels] Effect 2: Error processing marker for ${country.name} (ID: ${country.id}):`,
          conversionError,
        );
      }
    }); // End forEach

    console.log(`[Labels] Effect 2: Created ${markers.length} valid markers.`);

    // --- Add markers to layer group ---
    if (markers.length > 0) {
      markers.forEach((marker) => layerGroupRef.current.addLayer(marker));
      console.log('[Labels] Effect 2: Added markers to layer group.');

      // --- Add layer group to map ---
      layerGroupRef.current.addTo(map);
      console.log('[Labels] Effect 2: Added layer group to map.');
    } else {
      console.log('[Labels] Effect 2: No valid markers created, not adding layer group.');
    }

    // --- Cleanup function ---
    return () => {
      console.log('[Labels] Effect 2: Cleanup running...'); // Log cleanup start
      if (layerGroupRef.current) {
        console.log('[Labels] Effect 2: Removing layer group from map.');
        layerGroupRef.current.remove();
        layerGroupRef.current = null;
      } else {
        console.log('[Labels] Effect 2: No layer group ref to remove.');
      }
    };
    // Dependencies: Re-run effect if any of these change.
  }, [map, L, visible, countryData, isLoading, error, mapConfig]);

  // This component doesn't render anything itself
  return null;
};

export default CountryLabelsComponent;
