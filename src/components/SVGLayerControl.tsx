'use client';

import React, { useEffect, useState, useRef } from 'react';
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
}

const SVGLayerControl: React.FC<SVGLayerControlProps> = ({ 
  map, 
  L, 
  mapConfig,
  position = 'topright',
  collapsed = false
}) => {
  // State for all SVG layers
  const [layers, setLayers] = useState<Record<string, SVGLayer>>({});
  
  // State for layer visibility
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({
    political: true,
    climate: false,
    lakes: false,
    rivers: false,
    'altitude-layers': false,
    icecaps: false
  });
  
  // Refs for layer overlays and control
  const layerOverlaysRef = useRef<Record<string, any>>({});
  const controlRef = useRef<any>(null);
  const svgContentRef = useRef<string | null>(null);
  const [controlAdded, setControlAdded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!map || !L || Object.keys(layers).length === 0 || controlAdded) return;
    
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
      const priorityLayers = ['political', 'climate', 'lakes', 'rivers', 'altitude-layers', 'icecaps'];
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
      
      // Create control
      createLayerControl(L, map, visibleLayerKeys);
      
      console.log('Layer overlays created successfully');
    } catch (err) {
      console.error('Error creating layer overlays:', err);
      setError(err instanceof Error ? err.message : 'Unknown error creating layer overlays');
    }
  }, [layers, map, L, mapConfig, controlAdded]);

  // Create layer control
  const createLayerControl = (L: any, map: any, layerKeys: string[]) => {
    // Only create control once
    if (controlAdded) return;
    
    try {
      // Define the layer control
      const LayerControl = L.Control.extend({
        options: {
          position: position
        },
        
        onAdd: function() {
          const container = L.DomUtil.create('div', 'leaflet-control-layers leaflet-control svg-layer-control');
          container.style.backgroundColor = 'white';
          container.style.padding = '6px 10px';
          container.style.borderRadius = '4px';
          container.style.border = '2px solid rgba(0,0,0,0.2)';
          container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
          
          // Title
          const title = L.DomUtil.create('div', 'control-title', container);
          title.innerHTML = 'Map Layers';
          title.style.fontWeight = 'bold';
          title.style.marginBottom = '8px';
          title.style.borderBottom = '1px solid #ddd';
          title.style.paddingBottom = '5px';
          title.style.display = 'flex';
          title.style.justifyContent = 'space-between';
          title.style.alignItems = 'center';
          
          // Toggle button
          const toggleButton = L.DomUtil.create('span', 'toggle-button', title);
          toggleButton.innerHTML = collapsed ? '»' : '×';
          toggleButton.style.cursor = 'pointer';
          toggleButton.style.marginLeft = '8px';
          
          // Layer container
          const layerContainer = L.DomUtil.create('div', 'layer-container', container);
          if (collapsed) {
            layerContainer.style.display = 'none';
          }
          
          // Handle toggle button click
          L.DomEvent.on(toggleButton, 'click', function() {
            const isCollapsed = layerContainer.style.display === 'none';
            layerContainer.style.display = isCollapsed ? 'block' : 'none';
            toggleButton.innerHTML = isCollapsed ? '×' : '»';
          });
          
          // Layer group categories
          const layerGroups: Record<string, string[]> = {
            'Base Layers': ['political', 'climate'],
            'Geographic Features': ['lakes', 'rivers', 'altitude-layers', 'icecaps']
          };
          
          // Add layer groups
          Object.entries(layerGroups).forEach(([groupName, groupLayerIds]) => {
            // Create group container
            const groupContainer = L.DomUtil.create('div', 'layer-group', layerContainer);
            groupContainer.style.marginBottom = '10px';
            
            // Group title
            const groupTitle = L.DomUtil.create('div', 'group-title', groupContainer);
            groupTitle.innerHTML = groupName;
            groupTitle.style.fontWeight = 'bold';
            groupTitle.style.marginBottom = '5px';
            
            // Add layers in this group
            groupLayerIds.forEach(layerId => {
              // Only add layers that exist in the parsed SVG
              if (layerKeys.includes(layerId)) {
                const layerInfo = layers[layerId];
                const name = layerInfo.name.charAt(0).toUpperCase() + layerInfo.name.slice(1);
                
                // Create layer item
                const layerItem = L.DomUtil.create('div', 'layer-item', groupContainer);
                layerItem.style.marginBottom = '5px';
                layerItem.style.marginLeft = '10px';
                
                // Create label with checkbox
                const label = L.DomUtil.create('label', '', layerItem);
                label.style.display = 'flex';
                label.style.alignItems = 'center';
                label.style.cursor = 'pointer';
                
                // Checkbox
                const checkbox = L.DomUtil.create('input', '', label);
                checkbox.type = 'checkbox';
                checkbox.checked = layerVisibility[layerId] ?? false;
                checkbox.style.marginRight = '8px';
                
                // Layer name
                const layerName = L.DomUtil.create('span', '', label);
                layerName.innerHTML = name;
                
                // Add change event
                L.DomEvent.on(checkbox, 'change', function(e: { target: HTMLInputElement; }) {
                  // Update visibility
                  const target = e.target as HTMLInputElement;
                  const isVisible = target.checked;
                  
                  setLayerVisibility(prev => ({
                    ...prev,
                    [layerId]: isVisible
                  }));
                  
                  // Toggle overlay
                  const overlay = layerOverlaysRef.current[layerId];
                  if (overlay) {
                    if (isVisible) {
                      overlay.addTo(map);
                    } else {
                      overlay.remove();
                    }
                  }
                });
              }
            });
          });
          
          // Prevent propagation
          L.DomEvent.disableClickPropagation(container);
          L.DomEvent.disableScrollPropagation(container);
          
          return container;
        }
      });
      
      // Create and add control
      const control = new LayerControl();
      map.addControl(control);
      controlRef.current = control;
      setControlAdded(true);
      
      // Notify user
      showToast('SVG layers loaded successfully', 'success', 3000);
    } catch (err) {
      console.error('Error creating layer control:', err);
      setError(err instanceof Error ? err.message : 'Unknown error creating layer control');
    }
  };

  // Update layer visibility when changes
  useEffect(() => {
    if (!map || !layerOverlaysRef.current) return;
    
    Object.entries(layerVisibility).forEach(([layerId, isVisible]) => {
      const overlay = layerOverlaysRef.current[layerId];
      if (overlay) {
        if (isVisible && !map.hasLayer(overlay)) {
          overlay.addTo(map);
        } else if (!isVisible && map.hasLayer(overlay)) {
          overlay.remove();
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
      
      if (map && controlRef.current) {
        map.removeControl(controlRef.current);
      }
    };
  }, [map]);

  return null; // This component doesn't render any DOM elements
};

export default SVGLayerControl;