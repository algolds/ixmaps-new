import { SVGDimensions } from '@/types';
import { getAssetPath } from '@/lib/config';

export const loadSVGDimensions = async (svgPath: string): Promise<SVGDimensions> => {
  try {
    console.log(`SVGLoader: Attempting to load SVG from path: ${svgPath}`);
    
    // Use getAssetPath instead of createUrl
    const url = getAssetPath(svgPath);
    
    console.log(`SVGLoader: Fetching from URL: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to load SVG: ${response.status} ${response.statusText}`);
    }
    
    const svgText = await response.text();
    console.log(`SVGLoader: Received SVG content of length: ${svgText.length} characters`);
    
    // Default dimensions - used if we can't extract them
    const defaultDimensions = { width: 8202, height: 4900 };
    
    // Use DomParser if on client
    if (typeof window !== 'undefined') {
      try {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        
        // Check for parsing errors
        const parserError = svgDoc.querySelector('parsererror');
        if (parserError) {
          console.warn(`SVG parsing error: ${parserError.textContent}`);
          return defaultDimensions;
        }
        
        const svgElement = svgDoc.documentElement;
        
        // Check if this is actually an SVG
        if (svgElement.tagName.toLowerCase() !== 'svg') {
          console.warn('Loaded document is not an SVG');
          return defaultDimensions;
        }
        
        // Try multiple methods to extract dimensions
        let width = 0;
        let height = 0;
        
        // Method 1: Direct width/height attributes
        if (svgElement.hasAttribute('width') && svgElement.hasAttribute('height')) {
          const widthAttr = svgElement.getAttribute('width') || '0';
          const heightAttr = svgElement.getAttribute('height') || '0';
          
          // Handle units (px, cm, etc.)
          width = parseFloat(widthAttr.replace(/[^-.\d]/g, ''));
          height = parseFloat(heightAttr.replace(/[^-.\d]/g, ''));
          
          console.log(`SVGLoader: Extracted dimensions from attributes: ${width}x${height}`);
        }
        
        // Method 2: ViewBox attribute
        if ((width <= 0 || height <= 0) && svgElement.hasAttribute('viewBox')) {
          const viewBox = svgElement.getAttribute('viewBox')?.split(/[\s,]+/);
          if (viewBox && viewBox.length >= 4) {
            width = parseFloat(viewBox[2]);
            height = parseFloat(viewBox[3]);
            console.log(`SVGLoader: Extracted dimensions from viewBox: ${width}x${height}`);
          }
        }
        
        // Method 3: Look for metadata or other elements with dimensions
        if (width <= 0 || height <= 0) {
          // Try to find a rect element that covers the entire SVG
          const rects = svgDoc.querySelectorAll('rect');
          for (let i = 0; i < rects.length; i++) {
            const rect = rects[i];
            const rectWidth = parseFloat(rect.getAttribute('width') || '0');
            const rectHeight = parseFloat(rect.getAttribute('height') || '0');
            
            // If this rect is large enough, use its dimensions
            if (rectWidth > 100 && rectHeight > 100) {
              width = rectWidth;
              height = rectHeight;
              console.log(`SVGLoader: Extracted dimensions from rect element: ${width}x${height}`);
              break;
            }
          }
        }
        
        // Method 4: Try to determine from content bounds
        if (width <= 0 || height <= 0) {
          try {
            // Find all paths and determine the bounding box
            const paths = svgDoc.querySelectorAll('path');
            if (paths.length > 0) {
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
              
              // This is a rough approximation based on path data
              for (let i = 0; i < paths.length; i++) {
                const pathData = paths[i].getAttribute('d') || '';
                const coordinates = pathData.match(/[-+]?[0-9]*\.?[0-9]+/g);
                
                if (coordinates) {
                  for (let j = 0; j < coordinates.length; j += 2) {
                    if (j + 1 < coordinates.length) {
                      const x = parseFloat(coordinates[j]);
                      const y = parseFloat(coordinates[j + 1]);
                      
                      if (!isNaN(x) && !isNaN(y)) {
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                      }
                    }
                  }
                }
              }
              
              if (minX !== Infinity && minY !== Infinity && maxX !== -Infinity && maxY !== -Infinity) {
                width = maxX - minX;
                height = maxY - minY;
                console.log(`SVGLoader: Estimated dimensions from path bounds: ${width}x${height}`);
              }
            }
          } catch (e) {
            console.warn('Error estimating SVG dimensions from paths:', e);
          }
        }
        
        console.log(`SVGLoader: Final extracted dimensions: ${width}x${height}`);
        
        // Return default dimensions if we couldn't extract them or they're very small
        if (width <= 100 || height <= 100) {
          console.warn('SVGLoader: Dimensions too small, returning defaults');
          return defaultDimensions;
        }
        
        return { width, height };
      } catch (e) {
        console.error('SVGLoader: Error parsing SVG:', e);
        return defaultDimensions;
      }
    } else {
      // Server-side, use regex to extract dimensions
      // This is less reliable but gives us something
      
      // Try to extract from width/height attributes
      const widthMatch = svgText.match(/width=["']([^"']+)["']/i);
      const heightMatch = svgText.match(/height=["']([^"']+)["']/i);
      
      if (widthMatch && heightMatch) {
        const width = parseFloat(widthMatch[1].replace(/[^-.\d]/g, ''));
        const height = parseFloat(heightMatch[1].replace(/[^-.\d]/g, ''));
        
        if (width > 100 && height > 100) {
          console.log(`SVGLoader: Extracted dimensions from attributes: ${width}x${height}`);
          return { width, height };
        }
      }
      
      // Try viewBox as fallback
      const viewBoxMatch = svgText.match(/viewBox=["']([^"']+)["']/i);
      if (viewBoxMatch) {
        const viewBox = viewBoxMatch[1].split(/[\s,]+/);
        if (viewBox.length >= 4) {
          const width = parseFloat(viewBox[2]);
          const height = parseFloat(viewBox[3]);
          
          if (width > 100 && height > 100) {
            console.log(`SVGLoader: Extracted dimensions from viewBox: ${width}x${height}`);
            return { width, height };
          }
        }
      }
      
      // If all else fails, return default dimensions
      console.warn('SVGLoader: Unable to extract dimensions server-side, returning defaults');
      return defaultDimensions;
    }
  } catch (error) {
    console.error('SVGLoader: Error loading SVG dimensions:', error);
    // Return default dimensions on error
    return { width: 8202, height: 4900 };
  }
};