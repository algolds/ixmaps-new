const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { DOMParser } = require("xmldom");

// --- Configuration ---
const SVG_FILE_PATH = path.resolve("./public/maps/master-map.svg");
const OUTPUT_PATH = path.resolve("./public/data/political_layer_shapes_ctm.json"); // More specific output name
// *** SET THE ID OF THE GROUP LAYER YOU WANT TO TARGET ***
const TARGET_LAYER_ID = "political"; // Example: Use the actual ID of your political layer <g>
const TARGET_TAGS = ["path", "rect", "polygon", "circle", "ellipse"]; // Shape tags to extract within the layer
const BATCH_SIZE = 50;
// --- End Configuration ---

/**
 * Reads an SVG file, finds a specific layer group by ID, and extracts information
 * about all specified shape elements within that layer. Generates IDs for shapes
 * that don't have one.
 * @param {string} svgFilePath - Path to the SVG file.
 * @param {string} targetLayerId - ID of the parent <g> element to search within.
 * @param {string[]} targetShapeTags - Array of SVG shape tag names to extract.
 * @returns {Array<{id: string, name: string}>} - Array of objects with element ID and name.
 */
function getShapesFromLayer(svgFilePath, targetLayerId, targetShapeTags) {
  console.log(`Reading SVG from: ${svgFilePath}`);
  if (!fs.existsSync(svgFilePath)) {
    console.error(`Error: SVG file not found at ${svgFilePath}`);
    return [];
  }
  if (!targetLayerId) {
    console.error(`Error: TARGET_LAYER_ID configuration cannot be empty.`);
    return [];
  }

  const svgContent = fs.readFileSync(svgFilePath, "utf8");
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgContent, "text/xml");
  const shapeInfo = [];

  // Find the target layer group element
  const targetLayerElement = svgDoc.getElementById(targetLayerId);

  if (!targetLayerElement) {
    console.error(
      `Error: Target layer group with ID "${targetLayerId}" not found in the SVG.`,
    );
    return [];
  }
  console.log(`Found target layer: "${targetLayerId}". Extracting shapes...`);

  if (typeof targetLayerElement.getElementsByTagName !== "function") {
    console.error(
      `Error: Target layer element (ID: ${targetLayerId}) does not support getElementsByTagName.`,
    );
    return [];
  }

  let generatedIdCounter = 0;

  // Iterate through the specified shape tags within the target layer
  targetShapeTags.forEach((tag) => {
    const elements = targetLayerElement.getElementsByTagName(tag);
    console.log(`  Found ${elements.length} <${tag}> elements in layer.`);

    for (let i = 0; i < elements.length; i++) {
      const elem = elements[i];
      let id = elem.getAttribute("id");
      const inkscapeLabel = elem.getAttribute("inkscape:label");
      let name = "";
      let isGeneratedId = false;

      if (!id) {
        // Generate a unique ID if one doesn't exist
        id = `${targetLayerId}-${tag}-${generatedIdCounter++}`;
        isGeneratedId = true;
        // Assign the generated ID back to the element in the DOM object
        // Note: This only modifies the in-memory representation, not the original file
        elem.setAttribute("id", id);
      }

      // Determine the name: inkscape:label > element id
      name = inkscapeLabel || id;

      // Add to our list for processing
      shapeInfo.push({ id, name });
      if (isGeneratedId) {
        // console.log(`    Generated ID ${id} for <${tag}> element.`);
      }
    }
  });

  console.log(
    `Found ${shapeInfo.length} total shapes with actual or generated IDs within layer "${targetLayerId}" using tags: [${targetShapeTags.join(", ")}]`,
  );
  return shapeInfo;
}

/**
 * Uses Puppeteer to launch a headless browser, load the SVG,
 * and calculate the transformed center point for each element ID provided.
 * (This function remains largely the same as before)
 * @param {string} svgFilePath - Absolute path to the SVG file.
 * @param {Array<{id: string, name: string}>} elementInfo - Array from getShapesFromLayer.
 * @returns {Promise<Array<{id: string, name: string, position: {x: number, y: number}}>>} - Promise resolving to array of results.
 */
