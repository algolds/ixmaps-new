'use client';

import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { MapConfig } from '@/types';
import { SVGLayer, SVGLayerState } from '@/types/svg-types';
import { parseSVGLayers, svgToDataUrl } from '@/lib/SVGLayerParser';
import { showToast } from '@/lib/Toast';
import { getCurrentLODLevel, getMapPathForZoom, LODLevel } from '@/lib/LODManager';

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
  reloadLayers: () => Promise<void>;
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
  
  // Track current zoom and LOD level
  const [currentZoom, setCurrentZoom] = useState<number>(mapConfig.initialZoom);
  const [currentLODLevel, setCurrentLODLevel] = useState<LODLevel>(
    getCurrentLODLevel(mapConfig.initialZoom)
  );
  
  // Refs for layer overlays and control
  const layerOverlaysRef = useRef<Record<string, any>>({});
  const svgContentRef = useRef<Record<LODLevel, string | null>>({
    [LODLevel.LOW]: null,
    [LODLevel.MEDIUM]: null,
    [LODLevel.HIGH]: null
  });
  
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

  // Method to reload layers (useful when LOD changes)
  const reloadLayers = async () => {
    if (!mapConfig.lodEnabled) {
      await fetchSVG();
      return;
    }
    
    // For LOD-enabled maps, we want to fetch the SVG for the current LOD level
    const newLODLevel = getCurrentLODLevel(currentZoom);
    await fetchSVG(newLODLevel);
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
    },
    reloadLayers
  }), [layers, layerVisibility, map, currentZoom]);

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

  // Check for LOD level changes when zoom changes
  useEffect(() => {
    if (!mapConfig.lodEnabled) return;
    
    const newLODLevel = getCurrentLODLevel(currentZoom);
    if (newLODLevel !== currentLODLevel) {
      console.log(`SVGLayerControl: LOD level changed from ${currentLODLevel} to ${newLODLevel}`);
      setCurrentLODLevel(newLODLevel);
      
      // If we don't have the SVG content for this LOD level yet, fetch it
      if (!svgContentRef.current[newLODLevel]) {
        fetchSVG(newLODLevel);
      } else {
        // Otherwise, just recreate the layers from the cached content
        recreateLayersFromCache(newLODLevel);
      }
    }
  }, [currentZoom, currentLODLevel, mapConfig.lodEnabled]);

  // Fetch and parse SVG
  const fetchSVG = async (lodLevel?: LODLevel) => {
    if (!mapConfig) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Determine which SVG to load
      let svgPath = mapConfig.masterMapPath;
      
      if (mapConfig.lodEnabled) {
        const targetLODLevel = lodLevel || getCurrentLODLevel(currentZoom);
        
        if (mapConfig.lodPaths && mapConfig.lodPaths[targetLODLevel]) {
          svgPath = mapConfig.lodPaths[targetLODLevel];
        } else {
          svgPath = getMapPathForZoom(currentZoom);
        }
        
        console.log(`SVGLayerControl: Loading ${targetLODLevel} resolution SVG from ${svgPath}`);
      }
      
      // Fetch the SVG
      console.log(`SVGLayerControl: Fetching SVG from ${svgPath}`);
      const response = await fetch(svgPath);
      if (!response.ok) {
        throw new Error(`Failed to load SVG: ${response.status} ${response.statusText}`);
      }
      
      // Get SVG content
      const svgContent = await response.text();
      
      // Cache the SVG content for this LOD level
      if (mapConfig.lodEnabled && lodLevel) {
        svgContentRef.current[lodLevel] = svgContent;
      } else {
        // If not using LOD or no level specified, cache at current level
        const currentLevel = getCurrentLODLevel(currentZoom);
        svgContentRef.current[currentLevel] = svgContent;
      }
      
      // Parse SVG layers
      const parsedLayers = await parseSVGLayers(svgContent);
      console.log('Parsed SVG layers:', Object.keys(parsedLayers));
      
      // Update state
      setLayers(parsedLayers);
      
      // Create layer overlays
      createLayerOverlays(parsedLayers);
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching or parsing SVG:', err);
      setError(err instanceof Error ? err.message : 'Unknown error loading SVG');
      setIsLoading(false);
    }
  };
  
  // Recreate layers from cached SVG content
  const recreateLayersFromCache = async (lodLevel: LODLevel) => {
    const cachedContent = svgContentRef.current[lodLevel];
    if (!cachedContent) {
      console.log(`No cached content for LOD level ${lodLevel}, fetching new...`);
      await fetchSVG(lodLevel);
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Parse SVG layers from cached content
      const parsedLayers = await parseSVGLayers(cachedContent);
      console.log(`Recreated layers from cached ${lodLevel} SVG:`, Object.keys(parsedLayers));
      
      // Update state and create overlays
      setLayers(parsedLayers);
      createLayerOverlays(parsedLayers);
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error recreating layers from cache:', err);
      setError(err instanceof Error ? err.message : 'Unknown error recreating layers');
      setIsLoading(false);
      
      // Fallback: try fetching fresh
      await fetchSVG(lodLevel);
    }
  };
  
  // Create layer overlays
  const createLayerOverlays = (parsedLayers: Record<string, SVGLayer>) => {
    if (!map || !L) return;
    
    try {
      console.log('Creating layer overlays...');
      
      // Remove existing overlays first
      Object.values(layerOverlaysRef.current).forEach(overlay => {
        if (map.hasLayer(overlay)) {
          overlay.removeFrom(map);
        }
      });
      
      // Calculate bounds based on SVG dimensions
      const bounds = L.latLngBounds(
        L.latLng(mapConfig.bounds.south, mapConfig.bounds.west),
        L.latLng(mapConfig.bounds.north, mapConfig.bounds.east)
      );
      
      // Create overlays for each layer
      const overlays: Record<string, any> = {};
      
      // Sort layers by priority (keeping important ones at the top)
      const sortedLayerKeys = Object.keys(parsedLayers).sort((a, b) => {
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
        parsedLayers[id].parentId === 'altitude-layers'
      );
      
      // Create panes if they don't exist
      // This ensures consistent z-index even when LOD changes
      priorityLayers.forEach((layerId, index) => {
        const paneName = `svg-layer-${layerId}`;
        if (!map.getPane(paneName)) {
          map.createPane(paneName);
          // Higher z-index = rendered on top
          map.getPane(paneName).style.zIndex = 400 + index;
        }
      });
      
      // Create overlays for each layer
      visibleLayerKeys.forEach((layerId) => {
        const layer = parsedLayers[layerId];
        
        // Get or create pane for this layer
        const paneName = `svg-layer-${layerId}`;
        
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
      
      // Notify user on initial load, but not when LOD changes
      if (!Object.values(svgContentRef.current).some(Boolean)) {
        showToast('SVG layers loaded successfully', 'success', 3000);
      }
    } catch (err) {
      console.error('Error creating layer overlays:', err);
      setError(err instanceof Error ? err.message : 'Unknown error creating layer overlays');
    }
  };

  // Initial load on mount
  useEffect(() => {
    fetchSVG();
  }, [mapConfig.masterMapPath]);

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
