// src/components/SVGLayerControl.tsx
'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import L from 'leaflet'; // Import L directly
import { MapConfig } from '@/types';
import { SVGLayer } from '@/types/svg-types'; // Assuming SVGLayer includes { id, name, svgElement }
import { parseSVGLayers, svgToDataUrl } from '@/lib/SVGLayerParser';
import { showToast } from '@/lib/Toast';
import { svgToLatLng } from '@/lib/coordinates-system'; // <-- Import for bounds calculation

interface SVGLayerControlProps {
  map: L.Map; // Use L.Map type
  L: typeof L; // Use typeof L type
  mapConfig: MapConfig;
  position?: L.ControlPosition; // Use L.ControlPosition type
  collapsed?: boolean;
  // Optional: Pass initial visibility state from parent if needed
  initialVisibility?: Record<string, boolean>;
}

const SVGLayerControl: React.FC<SVGLayerControlProps> = ({
  map,
  L,
  mapConfig,
  position = 'topright',
  collapsed = false,
  initialVisibility, // Use if provided
}) => {
  // State for parsed SVG layers
  const [layers, setLayers] = useState<Record<string, SVGLayer>>({});

  // State for layer visibility - Use initialVisibility prop or defaults
  const [layerVisibility, setLayerVisibility] = useState<
    Record<string, boolean>
  >(
    initialVisibility || {
      // Default visibility (adjust as needed)
      political: true,
      climate: false,
      lakes: false,
      rivers: false,
      'altitude-layers': false,
      // Add other layers with default false if desired
    },
  );

  // Refs for Leaflet overlays and the control instance
  const layerOverlaysRef = useRef<Record<string, L.ImageOverlay>>({});
  const controlRef = useRef<L.Control | null>(null);
  const panesCreatedRef = useRef<Set<string>>(new Set()); // Track created panes

  // State for loading and error handling during SVG fetch/parse
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Effect 1: Fetch and Parse SVG ---
  useEffect(() => {
    const fetchAndParseSVG = async () => {
      if (!mapConfig.masterMapPath) {
        setError('Master SVG path is not configured.');
        console.error('SVGLayerControl: Master SVG path missing in mapConfig.');
        return;
      }

      // Reset state for potential re-fetch
      setIsLoading(true);
      setError(null);
      setLayers({}); // Clear previous layers
      console.log(
        `SVGLayerControl: Fetching SVG from ${mapConfig.masterMapPath}`,
      );

      try {
        const response = await fetch(mapConfig.masterMapPath);
        if (!response.ok) {
          throw new Error(
            `Failed to load SVG: ${response.status} ${response.statusText}`,
          );
        }
        const svgContent = await response.text();

        console.log('SVGLayerControl: Parsing SVG layers...');
        const parsedLayers = await parseSVGLayers(svgContent);
        if (Object.keys(parsedLayers).length === 0) {
          console.warn('SVGLayerControl: No layers found in SVG.');
          showToast('No layers found in SVG file.', 'warning');
        } else {
          console.log(
            'SVGLayerControl: Parsed layers:',
            Object.keys(parsedLayers),
          );
        }
        setLayers(parsedLayers);
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Unknown error loading SVG';
        console.error('SVGLayerControl: Error fetching or parsing SVG:', err);
        setError(errorMsg);
        showToast(`Error loading SVG layers: ${errorMsg}`, 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndParseSVG();
  }, [mapConfig.masterMapPath]); // Re-run only if the SVG path changes

  // --- Effect 2: Create/Update Leaflet Overlays ---
  useEffect(() => {
    // Ensure map, L, layers, and necessary mapConfig properties are available
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
    ) {
      // Clear existing overlays if dependencies are not met
      Object.values(layerOverlaysRef.current).forEach((overlay) =>
        overlay.remove(),
      );
      layerOverlaysRef.current = {};
      panesCreatedRef.current.clear();
      return;
    }

    console.log('SVGLayerControl: Creating/Updating layer overlays...');
    const currentOverlays = layerOverlaysRef.current;
    const newOverlays: Record<string, L.ImageOverlay> = {};

    try {
      // --- CORRECT GEOGRAPHIC BOUNDS CALCULATION ---
      const topLeftLatLng = svgToLatLng(0, 0, mapConfig);
      const bottomRightLatLng = svgToLatLng(
        mapConfig.svgWidth,
        mapConfig.svgHeight,
        mapConfig,
      );
      const geographicBounds = L.latLngBounds(
        L.latLng(bottomRightLatLng.lat, topLeftLatLng.lng), // South-West
        L.latLng(topLeftLatLng.lat, bottomRightLatLng.lng), // North-East
      );
      console.log(
        `SVGLayerControl: Using Geographic Bounds: ${geographicBounds.toBBoxString()}`,
      );
      // --- END BOUNDS CALCULATION ---

      // Define a sensible z-index order (adjust as needed)
      const layerOrder = [
        'altitude-layers',
        'political',
        'climate',
        'rivers',
        'lakes',
      ];
      const zIndexBase = 400; // Base z-index for these overlays

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
          return; // Skip incomplete layers
        }

        // Create pane if it doesn't exist
        const paneName = `svg-layer-${layerId}`;
        const layerIndex = layerOrder.indexOf(layerId);
        const zIndex =
          layerIndex !== -1
            ? zIndexBase + layerIndex
            : zIndexBase +
              layerOrder.length +
              sortedLayerKeys.indexOf(layerId); // Place unknown layers on top

        if (!panesCreatedRef.current.has(paneName)) {
          const pane = map.createPane(paneName);
          pane.style.zIndex = String(zIndex);
          pane.style.pointerEvents = 'none'; // Disable interaction on overlays
          panesCreatedRef.current.add(paneName);
          // console.log(`Created pane: ${paneName} with z-index: ${zIndex}`);
        }

        // Convert SVG element to data URL
        const dataUrl = svgToDataUrl(layer.svgElement);

        // Reuse existing overlay or create new one
        if (currentOverlays[layerId]) {
          // Optional: Update URL if SVG could change, though unlikely here
          // currentOverlays[layerId].setUrl(dataUrl);
          // Optional: Update bounds if they could change
          // currentOverlays[layerId].setBounds(geographicBounds);
          newOverlays[layerId] = currentOverlays[layerId];
        } else {
          const overlay = L.imageOverlay(dataUrl, geographicBounds, {
            pane: paneName,
            interactive: false,
            opacity: 1.0, // Start fully opaque
            // crossOrigin: true, // Enable if needed
            errorOverlayUrl:
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', // Placeholder for load errors
          });
          newOverlays[layerId] = overlay;
          // console.log(`Created overlay for: ${layerId}`);
        }
      });

      // Remove overlays for layers that no longer exist in the `layers` state
      Object.keys(currentOverlays).forEach((layerId) => {
        if (!newOverlays[layerId]) {
          currentOverlays[layerId].remove();
          // Optionally remove pane if desired, but usually fine to keep
          // map.getPane(`svg-layer-${layerId}`)?.remove();
          // panesCreatedRef.current.delete(`svg-layer-${layerId}`);
          console.log(`Removed stale overlay for: ${layerId}`);
        }
      });

      layerOverlaysRef.current = newOverlays;
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : 'Unknown error creating overlays';
      console.error('SVGLayerControl: Error creating/updating overlays:', err);
      setError(errorMsg);
      showToast(`Error creating overlays: ${errorMsg}`, 'error');
    }

    // Dependency array: Re-run when map, L, layers, or critical mapConfig parts change
  }, [map, L, layers, mapConfig]); // Assuming mapConfig object reference changes if critical props change

  // --- Effect 3: Create or Update the Leaflet Control UI ---
  // Use useCallback to memoize the control creation function
  const createOrUpdateControl = useCallback(() => {
    if (!map || !L || Object.keys(layers).length === 0) {
      // If dependencies aren't ready, remove existing control
      if (controlRef.current) {
        map.removeControl(controlRef.current);
        controlRef.current = null;
      }
      return;
    }

    // Define the layer keys to actually show in the control
    // You might want to filter `layers` based on some criteria here
    const controlLayerKeys = Object.keys(layers).filter(
      (id) => layers[id] && layers[id].name, // Example filter: only layers with names
    );

    // If a control already exists, potentially update its content (more complex)
    // For simplicity, we'll remove and recreate if layers change significantly.
    // If only visibility changes, the control checkboxes update via the state change.
    if (controlRef.current) {
      // Optional: Add logic here to update the existing control's content
      // if the `controlLayerKeys` change, instead of removing/recreating.
      // This is more complex and involves manipulating the control's DOM directly.
      // For now, we assume the control structure is static once created based on initial layers.
      return; // Don't recreate if it exists
    }

    console.log('SVGLayerControl: Creating Leaflet control UI...');

    try {
      const LayerControl = L.Control.extend({
        options: {
          position: position,
        },
        onAdd: function () {
          // Main container
          const container = L.DomUtil.create(
            'div',
            'leaflet-control-layers leaflet-control leaflet-control-layers-expanded svg-layer-control', // Added '-expanded' initially if not collapsed
          );
          // Basic styling (consider moving to CSS)
          container.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
          container.style.padding = '6px 10px';
          container.style.borderRadius = '5px';
          container.style.border = '1px solid #ccc';
          container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
          container.style.maxHeight = '400px'; // Prevent excessive height
          container.style.overflowY = 'auto'; // Allow scrolling
          container.style.fontSize = '13px';

          // Title and Toggle Button
          const titleDiv = L.DomUtil.create('div', '', container);
          titleDiv.style.fontWeight = 'bold';
          titleDiv.style.marginBottom = '8px';
          titleDiv.style.paddingBottom = '5px';
          titleDiv.style.borderBottom = '1px solid #ddd';
          titleDiv.style.display = 'flex';
          titleDiv.style.justifyContent = 'space-between';
          titleDiv.style.alignItems = 'center';
          titleDiv.innerHTML = '<span>Map Layers</span>';

          const toggleButton = L.DomUtil.create('span', '', titleDiv);
          toggleButton.innerHTML = collapsed ? '&#9660;' : '&#9650;'; // Down/Up arrows
          toggleButton.style.cursor = 'pointer';
          toggleButton.style.fontSize = '16px';
          toggleButton.style.marginLeft = '10px';

          // Layer items container
          const form = L.DomUtil.create('form', 'leaflet-control-layers-list', container);
          form.style.display = collapsed ? 'none' : 'block'; // Initial state

          // Toggle functionality
          L.DomEvent.on(toggleButton, 'click', (ev) => {
            L.DomEvent.stop(ev); // Prevent map click
            const isHidden = form.style.display === 'none';
            form.style.display = isHidden ? 'block' : 'none';
            toggleButton.innerHTML = isHidden ? '&#9650;' : '&#9660;';
            // Toggle expanded class on main container if needed for CSS
            if (isHidden) {
              L.DomUtil.addClass(container, 'leaflet-control-layers-expanded');
            } else {
              L.DomUtil.removeClass(container, 'leaflet-control-layers-expanded');
            }
          });

          // Group layers (optional, example grouping)
          const layerGroups: Record<string, string[]> = {
            // Define groups based on your layer IDs/names
            'Base': ['political', 'climate'],
            'Features': ['lakes', 'rivers', 'altitude-layers'],
            // Add an 'Other' group for uncategorized layers
          };
          const groupedKeys: Record<string, string[]> = {};
          const otherKeys: string[] = [];

          controlLayerKeys.forEach(key => {
             let foundGroup = false;
             for (const groupName in layerGroups) {
                if (layerGroups[groupName].includes(key)) {
                   if (!groupedKeys[groupName]) groupedKeys[groupName] = [];
                   groupedKeys[groupName].push(key);
                   foundGroup = true;
                   break;
                }
             }
             if (!foundGroup) otherKeys.push(key);
          });
          if (otherKeys.length > 0) groupedKeys['Other'] = otherKeys;


          // Add layer items to the form
          Object.entries(groupedKeys).forEach(([groupName, groupLayerIds]) => {
             if (groupLayerIds.length === 0) return; // Skip empty groups

             const groupDiv = L.DomUtil.create('div', 'leaflet-control-layers-group', form);
             groupDiv.style.marginBottom = '5px';

             const groupTitle = L.DomUtil.create('span', 'leaflet-control-layers-group-name', groupDiv);
             groupTitle.textContent = groupName;
             groupTitle.style.fontWeight = 'bold';
             groupTitle.style.display = 'block';
             groupTitle.style.marginBottom = '3px';

             groupLayerIds.forEach((layerId) => {
                const layerInfo = layers[layerId];
                const name = layerInfo.name
                  ? layerInfo.name.charAt(0).toUpperCase() +
                    layerInfo.name.slice(1)
                  : layerId; // Fallback to ID if name is missing

                const layerDiv = L.DomUtil.create('label', 'leaflet-control-layers-label', groupDiv);
                layerDiv.style.display = 'flex';
                layerDiv.style.alignItems = 'center';
                layerDiv.style.marginLeft = '10px'; // Indent items
                layerDiv.style.cursor = 'pointer';
                layerDiv.style.marginBottom = '2px';

                const checkbox = L.DomUtil.create('input', 'leaflet-control-layers-selector', layerDiv);
                checkbox.type = 'checkbox';
                checkbox.checked = layerVisibility[layerId] ?? false; // Use current visibility state
                checkbox.style.marginRight = '6px';
                checkbox.style.cursor = 'pointer';

                const nameSpan = L.DomUtil.create('span', '', layerDiv);
                nameSpan.textContent = ` ${name}`; // Add space before name

                // --- IMPORTANT: Update State on Change ---
                L.DomEvent.on(checkbox, 'change', (e) => {
                  const target = e.target as HTMLInputElement;
                  const isVisible = target.checked;
                  // Update the central visibility state
                  setLayerVisibility((prev) => ({
                    ...prev,
                    [layerId]: isVisible,
                  }));
                  // The actual map layer add/remove is handled by Effect 4
                });
             });
          });


          // Prevent map interaction when clicking on the control
          L.DomEvent.disableClickPropagation(container);
          L.DomEvent.disableScrollPropagation(container); // Prevent map zoom

          return container;
        },

        onRemove: function () {
          // Clean up any event listeners added specifically for the control UI if necessary
          console.log('SVGLayerControl: Control UI removed.');
        },
      });

      const controlInstance = new LayerControl();
      map.addControl(controlInstance);
      controlRef.current = controlInstance; // Store reference
      showToast('Layer control added', 'info', 1500);
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : 'Unknown error creating control';
      console.error('SVGLayerControl: Error creating control UI:', err);
      setError(errorMsg);
      showToast(`Error creating layer control: ${errorMsg}`, 'error');
    }
    // Dependencies: Recreate control if map, L, or the fundamental set of layers changes
  }, [map, L, layers, position, collapsed]); // Add other options if they should trigger recreation

  // Run the control creation/update function when its dependencies change
  useEffect(() => {
    createOrUpdateControl();
  }, [createOrUpdateControl]);

  // --- Effect 4: Sync Leaflet Overlays with Visibility State ---
  useEffect(() => {
    if (!map || Object.keys(layerOverlaysRef.current).length === 0) {
      // Don't try to sync if map or overlays aren't ready
      return;
    }

    // console.log('SVGLayerControl: Syncing overlay visibility:', layerVisibility);
    Object.entries(layerVisibility).forEach(([layerId, isVisible]) => {
      const overlay = layerOverlaysRef.current[layerId];
      if (overlay) {
        const mapHasLayer = map.hasLayer(overlay);
        if (isVisible && !mapHasLayer) {
          overlay.addTo(map);
          // console.log(`Added overlay ${layerId} to map`);
        } else if (!isVisible && mapHasLayer) {
          overlay.remove();
          // console.log(`Removed overlay ${layerId} from map`);
        }
      } else {
        // This might happen briefly if visibility updates before overlays ref is populated
        // console.warn(`Sync: Overlay not found for layer ID: ${layerId}`);
      }
    });
    // Dependency: Only run when visibility state or the map instance changes
  }, [map, layerVisibility]);

  // --- Effect 5: Cleanup ---
  useEffect(() => {
    // Capture refs in closure for cleanup function
    const controlToRemove = controlRef.current;
    const overlaysToRemove = layerOverlaysRef.current;
    const panesToRemove = new Set(panesCreatedRef.current); // Copy set

    return () => {
      console.log('SVGLayerControl: Cleaning up...');
      if (map) {
        // Remove control
        if (controlToRemove) {
          try {
            map.removeControl(controlToRemove);
          } catch (e) {
            console.warn('SVGLayerControl: Error removing control:', e);
          }
        }
        // Remove overlays
        Object.values(overlaysToRemove).forEach((overlay) => {
          try {
            overlay.remove(); // remove() handles check if it's on map
          } catch (e) {
            console.warn('SVGLayerControl: Error removing overlay:', e);
          }
        });
        // Remove panes (optional, usually harmless to leave)
        // panesToRemove.forEach(paneName => {
        //   const pane = map.getPane(paneName);
        //   if (pane) {
        //     try { pane.remove(); } catch(e) { console.warn(`Error removing pane ${paneName}:`, e); }
        //   }
        // });
      }
      // Clear refs after cleanup
      controlRef.current = null;
      layerOverlaysRef.current = {};
      panesCreatedRef.current.clear();
      console.log('SVGLayerControl: Cleanup complete.');
    };
    // Dependency: Run cleanup when map instance changes or component unmounts
  }, [map]);

  // This component manages Leaflet layers and controls directly
  // It doesn't render any React DOM elements itself.
  // Loading/error state could potentially render an indicator elsewhere if needed.
  if (isLoading) {
    // Optionally render a loading indicator or use toast
    // console.log("SVGLayerControl: Loading SVG...");
  }
  if (error) {
    // Optionally render an error message or use toast
    // console.error("SVGLayerControl: Error state:", error);
  }

  return null;
};

export default SVGLayerControl;