async function getTransformedCenters(svgFilePath, elementInfo) {
  const results = [];
  if (!elementInfo || elementInfo.length === 0) {
    console.log("No element IDs provided. Skipping center calculation.");
    return results;
  }

  let browser = null;
  try {
    console.log("Launching Puppeteer browser...");
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
    const page = await browser.newPage();

    page.on("console", (msg) =>
      console.log(`[Browser Console]: ${msg.text()}`),
    );
    page.on("pageerror", (err) =>
      console.error(`[Browser Page Error]: ${err.toString()}`),
    );
    page.on("error", (err) =>
      console.error(`[Browser Crash Error]: ${err.toString()}`),
    );

    const svgFileUrl = `file://${svgFilePath}`;
    console.log(`Navigating to SVG file URL: ${svgFileUrl}`);
    await page.goto(svgFileUrl, {
      waitUntil: "networkidle0",
      timeout: 90000,
    });

    console.log("SVG loaded. Calculating transformed centers for extracted shapes...");

    for (let i = 0; i < elementInfo.length; i += BATCH_SIZE) {
      const batch = elementInfo.slice(i, i + BATCH_SIZE);
      console.log(
        `Processing batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(elementInfo.length / BATCH_SIZE)} (${batch.length} items)...`,
      );

      const batchResults = await page.evaluate((batchInfo) => {
        const batchOutput = [];
        const svgRoot = document.documentElement;

        if (!svgRoot || typeof svgRoot.createSVGPoint !== "function") {
          return batchInfo.map((info) => ({
            id: info.id,
            name: info.name, // Pass name through
            success: false,
            errorType: "SetupError",
            errorMessage: "Could not find root SVG or createSVGPoint method.",
          }));
        }

        batchInfo.forEach(({ id, name }) => {
          // Use the ID (potentially generated) to find the element
          const element = document.getElementById(id);
          let resultData = { id, name, success: false };

          if (!element) {
            resultData.errorType = "NotFound";
            resultData.errorMessage = `Element with ID '${id}' not found in the DOM.`;
          } else if (typeof element.getBBox !== "function") {
            resultData.errorType = "NoGetBBox";
            resultData.errorMessage = `getBBox is not a function on <${element.tagName}> element (ID: ${id}).`;
          } else if (typeof element.getCTM !== "function") {
            resultData.errorType = "NoGetCTM";
            resultData.errorMessage = `getCTM is not a function on <${element.tagName}> element (ID: ${id}).`;
          } else {
            try {
              const bbox = element.getBBox();
              if (
                !bbox || typeof bbox.x !== "number" || typeof bbox.y !== "number" ||
                typeof bbox.width !== "number" || typeof bbox.height !== "number"
              ) {
                resultData.errorType = "InvalidBBox";
                resultData.errorMessage = `Invalid BBox returned for ID '${id}'.`;
              } else {
                const centerX = bbox.x + bbox.width / 2;
                const centerY = bbox.y + bbox.height / 2;
                const ctm = element.getCTM();

                if (!ctm) {
                  resultData.errorType = "InvalidCTM";
                  resultData.errorMessage = `Invalid CTM returned for ID '${id}'.`;
                } else {
                  const pt = svgRoot.createSVGPoint();
                  pt.x = centerX;
                  pt.y = centerY;
                  const transformedPoint = pt.matrixTransform(ctm);
                  resultData = {
                    id,
                    name,
                    success: true,
                    center: { x: transformedPoint.x, y: transformedPoint.y },
                  };
                }
              }
            } catch (e) {
              resultData.errorType = e.name || "EvaluationError";
              resultData.errorMessage = e.message || `Exception during processing ID '${id}'.`;
            }
          }
          batchOutput.push(resultData);
        });
        return batchOutput;
      }, batch);

      batchResults.forEach((result) => {
        if (result.success && result.center) {
          results.push({
            id: result.id,
            name: result.name,
            position: result.center,
          });
        } else {
          console.warn(
            `Could not get transformed center for ID ${result.id} (${result.name}): [${result.errorType}] ${result.errorMessage}`,
          );
        }
      });
    }
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
 * Main function to orchestrate SVG parsing and position calculation.
 */
async function main() {
  console.log("Starting shape position generation for target layer...");

  // 1. Extract shape elements from the target layer in the SVG
  const elementInfo = getShapesFromLayer(
    SVG_FILE_PATH,
    TARGET_LAYER_ID, // Pass the configured layer ID
    TARGET_TAGS, // Pass the shape tags
  );

  if (elementInfo.length === 0) {
    console.log("No shapes found in the target layer to process. Exiting.");
    return;
  }

  // 2. Calculate transformed center positions using Puppeteer
  const positionData = await getTransformedCenters(SVG_FILE_PATH, elementInfo);

  // 3. Save the results
  if (positionData.length > 0) {
    try {
      const outputDir = path.dirname(OUTPUT_PATH);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`Created output directory: ${outputDir}`);
      }
      fs.writeFileSync(
        OUTPUT_PATH,
        JSON.stringify(positionData, null, 2), // Pretty print JSON
        "utf8",
      );
      console.log(
        `\nSuccessfully saved transformed center data for ${positionData.length} shapes from layer "${TARGET_LAYER_ID}" to ${OUTPUT_PATH}`,
      );
    } catch (writeError) {
      console.error(`Error writing output file to ${OUTPUT_PATH}:`, writeError);
    }
  } else {
    console.log("\nNo position data was successfully generated.");
  }
}

// --- Run the script ---
main().catch((err) => {
  console.error("Script failed with unhandled error:", err);
  process.exit(1);
});
