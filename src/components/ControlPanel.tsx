'use client';

import React, { useState, useEffect } from 'react';

interface ControlPanelProps {
  map: any;
  L: any;
  onToggleGrid: (visible: boolean) => void;
  onToggleLabels: (visible: boolean) => void;
  onTogglePrimeMeridian: (visible: boolean) => void;
  onTogglePosition: (visible: boolean) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  map,
  L,
  onToggleGrid,
  onToggleLabels,
  onTogglePrimeMeridian,
  onTogglePosition
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [showPosition, setShowPosition] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showPrimeMeridian, setShowPrimeMeridian] = useState(false);
  const [controlAdded, setControlAdded] = useState(false);

  // Remove any existing control panel before adding a new one
  useEffect(() => {
    // Remove any existing control panels first
    const existingControlPanels = document.querySelectorAll('.coordinate-control');
    existingControlPanels.forEach(panel => {
      if (panel.parentNode) {
        panel.parentNode.removeChild(panel);
      }
    });
  }, []);

  useEffect(() => {
    if (!map || !L || controlAdded) return;

    // Create control
    const CoordinateControl = L.Control.extend({
      options: {
        position: 'topright'
      },
      
      onAdd: function() {
        const container = L.DomUtil.create('div', 'leaflet-control coordinate-control');
        container.style.backgroundColor = 'white';
        container.style.padding = '0';
        container.style.margin = '10px';
        container.style.border = '2px solid rgba(0,0,0,0.2)';
        container.style.borderRadius = '4px';
        container.style.boxShadow = '0 1px 7px rgba(0,0,0,0.4)';
        container.style.cursor = 'auto';
        container.style.width = '200px';
        container.style.transition = 'all 0.3s ease';
        
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
        title.innerHTML = 'Coordinates';
        title.style.fontWeight = 'bold';
        title.style.fontSize = '14px';
        title.style.padding = '10px';
        title.style.borderBottom = '1px solid #ccc';
        
        // Controls
        const controlsContainer = L.DomUtil.create('div', 'controls-container', content);
        controlsContainer.style.padding = '10px';
        
        // Position control
        const positionControl = createControlItem(
          controlsContainer,
          'Show Position',
          showPosition,
          (checked) => {
            setShowPosition(checked);
            onTogglePosition(checked);
          }
        );
        
        // Grid control
        const gridControl = createControlItem(
          controlsContainer,
          'Show Grid',
          showGrid,
          (checked) => {
            setShowGrid(checked);
            onToggleGrid(checked);
          }
        );
        
        // Labels control
        const labelsControl = createControlItem(
          controlsContainer,
          'Show Labels',
          showLabels,
          (checked) => {
            setShowLabels(checked);
            onToggleLabels(checked);
          }
        );
        
        // Prime Meridian section
        const meridianSection = L.DomUtil.create('div', 'meridian-section', content);
        meridianSection.style.padding = '10px';
        meridianSection.style.borderTop = '1px solid #ccc';
        
        // Prime Meridian title
        const meridianTitle = L.DomUtil.create('div', 'meridian-title', meridianSection);
        meridianTitle.innerHTML = 'Prime Meridian';
        meridianTitle.style.fontWeight = 'bold';
        meridianTitle.style.fontSize = '14px';
        meridianTitle.style.marginBottom = '10px';
        
        // Prime Meridian control
        const meridianControl = createControlItem(
          meridianSection,
          'Show Prime Meridian',
          showPrimeMeridian,
          (checked) => {
            setShowPrimeMeridian(checked);
            onTogglePrimeMeridian(checked);
          }
        );
        
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        
        return container;
      }
    });
    
    function createControlItem(container: HTMLElement, label: string, checked: boolean, onChange: (checked: boolean) => void) {
      const controlItem = L.DomUtil.create('div', 'control-item', container);
      controlItem.style.marginBottom = '10px';
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
      
      checkbox.addEventListener('change', (e: { target: HTMLInputElement; }) => {
        const target = e.target as HTMLInputElement;
        onChange(target.checked);
      });
      
      return controlItem;
    }
    
    // Add control to map
    map.addControl(new CoordinateControl());
    setControlAdded(true);
  }, [map, L, collapsed, controlAdded, onToggleGrid, onToggleLabels, onTogglePrimeMeridian, onTogglePosition, showGrid, showLabels, showPosition, showPrimeMeridian]);

  // Update control visibility when state changes
  useEffect(() => {
    if (!controlAdded) return;

    const toggleButton = document.querySelector('.toggle-button') as HTMLElement;
    const content = document.querySelector('.control-content') as HTMLElement;
    
    if (toggleButton && content) {
      toggleButton.innerHTML = collapsed ? '≫' : '≪';
      content.style.display = collapsed ? 'none' : 'block';
    }
  }, [collapsed, controlAdded]);

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      // Remove control when component unmounts
      const controlPanels = document.querySelectorAll('.coordinate-control');
      controlPanels.forEach(panel => {
        if (panel.parentNode) {
          panel.parentNode.removeChild(panel);
        }
      });
    };
  }, []);

  // This component doesn't render anything in the DOM tree
  return null;
};

export default ControlPanel;