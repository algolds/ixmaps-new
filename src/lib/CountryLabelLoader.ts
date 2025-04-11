/**
 * Utility functions for loading and processing country label data
 */

import { CountryData, CountriesData } from '@/types/country-types';
import { basePath } from './config';

/**
 * Load country data from JSON file
 * @returns Promise that resolves to the country data
 */
export async function loadCountryData(): Promise<CountriesData> {
  try {
    // Fetch the JSON file
    const response = await fetch(`${basePath}/data/countries.json`);
    
    if (!response.ok) {
      throw new Error(`Failed to load countries data: ${response.status} ${response.statusText}`);
    }
    
    const data: CountriesData = await response.json();
    
    // Validate data
    if (!data || !Array.isArray(data.countries)) {
      throw new Error('Invalid countries data format');
    }
    
    // Filter out countries without valid centerpoints
    const validCountries = {
      countries: data.countries.filter(country => 
        country.centerpoint && 
        typeof country.centerpoint.x === 'number' && 
        typeof country.centerpoint.y === 'number'
      )
    };
    
    console.log(`Loaded ${validCountries.countries.length} countries with valid centerpoints`);
    return validCountries;
  } catch (error) {
    console.error('Error loading country data:', error);
    // Return empty data on error
    return { countries: [] };
  }
}

/**
 * Classify country by type
 * @param country Country data object
 * @returns Classification as 'capital', 'major', 'standard', or 'minor'
 */
export function classifyCountry(country: CountryData): 'capital' | 'major' | 'standard' | 'minor' {
  // Major powers and large nations - customize this list for your map
  const majorCountries = [
    'Urcea', 'Caphiria', 'Burgundie', 'Great Levantine Empire', 
    'Holy Levantine Empire', 'Great Levantia', 'Kiravia'
  ];
  
  // Capital cities or important locations - customize this list for your map
  const capitals = [
    'Urceopolis', 'Venepia', 'Solaria', 'Cana', 'Capital'
  ];
  
  // Check if this looks like a capital
  if (capitals.some(capital => 
    country.id.includes(capital) || 
    country.name.includes(capital) ||
    country.name.includes('City')
  )) {
    return 'capital';
  } 
  // Check if this is a major country
  else if (majorCountries.some(major => 
    country.id === major || 
    country.name === major
  )) {
    return 'major';
  }
  // Check if this might be a smaller entity
  else if (
    country.id.includes('Island') || 
    country.name.includes('Island') ||
    country.id.includes('Region') || 
    country.name.includes('Region') ||
    country.id.includes('Territory') || 
    country.name.includes('Territory')
  ) {
    return 'minor';
  }
  // Default classification
  else {
    return 'standard';
  }
}

/**
 * Calculate approximate text width
 * @param text The text string
 * @param fontSize Font size in pixels
 * @returns Approximate width in pixels
 */
export function calculateTextWidth(text: string, fontSize: number): number {
  // Approximate width calculation (roughly 0.6 × fontSize × character count)
  return Math.max(30, Math.ceil(text.length * fontSize * 0.6));
}

/**
 * Check if two label areas overlap (collision detection)
 * @param a First label bounds {x, y, width, height}
 * @param b Second label bounds {x, y, width, height}
 * @param buffer Optional padding around labels (default: 10px)
 * @returns True if the labels collide, false otherwise
 */
export function checkLabelCollision(
  a: {x: number, y: number, width: number, height: number},
  b: {x: number, y: number, width: number, height: number},
  buffer: number = 10
): boolean {
  return (
    a.x - buffer < b.x + b.width + buffer &&
    a.x + a.width + buffer > b.x - buffer &&
    a.y - buffer < b.y + b.height + buffer &&
    a.y + a.height + buffer > b.y - buffer
  );
}

/**
 * Convert SVG coordinates to Leaflet coordinates
 * @param x X coordinate in SVG space
 * @param y Y coordinate in SVG space
 * @param svgWidth SVG width
 * @param svgHeight SVG height
 * @returns [lat, lng] coordinates for Leaflet
 */
export function svgToLeafletCoords(
  x: number, 
  y: number, 
  svgWidth: number, 
  svgHeight: number
): [number, number] {
  // This is a basic linear transformation
  // You may need to adjust this based on your map projection
  
  // SVG coordinates: 0,0 is top-left, width,height is bottom-right
  // Leaflet coords: [0,0] is usually bottom-left, [1,1] is top-right
  
  // Normalize to 0-1 range
  const normalizedX = x / svgWidth;
  // Flip Y axis (SVG Y increases downward, Leaflet lat increases upward)
  const normalizedY = 1 - (y / svgHeight);
  
  // Convert to Leaflet coordinates (assuming simple CRS)
  return [normalizedY * svgHeight, normalizedX * svgWidth];
}