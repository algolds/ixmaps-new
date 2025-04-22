// src/components/PoliticalLayerComponent.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import { MapConfig } from '@/types';
import { svgToLatLng } from '@/lib/coordinates-system';

// Define interfaces for the political layer data
interface PathData {
  id: string;
  name: string;
  path: string; // SVG path data
  element: SVGElement | null;
}

interface PositionData {
  id: string;
  name: string;
  position: {
    x: number;
    y: number;
  };
  layerId: string;
  tagName: string;
  continent: string | null;
  type: string | null;
}

interface PoliticalLayerProps {
  map: L.Map | null;
  L: typeof L | null;
  visible: boolean;
  mapConfig: MapConfig | null;
  highlight?: string | null; // Optional ID of country to highlight
  onClick?: (id: string, name: string, e: L.LeafletMouseEvent) => void;
}

const PoliticalLayerComponent = ({
  map,
  L,
  visible,
  mapConfig,
  highlight,
  onClick
}: PoliticalLayerProps) => {
  const [countryData, setCountryData] = useState<Record<string, PathData>>({});
  const [positionData, setPositionData] = useState<Record<string, PositionData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Fetch the position data from the JSON file
  useEffect(() => {
    const fetchPositionData = async () => {
      try {
        console.log('[PoliticalLayer] Fetching positions data...');
        const response = await fetch('/data/political_layer_shapes_ctm.json');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data: PositionData[] = await response.json();
        
        // Convert to a record for easier lookup
        const dataRecord: Record<string, PositionData> = {};
        data.forEach(item => {
          dataRecord[item.id] = item;
        });
        
        console.log(`[PoliticalLayer] Loaded ${Object.keys(dataRecord).length} country positions`);
        setPositionData(dataRecord);
      } catch (e: any) {
        console.error('[PoliticalLayer] Error fetching position data:', e);
        setError(`Failed to load country positions: ${e.message}`);
      }
    };
    
    fetchPositionData();
  }, []);

  // Fetch and parse the SVG to extract country paths
  useEffect(() => {
    const fetchSvgData = async () => {
      if (!mapConfig?.masterMapPath) {
        setError('Map config or master SVG path is missing');
        return;
      }
      
      try {
        console.log(`[PoliticalLayer] Fetching SVG from ${mapConfig.masterMapPath}...`);
        setIsLoading(true);
        
        const response = await fetch(mapConfig.masterMapPath);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const svgText = await response.text();
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        
        // Find the political layer
        const politicalLayer = svgDoc.getElementById('political');
        
        if (!politicalLayer) {
          throw new Error('Political layer not found in SVG');
        }
        
        // Extract all shapes (path, polygon, etc.) from the political layer
        const shapes: Record<string, PathData> = {};
        
        // Process path elements
        const paths = politicalLayer.getElementsByTagName('path');
        for (let i = 0; i < paths.length; i++) {
          const path = paths[i];
          const id = path.getAttribute('id');
          
          if (id) {
            const name = path.getAttribute('inkscape:label') || id;
            const d = path.getAttribute('d');
            
            if (d) {
              shapes[id] = {
                id,
                name: name || id,
                path: d,
                element: path.cloneNode(true) as SVGElement
              };
            }
          }
        }
        
        // Process polygon elements (if any)
        const polygons = politicalLayer.getElementsByTagName('polygon');
        for (let i = 0; i < polygons.length; i++) {
          const polygon = polygons[i];
          const id = polygon.getAttribute('id');
          
          if (id) {
            const name = polygon.getAttribute('inkscape:label') || id;
            const points = polygon.getAttribute('points');
            
            if (points) {
              // Convert polygon points to a path
              const pathData = `M${points.trim().replace(/\s+/g, 'L')}z`;
              shapes[id] = {
                id,
                name: name || id,
                path: pathData,
                element: polygon.cloneNode(true) as SVGElement
              };
            }
          }
        }
        
        console.log(`[PoliticalLayer] Extracted ${Object.keys(shapes).length} country shapes`);
        setCountryData(shapes);
      } catch (e: any) {
        console.error('[PoliticalLayer] Error fetching or parsing SVG:', e);
        setError(`Failed to load or parse SVG: ${e.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSvgData();
  }, [mapConfig]);

  // Create Leaflet vector layers from SVG paths
  useEffect(() => {
    if (!map || !L || !visible || isLoading || error || !mapConfig) {
      // Clean up if any condition is not met
      if (layerGroupRef.current) {
        layerGroupRef.current.remove();
        layerGroupRef.current = null;
      }
      return;
    }
    
    // Create a new layer group if it doesn't exist
    if (!layerGroupRef.current) {
      layerGroupRef.current = L.layerGroup().addTo(map);
    } else {
      // Clear existing layers
      layerGroupRef.current.clearLayers();
    }
    
    // Create a pane for the political layer
    const paneName = 'political-vector-pane';
    if (!map.getPane(paneName)) {
      map.createPane(paneName);
      const pane = map.getPane(paneName);
      if (pane) {
        pane.style.zIndex = '450'; // Above base layers, below labels
        pane.style.pointerEvents = 'auto'; // Enable interaction
      }
    }
    
    console.log('[PoliticalLayer] Creating country vector layers...');
    
    try {
      // Process each country shape
      Object.values(countryData).forEach(country => {
        const pathData = country.path;
        if (!pathData) return;
        
        // Get the position data for this country if available
        const position = positionData[country.id];
        
        // Convert SVG path to Leaflet polygon points
        try {
          // Parse the SVG path data
          const pathSvgPoints = parseSvgPath(pathData);
          
          // Convert SVG points to geographic coordinates
          const geoPoints: L.LatLngExpression[] = pathSvgPoints.map(point => {
            const latLng = svgToLatLng(point.x, point.y, mapConfig);
            return [latLng.lat, latLng.lng];
          });
          
          // Create the polygon
          if (geoPoints.length > 2) {
            const polygon = L.polygon(geoPoints, {
              pane: paneName,
              color: '#3388ff',
              weight: 1.5,
              opacity: 0.8,
              fillColor: '#3388ff',
              fillOpacity: 0.1,
              // Add highlight effect if this is the highlighted country
              className: highlight === country.id ? 'highlighted-country' : '',
            });
            
            // Add data to the polygon
            (polygon as any).countryId = country.id;
            (polygon as any).countryName = country.name;
            
            // Add event handlers
            polygon.on('mouseover', (e) => {
              const target = e.target as L.Polygon;
              target.setStyle({
                weight: 2.5,
                color: '#ff4500',
                fillOpacity: 0.2,
              });
              
              if (L.Browser.ie || L.Browser.opera || L.Browser.edge) {
                target.bringToFront();
              }
            });
            
            polygon.on('mouseout', (e) => {
              const target = e.target as L.Polygon;
              const isHighlighted = highlight === country.id;
              
              polygon.setStyle({
                weight: isHighlighted ? 2 : 1.5,
                color: isHighlighted ? '#ff4500' : '#3388ff',
                fillColor: isHighlighted ? '#ff4500' : '#3388ff',
                fillOpacity: isHighlighted ? 0.2 : 0.1,
              });
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
            
            // Add the polygon to the layer group
            layerGroupRef.current?.addLayer(polygon);
          }
        } catch (pathError) {
          console.warn(`[PoliticalLayer] Error converting path for ${country.id}:`, pathError);
        }
      });
      
      console.log('[PoliticalLayer] Vector layers created successfully');
    } catch (e) {
      console.error('[PoliticalLayer] Error creating vector layers:', e);
      setError(`Failed to create vector layers: ${e}`);
    }
    
    // Cleanup function
    return () => {
      if (layerGroupRef.current) {
        layerGroupRef.current.remove();
        layerGroupRef.current = null;
      }
    };
  }, [map, L, visible, isLoading, error, countryData, positionData, mapConfig, highlight, onClick]);

  // Add CSS styles for highlights
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
        }
      `;
      document.head.appendChild(style);
    }
    
    return () => {
      const styleElement = document.getElementById(styleId);
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, []);

  return null; // This component doesn't render any DOM elements directly
};

// Simple SVG path parser function
// This is a basic implementation and might need enhancement for complex SVG paths
interface Point {
  x: number;
  y: number;
}

// A basic SVG path parser
function parseSvgPath(pathData: string): Point[] {
  const points: Point[] = [];
  const commands = pathData.match(/[A-Za-z][^A-Za-z]*/g) || [];
  
  let currentX = 0;
  let currentY = 0;
  
  for (const cmd of commands) {
    const type = cmd[0];
    const args = cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat);
    
    switch (type) {
      case 'M': // Move to (absolute)
        currentX = args[0];
        currentY = args[1];
        points.push({ x: currentX, y: currentY });
        
        // If there are more points after the first pair, they are treated as line commands
        for (let i = 2; i < args.length; i += 2) {
          if (i + 1 < args.length) {
            currentX = args[i];
            currentY = args[i + 1];
            points.push({ x: currentX, y: currentY });
          }
        }
        break;
        
      case 'm': // Move to (relative)
        currentX += args[0];
        currentY += args[1];
        points.push({ x: currentX, y: currentY });
        
        // If there are more points after the first pair, they are treated as line commands
        for (let i = 2; i < args.length; i += 2) {
          if (i + 1 < args.length) {
            currentX += args[i];
            currentY += args[i + 1];
            points.push({ x: currentX, y: currentY });
          }
        }
        break;
        
      case 'L': // Line to (absolute)
        for (let i = 0; i < args.length; i += 2) {
          if (i + 1 < args.length) {
            currentX = args[i];
            currentY = args[i + 1];
            points.push({ x: currentX, y: currentY });
          }
        }
        break;
        
      case 'l': // Line to (relative)
        for (let i = 0; i < args.length; i += 2) {
          if (i + 1 < args.length) {
            currentX += args[i];
            currentY += args[i + 1];
            points.push({ x: currentX, y: currentY });
          }
        }
        break;
        
      case 'H': // Horizontal line to (absolute)
        for (const arg of args) {
          currentX = arg;
          points.push({ x: currentX, y: currentY });
        }
        break;
        
      case 'h': // Horizontal line to (relative)
        for (const arg of args) {
          currentX += arg;
          points.push({ x: currentX, y: currentY });
        }
        break;
        
      case 'V': // Vertical line to (absolute)
        for (const arg of args) {
          currentY = arg;
          points.push({ x: currentX, y: currentY });
        }
        break;
        
      case 'v': // Vertical line to (relative)
        for (const arg of args) {
          currentY += arg;
          points.push({ x: currentX, y: currentY });
        }
        break;
        
      case 'Z':
      case 'z': // Close path - return to the first point
        if (points.length > 0) {
          const firstPoint = points[0];
          if (currentX !== firstPoint.x || currentY !== firstPoint.y) {
            points.push({ x: firstPoint.x, y: firstPoint.y });
          }
        }
        break;
        
      // Note: Curves (C, c, S, s, Q, q, T, t, A, a) are not properly handled in this basic implementation
      default:
        console.warn(`[PoliticalLayer] Unsupported SVG path command: ${type}`);
        break;
    }
  }
  
  return points;
}

export default PoliticalLayerComponent;