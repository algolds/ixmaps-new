// country-parser.js
const fs = require('fs');
const { DOMParser } = require('xmldom');

// --- Configuration ---
const SVG_FILE_PATH = './public/maps/political-map.svg'; // Path to your SVG file
const COUNTRIES_DATA_PATH = './public/data/countries.json'; // Path to your JSON with labelPosition/bbox
const OUTPUT_PATH = './public/data/shapes.json'; // Path to save the combined JSON output
const shapeTags = ['path', 'rect', 'polygon', 'circle', 'ellipse']; // SVG tags to extract
// --- End Configuration ---

/**
 * Extracts an element's attributes into a plain object.
 */
function getAttributes(element) {
  const attrs = {};
  if (element.attributes) {
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attrs[attr.name] = attr.value;
    }
  }
  return attrs;
}

/**
 * Reads and parses the JSON file containing country metadata (labelPosition, bbox).
 * @param {string} jsonFilePath - Path to the countries JSON file.
 * @returns {Map<string, object>} A Map where keys are country IDs and values are country data objects.
 */
function loadCountryMetadata(jsonFilePath) {
  try {
    const jsonData = fs.readFileSync(jsonFilePath, 'utf8');
    const countryArray = JSON.parse(jsonData); // Assumes the JSON is an array of objects

    if (!Array.isArray(countryArray)) {
      console.error(
        `Error: Expected ${jsonFilePath} to contain a JSON array.`
      );
      // If it's an object with a key like "countries", adjust here:
      // e.g., if (typeof countryArray === 'object' && Array.isArray(countryArray.countries)) {
      //   return new Map(countryArray.countries.map(c => [c.id, c]));
      // }
      return new Map(); // Return empty map on error
    }

    // Create a Map for efficient lookup by ID
    const countryMap = new Map();
    countryArray.forEach((country) => {
      if (country && country.id) {
        countryMap.set(country.id, country);
      } else {
        console.warn('Skipping country data item without an ID:', country);
      }
    });
    console.log(
      `Loaded metadata for ${countryMap.size} countries from ${jsonFilePath}`
    );
    return countryMap;
  } catch (error) {
    console.error(`Error reading or parsing ${jsonFilePath}:`, error);
    return new Map(); // Return empty map on error
  }
}

/**
 * Extract shapes from the SVG and merge with country metadata.
 * @param {string} svgFilePath - Path to the SVG file.
 * @param {Map<string, object>} countryMetadataMap - Map containing pre-loaded country metadata.
 * @returns {Array<Object>} Array of merged shape objects.
 */
function extractAndMergeShapes(svgFilePath, countryMetadataMap) {
  const shapes = [];
  try {
    const svgContent = fs.readFileSync(svgFilePath, 'utf8');
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'text/xml'); // Use text/xml for SVG

    // Iterate over each specified shape tag
    shapeTags.forEach((tag) => {
      const elements = svgDoc.getElementsByTagName(tag);
      for (let i = 0; i < elements.length; i++) {
        const elem = elements[i];
        const id = elem.getAttribute('id') || '';
        // Use inkscape:label primarily, fall back to serif:id, then element id
        const label =
          elem.getAttribute('inkscape:label') ||
          elem.getAttribute('serif:id') || // Add fallback for other editors if needed
          id;
        const attributes = getAttributes(elem);

        // Find corresponding metadata from the JSON file
        const metadata = countryMetadataMap.get(id);

        const shapeData = {
          tag,
          id,
          name: label || id, // Ensure name is never empty
          attributes,
          // Add metadata if found
          labelPosition: metadata?.labelPosition || null, // Use null if not found
          bbox: metadata?.bbox || null, // Use null if not found
        };

        // Only add if it has an ID, as we need it for matching
        if (id) {
          shapes.push(shapeData);
          if (!metadata) {
            // console.warn(`No metadata found in ${COUNTRIES_DATA_PATH} for SVG element with id="${id}"`);
          }
        } else {
          // console.warn(`Skipping SVG element <${tag}> without an id attribute.`);
        }
      }
    });
  } catch (error) {
    console.error(`Error reading or parsing SVG ${svgFilePath}:`, error);
  }
  return shapes;
}

/**
 * Save the extracted shapes as a JSON file.
 */
function saveShapesAsJSON(shapes, outputPath) {
  try {
    // Structure the output as {"shapes": [...]}
    const jsonData = JSON.stringify({ shapes }, null, 2); // Pretty print JSON
    fs.writeFileSync(outputPath, jsonData, 'utf8');
    console.log(`Saved data for ${shapes.length} shapes to ${outputPath}`);
  } catch (error) {
    console.error(`Error writing JSON to ${outputPath}:`, error);
  }
}

/**
 * Main function
 */
function main() {
  console.log(`Loading country metadata from ${COUNTRIES_DATA_PATH}...`);
  const countryMetadataMap = loadCountryMetadata(COUNTRIES_DATA_PATH);

  if (countryMetadataMap.size === 0) {
    console.warn(
      'No country metadata loaded. Output JSON will not contain labelPosition or bbox.'
    );
  }

  console.log(`Extracting shapes from ${SVG_FILE_PATH} and merging data...`);
  const shapes = extractAndMergeShapes(SVG_FILE_PATH, countryMetadataMap);

  if (shapes.length > 0) {
    saveShapesAsJSON(shapes, OUTPUT_PATH);
  } else {
    console.error('No shapes with IDs were extracted. No output file generated.');
  }
}

// Run the main function
main();
