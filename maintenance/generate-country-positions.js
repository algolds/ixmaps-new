const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { DOMParser } = require("xmldom");

// --- Configuration ---
const SVG_FILE_PATH = path.resolve("./public/maps/master-map.svg");
// Output path for the JSON containing shape data for the TARGET layer
const OUTPUT_PATH = path.resolve(
  "./public/data/political_layer_shapes_ctm.json",
);
// *** SET THE ID OF THE GROUP LAYER (<g>) YOU WANT TO TARGET ***
const TARGET_LAYER_ID = "political"; // Example: Use the actual ID of your political layer <g>
// Shape tags to extract within the target layer
const TARGET_TAGS = ["path", "rect", "polygon", "circle", "ellipse"];
// Default values for new metadata fields (can be updated later manually or via another process)
const DEFAULT_CONTINENT = null; // Or "Unknown", "", etc.
const DEFAULT_TYPE = null; // Or "Unassigned", "NPC", "PC", "UNUSED" etc.
// Puppeteer batch size for processing elements
const BATCH_SIZE = 50;
// --- End Configuration ---

/**
 * Represents the extracted information for a single shape element.
 * @typedef {object} ShapeInfo
 * @property {string} id - The unique ID of the SVG element (original or generated).
 * @property {string} name - The name of the shape (from inkscape:label or ID).
 * @property {string} layerId - The ID of the parent layer group this shape belongs to.
 * @property {string} tagName - The SVG tag name of the shape (e.g., 'path', 'rect').
 * @property {string | null} continent - Placeholder for continent information.
 * @property {string | null} type - Placeholder for type information (e.g., PC, NPC).
 */

/**
 * Represents the final output data structure for a shape, including its position.
 * @typedef {object} ShapePositionData
 * @property {string} id - The unique ID of the SVG element.
 * @property {string} name - The name of the shape.
 * @property {string} layerId - The ID of the parent layer group.
 * @property {string} tagName - The SVG tag name of the shape.
 * @property {string | null} continent - Continent information.
 * @property {string | null} type - Type information.
 * @property {{x: number, y: number}} position - The calculated center position after transformations.
 */

/**
 * Reads an SVG file, finds a specific layer group by ID, and extracts information
 * (including metadata) about all specified shape elements within that layer.
 * Generates IDs for shapes that don't have one.
 * @param {string} svgFilePath - Path to the SVG file.
 * @param {string} targetLayerId - ID of the parent <g> element to search within.
 * @param {string[]} targetShapeTags - Array of SVG shape tag names to extract.
 * @returns {ShapeInfo[]} - Array of objects with element ID, name, and metadata.
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
  /** @type {ShapeInfo[]} */
  const shapeInfoList = [];

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

      // Add to our list for processing, including new metadata
      shapeInfoList.push({
        id,
        name,
        layerId: targetLayerId, // Add the layer ID
        tagName: tag, // Add the shape's tag name
        continent: DEFAULT_CONTINENT, // Add default continent
        type: DEFAULT_TYPE, // Add default type
      });

      if (isGeneratedId) {
        // console.log(`    Generated ID ${id} for <${tag}> element.`);
      }
    }
  });

  console.log(
    `Extracted info for ${shapeInfoList.length} total shapes with actual or generated IDs within layer "${targetLayerId}" using tags: [${targetShapeTags.join(", ")}]`,
  );
  return shapeInfoList;
}

/**
 * Uses Puppeteer to launch a headless browser, load the SVG,
 * and calculate the transformed center point for each element ID provided.
 * Includes passing through metadata.
 * @param {string} svgFilePath - Absolute path to the SVG file.
 * @param {ShapeInfo[]} elementInfoList - Array from getShapesFromLayer.
 * @returns {Promise<ShapePositionData[]>} - Promise resolving to array of results including positions.
 */
