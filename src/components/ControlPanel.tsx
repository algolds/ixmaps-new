'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SVGLayer } from '@/types/svg-types';
import { SVGLayerControlRef } from './SVGLayerControl';

interface ControlPanelProps {
  map: any;
  L: any;
  onToggleGrid: (visible: boolean) => void;
  onToggleLabels: (visible: boolean) => void;
  onTogglePrimeMeridian: (visible: boolean) => void;
  onTogglePosition: (visible: boolean) => void;
  mapConfig?: any;
  layerControlRef?: React.RefObject<any>;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  map,
  L,
  onToggleGrid,
  onToggleLabels,
  onTogglePrimeMeridian,
  onTogglePosition,
  mapConfig,
  layerControlRef
}) => {
  // State
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'display' | 'layers'>('display');
  const [showPosition, setShowPosition] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showPrimeMeridian, setShowPrimeMeridian] = useState(false);
  const [controlAdded, setControlAdded] = useState(false);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({
    political: true,
    climate: false,
    lakes: false,
    rivers: false
  });

  // Priority layers for ordering
  const priorityLayers = ['political', 'climate', 'lakes', 'rivers'];

  // Make sure altitude layer is initialized
  useEffect(() => {
    if (layerControlRef?.current) {
      // Force altitude layer to be added to the map but hidden initially
      console.log("Initializing altitude layer");
      layerControlRef.current.toggleLayer('altitude-layers', false);
    }
  }, [layerControlRef]);

  // Sync layer visibility with SVGLayerControl
  useEffect(() => {
    if (layerControlRef?.current) {
      // Get current visibility state from layer control
      const currentVisibility = layerControlRef.current.getVisibility();
      
      // Filter out altitude-layers since we manage it separately
      const filteredVisibility = { ...currentVisibility };
      delete filteredVisibility['altitude-layers'];
      
      setLayerVisibility(filteredVisibility);
    }
  }, [layerControlRef]);

  // Remove any existing control panel before adding a new one
  useEffect(() => {
    // Remove any existing control panels first
    const existingControlPanels = document.querySelectorAll('.ixmap-control-panel');
    existingControlPanels.forEach(panel => {
      if (panel.parentNode) {
        panel.parentNode.removeChild(panel);
      }
    });
    
    // Cleanup when component unmounts
    return () => {
      // Remove control panel when component unmounts
      const controlPanels = document.querySelectorAll('.ixmap-control-panel');
      controlPanels.forEach(panel => {
        if (panel.parentNode) {
          panel.parentNode.removeChild(panel);
        }
      });
    };
  }, [map]);

  // Handle layer toggle with special handling for political layer
  const handleLayerToggle = (layerId: string, checked: boolean) => {
    // Update local state
    setLayerVisibility(prev => ({
      ...prev,
      [layerId]: checked
    }));
    
    // Use the layerControlRef to toggle the layer
    if (layerControlRef?.current) {
      // Toggle the selected layer
      layerControlRef.current.toggleLayer(layerId, checked);
      
      // Special handling for political layer
      if (layerId === 'political') {
        const shouldShowAltitude = !checked;
        console.log(`Political toggled to ${checked}, setting altitude-layers to ${shouldShowAltitude}`);
        
        // Force toggle altitude layer with a small delay to ensure it's processed after political
        setTimeout(() => {
          layerControlRef.current?.toggleLayer('altitude-layers', shouldShowAltitude);
          console.log(`Altitude layer visibility set to ${shouldShowAltitude}`);
        }, 50);
      }
      
      console.log(`ControlPanel toggled layer: ${layerId} to ${checked}`);
    } else {
      console.warn('Layer control reference not available');
    }
  };

  // Add component did mount effect to initialize altitude layer visibility
  useEffect(() => {
    // Wait for everything to be initialized
    const timer = setTimeout(() => {
      if (layerControlRef?.current && layerVisibility.political === false) {
        console.log("Initial render: Political is off, showing altitude layer");
        layerControlRef.current.toggleLayer('altitude-layers', true);
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  // Watch for political layer changes to update altitude layer
  useEffect(() => {
    if (layerControlRef?.current) {
      const shouldShowAltitude = !layerVisibility.political;
      console.log(`Political changed to ${layerVisibility.political}, altitude should be ${shouldShowAltitude}`);
      layerControlRef.current.toggleLayer('altitude-layers', shouldShowAltitude);
    }
  }, [layerVisibility.political, layerControlRef]);

  useEffect(() => {
    if (!map || !L || controlAdded) return;

    const IxMapControl = L.Control.extend({
      options: {
        position: 'topright'
      },
      
      onAdd: function() {
        const container = L.DomUtil.create('div');
        L.DomUtil.addClass(container, 'ixmap-control-panel');
        
        const toggleButton = L.DomUtil.create('div', '', container);
        L.DomUtil.addClass(toggleButton, 'toggle-button');
        toggleButton.innerHTML = collapsed ? '≫' : '≪';
        
        toggleButton.addEventListener('click', () => {
          setCollapsed(prev => !prev);
        });
        
        const content = L.DomUtil.create('div', '', container);
        L.DomUtil.addClass(content, 'control-content');
        if (collapsed) {
          L.DomUtil.addClass(content, 'hidden');
        }
        
        const title = L.DomUtil.create('div', '', content);
        L.DomUtil.addClass(title, 'control-title');
        title.innerHTML = 'IxMaps Controls';
        
        const tabNav = L.DomUtil.create('div', '', content);
        L.DomUtil.addClass(tabNav, 'tab-navigation');
        
        const displayTab = L.DomUtil.create('div', '', tabNav);
        L.DomUtil.addClass(displayTab, 'tab');
        if (activeTab === 'display') L.DomUtil.addClass(displayTab, 'active');
        displayTab.innerHTML = 'Display';
        
        const layersTab = L.DomUtil.create('div', '', tabNav);
        L.DomUtil.addClass(layersTab, 'tab');
        if (activeTab === 'layers') L.DomUtil.addClass(layersTab, 'active');
        layersTab.innerHTML = 'Layers';
        
        const displayContent = L.DomUtil.create('div', '', content);
        L.DomUtil.addClass(displayContent, 'tab-content');
        if (activeTab === 'display') L.DomUtil.addClass(displayContent, 'active');
        
        const layersContent = L.DomUtil.create('div', '', content);
        L.DomUtil.addClass(layersContent, 'tab-content');
        if (activeTab === 'layers') L.DomUtil.addClass(layersContent, 'active');

        displayTab.addEventListener('click', () => setActiveTab('display'));
        layersTab.addEventListener('click', () => setActiveTab('layers'));
        
        // Display tab content
        const coordSection = L.DomUtil.create('div', '', displayContent);
        L.DomUtil.addClass(coordSection, 'control-section');
        
        const coordTitle = L.DomUtil.create('div', '', coordSection);
        L.DomUtil.addClass(coordTitle, 'section-title');
        coordTitle.innerHTML = 'Coordinates';
        
        createControlItem(coordSection, 'Show Position', showPosition, (checked) => { setShowPosition(checked); onTogglePosition(checked); });
        createControlItem(coordSection, 'Show Grid', showGrid, (checked) => { setShowGrid(checked); onToggleGrid(checked); });
        createControlItem(coordSection, 'Show Labels', showLabels, (checked) => { setShowLabels(checked); onToggleLabels(checked); });
        createControlItem(coordSection, 'Show Prime Meridian', showPrimeMeridian, (checked) => { setShowPrimeMeridian(checked); onTogglePrimeMeridian(checked); });
        
        // Layers tab content
        const layerGroups: Record<string, string[]> = {
          'Base Layers': ['political', 'climate'],
          'Geographic Features': ['lakes', 'rivers']
        };
        
        Object.entries(layerGroups).forEach(([groupName, groupLayerIds]) => {
          const groupContainer = L.DomUtil.create('div', '', layersContent);
          L.DomUtil.addClass(groupContainer, 'layer-group');
          
          const groupTitle = L.DomUtil.create('div', '', groupContainer);
          L.DomUtil.addClass(groupTitle, 'group-title');
          groupTitle.innerHTML = groupName;
          
          groupLayerIds.forEach(layerId => {
            const name = layerId.charAt(0).toUpperCase() + layerId.slice(1).replace(/-/g, ' ');
            const layerItem = L.DomUtil.create('div', '', groupContainer);
            L.DomUtil.addClass(layerItem, 'layer-item');
            
            createControlItem(
              layerItem,
              name,
              layerVisibility[layerId] || false,
              (checked) => { handleLayerToggle(layerId, checked); },
              false // No margin bottom for items within a group
            );
          });
        });
        
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        
        return container;
      }
    });
    
    function createControlItem(container: HTMLElement, label: string, checked: boolean, onChange: (checked: boolean) => void, addMargin = true) {
      const controlItem = L.DomUtil.create('div', '', container);
      L.DomUtil.addClass(controlItem, 'control-item');
      // Remove default margin if addMargin is false (Tailwind handles this via base class now)
      // If specific margin control is needed beyond default, add custom classes like 'mb-0'
      if (!addMargin) {
         // Example: L.DomUtil.addClass(controlItem, 'mb-0'); // if needed
      }
      
      const checkbox = L.DomUtil.create('input', '', controlItem);
      checkbox.type = 'checkbox';
      checkbox.checked = checked;
      checkbox.setAttribute('data-control', label.toLowerCase().replace(/\s+/g, '-'));
      L.DomUtil.addClass(checkbox, 'mr-2'); // Tailwind class for margin
      
      const labelElement = L.DomUtil.create('label', '', controlItem);
      labelElement.innerHTML = label;
      L.DomUtil.addClass(labelElement, 'cursor-pointer'); // Tailwind class for cursor
      
      checkbox.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        onChange(target.checked);
      });
      
      return controlItem;
    }
    
    map.addControl(new IxMapControl());
    setControlAdded(true);
  }, [map, L, controlAdded, layerVisibility]); // Dependencies simplified, state changes handled by separate useEffect

  // Update control UI when state changes (collapsed, activeTab)
  useEffect(() => {
    // Ensure map, L, and controlAdded are ready, and L.DomUtil is available
    if (!map || !L || !L.DomUtil || !controlAdded) return;

    // Find the main control panel element more reliably
    const controlPanel = map.getContainer().querySelector('.ixmap-control-panel');
    if (!controlPanel) {
      console.warn("Control panel element not found in update effect.");
      return; // Exit if the control panel itself isn't found
    }

    const toggleButton = controlPanel.querySelector('.toggle-button') as HTMLElement;
    const content = controlPanel.querySelector('.control-content') as HTMLElement;

    if (toggleButton) {
      toggleButton.innerHTML = collapsed ? '≫' : '≪';
    }

    // Use direct style manipulation for visibility and add/remove collapsed class
    if (content) {
      content.style.display = collapsed ? 'none' : '';
      if (collapsed) {
        L.DomUtil.addClass(controlPanel, 'collapsed-state'); // Add class when collapsed
      } else {
        L.DomUtil.removeClass(controlPanel, 'collapsed-state'); // Remove class when expanded
      }
    }

    // Only update tab content and checkboxes if the panel is not collapsed and content exists
    if (!collapsed && content) {
      // Scope selectors within the content element for tabs and checkboxes
      const displayContent = content.querySelector('.tab-content:has(.control-section)') as HTMLElement;
      const layersContent = content.querySelector('.tab-content:has(.layer-group)') as HTMLElement;
      // Use more specific selectors for tabs if possible, assuming order for now
      const displayTab = controlPanel.querySelector('.tab-navigation .tab:nth-child(1)') as HTMLElement;
      const layersTab = controlPanel.querySelector('.tab-navigation .tab:nth-child(2)') as HTMLElement;

      // Ensure all tab elements are found before proceeding
      if (displayContent && layersContent && displayTab && layersTab) {
        const setActive = (el: HTMLElement, active: boolean) => {
          if (active) L.DomUtil.addClass(el, 'active');
          else L.DomUtil.removeClass(el, 'active');
        };

        const isDisplayActive = activeTab === 'display';
        setActive(displayContent, isDisplayActive);
        setActive(layersContent, !isDisplayActive);
        setActive(displayTab, isDisplayActive);
        setActive(layersTab, !isDisplayActive);
      } else {
         console.warn("Tab elements not found for updating active state.");
      }

      // Update checkboxes based on state (scoped within content)
      const updateCheckbox = (dataControlValue: string, checked: boolean) => {
        // More specific selector using data attribute
        const checkbox = content.querySelector(`input[data-control="${dataControlValue}"]`) as HTMLInputElement;
        if (checkbox) {
          checkbox.checked = checked;
        } else {
           // Optional: Warn if a specific checkbox isn't found, could indicate mismatch
           // console.warn(`Checkbox with data-control="${dataControlValue}" not found.`);
        }
      };

      updateCheckbox('show-prime-meridian', showPrimeMeridian);
      updateCheckbox('show-position', showPosition);
      updateCheckbox('show-grid', showGrid);
      updateCheckbox('show-labels', showLabels);

      // Update layer checkboxes
      Object.keys(layerVisibility).forEach(layerId => {
        // Assuming data-control value matches the layerId used in layerVisibility state
        // We need to convert the label back to the data-control format used in createControlItem
        const dataControlId = layerId === 'political' ? 'political' : // Handle potential variations if needed
                              layerId === 'climate' ? 'climate' :
                              layerId === 'lakes' ? 'lakes' :
                              layerId === 'rivers' ? 'rivers' : layerId; // Fallback

        // Also check the display tab controls using their generated data-control values
        if (!['political', 'climate', 'lakes', 'rivers'].includes(layerId)) {
           // This part seems redundant given the specific updates above, but keeping for robustness
           // Ensure layerVisibility only contains layer keys handled in the loop below
        }
         // Correctly format the data-control attribute value based on how it's created
         // It looks like layerId is used directly in handleLayerToggle and derived from layerGroups
         // but createControlItem uses label.toLowerCase().replace(/\s+/g, '-')
         // Let's assume layerVisibility keys match the IDs used in layerGroups directly for now.
         updateCheckbox(layerId, layerVisibility[layerId]);
      });
    }
    // Simplify dependencies: Only include state variables that directly affect the UI updates
    // L and map are stable refs/objects after initial load, controlAdded prevents running too early.
  }, [collapsed, activeTab, controlAdded, showPrimeMeridian, showPosition, showGrid, showLabels, layerVisibility, map, L]);

  // This component doesn't render anything in the DOM tree
  return null;
};

export default ControlPanel;
