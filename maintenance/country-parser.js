/**
 * SVG Country Parser
 * 
 * This script extracts all country names from an SVG file by parsing
 * all path elements with IDs under the political group layer.
 * It also calculates the centerpoint of each country shape.
 */

// This would be run in a Node.js environment
const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');

/**
 * Extract centerpoint from SVG path
 * @param {string} pathData - SVG path data
 * @returns {Object} Centerpoint coordinates {x, y}
 */
function calculatePathCenterPoint(pathData) {
  try {
    // Parse the path data to find all coordinates
    const coordsRegex = /[ML][\s,]*([0-9.-]+)[\s,]+([0-9.-]+)/g;
    let match;
    let points = [];
    
    while ((match = coordsRegex.exec(pathData)) !== null) {
      points.push({
        x: parseFloat(match[1]),
        y: parseFloat(match[2])
      });
    }
    
    if (points.length === 0) {
      // Try another regex pattern for different path format
      const altRegex = /([0-9.-]+),([0-9.-]+)/g;
      while ((match = altRegex.exec(pathData)) !== null) {
        points.push({
          x: parseFloat(match[1]),
          y: parseFloat(match[2])
        });
      }
    }
    
    // Calculate the center point
    if (points.length > 0) {
      const sumX = points.reduce((sum, point) => sum + point.x, 0);
      const sumY = points.reduce((sum, point) => sum + point.y, 0);
      
      return {
        x: Math.round(sumX / points.length),
        y: Math.round(sumY / points.length)
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error calculating path center point:', error);
    return null;
  }
}

/**
 * Calculate bounding box for path
 * @param {string} pathData - SVG path data
 * @returns {Object} Bounding box {minX, minY, maxX, maxY}
 */
function calculatePathBoundingBox(pathData) {
  try {
    // Match all coordinate pairs in the path data
    const coordsRegex = /([0-9.-]+)[,\s]+([0-9.-]+)/g;
    let match;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let hasCoords = false;
    
    while ((match = coordsRegex.exec(pathData)) !== null) {
      hasCoords = true;
      const x = parseFloat(match[1]);
      const y = parseFloat(match[2]);
      
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    
    if (!hasCoords) {
      return null;
    }
    
    return {
      minX,
      minY,
      maxX,
      maxY,
      centerX: Math.round((minX + maxX) / 2),
      centerY: Math.round((minY + maxY) / 2),
      width: maxX - minX,
      height: maxY - minY
    };
  } catch (error) {
    console.error('Error calculating path bounding box:', error);
    return null;
  }
}

/**
 * Parse SVG file to extract country names and centerpoints from the political layer
 * @param {string} svgFilePath - Path to the SVG file
 * @returns {Array<Object>} Array of country objects with id, name, and centerpoint properties
 */
function extractCountriesFromSVG(svgFilePath) {
  try {
    // Read the SVG file
    const svgContent = fs.readFileSync(svgFilePath, 'utf8');
    console.log(`Successfully read SVG file: ${svgFilePath}`);
    
    // Create a list to store country information
    const countries = [];
    
    // Parse the SVG with a DOM parser for more accurate processing
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'text/xml');
    
    // Find the political group
    let politicalGroup = svgDoc.getElementById('political');
    
    // If political group not found by ID, try finding by inkscape:label
    if (!politicalGroup) {
      const allGroups = svgDoc.getElementsByTagName('g');
      for (let i = 0; i < allGroups.length; i++) {
        if (allGroups[i].getAttribute('inkscape:label') === 'political') {
          politicalGroup = allGroups[i];
          break;
        }
      }
    }
    
    if (politicalGroup) {
      // Get all path elements within the political group
      const paths = politicalGroup.getElementsByTagName('path');
      
      for (let i = 0; i < paths.length; i++) {
        const path = paths[i];
        const id = path.getAttribute('id');
        const name = path.getAttribute('inkscape:label') || id;
        
        if (id) {
          // Get the path data
          const pathData = path.getAttribute('d');
          
          // Calculate the centerpoint using bounding box
          const boundingBox = calculatePathBoundingBox(pathData);
          const centerpoint = boundingBox ? 
            { x: boundingBox.centerX, y: boundingBox.centerY } : 
            calculatePathCenterPoint(pathData);
          
          countries.push({
            id,
            name,
            centerpoint
          });
        }
      }
    } else {
      console.warn('Political layer not found in SVG using DOM parsing');
      
      // Use regex as fallback
      console.log('Falling back to regex-based parsing...');
      
      // Find the political group layer
      const politicalLayerMatch = svgContent.match(/<g[^>]*id="political"[^>]*>[\s\S]*?<\/g>/i);
      
      if (!politicalLayerMatch) {
        console.warn('Political layer not found in SVG using regex');
        
        // Try an alternative approach - look for paths with inkscape:label attributes
        console.log('Trying alternative approach...');
        
        // Match all path elements with an id attribute and inkscape:label
        const regex = /<path[^>]*id="([^"]+)"[^>]*(?:inkscape:label="([^"]+)")?[^>]*d="([^"]+)"[^>]*>/g;
        let match;
        
        while ((match = regex.exec(svgContent)) !== null) {
          const id = match[1];
          const label = match[2] || id;
          const pathData = match[3];
          
          // Calculate the centerpoint
          const boundingBox = calculatePathBoundingBox(pathData);
          const centerpoint = boundingBox ? 
            { x: boundingBox.centerX, y: boundingBox.centerY } : 
            calculatePathCenterPoint(pathData);
          
          // Add to countries array if not already included
          if (!countries.some(c => c.id === id)) {
            countries.push({
              id,
              name: label,
              centerpoint
            });
          }
        }
      } else {
        const politicalLayer = politicalLayerMatch[0];
        
        // Find all path elements with IDs within the political layer
        const pathRegex = /<path[^>]*id="([^"]+)"[^>]*(?:inkscape:label="([^"]+)")?[^>]*d="([^"]+)"[^>]*>/g;
        let match;
        
        while ((match = pathRegex.exec(politicalLayer)) !== null) {
          const id = match[1];
          const name = match[2] || id;
          const pathData = match[3];
          
          // Calculate the centerpoint
          const boundingBox = calculatePathBoundingBox(pathData);
          const centerpoint = boundingBox ? 
            { x: boundingBox.centerX, y: boundingBox.centerY } : 
            calculatePathCenterPoint(pathData);
          
          countries.push({
            id,
            name,
            centerpoint
          });
        }
      }
    }
    
    console.log(`Found ${countries.length} countries`);
    return countries;
    
  } catch (error) {
    console.error('Error extracting countries from SVG:', error);
    return [];
  }
}

