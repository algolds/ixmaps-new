'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Map as LeafletMap } from 'leaflet';
import { MapConfig } from '@/types';

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
  // State to store the loaded country data
  const [countriesData, setCountriesData] = useState<CountriesData | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
  
  // Refs to track markers and layers
  const labelMarkersRef = useRef<any[]>([]);
  const labelsLayerRef = useRef<any>(null);
  const loadingRef = useRef(false);

  // Log debug message in console and update state
  const debug = useCallback((message: string) => {
    console.log(`[CountryLabels] ${message}`);
    setDebugMessage(message);
  }, []);
  
  // Create a custom pane for labels to control z-index
  useEffect(() => {
    if (!map || !L) return;
    
    debug("Creating country labels pane");
    
    // Create a labels pane with high z-index if it doesn't exist
    if (!map.getPane('country-labels-pane')) {
      map.createPane('country-labels-pane');
      const pane = map.getPane('country-labels-pane');
      if (pane) {
        pane.style.zIndex = '650';
        // Allow mouse events for interactive labels
        pane.style.pointerEvents = 'auto';
        debug("Created country labels pane with z-index 650");
      } else {
        debug("ERROR: Failed to get the created pane");
      }
    } else {
      debug("Country labels pane already exists");
    }
    
    // Create layer group for labels
    const labelsLayer = L.layerGroup([], { pane: 'country-labels-pane' });
    labelsLayerRef.current = labelsLayer;
    
    // Add the layer to the map if visible
    if (visible) {
      labelsLayer.addTo(map);
      debug("Added labels layer to map (initially visible)");
    } else {
      debug("Labels layer created but not added to map (initially hidden)");
    }
    
    // Clean up on unmount
    return () => {
      if (map && labelsLayer) {
        try {
          map.removeLayer(labelsLayer);
          debug("Cleaned up labels layer on unmount");
        } catch (e) {
          debug(`Error removing labels layer: ${e}`);
        }
      }
    };
  }, [map, L, debug]);
  
  // Load country data
  useEffect(() => {
    async function loadCountryData() {
      // Prevent multiple simultaneous loads
      if (loadingRef.current || isDataLoaded) return;
      loadingRef.current = true;
      
      debug("Loading country data from JSON file");
      
      try {
        // Fetch the JSON file
        const response = await fetch('/data/countries.json');
        
        if (!response.ok) {
          throw new Error(`Failed to load countries data: ${response.status} ${response.statusText}`);
        }
        
        const data: CountriesData = await response.json();
        
        // Validate data
        if (!data || !Array.isArray(data.countries)) {
          throw new Error('Invalid countries data format');
        }
        
        // Filter out countries without valid centerpoints
        const validCountries = {
          countries: data.countries.filter(country => 
            country.centerpoint && 
            typeof country.centerpoint.x === 'number' && 
            typeof country.centerpoint.y === 'number'
          )
        };
        
        setCountriesData(validCountries);
        setIsDataLoaded(true);
        debug(`Successfully loaded ${validCountries.countries.length} countries with valid centerpoints`);
        
        // Sample data for debugging
        if (validCountries.countries.length > 0) {
          const sample = validCountries.countries[0];
          debug(`Sample country: ${sample.name}, ID: ${sample.id}, Position: (${sample.centerpoint.x}, ${sample.centerpoint.y})`);
        }
      } catch (error) {
        debug(`ERROR loading country data: ${error}`);
        // Create test data for debugging
        createTestLabels();
      } finally {
        loadingRef.current = false;
      }
    }
    
    if (!isDataLoaded) {
      loadCountryData();
    }
  }, [isDataLoaded, debug]);

  // Create test labels for debugging
  const createTestLabels = useCallback(() => {
    debug("Creating test labels for debugging");
    
    if (!map || !L || !labelsLayerRef.current) {
      debug("Cannot create test labels - map, L, or labelsLayer not available");
      return;
    }
    
    // Create test data
    const testData = {
      countries: [
        { id: "test1", name: "Test Country 1", centerpoint: { x: mapConfig.svgWidth / 4, y: mapConfig.svgHeight / 4 } },
        { id: "test2", name: "Test Country 2", centerpoint: { x: mapConfig.svgWidth / 2, y: mapConfig.svgHeight / 2 } },
        { id: "test3", name: "Test Country 3", centerpoint: { x: 3 * mapConfig.svgWidth / 4, y: 3 * mapConfig.svgHeight / 4 } }
      ]
    };
    
    setCountriesData(testData);
    setIsDataLoaded(true);
    debug("Created test country data");
  }, [map, L, mapConfig, debug]);
  
  // Update visibility based on the visible prop
  useEffect(() => {
    if (!map || !labelsLayerRef.current) return;
    
    debug(`Updating label visibility to: ${visible}`);
    
    if (visible) {
      if (!map.hasLayer(labelsLayerRef.current)) {
        labelsLayerRef.current.addTo(map);
        debug("Added labels layer to map (visibility changed to true)");
      }
    } else {
      if (map.hasLayer(labelsLayerRef.current)) {
        map.removeLayer(labelsLayerRef.current);
        debug("Removed labels layer from map (visibility changed to false)");
      }
    }
  }, [visible, map, debug]);
  
  // Function to determine label class based on country properties
  const determineLabelClass = useCallback((country: CountryData): string => {
    // Major powers and large nations
    const majorCountries = [
      'Urcea', 'Caphiria', 'Burgundie', 'Great Levantine Empire', 
      'Holy Levantine Empire', 'Great Levantia', 'Kiravia'
    ];
    
    // Capital cities or important locations
    const capitals = [
      'Urceopolis', 'Venepia', 'Solaria', 'Cana', 'Capital'
    ];
    
    // Check if this looks like a capital
    if (capitals.some(capital => 
      country.id.includes(capital) || 
      country.name.includes(capital) ||
      country.name.includes('City')
    )) {
      return 'capital';
    } 
    // Check if this is a major country
    else if (majorCountries.some(major => 
      country.id === major || 
      country.name === major
    )) {
      return 'major';
    }
    // Check if this might be a smaller entity
    else if (
      country.id.includes('Island') || 
      country.name.includes('Island') ||
      country.id.includes('Region') || 
      country.name.includes('Region') ||
      country.id.includes('Territory') || 
      country.name.includes('Territory')
    ) {
      return 'minor';
    }
    // Default classification
    else {
      return 'standard';
    }
  }, []);
  
  // Create labels for countries
  const createCountryLabels = useCallback(() => {
    if (!map || !L || !countriesData || !labelsLayerRef.current) {
      debug("Cannot create country labels - missing required references");
      return;
    }
    
    debug("Creating country labels");
    
    // Clear existing markers
    labelMarkersRef.current.forEach(marker => {
      if (labelsLayerRef.current) {
        labelsLayerRef.current.removeLayer(marker);
      }
    });
    labelMarkersRef.current = [];
    
    // Create new markers for country labels
    const newMarkers = countriesData.countries.map((country, index) => {
      // Skip countries without centerpoints
      if (!country.centerpoint || !country.centerpoint.x || !country.centerpoint.y) {
        debug(`Skipping country without valid centerpoint: ${country.name}`);
        return null;
      }
      
      const { x, y } = country.centerpoint;
      
      // Skip if coordinates are invalid
      if (isNaN(x) || isNaN(y)) {
        debug(`Skipping country with invalid coordinates: ${country.name}`);
        return null;
      }
      
      // Determine label class
      const labelClass = determineLabelClass(country);
      
      // Debug first few items
      if (index < 3) {
        debug(`Creating label for ${country.name} at (${x}, ${y}) with class ${labelClass}`);
      }
      
      // Try to create marker with div icon
      try {
        // Create marker with div icon and explicit size
        const fontSize = labelClass === 'major' ? 14 : 
                         labelClass === 'capital' ? 14 : 
                         labelClass === 'minor' ? 11 : 12;
                         
        const width = Math.max(80, country.name.length * 7); // Ensure minimum width
        const marker = L.marker([y, x], {
          icon: L.divIcon({
            className: `country-label ${labelClass}`,
            html: country.name,
            iconSize: [width, 20],
            iconAnchor: [width/2, 10]
          }),
          pane: 'country-labels-pane',
          interactive: true // Make labels clickable
        });
        
        // Log a sample of the created marker
        if (index === 0) {
          debug(`Sample marker created: ${country.name} with class ${labelClass}`);
        }
        
        // Add click handler for debugging
        marker.on('click', () => {
          debug(`Label clicked: ${country.name} at (${x}, ${y})`);
          // Show popup with country info
          L.popup()
            .setLatLng([y, x])
            .setContent(`<div><strong>${country.name}</strong><br>ID: ${country.id}<br>Position: (${x}, ${y})</div>`)
            .openOn(map);
        });
        
        return marker;
      } catch (e) {
        debug(`Error creating marker for ${country.name}: ${e}`);
        return null;
      }
    }).filter(Boolean) as any[];
    
    // Add markers to the layer
    newMarkers.forEach(marker => {
      if (labelsLayerRef.current) {
        try {
          marker.addTo(labelsLayerRef.current);
        } catch (e) {
          debug(`Error adding marker to layer: ${e}`);
        }
      }
    });
    
    // Store markers in ref
    labelMarkersRef.current = newMarkers;
    
    debug(`Created ${newMarkers.length} country labels`);
    
    // Add a visible test label at the map center for debugging
    if (newMarkers.length === 0) {
      debug("No markers created - adding test label at map center");
      try {
        const center = map.getCenter();
        const testMarker = L.marker(center, {
          icon: L.divIcon({
            className: 'country-label major',
            html: 'TEST LABEL',
            iconSize: [100, 30],
            iconAnchor: [50, 15]
          }),
          pane: 'country-labels-pane'
        });
        testMarker.addTo(labelsLayerRef.current);
        labelMarkersRef.current.push(testMarker);
        debug(`Added test label at map center: (${center.lat}, ${center.lng})`);
      } catch (e) {
        debug(`Error creating test label: ${e}`);
      }
    }
  }, [countriesData, map, L, determineLabelClass, debug]);
  
  // Create labels when data is loaded
  useEffect(() => {
    if (isDataLoaded && countriesData && visible) {
      debug("Data loaded and component visible - creating labels");
      createCountryLabels();
    }
  }, [isDataLoaded, countriesData, visible, createCountryLabels, debug]);
  
  // Update labels on zoom change
  useEffect(() => {
    if (!map || !isDataLoaded || !countriesData) return;
    
    const handleZoomEnd = () => {
      debug(`Zoom level changed to ${map.getZoom()} - recreating labels`);
      createCountryLabels();
    };
    
    map.on('zoomend', handleZoomEnd);
    
    // Clean up
    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [map, isDataLoaded, countriesData, createCountryLabels, debug]);
  
  // Render debug info if there's a message
  if (debugMessage) {
    return (
      <div style={{
        position: 'absolute',
        bottom: '50px',
        left: '10px',
        backgroundColor: 'rgba(255,255,255,0.8)',
        padding: '5px',
        zIndex: 1000,
        fontSize: '12px',
        maxWidth: '300px',
        display: visible ? 'block' : 'none'
      }}>
        <div><strong>Country Labels Debug:</strong></div>
        <div>{debugMessage}</div>
        <div>Loaded: {isDataLoaded ? 'Yes' : 'No'}</div>
        <div>Countries: {countriesData ? countriesData.countries.length : 0}</div>
        <div>Labels: {labelMarkersRef.current.length}</div>
      </div>
    );
  }
  
  // No visible UI otherwise
  return null;
};

export default CountryLabelsComponent;