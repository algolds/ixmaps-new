// src/components/ControlPanel.tsx
'use client';

import React, { useState, useEffect, useRef, RefObject } from 'react';
import { MapConfig } from '@/types'; // Assuming types are in '@/types'
import { SVGLayerControlRef } from './SVGLayerControl'; // Assuming this type/component exists

// Define props expected by the Control Panel based on MapComponent
interface ControlPanelProps {
  map: any;
  L: any;
  mapConfig: MapConfig; // Make mapConfig required if always needed
  layerControlRef?: RefObject<SVGLayerControlRef | null>; // Optional ref
  // Toggle handlers passed from MapComponent
  onToggleGrid: (visible: boolean) => void;
  onToggleCountryLabels: (visible: boolean) => void;
  onToggleCoordinates: (visible: boolean) => void;
  onTogglePrimeMeridian: (visible: boolean) => void; // For visibility of PM info/elements
  // Add other necessary props here, e.g., for specific layer toggles if not handled by SVGLayerControlRef
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  map,
  L,
  mapConfig,
  layerControlRef,
  onToggleGrid,
  onToggleCountryLabels,
  onToggleCoordinates,
  onTogglePrimeMeridian,
}) => {
  // --- State ---
  const [collapsed, setCollapsed] = useState(false); // Panel collapsed state
  const [activeTab, setActiveTab] = useState<'display' | 'layers'>('display'); // Active tab
  // State for checkbox values (initialize from props/config where applicable)
  const [showGrid, setShowGrid] = useState(true);
  const [showCountryLabels, setShowCountryLabels] = useState(
    mapConfig.showCountryLabels
  );
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [showPrimeMeridian, setShowPrimeMeridian] = useState(true); // Default PM info visibility
  // State to track layer visibility (synced from SVGLayerControl if used)
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});

  const controlRef = useRef<any>(null); // Ref to store the Leaflet control instance
  const isControlAdded = useRef(false); // Ref to track if control is added

  // --- Sync Layer Visibility from SVGLayerControl ---
  useEffect(() => {
    if (layerControlRef?.current) {
      const currentVisibility = layerControlRef.current.getVisibility();
      // Filter out layers you don't want in the panel if necessary
      // e.g., delete currentVisibility['altitude-layers'];
      setLayerVisibility(currentVisibility);
      console.log('ControlPanel: Synced layer visibility from SVGLayerControl.');
    }
    // Add a listener if SVGLayerControl emits events on visibility change
    // Example: layerControlRef.current?.on('visibilitychange', handleVisibilityChange);
    // return () => layerControlRef.current?.off('visibilitychange', handleVisibilityChange);
  }, [layerControlRef]); // Run when ref becomes available

  // --- Handle Layer Toggles ---
  const handleLayerToggle = (layerId: string, checked: boolean) => {
    // Update local state immediately for responsiveness
    setLayerVisibility((prev) => ({ ...prev, [layerId]: checked }));

    // Use the layerControlRef to toggle the actual layer
    if (layerControlRef?.current) {
      layerControlRef.current.toggleLayer(layerId, checked);
      console.log(`ControlPanel: Toggled layer '${layerId}' to ${checked}`);

      // --- Special handling for political/altitude layers (Example) ---
      // if (layerId === 'political') {
      //   const shouldShowAltitude = !checked;
      //   // Use timeout if needed to ensure order of operations
      //   setTimeout(() => {
      //     layerControlRef.current?.toggleLayer('altitude-layers', shouldShowAltitude);
      //     console.log(`ControlPanel: Set altitude-layers visibility to ${shouldShowAltitude}`);
      //   }, 50);
      // }
      // --- End Special Handling ---

    } else {
      console.warn('ControlPanel: SVGLayerControl reference not available.');
    }
  };

  // --- Create and Manage Leaflet Control ---
  useEffect(() => {
    if (!map || !L || isControlAdded.current) return; // Only add once

    // Define the custom Leaflet control
    const IxMapControl = L.Control.extend({
      options: {
        position: 'topright', // Standard Leaflet control position
      },

      onAdd: function (mapInstance: any) {
        // Create the main container
        const container = L.DomUtil.create('div', 'ixmap-control-panel leaflet-control leaflet-bar'); // Add Leaflet classes
        container.setAttribute('aria-haspopup', 'true'); // Accessibility

        // Prevent map interaction when interacting with the control
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        // --- Toggle Button ---
        const toggleButton = L.DomUtil.create('a', 'ixmap-control-toggle', container);
        toggleButton.href = '#';
        toggleButton.title = 'Toggle Controls';
        toggleButton.role = 'button';
        toggleButton.innerHTML = '≪'; // Initial state (expanded)
        toggleButton.onclick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setCollapsed(prev => !prev); // Update React state
        };

        // --- Content Container (initially hidden if collapsed starts true) ---
        const content = L.DomUtil.create('div', 'ixmap-control-content', container);
        if (collapsed) L.DomUtil.addClass(content, 'hidden');

        // --- Title ---
        const title = L.DomUtil.create('div', 'ixmap-control-title', content);
        title.innerHTML = 'Controls';

        // --- Tab Navigation ---
        const tabNav = L.DomUtil.create('div', 'ixmap-tab-navigation', content);
        const displayTab = L.DomUtil.create('button', 'ixmap-tab', tabNav);
        displayTab.innerHTML = 'Display';
        displayTab.onclick = () => setActiveTab('display');

        const layersTab = L.DomUtil.create('button', 'ixmap-tab', tabNav);
        layersTab.innerHTML = 'Layers';
        layersTab.onclick = () => setActiveTab('layers');

        // --- Tab Content Areas ---
        const displayContent = L.DomUtil.create('div', 'ixmap-tab-content ixmap-display-content', content);
        const layersContent = L.DomUtil.create('div', 'ixmap-tab-content ixmap-layers-content', content);

        // --- Populate Display Tab ---
        const displaySection = L.DomUtil.create('div', 'ixmap-control-section', displayContent);

        createControlItem(displaySection, 'Show Grid', 'grid-toggle', showGrid, (checked) => {
          setShowGrid(checked); onToggleGrid(checked);
        });
        createControlItem(displaySection, 'Show Labels', 'country-labels-toggle', showCountryLabels, (checked) => {
          setShowCountryLabels(checked); onToggleCountryLabels(checked);
        });
        createControlItem(displaySection, 'Show Coordinates', 'coords-toggle', showCoordinates, (checked) => {
          setShowCoordinates(checked); onToggleCoordinates(checked);
        });
        createControlItem(displaySection, 'Show Prime Meridian', 'pm-toggle', showPrimeMeridian, (checked) => {
          setShowPrimeMeridian(checked); onTogglePrimeMeridian(checked);
        });

        // --- Populate Layers Tab ---
        // Example layer grouping - adjust as needed
        const layerGroups: Record<string, string[]> = {
          'Base Layers': ['political', 'climate'], // Example IDs
          'Features': ['lakes', 'rivers'],      // Example IDs
          // Add more groups and layer IDs based on your SVGLayerControl setup
        };

        Object.entries(layerGroups).forEach(([groupName, layerIds]) => {
          // Check if any layer in the group actually exists in the synced state
          const relevantLayerIds = layerIds.filter(id => layerVisibility.hasOwnProperty(id));
          if (relevantLayerIds.length === 0) return; // Skip group if no relevant layers

          const groupContainer = L.DomUtil.create('div', 'ixmap-layer-group', layersContent);
          const groupTitle = L.DomUtil.create('div', 'ixmap-group-title', groupContainer);
          groupTitle.innerHTML = groupName;

          relevantLayerIds.forEach(layerId => {
            // Attempt to get a friendlier name (or use ID)
            const layerName = layerId.charAt(0).toUpperCase() + layerId.slice(1).replace(/-/g, ' ');
            createControlItem(
              groupContainer,
              layerName,
              `layer-${layerId}-toggle`, // Unique ID for the checkbox
              layerVisibility[layerId] || false, // Use synced state
              (checked) => { handleLayerToggle(layerId, checked); }
            );
          });
        });

        // Initial setup of active tab/content visibility
        this.updateControlDisplay(container); // Call helper to set initial state

        return container;
      },

      onRemove: function (mapInstance: any) {
        // Cleanup if needed, though React unmount handles main cleanup
        console.log('IxMapControl removed from map.');
      },

      // Helper function to update display based on React state
      updateControlDisplay: function(container: HTMLElement) {
        const content = container.querySelector<HTMLElement>('.ixmap-control-content');
        const toggleButton = container.querySelector<HTMLElement>('.ixmap-control-toggle');
        const displayTab = container.querySelectorAll<HTMLElement>('.ixmap-tab')[0];
        const layersTab = container.querySelectorAll<HTMLElement>('.ixmap-tab')[1];
        const displayContent = container.querySelector<HTMLElement>('.ixmap-display-content');
        const layersContent = container.querySelector<HTMLElement>('.ixmap-layers-content');

        // Update collapsed state
        if (toggleButton) toggleButton.innerHTML = collapsed ? '⚙️' : '≪'; // Use cog icon or arrows
        if (content) content.style.display = collapsed ? 'none' : '';
        L.DomUtil.removeClass(container, collapsed ? 'expanded' : 'collapsed');
        L.DomUtil.addClass(container, collapsed ? 'collapsed' : 'expanded');


        // Update active tab styles and content visibility (only if not collapsed)
        if (!collapsed) {
            if (displayTab && layersTab && displayContent && layersContent) {
                const isDisplayActive = activeTab === 'display';
                displayTab.classList.toggle('active', isDisplayActive);
                layersTab.classList.toggle('active', !isDisplayActive);
                displayContent.style.display = isDisplayActive ? '' : 'none';
                layersContent.style.display = !isDisplayActive ? '' : 'none';
            }

            // Update checkbox states within the control
            const updateCheckbox = (id: string, checked: boolean) => {
                const checkbox = container.querySelector<HTMLInputElement>(`#${id}`);
                if (checkbox) checkbox.checked = checked;
            };

            updateCheckbox('grid-toggle', showGrid);
            updateCheckbox('country-labels-toggle', showCountryLabels);
            updateCheckbox('coords-toggle', showCoordinates);
            updateCheckbox('pm-toggle', showPrimeMeridian);

            Object.keys(layerVisibility).forEach(layerId => {
                updateCheckbox(`layer-${layerId}-toggle`, layerVisibility[layerId] || false);
            });
        }
      }
    });

    // Helper function to create control items (checkbox + label)
    function createControlItem(
      container: HTMLElement,
      labelText: string,
      checkboxId: string, // Unique ID for the checkbox
      checked: boolean,
      onChange: (checked: boolean) => void
    ) {
      const itemContainer = L.DomUtil.create('div', 'ixmap-control-item', container);
      const checkbox = L.DomUtil.create('input', '', itemContainer);
      checkbox.type = 'checkbox';
      checkbox.id = checkboxId; // Assign unique ID
      checkbox.checked = checked;
      checkbox.onchange = (e: Event) => onChange((e.target as HTMLInputElement).checked);

      const label = L.DomUtil.create('label', '', itemContainer);
      label.htmlFor = checkboxId; // Associate label with checkbox
      label.textContent = labelText;

      return itemContainer;
    }

    // Instantiate and add the control
    const newControl = new IxMapControl();
    controlRef.current = newControl; // Store instance in ref
    map.addControl(newControl);
    isControlAdded.current = true; // Mark as added
    console.log('ControlPanel: Leaflet control added to map.');

    // Cleanup function for this effect
    return () => {
      if (map && controlRef.current) {
        console.log('ControlPanel: Removing Leaflet control from map.');
        map.removeControl(controlRef.current);
        controlRef.current = null;
      }
      isControlAdded.current = false;
    };
  }, [map, L]); // Only run when map and L are available

  // --- Effect to Update Control Display When State Changes ---
  useEffect(() => {
    if (controlRef.current && typeof controlRef.current.updateControlDisplay === 'function') {
      // Call the update method on the control instance when React state changes
      controlRef.current.updateControlDisplay(controlRef.current.getContainer());
    }
  }, [collapsed, activeTab, showGrid, showCountryLabels, showCoordinates, showPrimeMeridian, layerVisibility]);

  // This React component manages the Leaflet control but renders null itself
  return null;
};

export default ControlPanel;
