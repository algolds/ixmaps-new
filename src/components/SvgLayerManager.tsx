// src/components/SvgLayerManager.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapConfig, SVGLayer } from '@/types';
import { svgToDataUrl } from '@/lib/SVGLayerParser';
import { svgToLatLng } from '@/lib/coordinates-system'; // <-- IMPORT THIS

interface SvgLayerManagerProps {
  map: L.Map;
  L: typeof L;
  mapConfig: MapConfig;
  layers: Record<string, SVGLayer>; // Parsed SVG layers from parent
  visibility: Record<string, boolean>; // Visibility state from parent
  isLoading: boolean; // Loading state from parent (optional use)
  error: string | null; // Error state from parent (optional use)
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
    // Add checks for necessary mapConfig properties for bounds calculation
    if (
      !map ||
      !L ||
      Object.keys(layers).length === 0 ||
      !mapConfig ||
      typeof mapConfig.svgWidth !== 'number' ||
      mapConfig.svgWidth <= 0 ||
      typeof mapConfig.svgHeight !== 'number' ||
      mapConfig.svgHeight <= 0 ||
      typeof mapConfig.pixelsPerLatitude !== 'number' ||
      typeof mapConfig.pixelsPerLongitude !== 'number' ||
      typeof mapConfig.equatorY !== 'number' ||
      typeof mapConfig.primeMeridianX !== 'number'
    ) {
      // Clear existing overlays if dependencies are not met
      console.warn(
        '[SvgLayerManager] Dependencies not met for overlay creation (Map, L, Layers, or valid MapConfig projection params). Clearing overlays.',
      );
      Object.values(layerOverlaysRef.current).forEach((overlay) => {
        try {
          overlay.remove();
        } catch (e) {
          /* ignore */
        }
      });
      layerOverlaysRef.current = {};
      panesCreatedRef.current.clear();
      return;
    }

    console.log('[SvgLayerManager] Creating/Updating layer overlays...');
    const currentOverlays = layerOverlaysRef.current;
    const newOverlays: Record<string, L.ImageOverlay> = {};

    // --- *** CORRECT GEOGRAPHIC BOUNDS CALCULATION *** ---
    let geographicBounds: L.LatLngBounds | null = null;
    try {
      // Use the svgToLatLng function with the provided mapConfig
      const topLeftLatLng = svgToLatLng(0, 0, mapConfig);
      const bottomRightLatLng = svgToLatLng(
        mapConfig.svgWidth,
        mapConfig.svgHeight,
        mapConfig,
      );
      // Leaflet bounds are (southWest, northEast)
      geographicBounds = L.latLngBounds(
        L.latLng(bottomRightLatLng.lat, topLeftLatLng.lng), // South-West corner
        L.latLng(topLeftLatLng.lat, bottomRightLatLng.lng), // North-East corner
      );
      console.log(
        `[SvgLayerManager] Calculated Geographic Bounds: ${geographicBounds.toBBoxString()}`,
      );
    } catch (boundsError) {
      console.error(
        '[SvgLayerManager] CRITICAL: Error calculating geographic bounds:',
        boundsError,
      );
      // Prevent proceeding without valid bounds
      return;
    }
    // --- *** END CORRECT BOUNDS CALCULATION *** ---

    // Define a sensible z-index order (adjust as needed)
    const layerOrder = [
      'altitude-layers', // Base layer (if applicable, otherwise lowest feature)
      'political',
      'climate',
      'rivers',
      'lakes',
      'icecaps', // Add any other known layers
      // Unknown layers will be added after these
    ];
    const zIndexBase = 400; // Ensure this is above the base map tile layer (usually 0 or 1) and below controls (often 1000+)

    const sortedLayerKeys = Object.keys(layers).sort((a, b) => {
      const indexA = layerOrder.indexOf(a);
      const indexB = layerOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB; // Sort known layers by order
      if (indexA !== -1) return -1; // Known layers come before unknown
      if (indexB !== -1) return 1; // Unknown layers come after known
      return a.localeCompare(b); // Sort unknown layers alphabetically
    });

