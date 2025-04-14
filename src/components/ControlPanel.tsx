// src/components/ControlPanel.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const [collapsed, setCollapsed] = useState(true); // Start collapsed
  const [activeTab, setActiveTab] = useState<'display' | 'layers'>('display');
  const controlRef = useRef<L.Control | null>(null);
  const controlContainerRef = useRef<HTMLElement | null>(null);

  // Define layer groups for UI organization (adjust as needed)
  const layerGroups: Record<string, string[]> = {
    'Base Layers': ['political', 'climate', 'altitude-layers'], // Group altitude here if manually toggled
    'Geographic Features': ['lakes', 'rivers'], //  
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
      // itemDiv styles moved to CSS

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

  // --- Function to Update Control UI (REVISED) ---
  const updateControlUI = useCallback(() => {
    const container = controlContainerRef.current;
    if (!container || !L) return;

    // Clear previous content
    container.innerHTML = '';
    // Remove specific sizing classes if they exist from previous logic
    L.DomUtil.removeClass(container, 'collapsed');
    L.DomUtil.removeClass(container, 'expanded');
    // Reset padding, border will be handled by button or content area
    container.style.padding = '0';
    container.style.border = 'none'; // Base container has no border itself

    if (collapsed) {
      // --- RENDER COLLAPSED STATE ---
      container.style.width = 'auto'; // Let button define size
      container.style.height = 'auto';

      const toggleButton = L.DomUtil.create('div', 'toggle-button', container);
      toggleButton.innerHTML = '⚙️'; // Gear Icon
      toggleButton.title = 'Expand Controls';
      // Styles for collapsed button are now primarily from CSS class '.toggle-button'

      L.DomEvent.on(toggleButton, 'click', (e) => {
        L.DomEvent.stop(e); // Prevent map click
        setCollapsed(false);
      });

    } else {
      // --- RENDER EXPANDED STATE ---
      container.style.width = ''; // Remove fixed width if set
      container.style.height = ''; // Remove fixed height if set
      container.style.border = '1px solid #ccc'; // Add border for expanded panel

      // --- Toggle Button (Expanded Look) ---
      const toggleButton = L.DomUtil.create('div', 'toggle-button expanded-state', container);
      toggleButton.innerHTML = '≪ Collapse';
      toggleButton.title = 'Collapse Controls';
      // Styles for expanded button from CSS classes '.toggle-button.expanded-state'

      L.DomEvent.on(toggleButton, 'click', (e) => {
         L.DomEvent.stop(e); // Prevent map click
         setCollapsed(true);
      });

      // --- Content Area ---
      const content = L.DomUtil.create('div', 'control-content', container);
      // Styles for content area from CSS

      // --- Tab Navigation ---
      const tabNav = L.DomUtil.create('div', 'tab-navigation', content);
      // Styles from CSS

      const createTab = (tabId: 'display' | 'layers', tabText: string): HTMLDivElement => {
        const tab = L.DomUtil.create('div', `tab tab-${tabId}`, tabNav);
        tab.textContent = tabText;
        // Apply base tab styles (consider moving more to CSS if static)
        tab.style.flex = '1';
        tab.style.padding = '8px 0';
        tab.style.textAlign = 'center';
        tab.style.cursor = 'pointer';
        tab.style.border = '1px solid #ddd';
        tab.style.borderBottom = 'none'; // Default non-active state
        tab.style.backgroundColor = '#f1f1f1';
        tab.style.borderTopLeftRadius = '3px';
        tab.style.borderTopRightRadius = '3px';
        tab.style.marginRight = '-1px'; // Overlap borders

        if (activeTab === tabId) {
          tab.style.backgroundColor = '#fff'; // Active tab background
          tab.style.fontWeight = 'bold';
          tab.style.borderBottom = '1px solid #fff'; // Hide bottom border
          tab.style.marginBottom = '-1px'; // Pull up to overlap content border
        } else {
           // Hover effect for non-active tabs
           tab.onmouseenter = () => { if (activeTab !== tabId) tab.style.backgroundColor = '#e9e9e9'; };
           tab.onmouseleave = () => { if (activeTab !== tabId) tab.style.backgroundColor = '#f1f1f1'; };
        }
        L.DomEvent.on(tab, 'click', () => setActiveTab(tabId));
        return tab;
      };

      createTab('display', 'Display');
      createTab('layers', 'Layers');

      // --- Tab Content Area ---
      const tabContentArea = L.DomUtil.create('div', 'tab-content-area', content);
      // Styles from CSS

      // --- Display Tab Content ---
      if (activeTab === 'display') {
        const displaySection = L.DomUtil.create('div', 'control-section', tabContentArea);
        createCheckboxItem(displaySection, 'pos', 'Show Position', showPosition, onTogglePosition);
        createCheckboxItem(displaySection, 'grid', 'Show Grid', showGrid, onToggleGrid);
        createCheckboxItem(displaySection, 'country-labels', 'Show Country Labels', showCountryLabels, onToggleCountryLabels);
        createCheckboxItem(displaySection, 'pm', 'Show Prime Meridian', showPrimeMeridian, onTogglePrimeMeridian);
      }

      // --- Layers Tab Content ---
      if (activeTab === 'layers') {
        const layersSection = L.DomUtil.create('div', 'control-section', tabContentArea);

        if (isLoadingLayers) {
          layersSection.textContent = 'Loading layers...';
          Object.assign(layersSection.style, { fontStyle: 'italic', color: '#666' });
        } else if (layerError) {
          layersSection.textContent = `Error: ${layerError}`;
          Object.assign(layersSection.style, { color: 'red', fontWeight: 'bold' });
        } else if (Object.keys(layers).length === 0) {
          layersSection.textContent = 'No layers available.';
           Object.assign(layersSection.style, { fontStyle: 'italic', color: '#666' });
        } else {
            // Grouping and rendering logic
          // Filter out 'icecaps' before grouping/rendering
          const layerKeys = Object.keys(layers).filter(key => key !== 'icecaps'); // <--- MODIFIED LINE
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

          const sortedGroupNames = Object.keys(groupedRenderedKeys).sort((a, b) => {
             if (a === 'Base Layers') return -1; if (b === 'Base Layers') return 1;
             if (a === 'Other') return 1; if (b === 'Other') return -1;
             return a.localeCompare(b);
          });

          sortedGroupNames.forEach(groupName => {
             const groupContainer = L.DomUtil.create('div', 'layer-group', layersSection);
             const groupTitle = L.DomUtil.create('div', 'group-title', groupContainer);
             groupTitle.textContent = groupName;

             groupedRenderedKeys[groupName].sort((a, b) => (layers[a]?.name || a).localeCompare(layers[b]?.name || b))
               .forEach((layerId) => {
                 const layerInfo = layers[layerId];
                 if (layerInfo) {
                   const name = layerInfo.name || layerId;
                   const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
                   createCheckboxItem(
                     groupContainer, layerId, capitalizedName,
                     layerVisibility[layerId] ?? false,
                     (checked) => onToggleLayer(layerId, checked),
                     isLoadingLayers,
                   );
                 }
               });
          });
        }
      }
    } // End of expanded state rendering
  }, [
    // Include all props and state that affect the UI rendering
    L, collapsed, activeTab,
    showGrid, showCountryLabels, showPrimeMeridian, showPosition,
    layers, layerVisibility, isLoadingLayers, layerError,
    onToggleGrid, onToggleCountryLabels, onTogglePrimeMeridian, onTogglePosition, onToggleLayer,
    createCheckboxItem, layerGroups // Include memoized helper and layerGroups
  ]);

  // Effect to create and manage the Leaflet Control
  useEffect(() => {
    if (!map || !L) return;

    const IxMapControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd: function (_map: L.Map) {
        const container = L.DomUtil.create('div', 'leaflet-control leaflet-control-custom ixmap-control-panel');
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        controlContainerRef.current = container;
        updateControlUI(); // Initial build
        return container;
      },
      onRemove: function (_map: L.Map) {
        // Leaflet handles removing the container, just nullify our ref
        controlContainerRef.current = null;
      },
    });

    // Ensure control is added only once
    if (!controlRef.current) {
      controlRef.current = new IxMapControl();
      map.addControl(controlRef.current);
    } else {
      // If control exists but container ref got lost, try re-assigning
      if (!controlContainerRef.current && controlRef.current.getContainer) {
         // FIX for Error 1: Handle potential undefined return
         controlContainerRef.current = controlRef.current.getContainer() ?? null;
      }
      // Always update UI in case props changed before control was re-rendered
      // This might be redundant if the second useEffect handles it, but safe
      updateControlUI();
    }


    return () => {
      // FIX for Error 2: Remove map.hasControl check
      // Rely on try...catch for safe removal
      if (map && controlRef.current) { // Check if controlRef exists
        try {
          map.removeControl(controlRef.current);
        } catch (e) {
          console.warn('Error removing control panel:', e);
        }
      }
      controlRef.current = null;
      // controlContainerRef is handled by onRemove
    };
  // Add updateControlUI as dependency because it's called inside this effect
  }, [map, L, updateControlUI]);

  // Effect to update the control's UI when props or internal state change
  useEffect(() => {
    // Only call update if the container exists (control has been added)
    if (controlContainerRef.current) {
      updateControlUI();
    }
    // updateControlUI is memoized and includes all relevant dependencies
  }, [updateControlUI]);

  return null; // Component manages Leaflet control, doesn't render React DOM
};

export default ControlPanel;
