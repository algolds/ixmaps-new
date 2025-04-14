// src/components/LeafletDebugDisplay.tsx
'use client';

import React from 'react';

interface LeafletDebugDisplayProps {
  scriptLoaded: boolean;
  mapContainerReady: boolean;
  isInitialized: boolean;
  cleanupFlag: boolean; // Pass the boolean value, not the ref
  debugMessages: string[];
}

const LeafletDebugDisplay: React.FC<LeafletDebugDisplayProps> = ({
  scriptLoaded,
  mapContainerReady,
  isInitialized,
  cleanupFlag,
  debugMessages,
}) => {
  // Only render the debug panel in development environment
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 10000, // High z-index
        backgroundColor: 'rgba(255,255,255,0.9)',
        padding: '10px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        maxHeight: '300px', // Increased height
        maxWidth: '350px', // Increased width
        overflowY: 'auto',
        fontSize: '10px',
        fontFamily: 'monospace',
        display: 'block',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
      }}
    >
      <h4 style={{ margin: '0 0 5px 0', fontSize: '12px' }}>
        Leaflet Loader Debug (External Ref Mode):
      </h4>
      {/* Status Section */}
      <div id="leaflet-status">
        <p>Script Loaded: {scriptLoaded ? '✅ Yes' : '⏳ No'}</p>
        <p>Container Ready: {mapContainerReady ? '✅ Yes' : '⏳ No'}</p>
        <p>Map Initialized: {isInitialized ? '✅ Yes' : '⏳ No'}</p>
        <p>Cleanup Flag: {cleanupFlag ? '🚫 Yes' : '✅ No'}</p>
        <hr style={{ margin: '5px 0' }} />
      </div>
      {/* Log Message Section */}
      <div
        id="leaflet-debug-content" // Keep ID if external CSS targets it, otherwise optional
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          maxHeight: '200px',
          overflowY: 'auto',
        }}
      >
        {/* Display latest messages first */}
        {debugMessages.map((msg, i) => (
          <div key={i}>{msg}</div>
        ))}
      </div>
    </div>
  );
};

export default LeafletDebugDisplay;
