/**
 * Generate LOD (Level of Detail) versions of SVG maps
 * 
 * This script processes the high-resolution SVG map to create medium and low
 * resolution versions for improved performance at different zoom levels.
 * 
 * Usage: node scripts/generate-lod-maps.js
 */

const fs = require('fs');
const path = require('path');
const { optimize } = require('svgo');

// Configuration
const SOURCE_MAP = path.join(__dirname, '../public/master-map.svg');
const OUTPUT_DIR = path.join(__dirname, '../public/maps');
const LOD_LEVELS = {
  HIGH: { name: 'master-map-high.svg', simplify: 0 },      // Original, no simplification
  MEDIUM: { name: 'master-map-medium.svg', simplify: 0.5 }, // Medium simplification
  LOW: { name: 'master-map-low.svg', simplify: 0.9 }        // High simplification
};

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Copy the original high-res file
console.log('Creating high-resolution map copy...');
fs.copyFileSync(SOURCE_MAP, path.join(OUTPUT_DIR, LOD_LEVELS.HIGH.name));

// Process the SVG for each LOD level except HIGH (which is already copied)
async function processLODLevels() {
  const svgContent = fs.readFileSync(SOURCE_MAP, 'utf8');

  console.log('Generating medium-resolution map...');
  await generateLODVersion(svgContent, LOD_LEVELS.MEDIUM);

  console.log('Generating low-resolution map...');
  await generateLODVersion(svgContent, LOD_LEVELS.LOW);

  console.log('All LOD maps generated successfully!');
}

async function generateLODVersion(svgContent, levelConfig) {
  try {
    // Create a temporary file with the SVG content
    const tempFile = path.join(OUTPUT_DIR, `temp_${levelConfig.name}`);
    fs.writeFileSync(tempFile, svgContent);

    // Configure SVGO for the appropriate level of optimization
    // SVGO 3.x uses a different plugin system
    const precision = Math.max(1, Math.floor(5 * (1 - levelConfig.simplify)));
    
    const result = optimize(svgContent, {
      multipass: true, // Apply multiple optimization passes for better results
      // Configure plugins for SVGO 3.x
      plugins: [
        // Basic cleanup plugins
        'preset-default',
        
        // Add more specific optimizations based on LOD level
        {
          name: 'removeAttrs',
          params: {
            attrs: ['data-name', 'serif:id']
          }
        },
        
        // Configure path processing based on LOD level
        {
          name: 'convertPathData',
          params: {
            // Higher precision for higher quality levels
            floatPrecision: precision,
            // Apply more aggressive transformations for lower LOD levels
            transformPrecision: precision,
            // Apply different path simplification based on LOD level
            noSpaceAfterFlags: true,
            applyTransforms: true,
            applyTransformsStroked: true,
            straightCurves: levelConfig.simplify > 0.3,
            lineShorthands: levelConfig.simplify > 0.3,
            curveSmoothShorthands: levelConfig.simplify > 0.3,
            convertToQ: levelConfig.simplify > 0.7,
            removeUseless: true,
            collapseRepeated: true,
            utilizeAbsolute: true,
            leadingZero: false,
            negativeExtraSpace: true,
          }
        },
        
        // Configure number precision
        {
          name: 'cleanupNumericValues',
          params: {
            floatPrecision: precision,
            leadingZero: false,
            defaultPx: true,
            convertToPx: true
          }
        },
        
        // Merge paths if appropriate for the LOD level
        {
          name: 'mergePaths',
          // Only apply for lower detail versions
          active: levelConfig.simplify > 0.5
        },
        
        // Remove viewBox for better browser compatibility
        {
          name: 'removeViewBox',
          active: false
        },
        
        // Keep IDs
        {
          name: 'prefixIds',
          active: false
        },
        
        // Remove unused elements
        {
          name: 'removeEmptyContainers',
          active: true
        },
        
        // Collapse groups
        {
          name: 'collapseGroups',
          active: levelConfig.simplify > 0.7
        },
        
        // Remove unnecessary decimals
        {
          name: 'cleanupListOfValues',
          active: true,
          params: {
            floatPrecision: precision
          }
        }
      ]
    });

    // Write the optimized SVG to the output file
    fs.writeFileSync(path.join(OUTPUT_DIR, levelConfig.name), result.data);
    
    // Remove the temporary file
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    
    console.log(`Generated ${levelConfig.name}`);
  } catch (error) {
    console.error(`Error generating ${levelConfig.name}:`, error);
  }
}

processLODLevels().catch(err => {
  console.error('Error generating LOD maps:', err);
  process.exit(1);
});
