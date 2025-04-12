// src/components/SvgLayerManager.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapConfig, SVGLayer } from '@/types';
import { svgToDataUrl } from '@/lib/SVGLayerParser'; // Assuming this is correct path

interface SvgLayerManagerProps {
  map: L.Map;
  L: typeof L;
  mapConfig: MapConfig;
  layers: Record<string, SVGLayer>; // Parsed SVG layers from parent
  visibility: Record<string, boolean>; // Visibility state from parent
  isLoading: boolean; // Loading state from parent
  error: string | null; // Error state from parent
}

const SvgLayerManager: React.FC<SvgLayerManagerProps> = ({
  map,
  L,
  mapConfig,
  layers,
  visibility,
  isLoading, // Can be used to show loading state if needed
  error, // Can be used to show error state if needed
}) => {
  const layerOverlaysRef = useRef<Record<string, L.ImageOverlay>>({});
  const panesCreatedRef = useRef<Set<string>>(new Set()); // Track created panes

  // Effect to create/update Leaflet overlays when layers data changes
  useEffect(() => {
    if (!map || !L || Object.keys(layers).length === 0) {
      // Clear existing overlays if layers are reset
      Object.values(layerOverlaysRef.current).forEach((overlay) =>
        overlay.remove()
      );
      layerOverlaysRef.current = {};
      panesCreatedRef.current.clear(); // Reset created panes tracker
      return;
    }

    console.log('SvgLayerManager: Creating/Updating layer overlays...');
    const currentOverlays = layerOverlaysRef.current;
    const newOverlays: Record<string, L.ImageOverlay> = {};

    const bounds = L.latLngBounds(
      L.latLng(mapConfig.bounds.south, mapConfig.bounds.west),
      L.latLng(mapConfig.bounds.north, mapConfig.bounds.east)
    );

    // Define a sensible z-index order
    const layerOrder = [
      'altitude-layers', // Typically below political
      'political',
      'climate',
      'rivers',
      'lakes',
      // Add other layers in desired order
    ];

    const sortedLayerKeys = Object.keys(layers).sort((a, b) => {
       const indexA = layerOrder.indexOf(a);
       const indexB = layerOrder.indexOf(b);
       if (indexA !== -1 && indexB !== -1) return indexA - indexB;
       if (indexA !== -1) return -1; // Known layers first
       if (indexB !== -1) return 1;
       return a.localeCompare(b); // Alphabetical for unknown layers
    });


    sortedLayerKeys.forEach((layerId) => {
      const layer = layers[layerId];
      if (!layer || !layer.svgElement) {
         console.warn(`Layer data missing for ID: ${layerId}`);
         return; // Skip if layer data is incomplete
      }

      // Create pane if it doesn't exist
      const paneName = `svg-layer-${layerId}`;
      const zIndexBase = 400; // Base z-index for SVG layers
      const layerIndex = layerOrder.indexOf(layerId);
      // Assign z-index based on order, default for others
      const zIndex = layerIndex !== -1 ? zIndexBase + layerIndex : zIndexBase + layerOrder.length + sortedLayerKeys.indexOf(layerId);


      if (!panesCreatedRef.current.has(paneName)) {
        const pane = map.createPane(paneName);
        pane.style.zIndex = String(zIndex);
        // Prevent pointer events on layers unless specifically needed
        pane.style.pointerEvents = 'none';
        panesCreatedRef.current.add(paneName);
        console.log(`Created pane: ${paneName} with z-index: ${zIndex}`);
      }

      try {
        const dataUrl = svgToDataUrl(layer.svgElement);

        // Check if overlay exists, update URL if needed, otherwise create
        if (currentOverlays[layerId]) {
          // Potentially update URL if SVG content could change dynamically
          // currentOverlays[layerId].setUrl(dataUrl); // Usually not needed if SVG is static per load
          newOverlays[layerId] = currentOverlays[layerId];
        } else {
          const overlay = L.imageOverlay(dataUrl, bounds, {
            pane: paneName,
            interactive: false, // Typically false for static layers
            opacity: 1.0, // Default opacity
            // crossOrigin: true, // Add if needed for CORS
          });
          newOverlays[layerId] = overlay;
          console.log(`Created overlay for: ${layerId}`);
        }
      } catch (err) {
         console.error(`Error processing layer ${layerId}:`, err);
      }
    });

    // Remove overlays for layers that no longer exist
    Object.keys(currentOverlays).forEach((layerId) => {
      if (!newOverlays[layerId]) {
        currentOverlays[layerId].remove();
        // Optionally remove pane if no longer needed, though usually fine to keep
        // map.getPane(`svg-layer-${layerId}`)?.remove();
        // panesCreatedRef.current.delete(`svg-layer-${layerId}`);
        console.log(`Removed stale overlay for: ${layerId}`);
      }
    });

    layerOverlaysRef.current = newOverlays;
  }, [map, L, layers, mapConfig.bounds]); // Re-run if map, L, layers, or bounds change

  // Effect to add/remove overlays from map based on visibility prop
  useEffect(() => {
    if (!map || Object.keys(layerOverlaysRef.current).length === 0) return;

    console.log('SvgLayerManager: Updating layer visibility:', visibility);
    Object.entries(visibility).forEach(([layerId, isVisible]) => {
      const overlay = layerOverlaysRef.current[layerId];
      if (overlay) {
        if (isVisible && !map.hasLayer(overlay)) {
          overlay.addTo(map);
          console.log(`Added layer ${layerId} to map`);
        } else if (!isVisible && map.hasLayer(overlay)) {
          overlay.remove();
          console.log(`Removed layer ${layerId} from map`);
        }
      } else {
         // This might happen if visibility state updates before overlays are created
         // console.warn(`Overlay not found for layer ID: ${layerId} during visibility update.`);
      }
    });
  }, [map, visibility]); // Re-run only when map or visibility changes

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (map) {
        // Remove all managed overlays on unmount
        Object.values(layerOverlaysRef.current).forEach((overlay) => {
          overlay.remove();
        });
        // Optionally remove panes
        // panesCreatedRef.current.forEach(paneName => map.getPane(paneName)?.remove());
      }
      layerOverlaysRef.current = {};
      panesCreatedRef.current.clear();
    };
  }, [map]); // Run cleanup when map instance changes (or component unmounts)

  // This component manages Leaflet layers directly, doesn't render React DOM
  return null;
};

export default SvgLayerManager;
