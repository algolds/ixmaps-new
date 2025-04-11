'use client';

import React, { useEffect, useRef } from 'react';
import Script from 'next/script';

interface LeafletLoaderProps {
  onLeafletLoad: (L: any) => void;
}

const LeafletLoader: React.FC<LeafletLoaderProps> = ({ onLeafletLoad }) => {
  const initialized = useRef(false);

  useEffect(() => {
    // Only initialize if not already done and Leaflet is available
    if (!initialized.current && typeof window !== 'undefined' && window.L) {
      initialized.current = true;
      onLeafletLoad(window.L);
    }
    
    // Cleanup function
    return () => {
      initialized.current = false;
    };
  }, [onLeafletLoad]);

  const handleScriptLoad = () => {
    if (typeof window !== 'undefined' && window.L && !initialized.current) {
      initialized.current = true;
      
      // Add Leaflet-specific CSS
      const style = document.createElement('style');
      style.textContent = `
        .grid-label {
          background-color: rgba(255, 255, 255, 0.7);
          border: 1px solid #666;
          border-radius: 3px;
          padding: 2px 4px;
          font-size: 10px;
          font-weight: bold;
          color: #333;
          text-align: center;
          white-space: nowrap;
          pointer-events: none;
        }
        
        .prime-meridian-label {
          background-color: rgba(255, 128, 0, 0.8);
          color: white;
          padding: 3px 8px;
          border-radius: 4px;
          font-weight: bold;
          font-size: 12px;
          text-align: center;
          white-space: nowrap;
          text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
          pointer-events: none;
        }
        
        .country-label {
          background-color: transparent !important;
          border: none !important;
          font-family: Arial, sans-serif;
          font-size: 12px;
          font-weight: bold;
          color: #333;
          text-shadow: 
            -1px -1px 0 #fff,
            1px -1px 0 #fff,
            -1px 1px 0 #fff,
            1px 1px 0 #fff,
            0 0 5px rgba(255, 255, 255, 0.7);
          pointer-events: auto;
          cursor: pointer;
          z-index: 650;
          transition: transform 0.2s ease, opacity 0.2s ease;
          text-align: center;
        }
      `;
      document.head.appendChild(style);
      
      onLeafletLoad(window.L);
    }
  };

  return (
    <>
      <link 
        rel="stylesheet" 
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css" 
        crossOrigin="anonymous" 
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"
        onLoad={handleScriptLoad}
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
    </>
  );
};

export default LeafletLoader;

// Define window.L for TypeScript
declare global {
  interface Window {
    L: any;
  }
}