// src/lib/svg-path-utils.ts

import { SvgPoint, MapConfig } from '@/types';
import { svgToLatLng } from '@/lib/coordinates-system';

// Interface for a point in SVG space
export interface SVGPathPoint {
  x: number;
  y: number;
}

/**
 * Converts an SVG path string to an array of points
 * This handles most common SVG path commands, but not all curve types
 * For production use, consider using a dedicated SVG path library
 */
export function parseSvgPath(pathData: string): SVGPathPoint[] {
  const points: SVGPathPoint[] = [];
  const commands = pathData.match(/[A-Za-z][^A-Za-z]*/g) || [];
  
  let currentX = 0;
  let currentY = 0;
  let firstX = 0;
  let firstY = 0;
  let subpathStartX = 0;
  let subpathStartY = 0;
  
  // Handle path commands
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    const type = cmd[0];
    const args = cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat);
    
    switch (type) {
      // Moveto commands (M/m)
      case 'M': // Absolute moveto
        currentX = args[0];
        currentY = args[1];
        subpathStartX = currentX;
        subpathStartY = currentY;
        if (i === 0) {
          firstX = currentX;
          firstY = currentY;
        }
        points.push({ x: currentX, y: currentY });
        
        // Additional coordinate pairs after M are treated as implicit lineto commands
        for (let j = 2; j < args.length; j += 2) {
          if (j + 1 < args.length) {
            currentX = args[j];
            currentY = args[j + 1];
            points.push({ x: currentX, y: currentY });
          }
        }
        break;
        
      case 'm': // Relative moveto
        if (i === 0) {
          // First command is relative to 0,0
          currentX = args[0];
          currentY = args[1];
        } else {
          currentX += args[0];
          currentY += args[1];
        }
        subpathStartX = currentX;
        subpathStartY = currentY;
        if (i === 0) {
          firstX = currentX;
          firstY = currentY;
        }
        points.push({ x: currentX, y: currentY });
        
        // Additional coordinate pairs after m are treated as implicit lineto commands
        for (let j = 2; j < args.length; j += 2) {
          if (j + 1 < args.length) {
            currentX += args[j];
            currentY += args[j + 1];
            points.push({ x: currentX, y: currentY });
          }
        }
        break;
      
      // Lineto commands (L/l, H/h, V/v)
      case 'L': // Absolute lineto
        for (let j = 0; j < args.length; j += 2) {
          if (j + 1 < args.length) {
            currentX = args[j];
            currentY = args[j + 1];
            points.push({ x: currentX, y: currentY });
          }
        }
        break;
        
      case 'l': // Relative lineto
        for (let j = 0; j < args.length; j += 2) {
          if (j + 1 < args.length) {
            currentX += args[j];
            currentY += args[j + 1];
            points.push({ x: currentX, y: currentY });
          }
        }
        break;
        
      case 'H': // Absolute horizontal lineto
        for (const x of args) {
          currentX = x;
          points.push({ x: currentX, y: currentY });
        }
        break;
        
      case 'h': // Relative horizontal lineto
        for (const dx of args) {
          currentX += dx;
          points.push({ x: currentX, y: currentY });
        }
        break;
        
      case 'V': // Absolute vertical lineto
        for (const y of args) {
          currentY = y;
          points.push({ x: currentX, y: currentY });
        }
        break;
        
      case 'v': // Relative vertical lineto
        for (const dy of args) {
          currentY += dy;
          points.push({ x: currentX, y: currentY });
        }
        break;
      
      // Closepath command (Z/z)
      case 'Z':
      case 'z':
        // Close the current subpath by drawing a line to the first point
        if (subpathStartX !== currentX || subpathStartY !== currentY) {
          currentX = subpathStartX;
          currentY = subpathStartY;
          points.push({ x: currentX, y: currentY });
        }
        break;
      
      // Basic curve support - we approximate with line segments
      // For better curve handling, use a proper SVG path library
      case 'C': // Cubic bezier (absolute)
        if (args.length >= 6) {
          // End point of the curve
          const endX = args[4];
          const endY = args[5];
          // Simplistic approach: just add the end point
          // For a better approximation, interpolate along the curve
          currentX = endX;
          currentY = endY;
          points.push({ x: currentX, y: currentY });
        }
        break;
        
      case 'c': // Cubic bezier (relative)
        if (args.length >= 6) {
          // End point of the curve (relative)
          const endX = currentX + args[4];
          const endY = currentY + args[5];
          // Simplistic approach: just add the end point
          currentX = endX;
          currentY = endY;
          points.push({ x: currentX, y: currentY });
        }
        break;
        
      // Other commands like S, s, Q, q, T, t, A, a are not fully implemented here
      // For a production version, use a library that handles these properly
      default:
        console.warn(`Unsupported SVG path command: ${type}`);
        break;
    }
  }
  
  return points;
}

