'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapConfig, SvgPoint } from '@/types';
import { svgToLatLng, latLngToSvg } from '@/lib/coordinates-system';

interface CountryLabelsProps {
  map: any; // Leaflet map instance
  L: any; // Leaflet library
  visible: boolean;
  mapConfig: MapConfig;
  svgWidth: number;
  svgHeight: number;
  onLabelsLoaded?: (countryIds: string[]) => void;
}

interface CountryData {
  id: string;
  center: SvgPoint;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

const CountryLabelsComponent: React.FC<CountryLabelsProps> = ({
  map,
  L,
  visible,
  mapConfig,
  svgWidth,
  svgHeight,
  onLabelsLoaded
}) => {
  const [countryData, setCountryData] = useState<CountryData[]>([]);
  const [currentZoom, setCurrentZoom] = useState<number>(map?.getZoom() || mapConfig.initialZoom);
  const labelsRef = useRef<Record<string, any>>({});
  const labelGroupRef = useRef<any>(null);
  
  // Listen for zoom changes
  useEffect(() => {
    if (!map) return;
    
    const handleZoomEnd = () => {
      const newZoom = map.getZoom();
      setCurrentZoom(newZoom);
    };
    
    map.on('zoomend', handleZoomEnd);
    
    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [map]);

  // Extract country IDs and centers from SVG
  const extractCountryData = async (svgPath: string): Promise<CountryData[]> => {
    try {
      console.log(`Fetching SVG from ${svgPath} to extract country data`);
      const response = await fetch(svgPath);
      if (!response.ok) {
        throw new Error(`Failed to load SVG: ${response.status} ${response.statusText}`);
      }

      const svgContent = await response.text();
      
      // Create a temporary DOM element to parse the SVG
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
      
      // Find the political layer
      const politicalLayer = svgDoc.getElementById('political');
      if (!politicalLayer) {
        console.warn('Political layer not found in SVG');
        return [];
      }

      // Find all path elements within the political layer
      const countryPaths = politicalLayer.querySelectorAll('path[id]');
      
      const extractedData: CountryData[] = [];
      
      countryPaths.forEach((path) => {
        const id = path.getAttribute('id');
        if (id && !id.startsWith('border-')) {
          // Calculate bounding box for the path
          const bbox = (path as SVGPathElement).getBBox();
          
          // Calculate center point
          const centerX = bbox.x + (bbox.width / 2);
          const centerY = bbox.y + (bbox.height / 2);
          
          extractedData.push({
            id,
            center: { x: centerX, y: centerY },
            bounds: {
              minX: bbox.x,
              minY: bbox.y,
              maxX: bbox.x + bbox.width,
              maxY: bbox.y + bbox.height
            }
          });
        }
      });
      
      console.log(`Extracted ${extractedData.length} country IDs from political layer`);
      return extractedData;
    } catch (error) {
      console.error('Error extracting country data:', error);
      return [];
    }
  };

  // Create labels on the map
  const createLabels = () => {
    if (!map || !L || countryData.length === 0) return;
    
    // Remove existing labels
    if (labelGroupRef.current) {
      labelGroupRef.current.removeFrom(map);
    }
    
    // Create a new layer group for labels
    const labelGroup = L.layerGroup();
    
    // Create a label for each country
    countryData.forEach((country) => {
      // Convert SVG coordinates to geographic coordinates
      const { lat, lng } = svgToLatLng(country.center.x, country.center.y);
      
      // Create a tooltip
      const tooltip = L.tooltip({
        permanent: true,
        direction: 'center',
        className: `${mapConfig.labelClassName} country-id-label`,
        opacity: 0.8
      }).setContent(country.id);
      
      // Create a marker (invisible) to hold the tooltip
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'country-label-container',
          iconSize: [0, 0]
        }),
        interactive: false
      });
      
      // Add tooltip to marker
      marker.bindTooltip(tooltip).openTooltip();
      
      // Add to layer group
      labelGroup.addLayer(marker);
      
      // Save reference
      labelsRef.current[country.id] = marker;
      
      // For horizontal wrapping, create additional markers if needed
      // Left copy (for countries that may wrap around on the left edge)
      if (country.center.x < mapConfig.svgWidth * 0.25) {
        const leftCopy = L.marker([lat, lng + mapConfig.svgWidth], {
          icon: L.divIcon({
            className: 'country-label-container',
            iconSize: [0, 0]
          }),
          interactive: false
        });
        leftCopy.bindTooltip(tooltip).openTooltip();
        labelGroup.addLayer(leftCopy);
      }
      
      // Right copy (for countries that may wrap around on the right edge)
      if (country.center.x > mapConfig.svgWidth * 0.75) {
        const rightCopy = L.marker([lat, lng - mapConfig.svgWidth], {
          icon: L.divIcon({
            className: 'country-label-container',
            iconSize: [0, 0]
          }),
          interactive: false
        });
        rightCopy.bindTooltip(tooltip).openTooltip();
        labelGroup.addLayer(rightCopy);
      }
    });
    
    // Add layer group to map if visible
    if (visible) {
      labelGroup.addTo(map);
    }
    
    // Save reference to layer group
    labelGroupRef.current = labelGroup;
    
    // Notify parent component if needed
    if (onLabelsLoaded) {
      onLabelsLoaded(countryData.map(c => c.id));
    }
  };

  // Load country data when component mounts or when LOD changes
  useEffect(() => {
    const loadCountryData = async () => {
      // Use the appropriate SVG path based on LOD settings
      const svgPath = mapConfig.lodEnabled 
        ? mapConfig.baseMapUrl 
        : mapConfig.masterMapPath;
        
      console.log(`Loading country data from ${svgPath}`);
      const data = await extractCountryData(svgPath);
      setCountryData(data);
    };
    
    loadCountryData();
  }, [mapConfig.masterMapPath, mapConfig.baseMapUrl, mapConfig.lodEnabled]);

  // Create labels when country data is loaded or zoom level changes
  useEffect(() => {
    createLabels();
    
    // Scale the labels based on zoom level
    const fontSizeBase = 10; // Base font size in pixels
    const zoomFactor = 1 + (currentZoom * 0.15); // Adjust label size based on zoom
    const fontSize = Math.max(fontSizeBase * zoomFactor, 8); // Minimum size of 8px
    
    // Apply font size to all labels
    const labels = document.querySelectorAll('.country-id-label');
    labels.forEach(label => {
      (label as HTMLElement).style.fontSize = `${fontSize}px`;
    });
    
  }, [countryData, map, L, currentZoom]);
  
  // Reload country data when base map URL changes (LOD level changes)
  useEffect(() => {
    if (mapConfig.lodEnabled) {
      const loadCountryData = async () => {
        const data = await extractCountryData(mapConfig.baseMapUrl);
        setCountryData(data);
      };
      
      loadCountryData();
    }
  }, [mapConfig.baseMapUrl]);

  // Update visibility
  useEffect(() => {
    if (!labelGroupRef.current) return;
    
    if (visible) {
      if (!map.hasLayer(labelGroupRef.current)) {
        labelGroupRef.current.addTo(map);
      }
    } else {
      if (map.hasLayer(labelGroupRef.current)) {
        labelGroupRef.current.removeFrom(map);
      }
    }
  }, [visible, map]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (labelGroupRef.current && map) {
        labelGroupRef.current.removeFrom(map);
      }
    };
  }, [map]);

  // This component doesn't render any DOM elements
  return null;
};

export default CountryLabelsComponent;