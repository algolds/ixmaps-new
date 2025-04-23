// src/components/PoliticalLayerComponent.tsx
'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import L from 'leaflet';
import * as d3 from 'd3'; // Import d3 for better path parsing
import { MapConfig } from '@/types';
import { svgToLatLng } from '@/lib/coordinates-system';

// Define interfaces for the political layer data
interface CountryBoundaryData {
  id: string;
  name: string;
  path: string; // SVG path data
  position: {
    x: number;
    y: number;
  };
  points?: {
    x: number;
    y: number;
  }[] | null; // Pre-computed points from d3 (if available)
}

interface PoliticalLayerProps {
  map: L.Map | null;
  L: typeof L | null;
  visible: boolean;
  mapConfig: MapConfig | null;
  highlight?: string | null; // Optional ID of country to highlight
  onClick?: (id: string, name: string, e: L.LeafletMouseEvent) => void;
}

// Helper function to log without flooding console
const log = (message: string, ...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[PoliticalLayer] ${message}`, ...args);
  }
};

const PoliticalLayerComponent: React.FC<PoliticalLayerProps> = ({
  map,
  L,
  visible,
  mapConfig,
  highlight,
  onClick
}) => {
  const [countryData, setCountryData] = useState<Record<string, CountryBoundaryData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const countryPolygonsRef = useRef<Record<string, L.Polygon>>({});
  
  // Create a new pane name for vectors that can be referenced consistently
  const paneName = 'political-vector-pane';

  // Fetch boundary data - try the enhanced data first, fallback to original if needed
  useEffect(() => {
    const fetchBoundaryData = async () => {
      try {
        log('Fetching political boundary data...');
        setIsLoading(true);
        
        // Try to fetch the enhanced boundary data first
        let response = await fetch('/data/political_boundaries_essential.json');
        
        // If that fails, try the original format
        if (!response.ok) {
          log('Enhanced boundary data not found, trying original data format...');
          response = await fetch('/data/political_layer_shapes_ctm.json');
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
        }
        
        const data = await response.json();
        
        // Process and convert to a record for easier lookup
        const dataRecord: Record<string, CountryBoundaryData> = {};
        data.forEach((item: any) => {
          // Validate data has required properties
          if (item && item.id && (item.path || item.points)) {
            dataRecord[item.id] = item;
          }
        });
        
        log(`Loaded ${Object.keys(dataRecord).length} country boundaries`);
        setCountryData(dataRecord);
        setError(null);
      } catch (e: any) {
        console.error('Error fetching boundary data:', e);
        setError(`Failed to load country boundaries: ${e.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBoundaryData();
  }, []);

  // Create or update the custom pane when the map changes
  useEffect(() => {
    if (!map) return;

    // Create the custom pane if it doesn't exist
    if (!map.getPane(paneName)) {
      map.createPane(paneName);
      const pane = map.getPane(paneName);
      if (pane) {
        pane.style.zIndex = '450'; // Above base layers, below labels
        pane.style.pointerEvents = 'auto'; // Enable interaction
      }
      log('Created political vector pane');
    }
  }, [map]);

  // Parse SVG path data into Leaflet polyline points using d3
  const parsePathToPoints = useCallback((pathData: string): [number, number][] => {
    if (!pathData) return [];
    
    try {
      // Use d3 path parsing if available in the browser environment
      if (typeof document !== 'undefined' && d3) {
        // Create a temporary SVG with a path element to parse the path data
        const svg = d3.create('svg');
        const path = svg.append('path').attr('d', pathData).node();
        
        if (!path) return [];
        
        // Get the total length of the path
        const pathLength = path.getTotalLength();
        
        // Sample points along the path (more points for complex paths)
        const samplingCount = Math.max(50, Math.min(500, Math.ceil(pathLength / 10)));
        
        const points: [number, number][] = [];
        for (let i = 0; i < samplingCount; i++) {
          const point = path.getPointAtLength(pathLength * i / (samplingCount - 1));
          points.push([point.x, point.y]);
        }
        
        return points;
      }
    } catch (e) {
      console.warn('Error using d3 for path parsing, falling back to basic parser:', e);
    }
    
    // Fallback to the basic path parser
    return basicPathToPoints(pathData);
  }, []);

  // Basic SVG path parser (fallback if d3 is not available)
  const basicPathToPoints = (pathData: string): [number, number][] => {
    const points: [number, number][] = [];
    const commands = pathData.match(/[A-Za-z][^A-Za-z]*/g) || [];
    
    let currentX = 0;
    let currentY = 0;
    let firstX = 0;
    let firstY = 0;
    
    for (const cmd of commands) {
      const type = cmd[0];
      const args = cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat);
      
      switch (type) {
        case 'M': // Move to (absolute)
          currentX = args[0];
          currentY = args[1];
          firstX = currentX;
          firstY = currentY;
          points.push([currentX, currentY]);
          
          // Additional points after the first pair are treated as line commands
          for (let i = 2; i < args.length; i += 2) {
            if (i + 1 < args.length) {
              currentX = args[i];
              currentY = args[i + 1];
              points.push([currentX, currentY]);
            }
          }
          break;
          
        case 'm': // Move to (relative)
          if (points.length === 0) {
            // First command is relative to 0,0
            currentX = args[0];
            currentY = args[1];
          } else {
            currentX += args[0];
            currentY += args[1];
          }
          firstX = currentX;
          firstY = currentY;
          points.push([currentX, currentY]);
          
          // Additional points after the first pair are treated as line commands
          for (let i = 2; i < args.length; i += 2) {
            if (i + 1 < args.length) {
              currentX += args[i];
              currentY += args[i + 1];
              points.push([currentX, currentY]);
            }
          }
          break;
          
        case 'L': // Line to (absolute)
          for (let i = 0; i < args.length; i += 2) {
            if (i + 1 < args.length) {
              currentX = args[i];
              currentY = args[i + 1];
              points.push([currentX, currentY]);
            }
          }
          break;
          
        case 'l': // Line to (relative)
          for (let i = 0; i < args.length; i += 2) {
            if (i + 1 < args.length) {
              currentX += args[i];
              currentY += args[i + 1];
              points.push([currentX, currentY]);
            }
          }
          break;
          
        case 'H': // Horizontal line to (absolute)
          for (const x of args) {
            currentX = x;
            points.push([currentX, currentY]);
          }
          break;
          
        case 'h': // Horizontal line to (relative)
          for (const dx of args) {
            currentX += dx;
            points.push([currentX, currentY]);
          }
          break;
          
        case 'V': // Vertical line to (absolute)
          for (const y of args) {
            currentY = y;
            points.push([currentX, currentY]);
          }
          break;
          
        case 'v': // Vertical line to (relative)
          for (const dy of args) {
            currentY += dy;
            points.push([currentX, currentY]);
          }
          break;
          
        case 'Z':
        case 'z': // Close path
          if (points.length > 0 && (currentX !== firstX || currentY !== firstY)) {
            currentX = firstX;
            currentY = firstY;
            points.push([firstX, firstY]);
          }
          break;
          
        // Note: This basic parser doesn't handle curves (C, c, S, s, Q, q, T, t, A, a)
        // which is why we use d3 when available for better accuracy
        default:
          // Silently ignore unsupported commands
          break;
      }
    }
    
    return points;
  };

  // Convert SVG coordinates to geographic coordinates
  const svgPointsToLatLng = useCallback((svgPoints: [number, number][]) => {
    if (!mapConfig) return [];
    
    return svgPoints.map(([x, y]) => {
      try {
        const latLng = svgToLatLng(x, y, mapConfig);
        return [latLng.lat, latLng.lng] as L.LatLngExpression;
      } catch (e) {
        console.warn('Error converting SVG point to LatLng:', e);
        return null;
      }
    }).filter(Boolean) as L.LatLngExpression[];
  }, [mapConfig]);

  // Effect to create Leaflet layers from boundary data
  useEffect(() => {
    if (!map || !L || !visible || isLoading || error || !mapConfig) {
      // Clean up if any condition is not met
      if (layerGroupRef.current) {
        layerGroupRef.current.remove();
        layerGroupRef.current = null;
      }
      countryPolygonsRef.current = {};
      return;
    }
    
    // Create a new layer group if it doesn't exist
    if (!layerGroupRef.current) {
      layerGroupRef.current = L.layerGroup().addTo(map);
      log('Created new layer group');
    } else {
      // Clear existing layers
      layerGroupRef.current.clearLayers();
      log('Cleared existing layers');
    }
    
    // Get the pane or create it if it doesn't exist
    if (!map.getPane(paneName)) {
      map.createPane(paneName);
      const pane = map.getPane(paneName);
      if (pane) {
        pane.style.zIndex = '450';
        pane.style.pointerEvents = 'auto';
      }
    }
    
    log('Creating country vector layers...');
    let processedCount = 0;
    let errorCount = 0;
    countryPolygonsRef.current = {};
    
    try {
      // Process each country shape
      Object.values(countryData).forEach(country => {
        try {
          let geoPoints: L.LatLngExpression[] = [];
          
          // Use pre-computed points if available
          if (country.points && country.points.length > 2) {
            geoPoints = country.points.map(pt => {
              const latLng = svgToLatLng(pt.x, pt.y, mapConfig);
              return [latLng.lat, latLng.lng] as L.LatLngExpression;
            });
          } 
          // Otherwise parse the path data
          else if (country.path) {
            const svgPoints = parsePathToPoints(country.path);
            geoPoints = svgPointsToLatLng(svgPoints);
          }
          
          // Create polygon if we have enough points
          if (geoPoints.length > 2) {
            const isHighlighted = highlight === country.id;
            
            const polygon = L.polygon(geoPoints, {
              pane: paneName,
              color: isHighlighted ? '#ff4500' : '#3388ff',
              weight: isHighlighted ? 2 : 1.5,
              opacity: 0.8,
              fillColor: isHighlighted ? '#ff4500' : '#3388ff',
              fillOpacity: isHighlighted ? 0.2 : 0.1,
              className: isHighlighted ? 'highlighted-country' : '',
            });
            
            // Add data to the polygon
            (polygon as any).countryId = country.id;
            (polygon as any).countryName = country.name;
            
            // Add event handlers
            polygon.on('mouseover', (e) => {
              if (highlight !== country.id) {
                const target = e.target as L.Polygon;
                target.setStyle({
                  weight: 2.5,
                  color: '#ff4500',
                  fillOpacity: 0.2,
                });
              }
              
              if (L.Browser.ie || L.Browser.opera || L.Browser.edge) {
                (e.target as L.Polygon).bringToFront();
              }
            });
            
            polygon.on('mouseout', (e) => {
              if (highlight !== country.id) {
                const target = e.target as L.Polygon;
                target.setStyle({
                  weight: 1.5,
                  color: '#3388ff',
                  fillOpacity: 0.1,
                });
              }
            });
            
            // Add click handler
            if (onClick) {
              polygon.on('click', (e) => {
                onClick(country.id, country.name, e);
              });
            }
            
            // Add a tooltip with the country name
            polygon.bindTooltip(country.name, {
              direction: 'center',
              permanent: false,
              className: 'country-tooltip',
            });
            
            // Add the polygon to the layer group and reference
            layerGroupRef.current?.addLayer(polygon);
            countryPolygonsRef.current[country.id] = polygon;
            processedCount++;
          }
        } catch (err) {
          console.warn(`Error processing country ${country.id} (${country.name}):`, err);
          errorCount++;
        }
      });
      
      log(`Created ${processedCount} country polygons (${errorCount} errors)`);
    } catch (e) {
      console.error('Error creating vector layers:', e);
      setError(`Failed to create vector layers: ${e}`);
    }
    
    // Cleanup function
    return () => {
      if (layerGroupRef.current) {
        layerGroupRef.current.remove();
        layerGroupRef.current = null;
      }
      countryPolygonsRef.current = {};
    };
  }, [
    map, 
    L, 
    visible, 
    isLoading, 
    error, 
    countryData, 
    mapConfig, 
    highlight, 
    onClick, 
    parsePathToPoints, 
    svgPointsToLatLng
  ]);

  // Effect to update styles when highlight changes
  useEffect(() => {
    if (!layerGroupRef.current || Object.keys(countryPolygonsRef.current).length === 0) {
      return;
    }
    
    // Reset all polygons to default style
    Object.entries(countryPolygonsRef.current).forEach(([id, polygon]) => {
      const isHighlighted = id === highlight;
      
      polygon.setStyle({
        color: isHighlighted ? '#ff4500' : '#3388ff',
        weight: isHighlighted ? 2 : 1.5,
        fillColor: isHighlighted ? '#ff4500' : '#3388ff',
        fillOpacity: isHighlighted ? 0.2 : 0.1,
      });
      
      if (isHighlighted && (L.Browser.ie || L.Browser.opera || L.Browser.edge)) {
        polygon.bringToFront();
      }
    });
  }, [highlight]);

  // Add CSS styles for highlights and tooltips
  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    const styleId = 'political-layer-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .highlighted-country {
          stroke: #ff4500 !important;
          stroke-width: 2px !important;
          fill-opacity: 0.2 !important;
          fill: #ff4500 !important;
        }
        .country-tooltip {
          background-color: rgba(0, 0, 0, 0.7);
          border: none;
          color: white;
          font-weight: bold;
          padding: 5px 10px;
          border-radius: 3px;
          font-size: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
      `;
      document.head.appendChild(style);
      log('Added country styles to document');
    }
    
    return () => {
      const styleElement = document.getElementById(styleId);
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, []);

  // This component doesn't render any DOM elements directly
  return null;
};

export default PoliticalLayerComponent;