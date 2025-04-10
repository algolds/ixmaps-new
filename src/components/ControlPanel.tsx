'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SVGLayer } from '@/types/svg-types';
import { SVGLayerControlRef } from './SVGLayerControl';

interface ControlPanelProps {
  map: any;
  L: any;
  onToggleGrid: (visible: boolean) => void;
  onToggleLabels: (visible: boolean) => void;
  onToggleCountryLabels: (visible: boolean) => void; // Add this line
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
  const [showCountryLabels, setShowCountryLabels] = useState(true);

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
        // Create the main container
        const container = L.DomUtil.create('div');
        L.DomUtil.addClass(container, 'ixmap-control-panel');
        L.DomUtil.addClass(container, collapsed ? 'collapsed' : 'expanded');
        
        // Create toggle button with Leaflet styling
        const toggleButton = L.DomUtil.create('div', '', container);
        L.DomUtil.addClass(toggleButton, 'toggle-button');
        
        // Use cog icon when collapsed, arrow when expanded
        toggleButton.innerHTML = collapsed ? '<i class="cog-icon">⚙️</i>' : '≪';
        
        toggleButton.addEventListener('click', () => {
          setCollapsed(prev => !prev);
        });
        
        // Create content container
        const content = L.DomUtil.create('div', '', container);
        L.DomUtil.addClass(content, 'control-content');
        if (collapsed) {
          L.DomUtil.addClass(content, 'hidden');
        }
        
        // Create title
        const title = L.DomUtil.create('div', '', content);
        L.DomUtil.addClass(title, 'control-title');
        title.innerHTML = 'IxMaps Controls';
        
        // Create tab navigation
        const tabNav = L.DomUtil.create('div', '', content);
        L.DomUtil.addClass(tabNav, 'tab-navigation');
        
        // Display tab
        const displayTab = L.DomUtil.create('div', '', tabNav);
        L.DomUtil.addClass(displayTab, 'tab');
        if (activeTab === 'display') L.DomUtil.addClass(displayTab, 'active');
        displayTab.innerHTML = 'Display';
        
        // Layers tab
        const layersTab = L.DomUtil.create('div', '', tabNav);
        L.DomUtil.addClass(layersTab, 'tab');
        if (activeTab === 'layers') L.DomUtil.addClass(layersTab, 'active');
        layersTab.innerHTML = 'Layers';
        
        // Create tab content containers
        const displayContent = L.DomUtil.create('div', '', content);
        L.DomUtil.addClass(displayContent, 'tab-content');
        if (activeTab === 'display') L.DomUtil.addClass(displayContent, 'active');
        
        const layersContent = L.DomUtil.create('div', '', content);
        L.DomUtil.addClass(layersContent, 'tab-content');
        if (activeTab === 'layers') L.DomUtil.addClass(layersContent, 'active');

        // Add tab click handlers
        displayTab.addEventListener('click', () => setActiveTab('display'));
        layersTab.addEventListener('click', () => setActiveTab('layers'));
        
        // == Display tab content ==
        const coordSection = L.DomUtil.create('div', '', displayContent);
        L.DomUtil.addClass(coordSection, 'control-section');
        
        const coordTitle = L.DomUtil.create('div', '', coordSection);
        L.DomUtil.addClass(coordTitle, 'section-title');
        coordTitle.innerHTML = 'Coordinates';
        
        // Add control items
        createControlItem(coordSection, 'Show Position', showPosition, (checked) => { 
          setShowPosition(checked); 
          onTogglePosition(checked); 
        });
        
        createControlItem(coordSection, 'Show Grid', showGrid, (checked) => { 
          setShowGrid(checked); 
          onToggleGrid(checked); 
        });
        
        createControlItem(coordSection, 'Show Labels', showLabels, (checked) => { 
          setShowLabels(checked); 
          onToggleLabels(checked); 
        });
        
        createControlItem(coordSection, 'Show Prime Meridian', showPrimeMeridian, (checked) => { 
          setShowPrimeMeridian(checked); 
          onTogglePrimeMeridian(checked); 
        });

        createControlItem(coordSection, 'Show Country Labels', showCountryLabels, (checked) => { 
          setShowCountryLabels(checked); 
          onToggleLabels(checked); // Changed from onToggleLabels
        });
        // == Layers tab content ==
        const layerGroups: Record<string, string[]> = {
          'Base Layers': ['political', 'climate'],
          'Geographic Features': ['lakes', 'rivers']
        };
        
