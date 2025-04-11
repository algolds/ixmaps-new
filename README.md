# IxMaps Version 4.0.0

## Overview

This is the IxMaps Interactive Mapping System. The project uses modern React with TypeScript and implements the same functionality as the original project but with improved architecture and performance.

## Features

- Interactive map visualization with Leaflet.js
- Custom coordinate system with grid and prime meridian
- Layer management for different map features
- Distance calculation tools
- Responsive design
- Server-side rendering support (where appropriate)
- API routes for map data

## Getting Started

### Prerequisites

- Node.js 14.x or higher
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/ixmaps-next.git
   cd ixmaps-next
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Project Structure

```
/src
  /app                  # Next.js app directory
    /api                # API routes
    layout.tsx          # Root layout
    page.tsx            # Main page
    globals.css         # Global styles
  /components           # React components
    Map.tsx             # Main map component
    LeafletLoader.tsx   # Dynamic Leaflet loader
    LayerManager.tsx    # Layer management
  /lib                  # Utility functions
    distanceCalculator.ts
    mapConfig.ts
    svgLoader.ts
    toastUtils.ts
  /types                # TypeScript type definitions
    index.ts
/public                 # Static files
  /master-map.svg       # Base map SVG
```

## Building for Production

```bash
npm run build
# or
yarn build
```

Then start the production server:

```bash
npm run start
# or
yarn start
```

## Key Differences from Original Version

1. **Framework**: Uses Next.js instead of a custom Express + TypeScript setup
2. **Component-Based Architecture**: Follows React component patterns
3. **SSR Awareness**: Avoids SSR for client-only features like Leaflet
4. **API Routes**: Uses Next.js API routes instead of Express routes
5. **Better Type Safety**: Improved TypeScript integration
6. **Enhanced Performance**: Better code splitting and loading optimization

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Credits

- Original IxMaps system developers
- Leaflet.js team