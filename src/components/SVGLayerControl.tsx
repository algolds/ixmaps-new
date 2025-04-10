'use client';

import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { MapConfig } from '@/types';
import { SVGLayer, SVGLayerState } from '@/types/svg-types';
import { parseSVGLayers, svgToDataUrl } from '@/lib/SVGLayerParser';
import { showToast } from '@/lib/Toast';

interface SVGLayerControlProps {
  map: any;
  L: any;
  mapConfig: MapConfig;
  position?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  collapsed?: boolean;
  onLayerVisibilityChange?: (layerId: string, visible: boolean) => void;
}

// Define the interface for the ref methods
export interface SVGLayerControlRef {
  toggleLayer: (layerId: string, visible: boolean) => boolean;
  getLayers: () => string[];
  getVisibility: () => Record<string, boolean>;
  setVisibility: (newState: Record<string, boolean>) => void;
}

// Use forwardRef to create the component
const SVGLayerControl = forwardRef<SVGLayerControlRef, SVGLayerControlProps>(({
  map,
  L,
  mapConfig,
  position = 'topright',
  collapsed = false,
  onLayerVisibilityChange
}, ref) => {
  // State for all SVG layers
  const [layers, setLayers] = useState<Record<string, SVGLayer>>({});
  
  // State for layer visibility
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({
    political: true,
    climate: false,
    lakes: false,
    rivers: false,
    'altitude-layers': false
  });
  
  // Refs for layer overlays and control
  const layerOverlaysRef = useRef<Record<string, any>>({});
  const svgContentRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Priority layers for ordering
  const priorityLayers = ['political', 'climate', 'lakes', 'rivers', 'altitude-layers'];

  // Public method to toggle layer visibility
  const toggleLayerVisibility = (layerId: string, visible: boolean) => {
    // Update internal state
    setLayerVisibility(prev => {
      const newState = {
        ...prev,
        [layerId]: visible
      };
      return newState;
    });
    
    // Update overlay visibility
    const overlay = layerOverlaysRef.current[layerId];
    if (overlay) {
      if (visible && !map.hasLayer(overlay)) {
        overlay.addTo(map);
        console.log(`Added layer: ${layerId}`);
      } else if (!visible && map.hasLayer(overlay)) {
        overlay.removeFrom(map);
        console.log(`Removed layer: ${layerId}`);
      }
    }
    
    // Notify parent component if callback provided
    if (onLayerVisibilityChange) {
      onLayerVisibilityChange(layerId, visible);
    }
    
    return visible; // Return the new state for convenience
  };

  // Expose methods to parent components via ref
  useImperativeHandle(ref, () => ({
    toggleLayer: toggleLayerVisibility,
    getLayers: () => Object.keys(layers),
    getVisibility: () => layerVisibility,
    setVisibility: (newState: Record<string, boolean>) => {
      setLayerVisibility(prev => {
        const merged = { ...prev, ...newState };
        
        // Update layer visibility based on the new state
        Object.entries(merged).forEach(([layerId, isVisible]) => {
          const overlay = layerOverlaysRef.current[layerId];
          if (overlay) {
            if (isVisible && !map.hasLayer(overlay)) {
              overlay.addTo(map);
            } else if (!isVisible && map.hasLayer(overlay)) {
              overlay.removeFrom(map);
            }
          }
        });
        
        return merged;
      });
    }
  }), [layers, layerVisibility, map]);

  // Fetch and parse SVG on mount
  useEffect(() => {
    const fetchSVG = async () => {
      if (!mapConfig.masterMapPath) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch the SVG
        const response = await fetch(mapConfig.masterMapPath);
        if (!response.ok) {
          throw new Error(`Failed to load SVG: ${response.status} ${response.statusText}`);
        }
        
        // Get SVG content
        const svgContent = await response.text();
        svgContentRef.current = svgContent;
        
        // Parse SVG layers
        const parsedLayers = await parseSVGLayers(svgContent);
        console.log('Parsed SVG layers:', Object.keys(parsedLayers));
        
        // Update state
        setLayers(parsedLayers);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching or parsing SVG:', err);
        setError(err instanceof Error ? err.message : 'Unknown error loading SVG');
        setIsLoading(false);
      }
    };
    
    fetchSVG();
  }, [mapConfig.masterMapPath]);

  // Add layer overlays to the map once layers are parsed
  useEffect(() => {
    if (!map || !L || Object.keys(layers).length === 0) return;
    
    try {
      console.log('Creating layer overlays...');
      
      // Calculate bounds based on SVG dimensions
      const bounds = L.latLngBounds(
        L.latLng(mapConfig.bounds.south, mapConfig.bounds.west),
        L.latLng(mapConfig.bounds.north, mapConfig.bounds.east)
      );
      
      // Create overlays for each layer
      const overlays: Record<string, any> = {};
      
      // Sort layers by priority (keeping important ones at the top)
      const sortedLayerKeys = Object.keys(layers).sort((a, b) => {
        const indexA = priorityLayers.indexOf(a);
        const indexB = priorityLayers.indexOf(b);
        
        // If both are in priority list, sort by priority
        if (indexA >= 0 && indexB >= 0) {
          return indexA - indexB;
        }
        
        // If only one is in priority list, it comes first
        if (indexA >= 0) return -1;
        if (indexB >= 0) return 1;
        
        // Otherwise, sort alphabetically
        return a.localeCompare(b);
      });
      
      // Only process the main layers we want to display
      const visibleLayerKeys = sortedLayerKeys.filter(id => 
        priorityLayers.includes(id) || 
        // Also include child layers of altitude-layers
        layers[id].parentId === 'altitude-layers'
      );
      
      // Create overlays for each layer
      visibleLayerKeys.forEach((layerId, index) => {
        const layer = layers[layerId];
        
        // Create pane for this layer
        const paneName = `svg-layer-${layerId}`;
        if (!map.getPane(paneName)) {
          map.createPane(paneName);
          // Higher z-index = rendered on top
          map.getPane(paneName).style.zIndex = 400 + index;
        }
        
        // Convert SVG to data URL
        const dataUrl = svgToDataUrl(layer.svgElement);
        
        // Create image overlay
        const overlay = L.imageOverlay(dataUrl, bounds, {
          pane: paneName,
          interactive: false,
          opacity: 1.0
        });
        
        // Store reference to overlay
        overlays[layerId] = overlay;
        
        // Add to map if visibility is enabled
        const isVisible = layerVisibility[layerId] ?? false;
        if (isVisible) {
          overlay.addTo(map);
        }
      });
      
      // Store overlays reference
      layerOverlaysRef.current = overlays;
      
      console.log('Layer overlays created successfully');
      
      // Notify user
      showToast('SVG layers loaded successfully', 'success', 3000);
    } catch (err) {
      console.error('Error creating layer overlays:', err);
      setError(err instanceof Error ? err.message : 'Unknown error creating layer overlays');
    }
  }, [layers, map, L, mapConfig]);

  // Update layer visibility when it changes
  useEffect(() => {
    if (!map || !layerOverlaysRef.current) return;
    
    Object.entries(layerVisibility).forEach(([layerId, isVisible]) => {
      const overlay = layerOverlaysRef.current[layerId];
      if (overlay) {
        if (isVisible && !map.hasLayer(overlay)) {
          overlay.addTo(map);
        } else if (!isVisible && map.hasLayer(overlay)) {
          overlay.removeFrom(map);
        }
      }
    });
  }, [layerVisibility, map]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (map && layerOverlaysRef.current) {
        // Remove all overlays
        Object.values(layerOverlaysRef.current).forEach(overlay => {
          if (map.hasLayer(overlay)) {
            overlay.removeFrom(map);
          }
        });
      }
    };
  }, [map]);

  // This component no longer renders a UI control - it just manages layers
  return null;
});

// Add display name for better debugging
SVGLayerControl.displayName = 'SVGLayerControl';

export default SVGLayerControl;