    sortedLayerKeys.forEach((layerId, index) => {
      const layer = layers[layerId];
      if (!layer || !layer.svgElement) {
        console.warn(`[SvgLayerManager] Layer data or svgElement missing for ID: ${layerId}. Skipping.`);
        return; // Skip if layer data is incomplete
      }

      // Create pane if it doesn't exist
      const paneName = `svg-layer-${layerId}`;
      const layerIndexInOrder = layerOrder.indexOf(layerId);
      // Assign z-index based on order, place unknown layers sequentially on top
      const zIndex =
        layerIndexInOrder !== -1
          ? zIndexBase + layerIndexInOrder
          : zIndexBase + layerOrder.length + sortedLayerKeys.indexOf(layerId); // Ensure unknown layers get unique z-index

      if (!panesCreatedRef.current.has(paneName)) {
        const pane = map.createPane(paneName);
        pane.style.zIndex = String(zIndex);
        // Prevent pointer events on layers unless specifically needed
        pane.style.pointerEvents = 'none';
        panesCreatedRef.current.add(paneName);
        // console.log(`[SvgLayerManager] Created pane: ${paneName} with z-index: ${zIndex}`);
      }

      try {
        // Convert the specific layer's SVG element to a data URL
        const dataUrl = svgToDataUrl(layer.svgElement);
        if (!dataUrl || dataUrl === 'data:,') {
           throw new Error('Generated empty data URL');
        }

        // Check if overlay exists, update URL/Bounds if needed, otherwise create
        if (currentOverlays[layerId]) {
          // Only update URL/bounds if they could realistically change dynamically
          // currentOverlays[layerId].setUrl(dataUrl); // Usually not needed if SVG is static per load
          // currentOverlays[layerId].setBounds(geographicBounds);
          newOverlays[layerId] = currentOverlays[layerId];
        } else {
          const overlay = L.imageOverlay(dataUrl, geographicBounds!, {
            pane: paneName,
            interactive: false, // Typically false for static SVG layers
            opacity: 1.0, // Default opacity
            errorOverlayUrl:
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', // Simple placeholder
            // crossOrigin: true, // Add if needed for CORS issues with data URLs (unlikely)
          });
          overlay.on('error', () => console.error(`[SvgLayerManager] Leaflet failed to load image overlay for layer: ${layerId}`));
          newOverlays[layerId] = overlay;
          // console.log(`[SvgLayerManager] Created overlay for: ${layerId}`);
        }
      } catch (err) {
        console.error(
          `[SvgLayerManager] Error processing layer ${layerId}:`,
          err,
        );
        // Optionally remove the failed overlay if it exists in currentOverlays
        if (currentOverlays[layerId]) {
           try { currentOverlays[layerId].remove(); } catch(e) {/*ignore*/}
           delete currentOverlays[layerId]; // Remove from list to prevent reuse
        }
      }
    });

    // Remove overlays for layers that no longer exist in the `layers` prop
    Object.keys(currentOverlays).forEach((layerId) => {
      if (!newOverlays[layerId]) {
        try {
          currentOverlays[layerId].remove();
          // console.log(`[SvgLayerManager] Removed stale overlay for: ${layerId}`);
        } catch (e) {
          console.warn(`[SvgLayerManager] Error removing stale overlay ${layerId}:`, e);
        }
        // Optionally remove pane if no longer needed, though usually fine to keep
        // const paneName = `svg-layer-${layerId}`;
        // map.getPane(paneName)?.remove();
        // panesCreatedRef.current.delete(paneName);
      }
    });

    layerOverlaysRef.current = newOverlays;
    // Dependency array: Re-run if map, L, layers, or critical mapConfig parts change
  }, [map, L, layers, mapConfig]); // mapConfig reference change implies potential bounds change

  // Effect to add/remove overlays from map based on visibility prop
  useEffect(() => {
    if (!map || Object.keys(layerOverlaysRef.current).length === 0) {
      // Don't try to sync if map or overlays aren't ready
      return;
    }

    // console.log('[SvgLayerManager] Updating layer visibility:', visibility);
    Object.entries(visibility).forEach(([layerId, isVisible]) => {
      const overlay = layerOverlaysRef.current[layerId];
      if (overlay) {
        const mapHasLayer = map.hasLayer(overlay);
        if (isVisible && !mapHasLayer) {
          overlay.addTo(map);
          // console.log(`[SvgLayerManager] Added layer ${layerId} to map`);
        } else if (!isVisible && mapHasLayer) {
          overlay.remove();
          // console.log(`[SvgLayerManager] Removed layer ${layerId} from map`);
        }
      } else {
        // This might happen if visibility state updates before overlays are created
        // console.warn(`[SvgLayerManager] Overlay not found for layer ID: ${layerId} during visibility update.`);
      }
    });
    // Dependency: Re-run only when map instance or visibility state changes
  }, [map, visibility]);

  // Cleanup effect
  useEffect(() => {
    // Capture the current overlays for cleanup
    const overlaysToRemove = layerOverlaysRef.current;
    // Capture the current panes for cleanup (optional)
    // const panesToRemove = new Set(panesCreatedRef.current);

    return () => {
      console.log('[SvgLayerManager] Cleaning up overlays...');
      if (map) {
        // Remove all managed overlays on unmount or map change
        Object.values(overlaysToRemove).forEach((overlay) => {
          try {
            overlay.remove(); // remove() checks if it's on the map
          } catch (e) {
            console.warn('[SvgLayerManager] Error removing overlay during cleanup:', e);
          }
        });
        // Optionally remove panes
        // panesToRemove.forEach(paneName => {
        //   try { map.getPane(paneName)?.remove(); } catch(e) {/* ignore */}
        // });
      }
      // Clear refs
      layerOverlaysRef.current = {};
      panesCreatedRef.current.clear();
    };
  }, [map]); // Run cleanup when map instance changes (or component unmounts)

  // This component manages Leaflet layers directly, doesn't render React DOM
  // You could potentially render a status indicator based on isLoading/error here if needed
  // but typically UI feedback is handled elsewhere.
  return null;
};

export default SvgLayerManager;
