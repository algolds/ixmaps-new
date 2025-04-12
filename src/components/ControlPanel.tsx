// src/components/ControlPanel.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { SVGLayer } from '@/types'; // Import SVGLayer type

interface ControlPanelProps {
  map: L.Map;
  L: typeof L;
  // Display Toggles Props
  showGrid: boolean;
  showCountryLabels: boolean;
  showPrimeMeridian: boolean;
  showPosition: boolean;
  onToggleGrid: (visible: boolean) => void;
  onToggleCountryLabels: (visible: boolean) => void;
  onTogglePrimeMeridian: (visible: boolean) => void;
  onTogglePosition: (visible: boolean) => void;
  // Layer Toggles Props
  layers: Record<string, SVGLayer>; // Pass layers for names/grouping
  layerVisibility: Record<string, boolean>;
  onToggleLayer: (layerId: string, isVisible: boolean) => void;
  isLoadingLayers: boolean; // To disable/indicate loading
  layerError: string | null; // To show layer errors
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  map,
  L,
  // Display Props
  showGrid,
  showCountryLabels,
  showPrimeMeridian,
  showPosition,
  onToggleGrid,
  onToggleCountryLabels,
  onTogglePrimeMeridian,
  onTogglePosition,
  // Layer Props
  layers,
  layerVisibility,
  onToggleLayer,
  isLoadingLayers,
  layerError,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'display' | 'layers'>('display');
  const controlRef = useRef<L.Control | null>(null);
  const isMountedRef = useRef(false); // Prevent effect run on initial mount if needed

  // Define layer groups for UI organization
  const layerGroups: Record<string, string[]> = {
    'Base Layers': ['political', 'climate'],
    'Geographic Features': ['lakes', 'rivers'],
    // Add 'altitude-layers' if you want a manual toggle,
    // otherwise it's handled automatically by political toggle
    // 'Elevation': ['altitude-layers']
  };

