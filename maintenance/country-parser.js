const fs = require('fs');
const { DOMParser } = require('xmldom');

// Adjust these constants as needed.
const SVG_FILE_PATH = './public/maps/political-map.svg'; // Path to your SVG file.
const OUTPUT_PATH = './public/data/shapes.json';          // Path to save the JSON output.

// List of shape tag names to extract
const shapeTags = ['path', 'rect', 'polygon', 'circle', 'ellipse'];

/**
 * Extracts an element's attributes into a plain object.
 *
 * @param {Element} element - The DOM element.
 * @returns {Object} An object with all attribute name/value pairs.
 */
function getAttributes(element) {
  const attrs = {};
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

/**
 * Extract every shape from the SVG and return as an array of objects.
 *
 * Each object will include:
 *   - tag: The SVG tag name (e.g. "path", "rect", etc.)
 *   - id: The "id" attribute (if present)
 *   - name: The "inkscape:label" attribute, or the id if not available.
 *   - attributes: All attributes associated with the element.
 *
 * @param {string} svgFilePath - The file path to the SVG file.
 * @returns {Array<Object>} Array of shape objects.
 */
function extractShapes(svgFilePath) {
  const svgContent = fs.readFileSync(svgFilePath, 'utf8');
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgContent, 'text/xml');

  const shapes = [];

  // Iterate over each shape tag
  shapeTags.forEach((tag) => {
    const elements = svgDoc.getElementsByTagName(tag);
    for (let i = 0; i < elements.length; i++) {
      const elem = elements[i];
      const id = elem.getAttribute('id') || '';
      const label = elem.getAttribute('inkscape:label') || id;
      const attributes = getAttributes(elem);

      shapes.push({
        tag,
        id,
        name: label,
        attributes
      });
    }
  });

  return shapes;
}

/**
 * Save the extracted shapes as a JSON file.
 *
 * @param {Array<Object>} shapes - Array of shape objects.
 * @param {string} outputPath - File path to save the JSON.
 */
function saveShapesAsJSON(shapes, outputPath) {
  const jsonData = JSON.stringify({ shapes }, null, 2);
  fs.writeFileSync(outputPath, jsonData, 'utf8');
  console.log(`Saved data for ${shapes.length} shapes to ${outputPath}`);
}

/**
 * Main function to extract and save all shape data from the SVG.
 */
function main() {
  console.log('Extracting shape data from SVG...');
  const shapes = extractShapes(SVG_FILE_PATH);
  console.log(`Extracted data for ${shapes.length} shapes.`);
  saveShapesAsJSON(shapes, OUTPUT_PATH);
}

main();
