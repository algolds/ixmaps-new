/**
 * Simple SVG Position Extractor
 * This script extracts the center points of SVG shapes from a specified layer
 * and saves them to a JSON file.
 */

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { DOMParser } = require("xmldom");

// --- Configuration ---
const SVG_FILE_PATH = path.resolve("./public/maps/master-map.svg");
const OUTPUT_PATH = path.resolve("./public/data/political_layer_shapes_ctm.json");
const TARGET_LAYER_ID = "political";
const TARGET_TAGS = ["path", "rect", "polygon", "circle", "ellipse"];
const DEFAULT_CONTINENT = null;
const DEFAULT_TYPE = null;
const BATCH_SIZE = 50;
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

      shapeInfoList.push({
        id,
        name,
        layerId: targetLayerId,
        tagName: tag,
        continent: DEFAULT_CONTINENT,
        type: DEFAULT_TYPE,
      });
    }
  });

  console.log(`Extracted info for ${shapeInfoList.length} total shapes.`);
  return shapeInfoList;
}

/**
 * Uses Puppeteer to calculate the center points of shapes.
 */
async function calculateCenterPoints(svgFilePath, elementInfoList) {
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

        batchInfo.forEach(({ id, name, layerId, tagName, continent, type }) => {
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

            results.push({
              id,
              name,
              layerId,
              tagName,
              continent,
              type,
              position: {
                x: transformedPoint.x,
                y: transformedPoint.y,
              },
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

    console.log(`Successfully calculated center points for ${results.length} shapes.`);
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
  console.log(`Starting position extraction for layer: ${TARGET_LAYER_ID}`);

  // 1. Extract basic shape information
  const shapeInfo = getShapesFromLayer(SVG_FILE_PATH, TARGET_LAYER_ID, TARGET_TAGS);
  if (shapeInfo.length === 0) {
    console.log(`No shapes found in layer "${TARGET_LAYER_ID}". Exiting.`);
    return;
  }

  // 2. Calculate center points
  const positionData = await calculateCenterPoints(SVG_FILE_PATH, shapeInfo);
  if (positionData.length === 0) {
    console.log("No position data was successfully generated. Output file not written.");
    return;
  }

  // 3. Save results
  const success = saveResults(positionData, OUTPUT_PATH);
  if (success) {
    console.log(`\nPosition extraction complete! Saved data for ${positionData.length} shapes.`);
  }
}

// Run the script
main().catch((err) => {
  console.error("Script failed with unhandled error:", err);
  process.exit(1);
});