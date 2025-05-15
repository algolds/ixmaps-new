// src/app/account/page.tsx
import { UserProfile } from '@clerk/nextjs';
import React from 'react';

// Optional: Add metadata for the page title
export const metadata = {
  title: 'Account Settings - IxMaps',
};

// Basic styling for centering the component
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start', // Align to top, let UserProfile handle its height
    padding: '40px 20px', // Add some padding around the component
    minHeight: 'calc(100vh - 80px)', // Ensure it takes up significant height
    width: '100%',
    boxSizing: 'border-box',
  },
};

export default function AccountPage() {
  return (
    <div style={styles.container}>
      <UserProfile
        path="/account" // Tell Clerk this component handles routing for /account
        appearance={{
          // Optional: Customize appearance to match your theme
          // elements: {
          //   card: { boxShadow: 'none', border: '1px solid #e5e5e5' },
          //   navbar: { backgroundColor: '#f8f8f8' },
          // }
        }}
      />
    </div>
  );
}
