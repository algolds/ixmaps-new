// src/components/providers.tsx
'use client';

import React from 'react';

interface ProvidersProps {
  children: React.ReactNode;
}

// No need to read NEXT_PUBLIC_BASE_PATH when basePath is empty
const authApiPath = '/api/auth'; // Standard API path

export default function Providers({ children }: ProvidersProps) {
  console.log('[Providers] Using DEV basePath for SessionProvider:', authApiPath);
   
}
