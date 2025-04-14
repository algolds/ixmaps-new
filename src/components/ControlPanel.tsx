// src/components/ControlPanel.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import { SVGLayer } from '@/types'; // Import SVGLayer type

interface ControlPanelProps {
  map: L.Map | null; // Allow null initially
  L: typeof L | null; // Allow null initially
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
  // --- ADDED Admin Mode Props ---
  isAdminMode: boolean;
  onToggleAdminMode: () => void;
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
  // --- ADDED Admin Mode Props ---
  isAdminMode,
  onToggleAdminMode,
}) => {
  const [isExpanded, setIsExpanded] = useState(false); // Start collapsed for better initial map view
  const [activeTab, setActiveTab] = useState<'display' | 'layers'>('display');
  const controlRef = useRef<L.Control | null>(null);
  const controlContainerRef = useRef<HTMLElement | null>(null);

  // Define layer groups for UI organization (adjust as needed)
  // Using useCallback to memoize this structure if it were more complex
  const layerGroups = useCallback((): Record<string, string[]> => {
    return {
      'Base Layers': ['political', 'climate', 'altitude-layers'],
      'Geographic Features': ['lakes', 'rivers'],
      // 'Other': [] // Placeholder if needed
    };
  }, []);

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
      if (!L) return null; // Guard against L not being available

      const itemDiv = L.DomUtil.create('div', 'control-item', parent);

      const checkbox = L.DomUtil.create('input', '', itemDiv);
      checkbox.type = 'checkbox';
      checkbox.id = `ixmap-control-${id}`; // Unique ID
      checkbox.checked = isChecked;
      checkbox.disabled = disabled;
      checkbox.style.marginRight = '8px';
      checkbox.style.cursor = disabled ? 'not-allowed' : 'pointer';

      L.DomEvent.on(checkbox, 'change', (e) => {
        onChangeCallback((e.target as HTMLInputElement).checked);
      });

      const label = L.DomUtil.create('label', '', itemDiv);
      label.htmlFor = checkbox.id;
      label.textContent = labelText;
      label.style.cursor = disabled ? 'default' : 'pointer';
      label.style.flexGrow = '1'; // Allow label to take space
      if (disabled) {
        label.style.opacity = '0.6';
      }

      return itemDiv;
    },
    [L], // Dependency on L
  );

  // --- Function to Update Control UI ---
  const updateControlUI = useCallback(() => {
    const container = controlContainerRef.current;
    if (!container || !L) return;

    // Clear previous content
    container.innerHTML = '';
    L.DomUtil.removeClass(container, 'collapsed'); // Use L.DomUtil for consistency
    L.DomUtil.removeClass(container, 'expanded');
    container.style.padding = '0';
    container.style.border = 'none';

    if (!isExpanded) {
      // --- RENDER COLLAPSED STATE ---
      L.DomUtil.addClass(container, 'collapsed'); // Add class for potential styling
      container.style.width = 'auto';
      container.style.height = 'auto';

      const toggleButton = L.DomUtil.create('div', 'toggle-button', container);
      toggleButton.innerHTML = '⚙️'; // Gear Icon
      toggleButton.title = 'Expand Controls';

      L.DomEvent.on(toggleButton, 'click', (e) => {
        L.DomEvent.stop(e);
        setIsExpanded(true);
      });
    } else {
      // --- RENDER EXPANDED STATE ---
      L.DomUtil.addClass(container, 'expanded'); // Add class for potential styling
      container.style.width = ''; // Let CSS handle max-width
      container.style.height = ''; // Let CSS handle max-height
      container.style.border = '1px solid #ccc'; // Add border for expanded panel

      // --- Toggle Button (Expanded Look) ---
      const toggleButton = L.DomUtil.create(
        'div',
        'toggle-button expanded-state', // Use both classes
        container,
      );
      toggleButton.innerHTML = '≪ Collapse';
      toggleButton.title = 'Collapse Controls';

      L.DomEvent.on(toggleButton, 'click', (e) => {
        L.DomEvent.stop(e);
        setIsExpanded(false);
      });

      // --- Content Area ---
      const content = L.DomUtil.create('div', 'control-content', container);

      // --- Tab Navigation ---
      const tabNav = L.DomUtil.create('div', 'tab-navigation', content);

      const createTab = (
        tabId: 'display' | 'layers',
        tabText: string,
      ): HTMLDivElement => {
        const tab = L.DomUtil.create('div', `tab tab-${tabId}`, tabNav);
        tab.textContent = tabText;
        if (activeTab === tabId) {
          L.DomUtil.addClass(tab, 'active'); // Use class for active state
        }
        L.DomEvent.on(tab, 'click', () => setActiveTab(tabId));
        return tab;
      };

      createTab('display', 'Display');
      createTab('layers', 'Layers');

      // --- Tab Content Area ---
      const tabContentArea = L.DomUtil.create(
        'div',
        'tab-content-area',
        content,
      );

      // --- Display Tab Content ---
      if (activeTab === 'display') {
        const displaySection = L.DomUtil.create(
          'div',
          'control-section',
          tabContentArea,
        );
        // Standard Display Toggles
        createCheckboxItem(
          displaySection,
          'pos',
          'Show Position',
          showPosition,
          onTogglePosition,
        );
        createCheckboxItem(
          displaySection,
          'grid',
          'Show Grid',
          showGrid,
          onToggleGrid,
        );
        createCheckboxItem(
          displaySection,
          'country-labels',
          'Show Country Labels',
          showCountryLabels,
          onToggleCountryLabels,
        );
        createCheckboxItem(
          displaySection,
          'pm',
          'Show Prime Meridian',
          showPrimeMeridian,
          onTogglePrimeMeridian,
        );

        // --- Admin Mode Toggle ---
        const adminSection = L.DomUtil.create(
          'div',
          'control-section', // Reuse section styling
          tabContentArea, // Add within the display tab content area
        );
        const groupTitle = L.DomUtil.create('div', 'group-title', adminSection); // Add title
        groupTitle.textContent = 'Admin';
        createCheckboxItem(
          adminSection,
          'admin-mode', // Unique ID
          'Label Editor Mode', // Label text
          isAdminMode, // Checked state from props
          onToggleAdminMode, // Callback function from props
        );
      }

      // --- Layers Tab Content ---
      if (activeTab === 'layers') {
        const layersSection = L.DomUtil.create(
          'div',
          'control-section',
          tabContentArea,
        );

        if (isLoadingLayers) {
          layersSection.textContent = 'Loading layers...';
          Object.assign(layersSection.style, {
            fontStyle: 'italic',
            color: '#666',
          });
        } else if (layerError) {
          layersSection.textContent = `Error: ${layerError}`;
          Object.assign(layersSection.style, {
            color: 'red',
            fontWeight: 'bold',
          });
        } else if (Object.keys(layers).length === 0) {
          layersSection.textContent = 'No layers available.';
          Object.assign(layersSection.style, {
            fontStyle: 'italic',
            color: '#666',
          });
        } else {
          // Grouping and rendering logic
          const currentLayerGroups = layerGroups(); // Get groups
          const layerKeys = Object.keys(layers).filter((key) => key !== 'icecaps'); // Filter out internal layers if needed
          const groupedRenderedKeys: Record<string, string[]> = {};
          const otherRenderedKeys: string[] = [];

          layerKeys.forEach((key) => {
            let foundGroup = false;
            for (const groupName in currentLayerGroups) {
              if (currentLayerGroups[groupName].includes(key)) {
                if (!groupedRenderedKeys[groupName])
                  groupedRenderedKeys[groupName] = [];
                groupedRenderedKeys[groupName].push(key);
                foundGroup = true;
                break;
              }
            }
            if (!foundGroup) otherRenderedKeys.push(key);
          });
          // Add ungrouped layers to an 'Other' group
          if (otherRenderedKeys.length > 0) groupedRenderedKeys['Other'] = otherRenderedKeys;

          // Sort group names (e.g., Base Layers first, Other last)
          const sortedGroupNames = Object.keys(groupedRenderedKeys).sort(
            (a, b) => {
              if (a === 'Base Layers') return -1;
              if (b === 'Base Layers') return 1;
              if (a === 'Other') return 1;
              if (b === 'Other') return -1;
              return a.localeCompare(b);
            },
          );

          // Render each group
          sortedGroupNames.forEach((groupName) => {
            const groupContainer = L.DomUtil.create(
              'div',
              'layer-group',
              layersSection,
            );
            const groupTitle = L.DomUtil.create(
              'div',
              'group-title',
              groupContainer,
            );
            groupTitle.textContent = groupName;

            // Sort layers within the group alphabetically by name
            groupedRenderedKeys[groupName]
              .sort((a, b) =>
                (layers[a]?.name || a).localeCompare(layers[b]?.name || b),
              )
              .forEach((layerId) => {
                const layerInfo = layers[layerId];
                if (layerInfo) {
                  const name = layerInfo.name || layerId;
                  // Simple capitalization
                  const capitalizedName =
                    name.charAt(0).toUpperCase() + name.slice(1);
                  createCheckboxItem(
                    groupContainer,
                    layerId,
                    capitalizedName,
                    layerVisibility[layerId] ?? false,
                    (checked) => onToggleLayer(layerId, checked),
                    isLoadingLayers, // Disable while loading
                  );
                }
              });
          });
        }
      }
    } // End of expanded state rendering
  }, [
    L,
    isExpanded,
    activeTab,
    showGrid,
    showCountryLabels,
    showPrimeMeridian,
    showPosition,
    layers,
    layerVisibility,
    isLoadingLayers,
    layerError,
    isAdminMode, // Include admin state
    onToggleGrid,
    onToggleCountryLabels,
    onTogglePrimeMeridian,
    onTogglePosition,
    onToggleLayer,
    onToggleAdminMode, // Include admin toggle handler
    createCheckboxItem,
    layerGroups,
  ]);

  // Effect to create and manage the Leaflet Control
  useEffect(() => {
    if (!map || !L) return;

    const IxMapControl = L.Control.extend({
      options: { position: 'topright' }, // Standard Leaflet control position
      onAdd: function (_map: L.Map) {
        // Create the main container div
        const container = L.DomUtil.create(
          'div',
          'leaflet-control leaflet-control-custom ixmap-control-panel', // Use base class + custom class
        );
        // Prevent map interactions when clicking on the control
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        // Store the reference to the container element
        controlContainerRef.current = container;
        // Build the initial UI inside the container
        updateControlUI();
        return container;
      },
      onRemove: function (_map: L.Map) {
        // Cleanup when the control is removed from the map
        controlContainerRef.current = null; // Clear the container reference
      },
    });

    // Add the control to the map only if it hasn't been added yet
    if (!controlRef.current) {
      controlRef.current = new IxMapControl();
      map.addControl(controlRef.current);
    } else {
      // If control exists, ensure the container ref is up-to-date
      // (This handles potential edge cases during hot-reloading)
      if (!controlContainerRef.current && controlRef.current.getContainer) {
        controlContainerRef.current = controlRef.current.getContainer() ?? null;
      }
      // Update the UI in case props changed while the control existed
      updateControlUI();
    }

    // Cleanup function for this effect
    return () => {
      // Remove the control from the map when the component unmounts or dependencies change
      if (map && controlRef.current) {
        try {
          map.removeControl(controlRef.current);
        } catch (e) {
          console.warn('Error removing control panel:', e);
        }
      }
      controlRef.current = null; // Clear the control reference
    };
  }, [map, L, updateControlUI]); // Dependencies: map, L, and the UI update function

  // Effect to update the control's UI whenever its dependencies change
  useEffect(() => {
    // Only update if the control's container element exists
    if (controlContainerRef.current) {
      updateControlUI();
    }
    // The updateControlUI function is memoized and its dependency array
    // includes all props/state that should trigger a UI rebuild.
  }, [updateControlUI]);

  // This component renders nothing itself; it manages a Leaflet control
  return null;
};

export default ControlPanel;
