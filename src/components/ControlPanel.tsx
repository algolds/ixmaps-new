// src/components/ControlPanel.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import { SVGLayer } from '@/types'; // Import SVGLayer type

interface ControlPanelProps {
  map: L.Map | null;
  L: typeof L | null;
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
  layers: Record<string, SVGLayer>;
  layerVisibility: Record<string, boolean>;
  onToggleLayer: (layerId: string, isVisible: boolean) => void;
  isLoadingLayers: boolean;
  layerError: string | null;
  // Admin Mode Props (Simplified or Removed - Assuming kept for now)
  isAdminMode: boolean;
  onToggleAdminMode: () => void;
  isAdminToggleDisabled: boolean;
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
  // Admin Mode Props
  isAdminMode,
  onToggleAdminMode,
  isAdminToggleDisabled,
}) => {
  const [isExpanded, setIsExpanded] = useState(false); // Start collapsed
  const [activeTab, setActiveTab] = useState<'display' | 'layers'>('display');
  const controlRef = useRef<L.Control | null>(null);
  const controlContainerRef = useRef<HTMLElement | null>(null);

  // Define layer groups for UI organization
  const layerGroups = useCallback((): Record<string, string[]> => {
    // Define groups based on common prefixes or known IDs
    const groups: Record<string, string[]> = {
      'Base Layers': [],
      'Geographic Features': [],
      Other: [], // Catch-all
    };
    const knownBase = ['political', 'climate', 'altitude-layers'];
    const knownGeo = ['lakes', 'rivers', 'icecaps']; // Include icecaps here if desired

    Object.keys(layers).forEach((key) => {
      if (knownBase.includes(key)) {
        groups['Base Layers'].push(key);
      } else if (knownGeo.includes(key)) {
        groups['Geographic Features'].push(key);
      } else {
        groups['Other'].push(key);
      }
    });

    // Remove empty groups
    Object.keys(groups).forEach((groupName) => {
      if (groups[groupName].length === 0) {
        delete groups[groupName];
      }
    });

    return groups;
  }, [layers]); // Re-calculate if layers change

  // --- Helper to create checkboxes (memoized) ---
  const createCheckboxItem = useCallback(
    (
      parent: HTMLElement,
      id: string,
      labelText: string,
      isChecked: boolean,
      onChangeCallback: (checked: boolean) => void,
      disabled: boolean = false, // Accept disabled state
    ) => {
      if (!L) return null;

      const itemDiv = L.DomUtil.create('div', 'control-item', parent);
      itemDiv.style.display = 'flex'; // Use flex for alignment
      itemDiv.style.alignItems = 'center';
      itemDiv.style.marginBottom = '4px'; // Spacing

      const checkbox = L.DomUtil.create('input', '', itemDiv);
      checkbox.type = 'checkbox';
      checkbox.id = `ixmap-control-${id}`;
      checkbox.checked = isChecked;
      checkbox.disabled = disabled; // Set disabled attribute
      checkbox.style.marginRight = '8px';
      checkbox.style.cursor = disabled ? 'not-allowed' : 'pointer';
      checkbox.style.accentColor = '#007bff'; // Optional: Style checkbox color

      L.DomEvent.on(checkbox, 'change', (e) => {
        if (!disabled) {
          onChangeCallback((e.target as HTMLInputElement).checked);
        }
      });

      const label = L.DomUtil.create('label', '', itemDiv);
      label.htmlFor = checkbox.id;
      label.textContent = labelText;
      label.style.cursor = disabled ? 'default' : 'pointer';
      label.style.flexGrow = '1';
      label.style.fontSize = '13px'; // Slightly larger label text
      if (disabled) {
        label.style.opacity = '0.6'; // Style disabled label
        // label.title = 'Admin access required'; // Removed admin-specific tooltip
      }

      return itemDiv;
    },
    [L],
  );

  // --- Function to Update Control UI ---
  const updateControlUI = useCallback(() => {
    const container = controlContainerRef.current;
    if (!container || !L) return;

    // Clear previous content
    container.innerHTML = '';
    L.DomUtil.removeClass(container, 'collapsed');
    L.DomUtil.removeClass(container, 'expanded');
    // Reset styles that might interfere
    container.style.padding = '0';
    container.style.border = 'none';
    container.style.backgroundColor = 'transparent';
    container.style.width = '';
    container.style.height = '';
    container.style.display = '';
    container.style.alignItems = '';
    container.style.justifyContent = '';
    container.style.boxShadow = ''; // Reset box shadow

    if (!isExpanded) {
      // --- RENDER COLLAPSED STATE ---
      L.DomUtil.addClass(container, 'collapsed');

      // --- Style the container for centering (and make it invisible) ---
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.justifyContent = 'center';
      container.style.padding = '0'; // No padding needed for invisible container
      container.style.border = 'none'; // Ensure no border
      container.style.backgroundColor = 'transparent'; // Ensure no background
      container.style.boxShadow = 'none'; // Ensure no shadow

      // Create the button (the only visible element)
      const toggleButton = L.DomUtil.create(
        'div',
        'leaflet-bar leaflet-control', // Standard Leaflet button styling
        container,
      );

      const link = L.DomUtil.create('a', '', toggleButton);
      link.innerHTML = '⚙️'; // Gear Icon
      link.href = '#';
      link.title = 'Expand Controls';

      // --- Style the link (icon holder) for centering the icon *within* the button ---
      link.style.display = 'flex';
      link.style.alignItems = 'center';
      link.style.justifyContent = 'center';
      link.style.width = '30px'; // Standard Leaflet control size
      link.style.height = '30px'; // Standard Leaflet control size
      link.style.fontSize = '1.4em';

      L.DomEvent.on(link, 'click', L.DomEvent.stop).on(link, 'click', () => {
        setIsExpanded(true);
      });
    } else {
      // --- RENDER EXPANDED STATE ---
      L.DomUtil.addClass(container, 'expanded');
      // Reset flex styles applied in collapsed state (already done at the top)
      // container.style.display = '';
      // container.style.alignItems = '';
      // container.style.justifyContent = '';
      // container.style.padding = '';

      // Apply expanded styles (making the container visible again)
      container.style.width = ''; // Let CSS handle max-width
      container.style.height = ''; // Let CSS handle max-height
      container.style.border = '1px solid #ccc';
      container.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
      container.style.borderRadius = '4px';
      container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)'; // Add shadow back

      // --- Header with Title and Collapse Button ---
      const header = L.DomUtil.create('div', 'control-header', container);
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.padding = '5px 8px';
      header.style.borderBottom = '1px solid #ddd';
      header.style.backgroundColor = '#f8f8f8';

      const title = L.DomUtil.create('div', 'control-title', header);
      title.textContent = 'Map Controls';
      title.style.fontWeight = 'bold';

      const collapseButton = L.DomUtil.create('button', 'collapse-button', header);
      collapseButton.innerHTML = '&times;'; // Close icon
      collapseButton.title = 'Collapse Controls';
      Object.assign(collapseButton.style, {
        background: 'none', border: 'none', fontSize: '1.5em', cursor: 'pointer', padding: '0 5px', lineHeight: '1'
      });
      L.DomEvent.on(collapseButton, 'click', L.DomEvent.stop).on(collapseButton, 'click', () => {
        setIsExpanded(false);
      });


      // --- Content Area ---
      const content = L.DomUtil.create('div', 'control-content', container);
      content.style.padding = '8px 10px';
      content.style.maxHeight = 'calc(100vh - 150px)'; // Limit height, adjust as needed
      content.style.overflowY = 'auto';

      // --- Tab Navigation ---
      const tabNav = L.DomUtil.create('div', 'tab-navigation', content);
      tabNav.style.display = 'flex';
      tabNav.style.marginBottom = '10px';
      tabNav.style.borderBottom = '1px solid #ccc';

      const createTab = (
        tabId: 'display' | 'layers',
        tabText: string,
      ): HTMLButtonElement => {
        const tab = L.DomUtil.create('button', `tab tab-${tabId}`, tabNav);
        tab.textContent = tabText;
        Object.assign(tab.style, {
          padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer', borderBottom: '3px solid transparent', marginRight: '5px', fontWeight: '500', color: '#555'
        });
        if (activeTab === tabId) {
          tab.style.borderBottomColor = '#007bff'; // Active indicator
          tab.style.color = '#000';
          tab.style.fontWeight = 'bold';
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
          'control-section display-section',
          tabContentArea,
        );
        // Standard Display Toggles
        createCheckboxItem(displaySection, 'pos', 'Show Position', showPosition, onTogglePosition);
        createCheckboxItem(displaySection, 'grid', 'Show Grid', showGrid, onToggleGrid);
        // Country labels no longer disabled by admin mode
        createCheckboxItem(displaySection, 'country-labels', 'Show Country Labels', showCountryLabels, onToggleCountryLabels);
        createCheckboxItem(displaySection, 'pm', 'Show Prime Meridian', showPrimeMeridian, onTogglePrimeMeridian);

        // --- Simplified Admin Mode Toggle Section (if keeping the feature) ---
        if (onToggleAdminMode) { // Check if the prop exists (optional check)
            const adminSection = L.DomUtil.create('div', 'control-section admin-section', tabContentArea);
            adminSection.style.marginTop = '15px';
            adminSection.style.paddingTop = '10px';
            adminSection.style.borderTop = '1px dashed #ccc';
            const groupTitle = L.DomUtil.create('div', 'group-title', adminSection);
            groupTitle.textContent = 'Dev Tools'; // Rename if desired
            groupTitle.style.marginBottom = '5px';
            groupTitle.style.fontWeight = 'bold';
            groupTitle.style.fontSize = '1.1em';
            createCheckboxItem(
              adminSection,
              'admin-mode',
              'Label Editor Mode',
              isAdminMode,
              onToggleAdminMode,
              isAdminToggleDisabled, // Pass disabled state (likely always false now)
            );
        }
      }

      // --- Layers Tab Content ---
      if (activeTab === 'layers') {
        const layersSection = L.DomUtil.create(
          'div',
          'control-section layers-section',
          tabContentArea,
        );

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
          // Grouping and rendering logic (remains the same)
          const currentLayerGroups = layerGroups();
          const groupedRenderedKeys: Record<string, string[]> = {};
          const otherRenderedKeys: string[] = [];
          Object.keys(layers).forEach((key) => {
            let foundGroup = false;
            for (const groupName in currentLayerGroups) {
              if (currentLayerGroups[groupName].includes(key)) {
                if (!groupedRenderedKeys[groupName]) groupedRenderedKeys[groupName] = [];
                groupedRenderedKeys[groupName].push(key);
                foundGroup = true;
                break;
              }
            }
            if (!foundGroup) otherRenderedKeys.push(key);
          });
          if (otherRenderedKeys.length > 0) {
             if (!groupedRenderedKeys['Other']) groupedRenderedKeys['Other'] = [];
             groupedRenderedKeys['Other'].push(...otherRenderedKeys);
          }
          const sortedGroupNames = Object.keys(groupedRenderedKeys).sort(
            (a, b) => {
              const order = ['Base Layers', 'Geographic Features', 'Other'];
              const indexA = order.indexOf(a);
              const indexB = order.indexOf(b);
              if (indexA !== -1 && indexB !== -1) return indexA - indexB;
              if (indexA !== -1) return -1;
              if (indexB !== -1) return 1;
              return a.localeCompare(b);
            },
          );
          sortedGroupNames.forEach((groupName) => {
            const groupContainer = L.DomUtil.create('div', 'layer-group', layersSection);
            groupContainer.style.marginBottom = '10px';
            const groupTitle = L.DomUtil.create('div', 'group-title', groupContainer);
            groupTitle.textContent = groupName;
            groupTitle.style.fontWeight = 'bold';
            groupTitle.style.marginBottom = '5px';
            groupTitle.style.borderBottom = '1px solid #eee';
            groupTitle.style.paddingBottom = '3px';
            groupedRenderedKeys[groupName]
              .sort((a, b) =>
                (layers[a]?.name || a).localeCompare(layers[b]?.name || b),
              )
              .forEach((layerId) => {
                const layerInfo = layers[layerId];
                if (layerInfo) {
                  const name = layerInfo.name || layerId;
                  const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');
                  createCheckboxItem(
                    groupContainer,
                    layerId,
                    capitalizedName,
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
    // Dependencies remain the same
    L, isExpanded, activeTab, showGrid, showCountryLabels, showPrimeMeridian,
    showPosition, layers, layerVisibility, isLoadingLayers, layerError,
    isAdminMode, isAdminToggleDisabled, onToggleGrid, onToggleCountryLabels,
    onTogglePrimeMeridian, onTogglePosition, onToggleLayer, onToggleAdminMode,
    createCheckboxItem, layerGroups,
  ]);

  // Effect to create and manage the Leaflet Control
  useEffect(() => {
    if (!map || !L) return;

    const IxMapControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd: function (_map: L.Map) {
        const container = L.DomUtil.create(
          'div',
          'leaflet-control leaflet-control-custom ixmap-control-panel',
        );
        // Prevent map interaction when clicking on the control container
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        controlContainerRef.current = container;
        updateControlUI(); // Initial UI setup
        return container;
      },
      onRemove: function (_map: L.Map) {
        // Cleanup when control is removed
        controlContainerRef.current = null;
      },
    });

    // Add the control to the map if it doesn't exist
    if (!controlRef.current) {
      controlRef.current = new IxMapControl();
      map.addControl(controlRef.current);
    } else {
      // If control exists, ensure container ref is set and update UI
      // (Handles potential HMR scenarios where component re-renders but map/control persist)
      if (!controlContainerRef.current && controlRef.current.getContainer) {
        controlContainerRef.current = controlRef.current.getContainer() ?? null;
      }
      updateControlUI();
    }

    // Cleanup function when the component unmounts or dependencies change
    return () => {
      if (map && controlRef.current) {
        try {
          map.removeControl(controlRef.current);
        } catch (e) {
          // Log warning if removal fails, but don't crash
          console.warn('Error removing control panel:', e);
        }
      }
      controlRef.current = null; // Clear the ref
    };
  }, [map, L, updateControlUI]); // updateControlUI is stable due to useCallback

  // Effect to update the control's UI whenever its dependencies change
  // This ensures the UI reflects the latest state/props
  useEffect(() => {
    if (controlContainerRef.current) {
      updateControlUI();
    }
  }, [updateControlUI]); // updateControlUI dependency array handles prop/state changes

  // This component renders nothing itself; it manages a Leaflet control
  return null;
};

export default ControlPanel;
