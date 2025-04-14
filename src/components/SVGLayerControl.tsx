// src/components/SvgLayerManager.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapConfig, SVGLayer } from '@/types';
import { svgToDataUrl } from '@/lib/SVGLayerParser';
import { svgToLatLng } from '@/lib/coordinates-system';

interface SvgLayerManagerProps {
  map: L.Map;
  L: typeof L;
  mapConfig: MapConfig;
  layers: Record<string, SVGLayer>;
  visibility: Record<string, boolean>;
  isLoading: boolean;
  error: string | null;
}

const SvgLayerManager: React.FC<SvgLayerManagerProps> = ({
  map,
  L,
  mapConfig,
  layers,
  visibility,
  isLoading,
  error,
}) => {
  const layerOverlaysRef = useRef<Record<string, L.ImageOverlay>>({});
  const panesCreatedRef = useRef<Set<string>>(new Set());

  // Effect to create/update Leaflet overlays
  useEffect(() => {
    // --- Strict MapConfig Checks ---
    if (
      !map ||
      !L ||
      Object.keys(layers).length === 0 ||
      !mapConfig ||
      typeof mapConfig.svgWidth !== 'number' ||
      typeof mapConfig.svgHeight !== 'number' ||
      typeof mapConfig.pixelsPerLatitude !== 'number' ||
      typeof mapConfig.pixelsPerLongitude !== 'number' ||
      typeof mapConfig.equatorY !== 'number' ||
      typeof mapConfig.primeMeridianX !== 'number'
      // Note: primeMeridianReferenceLng check removed as logs show it's 0
    ) {
      Object.values(layerOverlaysRef.current).forEach((overlay) =>
        overlay.remove(),
      );
      layerOverlaysRef.current = {};
      panesCreatedRef.current.clear();
      console.warn(
        'SvgLayerManager: Dependencies not met. Clearing overlays.',
      );
      return;
    }
    // --- End Checks ---

    console.log('SvgLayerManager: Creating/Updating layer overlays...');
    const currentOverlays = layerOverlaysRef.current;
    const newOverlays: Record<string, L.ImageOverlay> = {};

    let geographicBounds: L.LatLngBounds | null = null;
    try {
      // --- *** BOUNDS CALCULATION & LOGGING *** ---
      const topLeftLatLng = svgToLatLng(0, 0, mapConfig);
      const bottomRightLatLng = svgToLatLng(
        mapConfig.svgWidth,
        mapConfig.svgHeight,
        mapConfig,
      );
      geographicBounds = L.latLngBounds(
        L.latLng(bottomRightLatLng.lat, topLeftLatLng.lng), // South-West
        L.latLng(topLeftLatLng.lat, bottomRightLatLng.lng), // North-East
      );
      // *** COMPARE THIS LOG WITH LeafletLoader's BOUNDS LOG ***
      console.log(
        `SvgLayerManager: Calculated Geographic Bounds: ${geographicBounds.toBBoxString()}`,
      );
      // --- *** END BOUNDS CALCULATION *** ---
    } catch (boundsError) {
      console.error(
        'SvgLayerManager: Error calculating geographic bounds:',
        boundsError,
      );
      Object.values(layerOverlaysRef.current).forEach((overlay) =>
        overlay.remove(),
      );
      layerOverlaysRef.current = {};
      panesCreatedRef.current.clear();
      return;
    }

    // Define z-index order
    const layerOrder = [
      'altitude-layers', 'political', 'climate', 'rivers', 'lakes', 'icecaps',
    ];
    const zIndexBase = 400;

    const sortedLayerKeys = Object.keys(layers).sort((a, b) => {
      const indexA = layerOrder.indexOf(a);
      const indexB = layerOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });

    sortedLayerKeys.forEach((layerId) => {
      const layer = layers[layerId];
      if (!layer || !layer.svgElement) {
        console.warn(`Layer data or svgElement missing for ID: ${layerId}`);
        return;
      }

      // Create pane
      const paneName = `svg-layer-${layerId}`;
      const layerIndex = layerOrder.indexOf(layerId);
      const zIndex =
        layerIndex !== -1
          ? zIndexBase + layerIndex
          : zIndexBase + layerOrder.length + sortedLayerKeys.indexOf(layerId);

      if (!panesCreatedRef.current.has(paneName)) {
        try {
          const pane = map.createPane(paneName);
          pane.style.zIndex = String(zIndex);
          pane.style.pointerEvents = 'none';
          // *** Optional: Add temporary background to pane for debugging ***
          // pane.style.backgroundColor = 'rgba(255, 0, 255, 0.1)'; // Light magenta
          panesCreatedRef.current.add(paneName);
          // console.log(`Created pane: ${paneName} with z-index: ${zIndex}`);
        } catch (paneError) {
          console.error(`Error creating pane ${paneName}:`, paneError);
          return;
        }
      }

      try {
        // --- *** DATA URL GENERATION & LOGGING *** ---
        const dataUrl = svgToDataUrl(layer.svgElement);
        if (!dataUrl || dataUrl.length < 100) { // Basic check for empty/trivial URL
            console.error(`SvgLayerManager: Generated invalid data URL for ${layerId}. Length: ${dataUrl?.length}`);
            return; // Skip this layer if URL seems bad
        }
        // Log the start of the URL for inspection
        console.log(`SvgLayerManager: Data URL for ${layerId} starts with:`, dataUrl.substring(0, 150) + '...');
        // *** For deeper debugging, log the full URL for one layer: ***
        // if (layerId === 'political') { console.log(`FULL Data URL for ${layerId}:`, dataUrl); }
        // --- *** END DATA URL LOGGING *** ---


        // Create or update overlay
        if (currentOverlays[layerId]) {
          // Update bounds if they differ significantly
          if (!currentOverlays[layerId].getBounds().equals(geographicBounds!, 1e-5)) {
            console.log(`Updating bounds for overlay: ${layerId}`);
            currentOverlays[layerId].setBounds(geographicBounds!);
          }
          // Update URL only if necessary (usually not for static layers)
          // if (currentOverlays[layerId].getUrl() !== dataUrl) {
          //    console.log(`Updating URL for overlay: ${layerId}`);
          //    currentOverlays[layerId].setUrl(dataUrl);
          // }
          newOverlays[layerId] = currentOverlays[layerId];
        } else {
          const overlay = L.imageOverlay(dataUrl, geographicBounds!, {
            pane: paneName,
            interactive: false,
            opacity: 1.0, // Start fully opaque
            errorOverlayUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
          });

          // *** ADD TEMPORARY BORDER TO OVERLAY ELEMENT FOR DEBUGGING ***
          overlay.on('load', () => {
             if (overlay.getElement()) {
                overlay.getElement()!.style.border = '2px dashed red'; // Add visible border
                overlay.getElement()!.style.boxSizing = 'border-box';
             }
          });
          // **********************************************************

          newOverlays[layerId] = overlay;
          // console.log(`Created overlay for: ${layerId}`);
        }
      } catch (err) {
        console.error(`Error processing layer ${layerId} (data URL or overlay creation):`, err);
      }
    });

    // Remove stale overlays
    Object.keys(currentOverlays).forEach((layerId) => {
      if (!newOverlays[layerId]) {
        currentOverlays[layerId].remove();
        // console.log(`Removed stale overlay for: ${layerId}`);
      }
    });

    layerOverlaysRef.current = newOverlays;
  }, [map, L, layers, mapConfig]);

  // Effect to sync visibility (NO CHANGES)
  useEffect(() => {
    if (!map || Object.keys(layerOverlaysRef.current).length === 0) return;

    // console.log('SvgLayerManager: Updating layer visibility:', visibility);
    Object.entries(visibility).forEach(([layerId, isVisible]) => {
      const overlay = layerOverlaysRef.current[layerId];
      if (overlay) {
        const mapHasLayer = map.hasLayer(overlay);
        if (isVisible && !mapHasLayer) {
          overlay.addTo(map);
          // console.log(`Added layer ${layerId} to map`);
        } else if (!isVisible && mapHasLayer) {
          overlay.remove();
          // console.log(`Removed layer ${layerId} from map`);
        }
      }
    });
  }, [map, visibility]);

  // Cleanup effect (NO CHANGES)
  useEffect(() => {
    const overlaysToRemove = layerOverlaysRef.current;
    return () => {
      if (map) {
        Object.values(overlaysToRemove).forEach((overlay) => {
          overlay.remove();
        });
      }
      layerOverlaysRef.current = {};
      panesCreatedRef.current.clear();
    };
  }, [map]);

  return null;
};

export default SvgLayerManager;
