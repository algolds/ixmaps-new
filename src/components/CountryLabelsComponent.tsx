// src/components/CountryLabelsComponent.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import getConfig from 'next/config'; // For basePath handling
import { svgToLatLng } from '@/lib/coordinates-system';
import { MapConfig } from '@/types';
import type L from 'leaflet';

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
  map: L.Map | null;
  L: typeof L | null;
  visible: boolean;
  mapConfig: MapConfig | null;
}

// --- Get publicRuntimeConfig ---
const { publicRuntimeConfig } = getConfig() || {};
const basePath = publicRuntimeConfig?.basePath || '';
console.log('[Labels] Component Scope: basePath from getConfig:', basePath);

const CountryLabelsComponent: React.FC<CountryLabelsProps> = ({
  map,
  L,
  visible,
  mapConfig,
}) => {
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const [countryData, setCountryData] = useState<CountryPositionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Effect 1: Fetch data ---
  useEffect(() => {
    const fetchData = async () => {
      // Construct the URL using the basePath from publicRuntimeConfig
      const dataUrl = `/data/political_layer_shapes_ctm.json`;

      console.log('[Labels] Effect 1: Starting data fetch from:', dataUrl);
      setIsLoading(true);
      setError(null);
      setCountryData([]);

      try {
        const response = await fetch(dataUrl);
        console.log(
          `[Labels] Effect 1: Fetch response status: ${response.status}`,
        );

        if (!response.ok) {
          throw new Error(
            `HTTP error! status: ${response.status} fetching ${dataUrl}`,
          );
        }

        const data: unknown = await response.json();

        // --- Type Guard and Validation ---
        if (!Array.isArray(data)) {
          console.error(
            '[Labels] Effect 1: Fetched data is not an array!',
            data,
          );
          throw new Error('Fetched data format is invalid (not an array).');
        }

        const validData: CountryPositionData[] = [];
        let invalidCount = 0;
        data.forEach((item: any, index: number) => {
          const isValid =
            item &&
            typeof item.id === 'string' &&
            item.id.trim() !== '' &&
            typeof item.name === 'string' &&
            item.name.trim() !== '' &&
            typeof item.position?.x === 'number' &&
            !isNaN(item.position.x) &&
            typeof item.position?.y === 'number' &&
            !isNaN(item.position.y);

          if (isValid) {
            validData.push(item as CountryPositionData);
          } else {
            invalidCount++;
            console.warn(
              `[Labels] Effect 1: Filtering out invalid item at index ${index}:`,
              item,
            );
          }
        });

        if (invalidCount > 0) {
          console.warn(
            `[Labels] Effect 1: Filtered ${invalidCount} invalid items out of ${data.length}.`,
          );
        }

        console.log(
          `[Labels] Effect 1: Setting ${validData.length} valid items to state.`,
        );
        setCountryData(validData);
      } catch (e: any) {
        console.error('[Labels] Effect 1: Fetch or processing error:', e);
        setError(e.message || 'Failed to fetch or process country positions');
        setCountryData([]);
      } finally {
        console.log(
          '[Labels] Effect 1: Fetch finished, setting isLoading to false.',
        );
        setIsLoading(false);
      }
    };

    fetchData();
  }, []); // Empty dependency array: runs only once on mount

  // --- Effect 2: Manage Leaflet markers ---
  useEffect(() => {
    console.log('[Labels] Effect 2: Running...');
    console.log(
      `[Labels] Effect 2: State - visible=${visible}, isLoading=${isLoading}, error=${error}, countryData.length=${countryData.length}`,
    );
    console.log(
      `[Labels] Effect 2: Props - map=${!!map}, L=${!!L}, mapConfig=${!!mapConfig}`,
    );

    // --- Pre-checks ---
    if (!map || !L || !mapConfig) {
      console.log(
        '[Labels] Effect 2: Exiting - map, L, or mapConfig not available.',
      );
      if (layerGroupRef.current) {
        console.log(
          '[Labels] Effect 2: Cleaning up layer due to missing map/L/config.',
        );
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
    if (!visible || isLoading || error || countryData.length === 0) {
      console.log(
        `[Labels] Effect 2: Exiting - Conditions not met (visible=${visible}, isLoading=${isLoading}, error=${error}, data=${countryData.length})`,
      );
      return;
    }

    // --- Log MapConfig ---
    console.log('[Labels] Effect 2: MapConfig for conversion:', {
      pixelsPerLatitude: mapConfig.pixelsPerLatitude,
      pixelsPerLongitude: mapConfig.pixelsPerLongitude,
      equatorY: mapConfig.equatorY,
      primeMeridianX: mapConfig.primeMeridianX,
      primeMeridianReferenceLng: mapConfig.primeMeridianReferenceLng,
    });
    const { countryLabelOffset = { x: 0, y: 0 } } = mapConfig;
    console.log('[Labels] Effect 2: Using countryLabelOffset:', countryLabelOffset);

    // --- Create and add new layer ---
    console.log(
      `[Labels] Effect 2: Creating markers for ${countryData.length} countries...`,
    );
    const markers: L.Marker[] = [];
    layerGroupRef.current = L.layerGroup();

    countryData.forEach((country, index) => {
      try {
        const adjustedX = country.position.x + countryLabelOffset.x;
        const adjustedY = country.position.y + countryLabelOffset.y;
        const customLatLng = svgToLatLng(adjustedX, adjustedY, mapConfig);

        if (
          !customLatLng ||
          isNaN(customLatLng.lat) ||
          isNaN(customLatLng.lng)
        ) {
          console.warn(
            `[Labels] Effect 2: Invalid LatLng conversion for ${country.name} (ID: ${country.id}). SVG(orig): ${country.position.x.toFixed(2)},${country.position.y.toFixed(2)}. SVG(adj): ${adjustedX.toFixed(2)},${adjustedY.toFixed(2)}. Result:`,
            customLatLng,
          );
          return; // Skip
        }
        const markerLatLng = L.latLng(customLatLng.lat, customLatLng.lng);

        // --- Create Icon & Marker ---
        const labelIcon = L.divIcon({
          // Use 'country-label' to match your CSS definition
          // (Unless mapConfig.labelClassName provides a different class)
          className: mapConfig.labelClassName || 'country-label', // <--- CORRECTED CLASS NAME
          html: `<span>${country.name}</span>`,
          iconSize: undefined, // Let CSS handle size via .country-label styles
          iconAnchor: undefined, // Let CSS handle alignment (might need adjustment in CSS)
        });

        // Log the created icon options for debugging if needed
        if (index % 50 === 0) { // Log occasionally
            console.log(`[Labels] Effect 2: [${index}] Creating icon for ${country.name}:`, { className: labelIcon.options.className, html: labelIcon.options.html });
        }

        const marker = L.marker(markerLatLng, {
          icon: labelIcon,
          // Set zIndexOffset consistent with or higher than CSS z-index
          zIndexOffset: 650,
          // Set interactive based on CSS pointer-events/cursor
          interactive: true, // Matches pointer-events: auto; cursor: pointer;
          keyboard: false, // Labels usually aren't keyboard navigable
          title: country.name, // Tooltip on hover (browser default)
        });
        markers.push(marker);
      } catch (conversionError: any) {
        console.error(
          `[Labels] Effect 2: Error processing marker for ${country.name} (ID: ${country.id}):`,
          conversionError,
        );
      }
    }); // End forEach

    console.log(`[Labels] Effect 2: Created ${markers.length} valid markers.`);

    // --- Add markers to layer group ---
    if (markers.length > 0 && layerGroupRef.current) {
      markers.forEach((marker) => layerGroupRef.current?.addLayer(marker));
      console.log('[Labels] Effect 2: Added markers to layer group.');
      layerGroupRef.current.addTo(map);
      console.log('[Labels] Effect 2: Added layer group to map.');
    } else if (layerGroupRef.current) {
      layerGroupRef.current.remove(); // Remove empty group
      layerGroupRef.current = null;
      console.log(
        '[Labels] Effect 2: No valid markers, removed empty layer group.',
      );
    }

    // --- Cleanup function ---
    return () => {
      console.log('[Labels] Effect 2: Cleanup running...');
      if (layerGroupRef.current) {
        console.log(
          '[Labels] Effect 2: Removing layer group from map during cleanup.',
        );
        if (map && map.hasLayer(layerGroupRef.current)) {
          map.removeLayer(layerGroupRef.current);
        }
        layerGroupRef.current = null;
      } else {
        console.log(
          '[Labels] Effect 2: No layer group ref to remove in cleanup.',
        );
      }
    };
  }, [map, L, visible, countryData, isLoading, error, mapConfig]); // Dependencies remain the same

  return null;
};

export default CountryLabelsComponent;