  // Effect to create and manage the Leaflet Control
  useEffect(() => {
    if (!map || !L) return;

    // --- Control Definition ---
    const IxMapControl = L.Control.extend({
      options: {
        position: 'topright', // Or your preferred position
      },

      onAdd: function (_map: L.Map) {
        const container = L.DomUtil.create('div', 'leaflet-control leaflet-control-custom ixmap-control-panel');
        container.style.backgroundColor = 'white';
        container.style.padding = '0'; // Padding managed internally
        container.style.border = '1px solid #ccc';
        container.style.borderRadius = '4px';
        container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
        container.style.transition = 'width 0.3s ease, height 0.3s ease'; // Smooth collapse

        // Prevent map interactions when interacting with the control
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        // Will be populated by the updateControlUI function
        return container;
      },

      onRemove: function (_map: L.Map) {
        // Cleanup if needed
      },
    });

    // --- Create or Get Control ---
    if (!controlRef.current) {
      controlRef.current = new IxMapControl();
      map.addControl(controlRef.current);
    }

    // --- Helper to create checkboxes ---
    const createCheckboxItem = (
      parent: HTMLElement,
      id: string,
      labelText: string,
      isChecked: boolean,
      onChangeCallback: (checked: boolean) => void,
      disabled: boolean = false
    ) => {
      const itemDiv = L.DomUtil.create('div', 'control-item', parent);
      itemDiv.style.display = 'flex';
      itemDiv.style.alignItems = 'center';
      itemDiv.style.marginBottom = '5px';
      itemDiv.style.marginLeft = '10px'; // Indent items

      const checkbox = L.DomUtil.create('input', '', itemDiv);
      checkbox.type = 'checkbox';
      checkbox.id = `ixmap-control-${id}`; // Unique ID
      checkbox.checked = isChecked;
      checkbox.disabled = disabled;
      checkbox.style.marginRight = '8px';
      checkbox.addEventListener('change', (e) => {
        onChangeCallback((e.target as HTMLInputElement).checked);
      });

      const label = L.DomUtil.create('label', '', itemDiv);
      label.htmlFor = checkbox.id;
      label.textContent = labelText;
      label.style.cursor = disabled ? 'default' : 'pointer';
      label.style.flexGrow = '1';

      return itemDiv;
    };

    // --- Function to Update Control UI ---
    const updateControlUI = () => {
      if (!controlRef.current) return;
      const container = controlRef.current.getContainer();
      if (!container) return;

      // Clear previous content
      container.innerHTML = '';
      L.DomUtil.removeClass(container, 'collapsed expanded'); // Reset classes
      L.DomUtil.addClass(container, collapsed ? 'collapsed' : 'expanded');

      // --- Toggle Button ---
      const toggleButton = L.DomUtil.create('div', 'toggle-button', container);
      toggleButton.innerHTML = collapsed ? '⚙️' : '≪'; // Icons or text
      toggleButton.style.padding = '5px 8px';
      toggleButton.style.backgroundColor = '#f8f8f8';
      toggleButton.style.borderBottom = collapsed ? 'none' : '1px solid #ccc';
      toggleButton.style.textAlign = collapsed ? 'center' : 'right';
      toggleButton.style.cursor = 'pointer';
      toggleButton.style.fontSize = collapsed ? '1.2em' : '1em';
      toggleButton.onclick = () => setCollapsed((c) => !c);

      // --- Content Area (Hidden when collapsed) ---
      const content = L.DomUtil.create('div', 'control-content', container);
      content.style.padding = '10px';
      content.style.display = collapsed ? 'none' : 'block';

      // --- Title ---
      const title = L.DomUtil.create('div', 'control-title', content);
      title.innerHTML = 'Map Controls';
      title.style.fontWeight = 'bold';
      title.style.marginBottom = '10px';
      title.style.borderBottom = '1px solid #eee';
      title.style.paddingBottom = '5px';

      // --- Tab Navigation ---
      const tabNav = L.DomUtil.create('div', 'tab-navigation', content);
      tabNav.style.display = 'flex';
      tabNav.style.marginBottom = '10px';

      const displayTab = L.DomUtil.create('div', 'tab', tabNav);
      displayTab.textContent = 'Display';
      displayTab.style.padding = '5px 10px';
      displayTab.style.cursor = 'pointer';
      displayTab.style.border = '1px solid #ccc';
      displayTab.style.borderBottom = 'none';
      displayTab.style.marginRight = '5px';
      displayTab.style.borderRadius = '4px 4px 0 0';
      if (activeTab === 'display') {
        displayTab.style.backgroundColor = '#fff';
        displayTab.style.fontWeight = 'bold';
      } else {
        displayTab.style.backgroundColor = '#f1f1f1';
      }
      displayTab.onclick = () => setActiveTab('display');

      const layersTab = L.DomUtil.create('div', 'tab', tabNav);
      layersTab.textContent = 'Layers';
      layersTab.style.padding = '5px 10px';
      layersTab.style.cursor = 'pointer';
      layersTab.style.border = '1px solid #ccc';
      layersTab.style.borderBottom = 'none';
      layersTab.style.borderRadius = '4px 4px 0 0';
      if (activeTab === 'layers') {
        layersTab.style.backgroundColor = '#fff';
        layersTab.style.fontWeight = 'bold';
      } else {
        layersTab.style.backgroundColor = '#f1f1f1';
      }
      layersTab.onclick = () => setActiveTab('layers');

      // --- Tab Content Area ---
      const tabContent = L.DomUtil.create('div', 'tab-content-area', content);
      tabContent.style.border = '1px solid #ccc';
      tabContent.style.padding = '10px';
      tabContent.style.marginTop = '-1px'; // Overlap border

      // --- Display Tab Content ---
      if (activeTab === 'display') {
        const displaySection = L.DomUtil.create('div', 'control-section', tabContent);
        createCheckboxItem(displaySection, 'pos', 'Show Position', showPosition, onTogglePosition);
        createCheckboxItem(displaySection, 'grid', 'Show Grid', showGrid, onToggleGrid);
        createCheckboxItem(displaySection, 'country-labels', 'Show Country Labels', showCountryLabels, onToggleCountryLabels);
        createCheckboxItem(displaySection, 'pm', 'Show Prime Meridian', showPrimeMeridian, onTogglePrimeMeridian);
      }

      // --- Layers Tab Content ---
      if (activeTab === 'layers') {
        const layersSection = L.DomUtil.create('div', 'control-section', tabContent);

        if (isLoadingLayers) {
          layersSection.textContent = 'Loading layers...';
        } else if (layerError) {
          layersSection.textContent = `Error: ${layerError}`;
          layersSection.style.color = 'red';
        } else if (Object.keys(layers).length === 0) {
          layersSection.textContent = 'No layers available.';
        } else {
          Object.entries(layerGroups).forEach(([groupName, groupLayerIds]) => {
            const groupContainer = L.DomUtil.create('div', 'layer-group', layersSection);
            groupContainer.style.marginBottom = '10px';

            const groupTitle = L.DomUtil.create('div', 'group-title', groupContainer);
            groupTitle.textContent = groupName;
            groupTitle.style.fontWeight = 'bold';
            groupTitle.style.marginBottom = '5px';

            groupLayerIds.forEach((layerId) => {
              const layerInfo = layers[layerId];
              if (layerInfo) { // Check if layer exists in parsed data
                const name = layerInfo.name || layerId; // Use name from SVG or fallback to ID
                const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
                createCheckboxItem(
                  groupContainer,
                  layerId,
                  capitalizedName,
                  layerVisibility[layerId] ?? false, // Use state from props
                  (checked) => onToggleLayer(layerId, checked), // Use handler from props
                  isLoadingLayers // Disable while loading
                );
              }
            });
          });
        }
      }
    };

    // --- Initial UI build and subsequent updates ---
    updateControlUI();

    // --- Cleanup ---
    return () => {
      // Check if map still exists and control is present before removing
      if (map && controlRef.current && map.addControl(controlRef.current)) {
         // Check specifically if the control instance is still on this map
         // This check might be overly cautious depending on Leaflet version/behavior
         try {
            map.removeControl(controlRef.current);
         } catch (e) {
            console.warn("Error removing control panel:", e);
         }
      }
      controlRef.current = null; // Clear ref on cleanup
    };
    // Dependencies: Re-run the effect if any state affecting the UI changes
  }, [
    map, L, // Core Leaflet objects
    collapsed, activeTab, // Internal UI state
    showGrid, showCountryLabels, showPrimeMeridian, showPosition, // Display state props
    layers, layerVisibility, isLoadingLayers, layerError, // Layer state props
    onToggleGrid, onToggleCountryLabels, onTogglePrimeMeridian, onTogglePosition, onToggleLayer // Handlers (if their identity changes)
  ]);


  // This component manages a Leaflet control, doesn't render React DOM directly
  return null;
};

export default ControlPanel;
