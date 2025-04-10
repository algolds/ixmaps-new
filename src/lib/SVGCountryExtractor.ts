/**
 * SVGCountryExtractor.ts
 * Utility for extracting country data from SVG maps
 */

import { SvgPoint, LatLng } from '@/types';

export interface CountryData {
  id: string;
  name: string;
  center: [number, number]; // [lat, lng]
  bounds: [[number, number], [number, number]]; // [[south, west], [north, east]]
  area?: number;
  importance?: 'capital' | 'major' | 'standard' | 'minor';
}

/**
 * Extract country data from an SVG document
 * @param svgContent The SVG content as a string
 * @param svgToLatLng Function to convert SVG coordinates to geographic coordinates
 * @returns Array of country data objects
 */
export async function extractCountriesFromSVG(
  svgContent: string,
  svgToLatLng: (x: number, y: number) => LatLng
): Promise<CountryData[]> {
  try {
    // Parse SVG content
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    
    // Check for parsing errors
    const parserError = svgDoc.querySelector('parsererror');
    if (parserError) {
      console.error('SVG parsing error:', parserError.textContent);
      throw new Error('Failed to parse SVG content');
    }
    
    // Look for the political layer (where countries are typically stored)
    const politicalLayer = svgDoc.querySelector('g[inkscape\\:label="political"]') || 
                           svgDoc.getElementById('political');
    
    if (!politicalLayer) {
      throw new Error('Political layer not found in SVG');
    }
    
    // Find all country paths
    const countryPaths = politicalLayer.querySelectorAll('path');
    console.log(`Found ${countryPaths.length} potential country paths`);
    
    // Extract country data
    const countries: CountryData[] = [];
    
    countryPaths.forEach(path => {
      // Get country ID
      const id = path.getAttribute('id');
      if (!id) return; // Skip paths without ID
      
      // Get name from inkscape:label, serif:id, or use ID
      const name = path.getAttribute('inkscape:label') || 
                   path.getAttribute('serif:id') || 
                   id;
      
      try {
        // Calculate bounding box
        const bbox = path.getBBox();
        
        // Skip very small paths (likely not countries)
        if (bbox.width < 1 || bbox.height < 1) {
          return;
        }
        
        // Calculate center point in SVG coordinates
        const svgCenterX = bbox.x + (bbox.width / 2);
        const svgCenterY = bbox.y + (bbox.height / 2);
        
        // Convert center to geographic coordinates
        const centerLatLng = svgToLatLng(svgCenterX, svgCenterY);
        
        // Convert bounds to geographic coordinates
        const southWest = svgToLatLng(bbox.x, bbox.y + bbox.height);
        const northEast = svgToLatLng(bbox.x + bbox.width, bbox.y);
        
        // Calculate approximate area
        const area = bbox.width * bbox.height;
        
        // Determine importance based on area
        let importance: 'capital' | 'major' | 'standard' | 'minor' = 'standard';
        
        if (name.toLowerCase().includes('capital')) {
          importance = 'capital';
        } else if (area > 10000) {
          importance = 'major';
        } else if (area < 1000) {
          importance = 'minor';
        }
        
        // Add to countries array
        countries.push({
          id,
          name,
          center: [centerLatLng.lat, centerLatLng.lng],
          bounds: [
            [southWest.lat, southWest.lng],
            [northEast.lat, northEast.lng]
          ],
          area,
          importance
        });
      } catch (error) {
        console.warn(`Error processing country ${name}:`, error);
      }
    });
    
    console.log(`Successfully extracted ${countries.length} countries`);
    return countries;
  } catch (error) {
    console.error('Error extracting countries from SVG:', error);
    throw error;
  }
}

/**
 * Save countries data to a JSON file
 * @param countries Array of country data
 * @param filename Name of file to save
 */
export function saveCountriesToJSON(countries: CountryData[], filename: string = 'countries.json'): void {
  try {
    // Format data with indentation for readability
    const data = JSON.stringify(countries, null, 2);
    
    // Create a Blob with the JSON data
    const blob = new Blob([data], { type: 'application/json' });
    
    // Create a download URL
    const url = URL.createObjectURL(blob);
    
    // Create and trigger a download link
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`Saved ${countries.length} countries to ${filename}`);
  } catch (error) {
    console.error('Error saving countries to JSON:', error);
    throw error;
  }
}

/**
 * Load countries from a JSON file
 * @param jsonPath Path to the JSON file
 * @returns Promise resolving to array of country data
 */
export async function loadCountriesFromJSON(jsonPath: string): Promise<CountryData[]> {
  try {
    const response = await fetch(jsonPath);
    
    if (!response.ok) {
      throw new Error(`Failed to load JSON: ${response.status} ${response.statusText}`);
    }
    
    const countries = await response.json();
    console.log(`Loaded ${countries.length} countries from ${jsonPath}`);
    return countries;
  } catch (error) {
    console.error('Error loading countries from JSON:', error);
    throw error;
  }
}