        // Create layer groups
        Object.entries(layerGroups).forEach(([groupName, groupLayerIds]) => {
          const groupContainer = L.DomUtil.create('div', '', layersContent);
          L.DomUtil.addClass(groupContainer, 'layer-group');
          
          const groupTitle = L.DomUtil.create('div', '', groupContainer);
          L.DomUtil.addClass(groupTitle, 'group-title');
          groupTitle.innerHTML = groupName;
          
          // Create layer items
          groupLayerIds.forEach(layerId => {
            const name = layerId.charAt(0).toUpperCase() + layerId.slice(1).replace(/-/g, ' ');
            const layerItem = L.DomUtil.create('div', '', groupContainer);
            L.DomUtil.addClass(layerItem, 'layer-item');
            
            createControlItem(
              layerItem,
              name,
              layerVisibility[layerId] || false,
              (checked) => { handleLayerToggle(layerId, checked); }
            );
          });
        });
        
        // Disable map events propagation
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        
        return container;
      }
    });
    
    // Helper function to create control items with checkboxes
    function createControlItem(
      container: HTMLElement, 
      label: string, 
      checked: boolean, 
      onChange: (checked: boolean) => void
    ) {
      const controlItem = L.DomUtil.create('div', '', container);
      L.DomUtil.addClass(controlItem, 'control-item');
      
      // Create checkbox
      const checkbox = L.DomUtil.create('input', '', controlItem);
      checkbox.type = 'checkbox';
      checkbox.checked = checked;
      checkbox.setAttribute('data-control', label.toLowerCase().replace(/\s+/g, '-'));
      
      // Create label
      const labelElement = L.DomUtil.create('label', '', controlItem);
      labelElement.innerHTML = label;
      
      // Add change handler
      checkbox.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        onChange(target.checked);
      });
      
      return controlItem;
    }
    
    // Add the control to the map
    map.addControl(new IxMapControl());
    setControlAdded(true);
  }, [map, L, controlAdded, collapsed, activeTab, showPosition, showGrid, showLabels, showPrimeMeridian, layerVisibility]);

  // Update control panel state when collapsed or activeTab changes
  useEffect(() => {
    if (!map || !L || !controlAdded) return;
    
    const controlPanel = document.querySelector('.ixmap-control-panel');
    if (!controlPanel) return;
    
    // Update collapsed state
    if (collapsed) {
      controlPanel.classList.add('collapsed');
      controlPanel.classList.remove('expanded');
    } else {
      controlPanel.classList.remove('collapsed');
      controlPanel.classList.add('expanded');
    }
    
    // Update toggle button text
    const toggleButton = controlPanel.querySelector('.toggle-button');
    if (toggleButton) {
      (toggleButton as HTMLElement).innerHTML = collapsed ? '<i class="cog-icon">⚙️</i>' : '≪';
    }
    
    // Update content visibility
    const content = controlPanel.querySelector('.control-content');
    if (content) {
      if (collapsed) {
        content.classList.add('hidden');
      } else {
        content.classList.remove('hidden');
      }
    }
    
    // Only update tab states if panel is expanded
    if (!collapsed) {
      // Update active tab
      const tabs = controlPanel.querySelectorAll('.tab');
      const tabContents = controlPanel.querySelectorAll('.tab-content');
      
      tabs.forEach((tab, index) => {
        if (index === 0) { // Display tab
          if (activeTab === 'display') {
            tab.classList.add('active');
          } else {
            tab.classList.remove('active');
          }
        } else if (index === 1) { // Layers tab
          if (activeTab === 'layers') {
            tab.classList.add('active');
          } else {
            tab.classList.remove('active');
          }
        }
      });
      
      tabContents.forEach((content, index) => {
        if (index === 0) { // Display content
          if (activeTab === 'display') {
            content.classList.add('active');
          } else {
            content.classList.remove('active');
          }
        } else if (index === 1) { // Layers content
          if (activeTab === 'layers') {
            content.classList.add('active');
          } else {
            content.classList.remove('active');
          }
        }
      });
      
      // Update checkbox states
      const updateCheckbox = (dataControlValue: string, checked: boolean) => {
        const checkbox = controlPanel.querySelector(`input[data-control="${dataControlValue}"]`) as HTMLInputElement;
        if (checkbox) {
          checkbox.checked = checked;
        }
      };
      
      // Update display options
      updateCheckbox('show-position', showPosition);
      updateCheckbox('show-grid', showGrid);
      updateCheckbox('show-labels', showLabels);
      updateCheckbox('show-prime-meridian', showPrimeMeridian);
      updateCheckbox('show-country-labels', showCountryLabels);

      // Update layer visibility
      Object.entries(layerVisibility).forEach(([layerId, isVisible]) => {
        updateCheckbox(layerId, isVisible);
      });
    }
  }, [collapsed, activeTab, controlAdded, showPosition, showGrid, showLabels, showPrimeMeridian, layerVisibility, map, L]);

  // This component doesn't render anything in the DOM tree
  return null;
};

export default ControlPanel;