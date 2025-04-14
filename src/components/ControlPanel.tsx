// src/components/ControlPanel.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react'; // Added useCallback
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
  // *** RESTORED Layer Toggles Props ***
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
  // *** Layer Props ***
  layers,
  layerVisibility,
  onToggleLayer,
  isLoadingLayers,
  layerError,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'display' | 'layers'>('display');
  const controlRef = useRef<L.Control | null>(null);
  const controlContainerRef = useRef<HTMLElement | null>(null);

  // Define layer groups for UI organization (adjust as needed)
  const layerGroups: Record<string, string[]> = {
    'Base Layers': ['political', 'climate', 'altitude-layers'], // Group altitude here if manually toggled
    'Geographic Features': ['lakes', 'rivers', 'icecaps'], // Added icecaps
    // Add 'Other' group logic if needed later
  };

  // --- Helper to create checkboxes (memoized) ---
  const createCheckboxItem = useCallback(
    (
      parent: HTMLElement,
      id: string,
      labelText: string,
      isChecked: boolean,
      onChangeCallback: (checked: boolean) => void,
      disabled: boolean = false,
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
      checkbox.style.cursor = disabled ? 'not-allowed' : 'pointer'; // Indicate disabled state

      // Use L.DomEvent for potentially better handling
      L.DomEvent.on(checkbox, 'change', (e) => {
        onChangeCallback((e.target as HTMLInputElement).checked);
      });

      const label = L.DomUtil.create('label', '', itemDiv);
      label.htmlFor = checkbox.id;
      label.textContent = labelText;
      label.style.cursor = disabled ? 'default' : 'pointer';
      label.style.flexGrow = '1';
      if (disabled) {
        label.style.opacity = '0.6'; // Visually indicate disabled
      }

      return itemDiv;
    },
    [L], // L is stable, so this is effectively memoized
  );

  // --- Function to Update Control UI (memoized) ---
  const updateControlUI = useCallback(() => {
    const container = controlContainerRef.current;
    if (!container || !L) return;

    // Clear previous content
    container.innerHTML = '';

    // Manage collapsed/expanded classes
    L.DomUtil.removeClass(container, 'collapsed');
    L.DomUtil.removeClass(container, 'expanded');
    L.DomUtil.addClass(container, collapsed ? 'collapsed' : 'expanded');

    // --- Toggle Button ---
    const toggleButton = L.DomUtil.create('div', 'toggle-button', container);
    toggleButton.innerHTML = collapsed ? '⚙️ Controls' : '≪ Collapse'; // More descriptive text
    toggleButton.style.padding = '5px 8px';
    toggleButton.style.backgroundColor = '#f8f8f8';
    toggleButton.style.borderBottom = collapsed ? 'none' : '1px solid #ccc';
    toggleButton.style.textAlign = 'center'; // Center always looks fine
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.fontSize = '12px'; // Slightly smaller font
    toggleButton.title = collapsed ? 'Expand Controls' : 'Collapse Controls'; // Tooltip
    L.DomEvent.on(toggleButton, 'click', () => setCollapsed((c) => !c));

    // --- Content Area (Hidden when collapsed) ---
    const content = L.DomUtil.create('div', 'control-content', container);
    content.style.padding = '10px';
    content.style.display = collapsed ? 'none' : 'block';
    content.style.maxHeight = 'calc(100vh - 100px)'; // Limit height
    content.style.overflowY = 'auto'; // Allow scrolling if needed
    content.style.minWidth = '200px'; // Ensure minimum width

    // --- Tab Navigation ---
    const tabNav = L.DomUtil.create('div', 'tab-navigation', content);
    tabNav.style.display = 'flex';
    tabNav.style.marginBottom = '10px';

    const createTab = (
      tabId: 'display' | 'layers',
      tabText: string,
    ): HTMLDivElement => {
      const tab = L.DomUtil.create('div', `tab tab-${tabId}`, tabNav);
      tab.textContent = tabText;
      tab.style.padding = '5px 10px';
      tab.style.cursor = 'pointer';
      tab.style.border = '1px solid #ccc';
      tab.style.borderBottom = 'none';
      tab.style.marginRight = '5px';
      tab.style.borderRadius = '4px 4px 0 0';
      tab.style.fontSize = '12px';
      if (activeTab === tabId) {
        tab.style.backgroundColor = '#fff';
        tab.style.fontWeight = 'bold';
        tab.style.borderBottom = '1px solid #fff'; // Hide bottom border for active tab
        tab.style.position = 'relative'; // To overlap the content border
        tab.style.bottom = '-1px';
      } else {
        tab.style.backgroundColor = '#f1f1f1';
      }
      L.DomEvent.on(tab, 'click', () => setActiveTab(tabId));
      return tab;
    };

    createTab('display', 'Display');
    createTab('layers', 'Layers');

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
        layersSection.style.fontStyle = 'italic';
        layersSection.style.color = '#666';
      } else if (layerError) {
        layersSection.textContent = `Error: ${layerError}`;
        layersSection.style.color = 'red';
        layersSection.style.fontWeight = 'bold';
      } else if (Object.keys(layers).length === 0) {
        layersSection.textContent = 'No layers available.';
        layersSection.style.fontStyle = 'italic';
        layersSection.style.color = '#666';
      } else {
        // Group and render layer toggles using props
        const layerKeys = Object.keys(layers);
        const groupedRenderedKeys: Record<string, string[]> = {};
        const otherRenderedKeys: string[] = [];

        layerKeys.forEach(key => {
           let foundGroup = false;
           for (const groupName in layerGroups) {
              if (layerGroups[groupName].includes(key)) {
                 if (!groupedRenderedKeys[groupName]) groupedRenderedKeys[groupName] = [];
                 groupedRenderedKeys[groupName].push(key);
                 foundGroup = true;
                 break;
              }
           }
           if (!foundGroup) otherRenderedKeys.push(key);
        });
        if (otherRenderedKeys.length > 0) groupedRenderedKeys['Other'] = otherRenderedKeys;

        // Sort group names (optional)
        const sortedGroupNames = Object.keys(groupedRenderedKeys).sort((a, b) => {
           if (a === 'Base Layers') return -1; if (b === 'Base Layers') return 1;
           if (a === 'Other') return 1; if (b === 'Other') return -1;
           return a.localeCompare(b);
        });

        sortedGroupNames.forEach(groupName => {
           const groupContainer = L.DomUtil.create('div', 'layer-group', layersSection);
           groupContainer.style.marginBottom = '10px';

           const groupTitle = L.DomUtil.create('div', 'group-title', groupContainer);
           groupTitle.textContent = groupName;
           groupTitle.style.fontWeight = 'bold';
           groupTitle.style.marginBottom = '5px';
           groupTitle.style.fontSize = '13px';

           // Sort layers within group
           groupedRenderedKeys[groupName].sort((a, b) => (layers[a]?.name || a).localeCompare(layers[b]?.name || b))
             .forEach((layerId) => {
               const layerInfo = layers[layerId];
               if (layerInfo) {
                 const name = layerInfo.name || layerId;
                 const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
                 // *** Use props for state and callback ***
                 createCheckboxItem(
                   groupContainer,
                   layerId,
                   capitalizedName,
                   layerVisibility[layerId] ?? false, // Get state from prop
                   (checked) => onToggleLayer(layerId, checked), // Call handler prop
                   isLoadingLayers, // Disable based on prop
                 );
               }
             });
        });
      }
    }
  }, [
    // Include all props and state that affect the UI rendering
    L, collapsed, activeTab,
    showGrid, showCountryLabels, showPrimeMeridian, showPosition,
    layers, layerVisibility, isLoadingLayers, layerError,
    onToggleGrid, onToggleCountryLabels, onTogglePrimeMeridian, onTogglePosition, onToggleLayer,
    createCheckboxItem // Include memoized helper
  ]);

  // Effect to create and manage the Leaflet Control
  useEffect(() => {
    if (!map || !L) return;

    const IxMapControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd: function (_map: L.Map) {
        const container = L.DomUtil.create('div', 'leaflet-control leaflet-control-custom ixmap-control-panel');
        container.style.backgroundColor = 'white';
        container.style.padding = '0';
        container.style.border = '1px solid #ccc';
        container.style.borderRadius = '4px';
        container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
        container.style.transition = 'width 0.2s ease, height 0.2s ease';
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        controlContainerRef.current = container;
        updateControlUI(); // Initial build
        return container;
      },
      onRemove: function (_map: L.Map) {
        controlContainerRef.current = null;
      },
    });

    if (!controlRef.current) {
      controlRef.current = new IxMapControl();
      map.addControl(controlRef.current);
    }

    return () => {
      if (map && controlRef.current && map.addControl(controlRef.current)) { // Check if control exists before removing
        try { map.removeControl(controlRef.current); }
        catch (e) { console.warn('Error removing control panel:', e); }
      }
      controlRef.current = null;
    };
  }, [map, L, updateControlUI]); // Add updateControlUI as dependency for initial build

  // Effect to update the control's UI when props or internal state change
  // This effect now just calls the memoized update function
  useEffect(() => {
    if (controlContainerRef.current) {
      updateControlUI();
    }
  }, [updateControlUI]); // updateControlUI includes all relevant dependencies

  return null; // Component manages Leaflet control, doesn't render React DOM
};

export default ControlPanel;
