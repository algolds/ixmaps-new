// scripts/generate-country-positions.js
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');

// --- Configuration ---
const SVG_FILE_PATH = path.resolve('./public/maps/political-map.svg');
const OUTPUT_PATH = path.resolve('./public/data/country_positions_bbox.json');
const PARENT_LAYER_ID = null;
const TARGET_TAGS = ['path', 'rect', 'polygon', 'circle', 'ellipse', 'g'];
// --- End Configuration ---

function getCountryIdsFromSVG(svgFilePath, parentLayerId, targetTags) {
  // ... (This function remains the same) ...
  console.log(`Reading SVG from: ${svgFilePath}`);
  const svgContent = fs.readFileSync(svgFilePath, 'utf8');
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgContent, 'text/xml');
  const countryInfo = [];
  let searchContext = svgDoc;
  if (parentLayerId) { /* ... */ }
  targetTags.forEach(tag => {
    const elements = searchContext.getElementsByTagName(tag);
    for (let i = 0; i < elements.length; i++) {
      const elem = elements[i];
      const id = elem.getAttribute('id');
      if (id) {
        const name = elem.getAttribute('inkscape:label') || id;
        if (!countryInfo.some(c => c.id === id)) {
             countryInfo.push({ id, name });
        }
      }
    }
  });
  console.log(`Found ${countryInfo.length} potential country elements with IDs.`);
  return countryInfo;
}


async function getAccurateBBoxCenters(svgFilePath, countryInfo) {
  let browser = null;
  const results = [];
  if (!countryInfo || countryInfo.length === 0) {
    console.log("No country IDs provided. Skipping BBox calculation.");
    return results;
  }

  try {
    console.log('Launching Puppeteer browser...');
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    page.on('pageerror', (err) => { console.error(`[Browser Page Error]: ${err.toString()}`); });
    page.on('error', (err) => { console.error(`[Browser Crash Error]: ${err.toString()}`); });

    const svgFileUrl = `file://${path.resolve(svgFilePath)}`;
    console.log(`Navigating to SVG file URL: ${svgFileUrl}`);
    await page.goto(svgFileUrl, { waitUntil: 'load', timeout: 60000 });

    console.log('SVG loaded. Calculating BBoxes...');

    const batchSize = 25;
    for (let i = 0; i < countryInfo.length; i += batchSize) {
        const batch = countryInfo.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} items)...`);

        // Process batch items one by one using evaluate to get better error details if needed
        for (const { id, name } of batch) {
            const isProblemId = (id === 'Bulkh');
            if (isProblemId) console.log(`>>> Evaluating ID: ${id} directly`);

            const result = await page.evaluate((elementId) => {
                // This entire function runs in the browser context
                try {
                    const element = document.getElementById(elementId);
                    if (!element) {
                        return { success: false, errorType: 'NotFound', errorMessage: 'Element not found' };
                    }
                    if (typeof element.checkVisibility === 'function' && !element.checkVisibility()) {
                         return { success: false, errorType: 'NotVisible', errorMessage: 'Element not visible' };
                    }
                    if (typeof element.getBBox !== 'function') {
                        return { success: false, errorType: 'NoGetBBox', errorMessage: `getBBox not a function on <${element.tagName}>` };
                    }

                    // --- Call getBBox ---
                    const box = element.getBBox();
                    // --- End Call ---

                    if (!box || typeof box.x !== 'number' || typeof box.y !== 'number' || typeof box.width !== 'number' || typeof box.height !== 'number') {
                         return { success: false, errorType: 'InvalidRect', errorMessage: 'Invalid DOMRect returned' };
                    }

                    // Success case
                    return {
                        success: true,
                        center: {
                            x: box.x + box.width / 2,
                            y: box.y + box.height / 2,
                        }
                    };
                } catch (e) {
                    // Explicitly catch errors within evaluate and serialize properties
                    return {
                        success: false,
                        errorType: e.name || 'UnknownError', // e.g., 'TypeError', 'DOMException'
                        errorMessage: e.message || 'Exception during getBBox'
                    };
                }
            }, id); // Pass ID to evaluate

            if (isProblemId) console.log(`<<< Result for ${id}:`, JSON.stringify(result));

            // Process result in Node.js context
            if (result && result.success && result.center) {
                results.push({ id, name, position: result.center });
            } else {
                const errorType = (result && result.errorType) ? result.errorType : 'UnknownType';
                const errorMessage = (result && result.errorMessage) ? result.errorMessage : 'Unknown evaluation error';
                console.warn(`Could not get BBox center for ${id}: [${errorType}] ${errorMessage}`);
                // Check if the strange error persists
                if (errorMessage === 'document is not defined') {
                     console.error(`   >>> Received 'document is not defined' error for ID ${id}. This indicates a likely Puppeteer serialization issue.`);
                }
            }
        } // End loop through batch items
    } // End loop through batches

  } catch (error) {
    console.error('Error during Puppeteer processing:', error);
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
    }
  }
  return results;
}

async function main() {
  // ... (main function remains the same) ...
  console.log('Starting country position generation...');
  const countryInfo = getCountryIdsFromSVG(SVG_FILE_PATH, PARENT_LAYER_ID, TARGET_TAGS);
  const positionData = await getAccurateBBoxCenters(SVG_FILE_PATH, countryInfo);
  if (positionData.length > 0) { /* ... save results ... */
    const outputDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outputDir)){ fs.mkdirSync(outputDir, { recursive: true }); }
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(positionData, null, 2), 'utf8');
    console.log(`\nSuccessfully saved position data for ${positionData.length} countries to ${OUTPUT_PATH}`);
  } else { console.log('\nNo position data was generated.'); }
}

main().catch(err => {
    console.error("Script failed:", err);
    process.exit(1);
});
