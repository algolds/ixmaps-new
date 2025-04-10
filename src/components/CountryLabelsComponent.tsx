'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Map as LeafletMap } from 'leaflet';
import { MapConfig } from '@/types';
import { visibleBounds } from '@/lib/MapConfig';

interface CountryData {
  id: string;
  name: string;
  centerpoint: {
    x: number;
    y: number;
  };
}

interface CountriesData {
  countries: CountryData[];
}

interface CountryLabelsComponentProps {
  map: LeafletMap;
  L: any; // Leaflet library
  visible: boolean;
  mapConfig: MapConfig;
}

const CountryLabelsComponent: React.FC<CountryLabelsComponentProps> = ({
  map,
  L,
  visible,
  mapConfig
}) => {
  // State and refs
  const [isLoaded, setIsLoaded] = useState(false);
  const labelsLayerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const debugInfoRef = useRef<any>({
    labels: 0,
    errors: 0,
    lastError: '',
    elapsed: 0
  });
  
  // Set up the label layer
  useEffect(() => {
    if (!map || !L) return;
    
    console.log("Setting up country labels layer");
    
    // Create a labels pane with high z-index
    if (!map.getPane('country-labels-pane')) {
      map.createPane('country-labels-pane');
      map.getPane('country-labels-pane').style.zIndex = '900'; // Very high z-index
      map.getPane('country-labels-pane').style.pointerEvents = 'auto';
    }
    
    // Create layer group for labels
    const labelsLayer = L.layerGroup([], { pane: 'country-labels-pane' });
    labelsLayerRef.current = labelsLayer;
    
    // Add to map if visible
    if (visible) {
      labelsLayer.addTo(map);
    }
    
    // Cleanup on unmount
    return () => {
      if (map && labelsLayer) {
        map.removeLayer(labelsLayer);
      }
    };
  }, [map, L]);
  
  // Update visibility
  useEffect(() => {
    if (!map || !labelsLayerRef.current) return;
    
    if (visible) {
      if (!map.hasLayer(labelsLayerRef.current)) {
        labelsLayerRef.current.addTo(map);
      }
    } else {
      if (map.hasLayer(labelsLayerRef.current)) {
        map.removeLayer(labelsLayerRef.current);
      }
    }
  }, [visible, map]);
  
  // Convert SVG coordinates to Leaflet coordinates
  const svgToLeaflet = (svgX: number, svgY: number) => {
    // Leaflet's coordinate system:
    // 1. First parameter is latitude (Y-axis / vertical)
    // 2. Second parameter is longitude (X-axis / horizontal)
    
    // Define bounds based on map configuration
    const bounds = {
      north: 0,
      south: mapConfig.svgHeight,
      east: mapConfig.svgWidth,
      west: 0
    };
    
    // Calculate latitude (Y coordinate)
    // Invert Y because SVG Y increases downward, while Leaflet's lat increases upward
    const lat = (bounds.south - svgY) * (visibleBounds.northLat - visibleBounds.southLat) / (bounds.south - bounds.north) + visibleBounds.southLat;
    
    // Calculate longitude (X coordinate)
    const lng = svgX * 360 / mapConfig.svgWidth - 180;
    
    return { lat, lng };
  };
  
  // Classify country label based on name and properties
  const classifyLabel = (name: string, id: string): string => {
    // Major countries
    const majorCountries = [
      'Urcea', 'Caphiria', 'Burgundie', 'Great Levantine Empire', 
      'Holy Levantine Empire', 'Great Levantia', 'Kiravia'
    ];
    
    // Cities and capitals
    const capitals = [
      'Urceopolis', 'Venepia', 'Solaria', 'Cana', 'Capital', 'City'
    ];
    
    // Check if this is a capital or city
    if (capitals.some(c => name.includes(c) || id.includes(c))) {
      return 'capital';
    }
    
    // Check if this is a major country
    if (majorCountries.some(c => name === c || id === c)) {
      return 'major';
    }
    
    // Check if this is a minor feature
    if (name.includes('Island') || 
        name.includes('Region') || 
        name.includes('Territory') ||
        id.includes('Island') ||
        id.includes('Region') ||
        id.includes('Territory') ||
        name.length < 4) {
      return 'minor';
    }
    
    // Default classification
    return 'standard';
  };
  
  // Calculate appropriate label size based on country name and classification
  const getLabelSize = (name: string, className: string): [number, number] => {
    const baseWidth = Math.max(80, name.length * 7);
    const baseHeight = 20;
    
    // Adjust size based on class
    switch (className) {
      case 'capital':
      case 'major':
        return [baseWidth * 1.2, baseHeight * 1.2];
      case 'minor':
        return [baseWidth * 0.8, baseHeight * 0.8];
      default:
        return [baseWidth, baseHeight];
    }
  };
  
  // Load data and create labels
  useEffect(() => {
    if (!map || !L || !labelsLayerRef.current || !visible) return;
    
    // Skip if already loaded
    if (isLoaded && markersRef.current.length > 0) return;
    
    const startTime = performance.now();
    
    async function createLabels() {
      // Clear existing markers
      markersRef.current.forEach(marker => {
        labelsLayerRef.current.removeLayer(marker);
      });
      markersRef.current = [];
      
      // Add test markers for reference points
      const testPoints = [
        { name: "Center", x: mapConfig.svgWidth / 2, y: mapConfig.svgHeight / 2 },
        { name: "Top Left", x: mapConfig.svgWidth * 0.25, y: mapConfig.svgHeight * 0.25 },
        { name: "Bottom Right", x: mapConfig.svgWidth * 0.75, y: mapConfig.svgHeight * 0.75 },
        { name: "Prime Meridian", x: mapConfig.primeMeridianX, y: mapConfig.equatorY }
      ];
      
      testPoints.forEach(point => {
        try {
          // Convert SVG coordinates to Leaflet
          const coords = svgToLeaflet(point.x, point.y);
          
          // Create the marker with appropriate styling
          const marker = L.marker([coords.lat, coords.lng], {
            icon: L.divIcon({
              className: 'country-label major',
              html: point.name,
              iconSize: [100, 30],
              iconAnchor: [50, 15]
            }),
            pane: 'country-labels-pane'
          });
          
          // Add click handler for debugging
          marker.on('click', () => {
            L.popup()
              .setLatLng([coords.lat, coords.lng])
              .setContent(`<strong>${point.name}</strong><br>SVG: (${point.x}, ${point.y})<br>Map: (${coords.lat.toFixed(2)}, ${coords.lng.toFixed(2)})`)
              .openOn(map);
          });
          
          // Add to layer and track
          marker.addTo(labelsLayerRef.current);
          markersRef.current.push(marker);
        } catch (e) {
          debugInfoRef.current.errors++;
          debugInfoRef.current.lastError = `Error with test point ${point.name}: ${e}`;
          console.error(`Error creating test label:`, e);
        }
      });
      
      // Now try to load the real data
      try {
        const response = await fetch('/data/countries.json');
        
        if (response.ok) {
          const data: CountriesData = await response.json();
          
          if (data && Array.isArray(data.countries)) {
            console.log(`Loaded ${data.countries.length} countries from JSON`);
            
            let addedCount = 0;
            // Process all countries
            data.countries.forEach(country => {
              if (!country.centerpoint || !country.centerpoint.x || !country.centerpoint.y) return;
              
              const { x, y } = country.centerpoint;
              
              try {
                // Convert SVG coordinates to Leaflet
                const coords = svgToLeaflet(x, y);
                
                // Classify the label
                const labelClass = classifyLabel(country.name, country.id);
                
                // Calculate size
                const [width, height] = getLabelSize(country.name, labelClass);
                
                // Create the marker
                const marker = L.marker([coords.lat, coords.lng], {
                  icon: L.divIcon({
                    className: `country-label ${labelClass}`,
                    html: country.name,
                    iconSize: [width, height],
                    iconAnchor: [width/2, height/2]
                  }),
                  pane: 'country-labels-pane'
                });
                
                // Add click handler
                marker.on('click', () => {
                  L.popup()
                    .setLatLng([coords.lat, coords.lng])
                    .setContent(`<strong>${country.name}</strong><br>SVG: (${x}, ${y})<br>Map: (${coords.lat.toFixed(2)}, ${coords.lng.toFixed(2)})`)
                    .openOn(map);
                });
                
                // Add to layer and track
                marker.addTo(labelsLayerRef.current);
                markersRef.current.push(marker);
                addedCount++;
              } catch (e) {
                debugInfoRef.current.errors++;
                debugInfoRef.current.lastError = `Error with country ${country.name}: ${e}`;
                console.error(`Error creating label for ${country.name}:`, e);
              }
            });
            
            debugInfoRef.current.labels = addedCount;
            console.log(`Added ${addedCount} country labels to map`);
          }
        } else {
          throw new Error(`Failed to load countries: ${response.status}`);
        }
      } catch (e) {
        debugInfoRef.current.errors++;
        debugInfoRef.current.lastError = `Error loading data: ${e}`;
        console.error("Error loading country data:", e);
      }
      
      // Update debug info
      debugInfoRef.current.elapsed = (performance.now() - startTime).toFixed(0);
      setIsLoaded(true);
    }
    
    createLabels();
  }, [map, L, visible, mapConfig]);
  
  // Add event handler for zoom changes
  useEffect(() => {
    if (!map || !isLoaded) return;
    
    const handleZoomEnd = () => {
      // We could adjust label size based on zoom level here
      // or hide certain labels at different zoom levels
      console.log(`Zoom level changed: ${map.getZoom()}`);
    };
    
    map.on('zoomend', handleZoomEnd);
    
    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [map, isLoaded]);
  
  // Add a debug display
  return (
    visible ? (
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '10px',
        backgroundColor: 'rgba(255,255,255,0.8)',
        padding: '10px',
        borderRadius: '4px',
        zIndex: 1000,
        boxShadow: '0 1px 5px rgba(0,0,0,0.2)',
        fontSize: '12px',
        maxWidth: '300px'
      }}>
        <div><strong>Country Labels Debug:</strong></div>
        <div>Visible: {visible ? 'Yes' : 'No'}</div>
        <div>Loaded: {isLoaded ? 'Yes' : 'No'}</div>
        <div>Labels: {debugInfoRef.current.labels + 4} (incl. test points)</div>
        <div>Map Dimensions: {mapConfig.svgWidth} x {mapConfig.svgHeight}</div>
        <div>Prime Meridian: {mapConfig.primeMeridianX}, Equator: {mapConfig.equatorY}</div>
        <div>Zoom: {map?.getZoom()}</div>
        <div>Load time: {debugInfoRef.current.elapsed}ms</div>
        <div>Errors: {debugInfoRef.current.errors}</div>
        {debugInfoRef.current.lastError && (
          <div style={{color: 'red', fontSize: '11px', marginTop: '5px'}}>
            Last error: {debugInfoRef.current.lastError}
          </div>
        )}
        <div style={{marginTop: '10px', fontSize: '11px'}}>
          Coordinate system has been fixed using proper conversion 
          from SVG to map coordinates.
        </div>
      </div>
    ) : null
  );
};

export default CountryLabelsComponent;