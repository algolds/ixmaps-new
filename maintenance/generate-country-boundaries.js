/**
 * Enhanced SVG Path Extractor
 * This script extracts complete path data from SVG shapes in a specified layer
 * and saves them to a JSON file for use with the PoliticalLayerComponent.
 */

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { DOMParser } = require("xmldom");

// --- Configuration ---
const SVG_FILE_PATH = path.resolve("./public/maps/master-map.svg");
const OUTPUT_PATH = path.resolve("./public/data/political_boundaries.json");
const TARGET_LAYER_ID = "political";
const TARGET_TAGS = ["path", "polygon", "rect"]; // Common SVG shape elements
const DEFAULT_CONTINENT = null;
const DEFAULT_TYPE = null;
const BATCH_SIZE = 25; // Reduced batch size for more complex data
// --- End Configuration ---

/**
 * Reads an SVG file and extracts basic shape information.
 */
function getShapesFromLayer(svgFilePath, targetLayerId, targetShapeTags) {
  console.log(`Reading SVG from: ${svgFilePath}`);
  if (!fs.existsSync(svgFilePath)) {
    console.error(`Error: SVG file not found at ${svgFilePath}`);
    return [];
  }
  
  const svgContent = fs.readFileSync(svgFilePath, "utf8");
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgContent, "text/xml");
  const shapeInfoList = [];

  // Find the target layer
  const targetLayerElement = svgDoc.getElementById(targetLayerId);
  if (!targetLayerElement) {
    console.error(`Error: Target layer group with ID "${targetLayerId}" not found in the SVG.`);
    return [];
  }
  console.log(`Found target layer: "${targetLayerId}". Extracting shapes...`);

  // Extract shapes
  let generatedIdCounter = 0;
  targetShapeTags.forEach((tag) => {
    const elements = targetLayerElement.getElementsByTagName(tag);
    console.log(`  Found ${elements.length} <${tag}> elements in layer.`);

    for (let i = 0; i < elements.length; i++) {
      const elem = elements[i];
      let id = elem.getAttribute("id") || `${targetLayerId}-${tag}-${generatedIdCounter++}`;
      const inkscapeLabel = elem.getAttribute("inkscape:label");
      const name = inkscapeLabel || id;

      // Get path data or points based on tag type
      let pathData = null;
      if (tag === "path") {
        pathData = elem.getAttribute("d");
      } else if (tag === "polygon") {
        const points = elem.getAttribute("points");
        // Convert polygon points to path data
        if (points) {
          pathData = `M${points.trim().replace(/\s+/g, 'L')}z`;
        }
      } else if (tag === "rect") {
        const x = parseFloat(elem.getAttribute("x") || 0);
        const y = parseFloat(elem.getAttribute("y") || 0);
        const width = parseFloat(elem.getAttribute("width") || 0);
        const height = parseFloat(elem.getAttribute("height") || 0);
        // Create path data for rectangle
        pathData = `M${x},${y}L${x + width},${y}L${x + width},${y + height}L${x},${y + height}z`;
      }

      if (pathData) {
        shapeInfoList.push({
          id,
          name,
          layerId: targetLayerId,
          tagName: tag,
          continent: DEFAULT_CONTINENT,
          type: DEFAULT_TYPE,
          path: pathData,
        });
      }
    }
  });

  console.log(`Extracted info for ${shapeInfoList.length} total shapes.`);
  return shapeInfoList;
}

/**
 * Uses Puppeteer to calculate center points and extract transform information.
 */