/**
 * Converts an SVG path to Leaflet LatLng coordinates
 * @param pathData SVG path string
 * @param mapConfig Map configuration
 * @returns Array of LatLng coordinates
 */
export function svgPathToLatLng(pathData: string, mapConfig: MapConfig): L.LatLngExpression[] {
  const svgPoints = parseSvgPath(pathData);
  
  // Convert SVG points to geographic coordinates
  return svgPoints.map(point => {
    const latLng = svgToLatLng(point.x, point.y, mapConfig);
    return [latLng.lat, latLng.lng] as L.LatLngExpression;
  });
}

/**
 * Simplified SVG Path data to reduce the number of points
 * Useful for large paths that would otherwise be too detailed
 * @param points Array of SVG path points
 * @param tolerance Distance tolerance for simplification
 * @returns Simplified path points
 */
export function simplifyPath(points: SVGPathPoint[], tolerance: number = 1): SVGPathPoint[] {
  if (points.length <= 2) return points;
  
  // Douglas-Peucker algorithm for polyline simplification
  const douglasPeucker = (start: number, end: number, tol: number): SVGPathPoint[] => {
    // If start and end are adjacent, return them
    if (end - start <= 1) return [points[start], points[end]];
    
    // Find the point with the maximum distance
    let maxDist = 0;
    let maxIndex = start;
    
    const startPoint = points[start];
    const endPoint = points[end];
    
    // Calculate the line segment
    const lineLength = Math.sqrt(
      Math.pow(endPoint.x - startPoint.x, 2) + 
      Math.pow(endPoint.y - startPoint.y, 2)
    );
    
    for (let i = start + 1; i < end; i++) {
      const dist = pointToLineDistance(points[i], startPoint, endPoint, lineLength);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }
    
    // If the maximum distance is greater than the tolerance,
    // recursively simplify the two parts of the path
    if (maxDist > tol) {
      const leftPart = douglasPeucker(start, maxIndex, tol);
      const rightPart = douglasPeucker(maxIndex, end, tol);
      
      // Combine the results (excluding duplicates)
      return leftPart.slice(0, -1).concat(rightPart);
    } else {
      // If no point is further than the tolerance, just return the endpoints
      return [points[start], points[end]];
    }
  };
  
  // Helper function to calculate perpendicular distance from a point to a line
  const pointToLineDistance = (
    point: SVGPathPoint, 
    lineStart: SVGPathPoint, 
    lineEnd: SVGPathPoint,
    lineLength: number
  ): number => {
    if (lineLength === 0) return 0;
    
    // Calculate area of the triangle formed by the 3 points
    const area = Math.abs(
      (lineStart.y - point.y) * (lineEnd.x - point.x) -
      (lineStart.x - point.x) * (lineEnd.y - point.y)
    );
    
    // Distance is 2 * area / base
    return area / lineLength;
  };
  
  // Apply the algorithm to the entire path
  return douglasPeucker(0, points.length - 1, tolerance);
}

/**
 * Returns a simplified version of an SVG path
 * @param pathData SVG path string
 * @param tolerance Distance tolerance for simplification
 * @returns Simplified SVG path points
 */
export function getSimplifiedSvgPath(pathData: string, tolerance: number = 1): SVGPathPoint[] {
  const points = parseSvgPath(pathData);
  return simplifyPath(points, tolerance);
}