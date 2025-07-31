# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm run dev` - Development server on port 3003
- `npm run build` - Production build
- `npm run start` - Production server on port 3002
- `npm run lint` - ESLint validation

### Database (Prisma)
- `npm run prisma:dev` - Run migrations in development
- `npm run prisma:deploy` - Deploy migrations to production
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:studio` - Open Prisma Studio

### Initial Setup
- `node setup.js` - Interactive setup for environment and database

### Production Management (PM2)
- `pm2 start ecosystem.config.js` - Start production app
- `pm2 stop ixmaps` - Stop the app
- `pm2 restart ixmaps` - Restart the app
- `pm2 logs ixmaps` - View logs

## Architecture Overview

### Custom Coordinate System
This is an interactive mapping platform with a **custom coordinate system** built around SVG-based maps. The core coordinate conversion system is in `src/lib/coordinates-system.ts` with functions:
- `latLngToSvg()` - Converts geographic coordinates to SVG pixel coordinates
- `svgToLatLng()` - Converts SVG coordinates back to geographic coordinates
- Uses custom projection parameters defined in `MapConfig`

### Map Configuration System
The `src/lib/MapConfig.ts` file contains critical map projection parameters:
- `RENDERED_PIXELS_PER_LNG/LAT` - Scaling factors for coordinate conversion
- `RENDERED_PRIME_MERIDIAN_X` - SVG X coordinate of reference longitude (30°)
- `RENDERED_EQUATOR_Y` - SVG Y coordinate of equator
- `EFFECTIVE_SCALE_X/Y` - Scaling ratios between original and rendered SVG dimensions

### Component Architecture
- **Map.tsx** - Main map component using Leaflet.js with custom CRS
- **LeafletLoader** - Dynamically loads Leaflet and initializes map with custom bounds
- **SvgLayerManager** - Manages SVG layer parsing and rendering
- **GridComponent** - Renders coordinate grid and prime meridian
- **CountryLabelsComponent** - Displays country labels with custom positioning
- **AdminLabelEditor** - Admin interface for editing label positions

### Layer Management System
- SVG maps are parsed into layers using `SVGLayerParser.ts`
- Layers include: political, climate, lakes, rivers, altitude-layers
- Political and altitude layers are mutually exclusive
- Layer visibility state is managed in the main Map component

### Database Schema
Uses Prisma with PostgreSQL:
- User authentication models (Account, Session, User)
- AuditLog for tracking administrative actions
- Users have optional `isAdmin` flag for label editing permissions

### Environment Configuration
- Development: Runs on port 3003, no base path
- Production: Runs on port 3002 with base path `/public/maps/ixmaps-new`
- Environment switching handled in `next.config.js` based on `NODE_ENV`
- Docker Compose provided for PostgreSQL development database

### Key Files to Understand
- `src/lib/coordinates-system.ts` - Core coordinate conversion logic
- `src/lib/MapConfig.ts` - Map projection and scaling parameters
- `src/components/Map.tsx` - Main map component and state management
- `prisma/schema.prisma` - Database models
- `next.config.js` - Production path configuration
- `ecosystem.config.js` - PM2 production deployment settings

### Common Development Patterns
- Components use dynamic imports with `{ ssr: false }` for Leaflet compatibility
- Map state is centrally managed in the main Map component
- SVG coordinates are converted to/from geographic coordinates for all operations
- Admin features are conditionally rendered based on user permissions
- Toast notifications provide user feedback for actions