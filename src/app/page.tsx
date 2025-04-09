'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

// Dynamically load the Map component with no SSR
const MapComponent = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#D5FFFF'
    }}>
      <div style={{
        padding: '20px',
        borderRadius: '8px',
        backgroundColor: 'white',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        Loading IxMaps...
      </div>
    </div>
  )
});

export default function Home() {
  return (
    <main 
      style={{ 
        height: '100vh', 
        width: '100vw',
        padding: 0,
        margin: 0,
        overflow: 'hidden'
      }}
    >
      <MapComponent />
    </main>
  );
}