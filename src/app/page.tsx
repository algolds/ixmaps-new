// app/page.tsx
'use client';

import React from 'react'; // Removed useState, useEffect, useCallback
import dynamic from 'next/dynamic';
// Removed Clerk imports: SignedIn, SignedOut, UserButton, SignIn, useAuth

// --- Dynamic Import for Map ---
// Ensure the path to your Map component is correct
const MapComponentWithNoSSR = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div style={styles.loadingContainer}>
      <div style={styles.loadingBox}>Loading IxMaps...</div>
    </div>
  ),
});

// --- Main Component ---
export default function Home() {
  // Removed all state and effects related to the login modal

  return (
    <main style={styles.mainContainer}>
      {/* Render Map Component always */}
      <MapComponentWithNoSSR />

      {/* Removed SignedIn/UserButton section */}
      {/* Removed SignedOut/Modal section */}
    </main>
  );
}

// --- Inline Styles Object ---
const styles: { [key: string]: React.CSSProperties } = {
  mainContainer: {
    height: '100vh',
    width: '100vw',
    padding: 0,
    margin: 0,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#D5FFFF', // Base background
  },
  loadingContainer: {
    width: '100%',
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#D5FFFF',
  },
  loadingBox: {
    padding: '25px 30px',
    borderRadius: '10px',
    backgroundColor: 'white',
    boxShadow: '0 6px 12px rgba(0, 0, 0, 0.1)',
    color: '#333',
    fontSize: '1.1rem',
  },
  // Removed styles related to authContainer, signInTriggerButton, modalOverlay, modalContent, closeButton
};
