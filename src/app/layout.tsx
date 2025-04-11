import './globals.css'
import type { Metadata } from 'next'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'IxMaps™ - v4.0',
  description: 'Interactive Mapping System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Suppress hydration warnings from browser extensions like Grammarly */}
        <Script id="suppress-hydration-warning">
          {`
            (function() {
              try {
                // This helps React ignore attributes added by browser extensions
                const originalError = console.error;
                console.error = function(...args) {
                  if (args[0] && typeof args[0] === 'string' && args[0].includes('Hydration')) {
                    if (args[0].includes('data-gr-') || args[0].includes('data-new-gr')) {
                      // Suppress the warning
                      return;
                    }
                  }
                  return originalError.apply(console, args);
                };
              } catch (e) {}
            })();
          `}
        </Script>
      </head>
      <body suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  )
}