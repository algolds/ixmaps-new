'use client';

import React, { useEffect, useState } from 'react';
import { LayerVisibility } from '@/types';

interface LayerManagerProps {
  map: any;
  layers: Record<string, any>;
  onUpdate?: (visibility: LayerVisibility) => void;
}

const LayerManager: React.FC<LayerManagerProps> = ({ map, layers, onUpdate }) => {
  const [visibility, setVisibility] = useState<LayerVisibility>({
    political: false,
    climate: false,
    lakes: false,
    rivers: false,  
    mountains: false,
    cities: false,
    countries: true,
    states: false,
    territories: false,
    disputed: false,
    labels: true,
    grid: false,
    scale: true,
    compass: true
  });
  
  const [collapsed, setCollapsed] = useState(false);

  // Initialize layer visibility based on stored state
  useEffect(() => {
    // Apply initial visibility
    Object.entries(visibility).forEach(([key, visible]) => {
      if (layers[key]) {
        if (visible) {
          layers[key].addTo(map);
        } else {
          layers[key].remove();
        }
      }
    });
  }, [map, layers]);

  // Handle layer toggle
  const handleToggle = (layerName: keyof LayerVisibility) => {
    setVisibility(prev => {
      const newVisibility = {
        ...prev,
        [layerName]: !prev[layerName]
      };
      
      // Update layer visibility
      if (layers[layerName]) {
        if (newVisibility[layerName]) {
          layers[layerName].addTo(map);
        } else {
          layers[layerName].remove();
        }
      }
      
      // Notify parent component if needed
      if (onUpdate) {
        onUpdate(newVisibility);
      }
      
      return newVisibility;
    });
  };

  return (
    <div className="leaflet-control-layers control-panel" style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      zIndex: 1000,
      background: 'white',
      padding: '10px',
      borderRadius: '5px',
      boxShadow: '0 0 10px rgba(0, 0, 0, 0.2)',
      transition: 'transform 0.3s ease, opacity 0.3s ease',
      maxWidth: '250px',
      maxHeight: '80vh',
      overflowY: 'auto',
      transform: collapsed ? 'translateX(calc(100% - 30px))' : 'translateX(0)'
    }}>
      <div className="layer-control">
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: '10px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          Map Layers 
          <span 
            className="control-toggle-button" 
            onClick={() => setCollapsed(!collapsed)}
            style={{
              textDecoration: 'none',
              fontSize: '18px',
              width: '30px',
              height: '30px',
              lineHeight: '30px',
              textAlign: 'center',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            {collapsed ? '»' : '×'}
          </span>
        </h3>
        
        {!collapsed && (
          <div id="layer-list">
            <div className="layer-group" style={{ marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
              <h4 style={{ margin: '5px 0', fontSize: '14px' }}>Base Layers</h4>
              <div className="layer-toggle" style={{ marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={visibility.political} 
                    onChange={() => handleToggle('political')}
                  /> Political Boundaries
                </label>
              </div>
              <div className="layer-toggle" style={{ marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={visibility.climate} 
                    onChange={() => handleToggle('climate')}
                  /> Climate Zones
                </label>
              </div>
            </div>
            
            <div className="layer-group" style={{ marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
              <h4 style={{ margin: '5px 0', fontSize: '14px' }}>Water Features</h4>
              <div className="layer-toggle" style={{ marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={visibility.lakes} 
                    onChange={() => handleToggle('lakes')}
                  /> Lakes
                </label>
              </div>
              <div className="layer-toggle" style={{ marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={visibility.rivers} 
                    onChange={() => handleToggle('rivers')}
                  /> Rivers
                </label>
              </div>
            </div>
            
            <div className="layer-group" style={{ marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
              <h4 style={{ margin: '5px 0', fontSize: '14px' }}>Land Features</h4>
              <div className="layer-toggle" style={{ marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={visibility.mountains} 
                    onChange={() => handleToggle('mountains')}
                  /> Mountains
                </label>
              </div>
            </div>
            
            <div className="layer-group" style={{ marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
              <h4 style={{ margin: '5px 0', fontSize: '14px' }}>Places</h4>
              <div className="layer-toggle" style={{ marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={visibility.cities} 
                    onChange={() => handleToggle('cities')}
                  /> Cities
                </label>
              </div>
              <div className="layer-toggle" style={{ marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={visibility.countries} 
                    onChange={() => handleToggle('countries')}
                  /> Countries
                </label>
              </div>
              <div className="layer-toggle" style={{ marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={visibility.states} 
                    onChange={() => handleToggle('states')}
                  /> States/Provinces
                </label>
              </div>
            </div>
            
            <div className="layer-group" style={{ marginBottom: '15px' }}>
              <h4 style={{ margin: '5px 0', fontSize: '14px' }}>Display Options</h4>
              <div className="layer-toggle" style={{ marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={visibility.labels} 
                    onChange={() => handleToggle('labels')}
                  /> Labels
                </label>
              </div>
              <div className="layer-toggle" style={{ marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={visibility.grid} 
                    onChange={() => handleToggle('grid')}
                  /> Grid
                </label>
              </div>
              <div className="layer-toggle" style={{ marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={visibility.scale} 
                    onChange={() => handleToggle('scale')}
                  /> Scale
                </label>
              </div>
              <div className="layer-toggle" style={{ marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={visibility.compass} 
                    onChange={() => handleToggle('compass')}
                  /> Compass
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LayerManager;