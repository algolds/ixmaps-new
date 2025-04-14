// app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs'; // Import ClerkProvider
import './globals.css';
import type { Metadata } from 'next';
import Script from 'next/script';
// Removed the old Providers import

export const metadata: Metadata = {
  title: 'IxMaps™ - v4.0',
  description: 'Interactive Mapping System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Wrap the entire html content with ClerkProvider
    <ClerkProvider>
      <html lang="en">
        <head>
          {/* Suppress hydration warnings */}
          <Script id="suppress-hydration-warning" strategy="beforeInteractive">
            {`
              (function() {
                try {
                  const originalError = console.error;
                  console.error = function(...args) {
                    if (args[0] && typeof args[0] === 'string' && (args[0].includes('Warning: Extra attributes from the server:') || args[0].includes('Hydration failed because the initial UI does not match'))) {
                      return; // Suppress common hydration mismatch warnings
                    }
                    if (args[0] && typeof args[0] === 'string' && args[0].includes('Hydration') && (args[0].includes('data-gr-') || args[0].includes('data-new-gr'))) {
                       return; // Suppress Grammarly warnings
                    }
                    return originalError.apply(console, args);
                  };
                } catch (e) { console.warn("Error in hydration suppression script:", e); }
              })();
            `}
          </Script>
          {/* Add other head elements here */}
        </head>
        <body suppressHydrationWarning={true}>
          {/* Children are rendered directly inside body, ClerkProvider is outside html */}
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