async function calculateGeometryData(svgFilePath, elementInfoList) {
  const results = [];
  if (!elementInfoList || elementInfoList.length === 0) {
    console.log("No element info provided. Skipping processing.");
    return results;
  }

  let browser = null;
  try {
    console.log("Launching Puppeteer browser...");
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
    const page = await browser.newPage();

    // Add d3 for better path parsing
    await page.addScriptTag({
      url: 'https://d3js.org/d3.v7.min.js'
    });

    // Navigate to the SVG file
    const svgFileUrl = `file://${svgFilePath}`;
    console.log(`Loading SVG file: ${svgFileUrl}`);
    await page.goto(svgFileUrl, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    console.log("Processing shapes in batches...");
    for (let i = 0; i < elementInfoList.length; i += BATCH_SIZE) {
      const batch = elementInfoList.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(elementInfoList.length / BATCH_SIZE)} (${batch.length} items)...`);

      // Process each shape
      const batchResults = await page.evaluate((batchInfo) => {
        const results = [];
        const svgRoot = document.documentElement;

        batchInfo.forEach(({ id, name, layerId, tagName, continent, type, path }) => {
          try {
            const element = document.getElementById(id);
            if (!element) {
              console.log(`Element with ID '${id}' not found.`);
              return;
            }

            // Get the bounding box to calculate center
            const bbox = element.getBBox();
            const centerX = bbox.x + bbox.width / 2;
            const centerY = bbox.y + bbox.height / 2;

            // Transform center point using the element's transformation matrix
            const ctm = element.getCTM();
            if (!ctm) {
              console.log(`Could not get CTM for element with ID '${id}'.`);
              return;
            }

            const pt = svgRoot.createSVGPoint();
            pt.x = centerX;
            pt.y = centerY;
            const transformedPoint = pt.matrixTransform(ctm);

            // Process path data using d3 for better accuracy
            let processedPath = path;
            let simplifiedPoints = [];
            
            try {
              if (window.d3 && path) {
                // Parse the path data to get points
                const pathNode = d3.create("svg").append("path").attr("d", path).node();
                const pathLength = pathNode.getTotalLength();
                
                // Sample points along the path with adaptive sampling
                // Use more points for complex paths, fewer for simple ones
                const samplingCount = Math.max(50, Math.min(500, Math.ceil(pathLength / 10)));
                
                for (let i = 0; i < samplingCount; i++) {
                  const point = pathNode.getPointAtLength(pathLength * i / (samplingCount - 1));
                  
                  // Transform the point using the element's CTM
                  const svgPoint = svgRoot.createSVGPoint();
                  svgPoint.x = point.x;
                  svgPoint.y = point.y;
                  const transformedSvgPoint = svgPoint.matrixTransform(ctm);
                  
                  simplifiedPoints.push({
                    x: transformedSvgPoint.x,
                    y: transformedSvgPoint.y
                  });
                }
              }
            } catch (pathError) {
              console.log(`Error processing path data for '${id}': ${pathError.message}`);
              // Fall back to the original path
              simplifiedPoints = [];
            }

            results.push({
              id,
              name,
              layerId,
              tagName,
              continent,
              type,
              path: processedPath,
              position: {
                x: transformedPoint.x,
                y: transformedPoint.y,
              },
              bbox: {
                x: bbox.x,
                y: bbox.y,
                width: bbox.width,
                height: bbox.height
              },
              // Include the sampled points for complex shapes
              points: simplifiedPoints.length > 0 ? simplifiedPoints : null,
              // Include basic transform matrix values for debugging
              transform: {
                a: ctm.a,
                b: ctm.b,
                c: ctm.c,
                d: ctm.d,
                e: ctm.e,
                f: ctm.f
              }
            });
          } catch (error) {
            console.log(`Error processing element with ID '${id}': ${error.message}`);
          }
        });

        return results;
      }, batch);

      // Add successful results to the final array
      results.push(...batchResults);
    }

    console.log(`Successfully processed geometry data for ${results.length} shapes.`);
  } catch (error) {
    console.error("Error during Puppeteer processing:", error);
  } finally {
    if (browser) {
      console.log("Closing browser...");
      await browser.close();
    }
  }

  return results;
}

/**
 * Saves the results to a JSON file.
 */
function saveResults(results, outputPath) {
  try {
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Created output directory: ${outputDir}`);
    }

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf8");
    console.log(`Successfully saved data for ${results.length} shapes to ${outputPath}`);
    
    // Create a simplified version with just essential data
    const essentialData = results.map(({ id, name, path, position, points }) => ({
      id, 
      name, 
      path,
      position,
      points
    }));
    
    const essentialOutputPath = outputPath.replace('.json', '_essential.json');
    fs.writeFileSync(essentialOutputPath, JSON.stringify(essentialData, null, 2), "utf8");
    console.log(`Created simplified data file at ${essentialOutputPath}`);
    
    return true;
  } catch (error) {
    console.error(`Error writing output file: ${error.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log(`Starting enhanced extraction for layer: ${TARGET_LAYER_ID}`);

  // 1. Extract basic shape information with path data
  const shapeInfo = getShapesFromLayer(SVG_FILE_PATH, TARGET_LAYER_ID, TARGET_TAGS);
  if (shapeInfo.length === 0) {
    console.log(`No shapes found in layer "${TARGET_LAYER_ID}". Exiting.`);
    return;
  }

  // 2. Calculate center points and additional geometry data
  const geometryData = await calculateGeometryData(SVG_FILE_PATH, shapeInfo);
  if (geometryData.length === 0) {
    console.log("No geometry data was successfully generated. Output file not written.");
    return;
  }

  // 3. Save results
  const success = saveResults(geometryData, OUTPUT_PATH);
  if (success) {
    console.log(`\nExtraction complete! Saved data for ${geometryData.length} shapes.`);
    console.log("This data can now be used by the PoliticalLayerComponent for accurate border rendering.");
  }
}

// Run the script
main().catch((err) => {
  console.error("Script failed with unhandled error:", err);
  process.exit(1);
});