async function getTransformedCenters(svgFilePath, elementInfoList) {
  /** @type {ShapePositionData[]} */
  const results = [];
  if (!elementInfoList || elementInfoList.length === 0) {
    console.log("No element info provided. Skipping center calculation.");
    return results;
  }

  let browser = null;
  try {
    console.log("Launching Puppeteer browser...");
    browser = await puppeteer.launch({
      headless: true, // Keep headless true for server/script environments
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", // Crucial for Docker/limited environments
        "--disable-gpu", // Often needed in headless
      ],
    });
    const page = await browser.newPage();

    // Optional: Log browser console messages to Node console
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
    // Increased timeout for potentially complex SVGs
    await page.goto(svgFileUrl, {
      waitUntil: "networkidle0", // Wait for network activity to cease
      timeout: 90000, // 90 seconds
    });

    console.log(
      "SVG loaded. Calculating transformed centers for extracted shapes...",
    );

    for (let i = 0; i < elementInfoList.length; i += BATCH_SIZE) {
      const batch = elementInfoList.slice(i, i + BATCH_SIZE);
      console.log(
        `Processing batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(elementInfoList.length / BATCH_SIZE)} (${batch.length} items)...`,
      );

      // Pass the full shape info into evaluate
      const batchResults = await page.evaluate((batchInfo) => {
        const batchOutput = [];
        const svgRoot = document.documentElement;

        if (!svgRoot || typeof svgRoot.createSVGPoint !== "function") {
          // Return error status for all items in the batch if setup fails
          return batchInfo.map((info) => ({
            ...info, // Spread existing info
            success: false,
            errorType: "SetupError",
            errorMessage: "Could not find root SVG or createSVGPoint method.",
          }));
        }

        batchInfo.forEach(
          ({ id, name, layerId, tagName, continent, type }) => {
            // Initialize resultData with all incoming info
            let resultData = {
              id,
              name,
              layerId,
              tagName,
              continent,
              type,
              success: false,
            };
            const element = document.getElementById(id); // Use the ID to find the element

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
                // Basic validation of bbox properties
                if (
                  !bbox ||
                  typeof bbox.x !== "number" ||
                  typeof bbox.y !== "number" ||
                  typeof bbox.width !== "number" ||
                  typeof bbox.height !== "number"
                ) {
                  resultData.errorType = "InvalidBBox";
                  resultData.errorMessage = `Invalid BBox returned for ID '${id}'. BBox: ${JSON.stringify(bbox)}`;
                } else {
                  // Handle zero-dimension bounding boxes (e.g., for straight lines)
                  // Use the starting point as the center in this case.
                  const centerX =
                    bbox.width === 0 ? bbox.x : bbox.x + bbox.width / 2;
                  const centerY =
                    bbox.height === 0 ? bbox.y : bbox.y + bbox.height / 2;

                  const ctm = element.getCTM(); // Get CONSOLIDATED transform matrix

                  if (!ctm) {
                    // Should be rare if getCTM exists, but check anyway
                    resultData.errorType = "InvalidCTM";
                    resultData.errorMessage = `Invalid CTM returned for ID '${id}'.`;
                  } else {
                    const pt = svgRoot.createSVGPoint();
                    pt.x = centerX;
                    pt.y = centerY;
                    const transformedPoint = pt.matrixTransform(ctm);

                    // Update resultData with success and position
                    resultData = {
                      ...resultData, // Keep existing metadata
                      success: true,
                      position: {
                        x: transformedPoint.x,
                        y: transformedPoint.y,
                      },
                    };
                  }
                }
              } catch (e) {
                // Catch errors during bbox/ctm calculation
                resultData.errorType = e.name || "EvaluationError";
                resultData.errorMessage =
                  e.message || `Exception during processing ID '${id}'.`;
              }
            }
            batchOutput.push(resultData);
          },
        );
        return batchOutput;
      }, batch); // Pass the current batch to evaluate

      // Process results from the batch
      batchResults.forEach((result) => {
        if (result.success && result.position) {
          // Push the full object including metadata and position
          results.push({
            id: result.id,
            name: result.name,
            layerId: result.layerId,
            tagName: result.tagName,
            continent: result.continent,
            type: result.type,
            position: result.position,
          });
        } else {
          // Log warnings for failures, including the ID and name
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
  console.log(`Successfully calculated positions for ${results.length} shapes.`);
  return results;
}

/**
 * Main function to orchestrate SVG parsing and position calculation.
 */
async function main() {
  console.log(
    `Starting shape position generation for layer: ${TARGET_LAYER_ID}`,
  );

  // 1. Extract shape elements and initial metadata from the target layer
  const elementInfoList = getShapesFromLayer(
    SVG_FILE_PATH,
    TARGET_LAYER_ID,
    TARGET_TAGS,
  );

  if (elementInfoList.length === 0) {
    console.log(
      `No shapes found in the target layer "${TARGET_LAYER_ID}" matching tags [${TARGET_TAGS.join(", ")}]. Exiting.`,
    );
    return;
  }

  // 2. Calculate transformed center positions using Puppeteer
  const positionData = await getTransformedCenters(
    SVG_FILE_PATH,
    elementInfoList,
  );

  // 3. Save the results (including metadata and positions)
  if (positionData.length > 0) {
    try {
      const outputDir = path.dirname(OUTPUT_PATH);
      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`Created output directory: ${outputDir}`);
      }
      // Write the final data to JSON
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
    console.log(
      `\nNo position data was successfully generated for layer "${TARGET_LAYER_ID}". Output file not written.`,
    );
  }
}

// --- Run the script ---
main().catch((err) => {
  console.error("Script failed with unhandled error:", err);
  process.exit(1); // Exit with error code
});
