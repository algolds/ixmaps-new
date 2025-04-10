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
    rivers: false,
    'altitude-layers': false
  });

  // Priority layers for ordering
  const priorityLayers = ['political', 'climate', 'lakes', 'rivers', 'altitude-layers'];

  // Sync layer visibility with SVGLayerControl
  useEffect(() => {
    if (layerControlRef?.current) {
      // Get current visibility state from layer control
      const currentVisibility = layerControlRef.current.getVisibility();
      setLayerVisibility(currentVisibility);
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

  // Handle layer toggle
  const handleLayerToggle = (layerId: string, checked: boolean) => {
    // Update local state
    setLayerVisibility(prev => ({
      ...prev,
      [layerId]: checked
    }));
    
    // Use the layerControlRef to toggle the layer
    if (layerControlRef?.current) {
      layerControlRef.current.toggleLayer(layerId, checked);
      console.log(`ControlPanel toggled layer: ${layerId} to ${checked}`);
    } else {
      console.warn('Layer control reference not available');
    }
  };

  useEffect(() => {
    if (!map || !L || controlAdded) return;

    // Create control
    const IxMapControl = L.Control.extend({
      options: {
        position: 'topright'
      },
      
      onAdd: function() {
        const container = L.DomUtil.create('div', 'leaflet-control ixmap-control-panel');
        container.style.backgroundColor = 'white';
        container.style.padding = '0';
        container.style.margin = '10px';
        container.style.border = '2px solid rgba(0,0,0,0.2)';
        container.style.borderRadius = '4px';
        container.style.boxShadow = '0 1px 7px rgba(0,0,0,0.4)';
        container.style.cursor = 'auto';
        container.style.width = '250px';
        container.style.transition = 'all 0.3s ease';
        container.style.maxHeight = '80vh';
        container.style.overflowY = 'auto';
        
        // Toggle button
        const toggleButton = L.DomUtil.create('div', 'toggle-button', container);
        toggleButton.innerHTML = collapsed ? '≫' : '≪';
        toggleButton.style.position = 'absolute';
        toggleButton.style.left = '-15px';
        toggleButton.style.top = '10px';
        toggleButton.style.backgroundColor = 'white';
        toggleButton.style.border = '2px solid rgba(0,0,0,0.2)';
        toggleButton.style.borderRadius = '4px';
        toggleButton.style.width = '20px';
        toggleButton.style.height = '20px';
        toggleButton.style.textAlign = 'center';
        toggleButton.style.lineHeight = '16px';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.zIndex = '1000';
        
        toggleButton.addEventListener('click', () => {
          setCollapsed(!collapsed);
        });
        
        // Control content
        const content = L.DomUtil.create('div', 'control-content', container);
        if (collapsed) {
          content.style.display = 'none';
        } else {
          content.style.display = 'block';
        }
        
        // Title
        const title = L.DomUtil.create('div', 'control-title', content);
        title.innerHTML = 'IxMaps Controls';
        title.style.fontWeight = 'bold';
        title.style.fontSize = '16px';
        title.style.padding = '10px';
        title.style.borderBottom = '1px solid #ccc';
        title.style.textAlign = 'center';
        
        // Tab navigation
        const tabNav = L.DomUtil.create('div', 'tab-navigation', content);
        tabNav.style.display = 'flex';
        tabNav.style.borderBottom = '1px solid #ccc';
        
        const displayTab = L.DomUtil.create('div', 'tab', tabNav);
        displayTab.innerHTML = 'Display';
        displayTab.style.flex = '1';
        displayTab.style.padding = '8px';
        displayTab.style.textAlign = 'center';
        displayTab.style.cursor = 'pointer';
        displayTab.style.backgroundColor = activeTab === 'display' ? '#f0f0f0' : 'transparent';
        displayTab.style.fontWeight = activeTab === 'display' ? 'bold' : 'normal';
        
        const layersTab = L.DomUtil.create('div', 'tab', tabNav);
        layersTab.innerHTML = 'Layers';
        layersTab.style.flex = '1';
        layersTab.style.padding = '8px';
        layersTab.style.textAlign = 'center';
        layersTab.style.cursor = 'pointer';
        layersTab.style.backgroundColor = activeTab === 'layers' ? '#f0f0f0' : 'transparent';
        layersTab.style.fontWeight = activeTab === 'layers' ? 'bold' : 'normal';
        
        displayTab.addEventListener('click', () => {
          setActiveTab('display');
          displayTab.style.backgroundColor = '#f0f0f0';
          displayTab.style.fontWeight = 'bold';
          layersTab.style.backgroundColor = 'transparent';
          layersTab.style.fontWeight = 'normal';
          displayContent.style.display = 'block';
          layersContent.style.display = 'none';
        });
        
        layersTab.addEventListener('click', () => {
          setActiveTab('layers');
          layersTab.style.backgroundColor = '#f0f0f0';
          layersTab.style.fontWeight = 'bold';
          displayTab.style.backgroundColor = 'transparent';
          displayTab.style.fontWeight = 'normal';
          displayContent.style.display = 'none';
          layersContent.style.display = 'block';
        });
        
        // Display tab content
        const displayContent = L.DomUtil.create('div', 'display-content', content);
        displayContent.style.display = activeTab === 'display' ? 'block' : 'none';
        displayContent.style.padding = '10px';
        
        // Section: Coordinates
        const coordSection = L.DomUtil.create('div', 'control-section', displayContent);
        coordSection.style.marginBottom = '15px';
        
        const coordTitle = L.DomUtil.create('div', 'section-title', coordSection);
        coordTitle.innerHTML = 'Coordinates';
        coordTitle.style.fontWeight = 'bold';
        coordTitle.style.marginBottom = '8px';
        coordTitle.style.fontSize = '14px';
        
        // Position control
        createControlItem(
          coordSection,
          'Show Position',
          showPosition,
          (checked) => {
            setShowPosition(checked);
            onTogglePosition(checked);
          }
        );
        
        // Grid control
        createControlItem(
          coordSection,
          'Show Grid',
          showGrid,
          (checked) => {
            setShowGrid(checked);
            onToggleGrid(checked);
          }
        );
        
        // Labels control
        createControlItem(
          coordSection,
          'Show Labels',
          showLabels,
          (checked) => {
            setShowLabels(checked);
            onToggleLabels(checked);
          }
        );
        
        // Prime Meridian control
        createControlItem(
          coordSection,
          'Show Prime Meridian',
          showPrimeMeridian,
          (checked) => {
            setShowPrimeMeridian(checked);
            onTogglePrimeMeridian(checked);
          }
        );
        
        // Layers tab content
        const layersContent = L.DomUtil.create('div', 'layers-content', content);
        layersContent.style.display = activeTab === 'layers' ? 'block' : 'none';
        layersContent.style.padding = '10px';
        
        // Layer groups
        const layerGroups: Record<string, string[]> = {
          'Base Layers': ['political', 'climate'],
          'Geographic Features': ['lakes', 'rivers', 'altitude-layers']
        };
        
        // Add layer groups
        Object.entries(layerGroups).forEach(([groupName, groupLayerIds]) => {
          // Create group container
          const groupContainer = L.DomUtil.create('div', 'layer-group', layersContent);
          groupContainer.style.marginBottom = '15px';
          
          // Group title
          const groupTitle = L.DomUtil.create('div', 'group-title', groupContainer);
          groupTitle.innerHTML = groupName;
          groupTitle.style.fontWeight = 'bold';
          groupTitle.style.marginBottom = '8px';
          groupTitle.style.fontSize = '14px';
          
          // Add layers in this group
          groupLayerIds.forEach(layerId => {
            // Format layer name
            const name = layerId.charAt(0).toUpperCase() + layerId.slice(1).replace(/-/g, ' ');
            
            // Create layer item
            const layerItem = L.DomUtil.create('div', 'layer-item', groupContainer);
            layerItem.style.marginBottom = '8px';
            layerItem.style.marginLeft = '10px';
            
            // Create checkbox control for this layer
            createControlItem(
              layerItem,
              name,
              layerVisibility[layerId] || false,
              (checked) => {
                handleLayerToggle(layerId, checked);
              },
              false // No margin bottom
            );
          });
        });
        
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        
        return container;
      }
    });
    
    function createControlItem(container: HTMLElement, label: string, checked: boolean, onChange: (checked: boolean) => void, addMargin = true) {
      const controlItem = L.DomUtil.create('div', 'control-item', container);
      if (addMargin) {
        controlItem.style.marginBottom = '10px';
      }
      controlItem.style.display = 'flex';
      controlItem.style.alignItems = 'center';
      
      const checkbox = L.DomUtil.create('input', '', controlItem);
      checkbox.type = 'checkbox';
      checkbox.checked = checked;
      checkbox.style.marginRight = '8px';
      
      // Add a data attribute to help identify this checkbox
      checkbox.setAttribute('data-control', label.toLowerCase().replace(/\s+/g, '-'));
      
      const labelElement = L.DomUtil.create('label', '', controlItem);
      labelElement.innerHTML = label;
      labelElement.style.cursor = 'pointer';
      
      checkbox.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        onChange(target.checked);
      });
      
      return controlItem;
    }
    
    // Add control to map
    map.addControl(new IxMapControl());
    setControlAdded(true);
  }, [map, L, collapsed, activeTab, controlAdded, onToggleGrid, onToggleLabels, 
      onTogglePrimeMeridian, onTogglePosition, showGrid, showLabels, showPosition, 
      showPrimeMeridian, layerVisibility]);

  // Update control visibility when state changes
  useEffect(() => {
    if (!controlAdded) return;

    const toggleButton = document.querySelector('.toggle-button') as HTMLElement;
    const content = document.querySelector('.control-content') as HTMLElement;
    
    if (toggleButton && content) {
      toggleButton.innerHTML = collapsed ? '≫' : '≪';
      content.style.display = collapsed ? 'none' : 'block';
    }
    
    const displayContent = document.querySelector('.display-content') as HTMLElement;
    const layersContent = document.querySelector('.layers-content') as HTMLElement;
    
    if (displayContent && layersContent) {
      displayContent.style.display = activeTab === 'display' ? 'block' : 'none';
      layersContent.style.display = activeTab === 'layers' ? 'block' : 'none';
    }
    
    const displayTab = document.querySelector('.tab:first-child') as HTMLElement;
    const layersTab = document.querySelector('.tab:last-child') as HTMLElement;
    
    if (displayTab && layersTab) {
      displayTab.style.backgroundColor = activeTab === 'display' ? '#f0f0f0' : 'transparent';
      displayTab.style.fontWeight = activeTab === 'display' ? 'bold' : 'normal';
      layersTab.style.backgroundColor = activeTab === 'layers' ? '#f0f0f0' : 'transparent';
      layersTab.style.fontWeight = activeTab === 'layers' ? 'bold' : 'normal';
    }

    // Update the checkbox state for the Prime Meridian control to match the component state
    const primeMeridianCheckbox = document.querySelector('input[data-control="show-prime-meridian"]') as HTMLInputElement;
    if (primeMeridianCheckbox) {
      primeMeridianCheckbox.checked = showPrimeMeridian;
    }
  }, [collapsed, activeTab, controlAdded, showPrimeMeridian]);

  // Update state when props change
  useEffect(() => {
    // This effect synchronizes the internal state with the parent component
    // For example, if the Prime Meridian state changes elsewhere, update the checkbox
    const primeMeridianCheckbox = document.querySelector('input[data-control="show-prime-meridian"]') as HTMLInputElement;
    if (primeMeridianCheckbox && primeMeridianCheckbox.checked !== showPrimeMeridian) {
      primeMeridianCheckbox.checked = showPrimeMeridian;
    }
  }, [showPrimeMeridian]);

  // This component doesn't render anything in the DOM tree
  return null;
};

export default ControlPanel;