/**
 * Save countries as JSON file
 * @param {Array<Object>} countries - Array of country objects
 * @param {string} outputPath - Path to save the JSON file
 */
function saveCountriesAsJSON(countries, outputPath) {
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Format the JSON with indentation for readability
    const json = JSON.stringify({ countries }, null, 2);
    
    // Write the JSON file
    fs.writeFileSync(outputPath, json, 'utf8');
    console.log(`Successfully saved countries to: ${outputPath}`);
    
  } catch (error) {
    console.error('Error saving countries as JSON:', error);
  }
}

/**
 * Process full SVG to calculate more accurate centerpoints using browser environment
 * @param {Array<Object>} countries - Initial country data
 * @param {string} svgFilePath - Path to the SVG file
 * @returns {Array<Object>} Enhanced country data with accurate centerpoints
 */
function processWithBrowserEnvironment(countries, svgFilePath) {
  // In a real browser environment, we would:
  // 1. Load the SVG into the DOM
  // 2. Use getBBox() or getClientRects() for each path to get accurate centerpoints
  // 3. Return the enhanced country data
  
  // This is a mock implementation for Node.js
  // For production, you would need to use a headless browser like Puppeteer
  
  console.log('Calculating more accurate centerpoints (mock implementation)');
  return countries;
}

/**
 * Main function to process SVG and export countries
 */
function main() {
  // Configuration
  const svgFilePath = './public/master-map.svg';
  const outputPath = './public/data/countries.json';
  
  console.log('Starting country extraction process...');
  
  // Extract countries from SVG
  const countries = extractCountriesFromSVG(svgFilePath);
  
  // Process with browser environment for more accurate centerpoints
  // const enhancedCountries = processWithBrowserEnvironment(countries, svgFilePath);
  
  // Save countries as JSON
  if (countries.length > 0) {
    saveCountriesAsJSON(countries, outputPath);
    console.log('Country extraction completed successfully!');
    console.log(`Total countries: ${countries.length}`);
    
    // Print some sample data
    if (countries.length > 0) {
      console.log('Sample country data:');
      console.log(countries[0]);
    }
  } else {
    console.error('No countries found in the SVG file.');
  }
}

// Run the main function
main();