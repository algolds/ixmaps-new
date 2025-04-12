// src/components/ControlPanel.tsx
'use client';

import React, { useState, useEffect, useRef, RefObject } from 'react';
import { MapConfig } from '@/types'; // Assuming types are in '@/types'
import { SVGLayerControlRef } from './SVGLayerControl'; // Assuming this type/component exists

// Define props expected by the Control Panel based on MapComponent
interface ControlPanelProps {
  map: any;
  L: any;
  mapConfig: MapConfig; // Make mapConfig required
  layerControlRef?: RefObject<SVGLayerControlRef | null>; // Optional ref
  // Toggle handlers passed from MapComponent
  onToggleGrid: (visible: boolean) => void;
  onToggleCountryLabels: (visible: boolean) => void;
  onToggleCoordinates: (visible: boolean) => void;
  onTogglePrimeMeridian: (visible: boolean) => void; // For visibility of PM info/elements
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
  const [showGrid, setShowGrid] = useState(true); // Default grid visibility
  const [showCountryLabels, setShowCountryLabels] = useState(
    mapConfig.showCountryLabels // Initialize from config
  );
  const [showCoordinates, setShowCoordinates] = useState(true); // Default coords visibility
  const [showPrimeMeridian, setShowPrimeMeridian] = useState(true); // Default PM info visibility
  // State to track layer visibility (synced from SVGLayerControl if used)
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});

  const controlRef = useRef<any>(null); // Ref to store the Leaflet control instance
  const isControlAdded = useRef(false); // Ref to track if control is added

  // --- Sync Layer Visibility from SVGLayerControl ---
  useEffect(() => {
    if (layerControlRef?.current) {
      const currentVisibility = layerControlRef.current.getVisibility();
      // Example: Filter out layers you might manage differently
      // delete currentVisibility['altitude-layers'];
      setLayerVisibility(currentVisibility);
      console.log('ControlPanel: Synced layer visibility from SVGLayerControl.');
      // TODO: Add listener if SVGLayerControl emits events on visibility change
      // layerControlRef.current?.on('visibilitychange', handleVisibilityChange);
      // return () => layerControlRef.current?.off('visibilitychange', handleVisibilityChange);
    }
  }, [layerControlRef]); // Run when ref becomes available

  // --- Handle Layer Toggles ---
  const handleLayerToggle = (layerId: string, checked: boolean) => {
    setLayerVisibility((prev) => ({ ...prev, [layerId]: checked }));
    if (layerControlRef?.current) {
      layerControlRef.current.toggleLayer(layerId, checked);
      console.log(`ControlPanel: Toggled layer '${layerId}' to ${checked}`);
      // Add any special cross-layer logic here (e.g., political vs altitude)
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
        position: 'topright',
      },

      onAdd: function (mapInstance: any) {
        const container = L.DomUtil.create('div', 'ixmap-control-panel leaflet-control leaflet-bar');
        container.setAttribute('aria-haspopup', 'true');
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        const toggleButton = L.DomUtil.create('a', 'ixmap-control-toggle', container);
        toggleButton.href = '#';
        toggleButton.title = 'Toggle Controls';
        toggleButton.role = 'button';
        toggleButton.innerHTML = '≪';
        toggleButton.onclick = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); setCollapsed(prev => !prev); };

        const content = L.DomUtil.create('div', 'ixmap-control-content', container);
        if (collapsed) L.DomUtil.addClass(content, 'hidden');

        const title = L.DomUtil.create('div', 'ixmap-control-title', content);
        title.innerHTML = 'Controls';

        const tabNav = L.DomUtil.create('div', 'ixmap-tab-navigation', content);
        const displayTab = L.DomUtil.create('button', 'ixmap-tab', tabNav);
        displayTab.innerHTML = 'Display';
        displayTab.onclick = () => setActiveTab('display');
        const layersTab = L.DomUtil.create('button', 'ixmap-tab', tabNav);
        layersTab.innerHTML = 'Layers';
        layersTab.onclick = () => setActiveTab('layers');

        const displayContent = L.DomUtil.create('div', 'ixmap-tab-content ixmap-display-content', content);
        const layersContent = L.DomUtil.create('div', 'ixmap-tab-content ixmap-layers-content', content);

        // --- Populate Display Tab ---
        const displaySection = L.DomUtil.create('div', 'ixmap-control-section', displayContent);
        // Use correct state and handlers
        createControlItem(displaySection, 'Show Grid', 'grid-toggle', showGrid, (checked) => { setShowGrid(checked); onToggleGrid(checked); });
        createControlItem(displaySection, 'Show Country Labels', 'country-labels-toggle', showCountryLabels, (checked) => { setShowCountryLabels(checked); onToggleCountryLabels(checked); });
        createControlItem(displaySection, 'Show Coordinates', 'coords-toggle', showCoordinates, (checked) => { setShowCoordinates(checked); onToggleCoordinates(checked); });
        createControlItem(displaySection, 'Show Prime Meridian', 'pm-toggle', showPrimeMeridian, (checked) => { setShowPrimeMeridian(checked); onTogglePrimeMeridian(checked); });

        // --- Populate Layers Tab ---
        const layerGroups: Record<string, string[]> = { // Example groups
          'Base Layers': ['political', 'climate'],
          'Features': ['lakes', 'rivers'],
        };
        Object.entries(layerGroups).forEach(([groupName, layerIds]) => {
          const relevantLayerIds = layerIds.filter(id => layerVisibility.hasOwnProperty(id));
          if (relevantLayerIds.length === 0) return;

          const groupContainer = L.DomUtil.create('div', 'ixmap-layer-group', layersContent);
          const groupTitle = L.DomUtil.create('div', 'ixmap-group-title', groupContainer);
          groupTitle.innerHTML = groupName;

          relevantLayerIds.forEach(layerId => {
            const layerName = layerId.charAt(0).toUpperCase() + layerId.slice(1).replace(/-/g, ' ');
            createControlItem(
              groupContainer,
              layerName,
              `layer-${layerId}-toggle`, // Unique ID
              layerVisibility[layerId] || false,
              (checked) => { handleLayerToggle(layerId, checked); }
            );
          });
        });

        this.updateControlDisplay(container); // Set initial display state
        return container;
      },

      onRemove: function (mapInstance: any) { /* Optional cleanup */ },

      // Helper to update DOM based on React state
      updateControlDisplay: function(container: HTMLElement) {
        const content = container.querySelector<HTMLElement>('.ixmap-control-content');
        const toggleButton = container.querySelector<HTMLElement>('.ixmap-control-toggle');
        const displayTab = container.querySelectorAll<HTMLElement>('.ixmap-tab')[0];
        const layersTab = container.querySelectorAll<HTMLElement>('.ixmap-tab')[1];
        const displayContent = container.querySelector<HTMLElement>('.ixmap-display-content');
        const layersContent = container.querySelector<HTMLElement>('.ixmap-layers-content');

        // Update collapsed state
        if (toggleButton) toggleButton.innerHTML = collapsed ? '⚙️' : '≪';
        if (content) content.style.display = collapsed ? 'none' : '';
        container.classList.toggle('collapsed', collapsed);
        container.classList.toggle('expanded', !collapsed);

        if (!collapsed && displayTab && layersTab && displayContent && layersContent) {
            // Update active tab styles and content visibility
            const isDisplayActive = activeTab === 'display';
            displayTab.classList.toggle('active', isDisplayActive);
            layersTab.classList.toggle('active', !isDisplayActive);
            displayContent.style.display = isDisplayActive ? '' : 'none';
            layersContent.style.display = !isDisplayActive ? '' : 'none';

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

    // --- *** FIX: Corrected createControlItem Helper Function *** ---
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
    // --- *** END FIX *** ---

    // Instantiate and add the control
    const newControl = new IxMapControl();
    controlRef.current = newControl;
    map.addControl(newControl);
    isControlAdded.current = true;
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
      controlRef.current.updateControlDisplay(controlRef.current.getContainer());
    }
    // Include all state variables that affect the display
  }, [collapsed, activeTab, showGrid, showCountryLabels, showCoordinates, showPrimeMeridian, layerVisibility]);

  return null; // React component renders null, Leaflet control handles UI
};

export default ControlPanel;
