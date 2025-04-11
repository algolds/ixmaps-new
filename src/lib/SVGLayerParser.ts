/**
 * SVGLayerParser.ts
 * 
 * Utility functions for parsing SVG layers from Inkscape-generated SVGs
 */

import { SVGLayer } from '@/types';
import { getAssetPath } from '@/lib/config';

/**
 * Parse SVG content and extract layers
 * @param svgContent The SVG content as a string
 * @returns Object mapping layer IDs to their SVG elements
 */
export async function parseSVGLayers(svgContent: string): Promise<Record<string, SVGLayer>> {
  // Parse SVG content into a DOM document
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
  
  // Check for parsing errors
  const parserError = svgDoc.querySelector('parsererror');
  if (parserError) {
    console.error('SVG parsing error:', parserError.textContent);
    throw new Error('Failed to parse SVG content');
  }
  
  // Get the root SVG element
  const svgRoot = svgDoc.documentElement;
  
  // Get SVG dimensions
  const width = svgRoot.getAttribute('width') || '100%';
  const height = svgRoot.getAttribute('height') || '100%';
  const viewBox = svgRoot.getAttribute('viewBox') || '0 0 100 100';
  
  // Extract layers from SVG
  const layers: Record<string, SVGLayer> = {};
  
  // Function to process each potential layer
  const processLayerElement = (element: Element, parentId: string = '') => {
    // Get element ID and inkscape:label
    const id = element.getAttribute('id') || '';
    const label = element.getAttribute('inkscape:label') || element.getAttribute('serif:id') || id;
    
    // Is this a group element?
    if (element.tagName.toLowerCase() === 'g') {
      // Skip if no ID or label
      if (!id && !label) return;
      
      // Create a new SVG document for this layer
      const layerSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      layerSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      layerSvg.setAttribute('width', width);
      layerSvg.setAttribute('height', height);
      layerSvg.setAttribute('viewBox', viewBox);
      
      // Clone the element to avoid modifying the original
      const clonedElement = element.cloneNode(true) as Element;
      
      // Make layer visible
      clonedElement.setAttribute('style', 'display:inline');
      
      // Add the element to the SVG
      layerSvg.appendChild(clonedElement);
      
      // Store the layer
      const layerId = label || id;
      const fullId = parentId ? `${parentId}-${layerId}` : layerId;
      
      layers[fullId] = {
        id: fullId,
        name: label || id,
        svgElement: layerSvg,
        originalElement: element,
        parentId: parentId
      };
      
      // Process child groups as sub-layers (if they have the inkscape:groupmode="layer" attribute)
      const childLayers = element.querySelectorAll('g[inkscape\\:groupmode="layer"]');
      childLayers.forEach(childLayer => {
        processLayerElement(childLayer, fullId);
      });
    }
  };
  
  // Find all top-level layers (groups with inkscape:groupmode="layer")
  const topLevelLayers = svgDoc.querySelectorAll('g[inkscape\\:groupmode="layer"]');
  topLevelLayers.forEach(layer => {
    processLayerElement(layer);
  });
  
  // Also look for specific layers by ID if they weren't found as inkscape layers
  const targetLayerIds = ['political', 'climate', 'lakes', 'rivers', 'altitude-layers', 'icecaps'];
  targetLayerIds.forEach(id => {
    if (!layers[id]) {
      const element = svgDoc.getElementById(id);
      if (element) {
        processLayerElement(element);
      }
    }
  });
  
  return layers;
}

/**
 * Convert SVG element to a data URL
 * @param svgElement The SVG element to convert
 * @returns A data URL containing the SVG
 */
export function svgToDataUrl(svgElement: SVGElement): string {
  // Serialize the SVG to a string
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);
  
  // Create a data URL
  const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
  
  return dataUrl;
}

/**
 * Extract specific countries from the political layer
 * @param svgDoc The SVG document
 * @param countryIds Array of country IDs to extract
 * @returns SVG element containing only the selected countries
 */
export function extractCountries(svgDoc: Document, countryIds: string[]): SVGElement | null {
  // Find the political layer
  const politicalLayer = svgDoc.querySelector('g[inkscape\\:label="political"]') || 
                         svgDoc.getElementById('political');
  
  if (!politicalLayer) return null;
  
  // Create a new SVG document
  const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const svgRoot = svgDoc.documentElement;
  
  // Copy attributes from the original SVG
  if (svgRoot) {
    const width = svgRoot.getAttribute('width') || '100%';
    const height = svgRoot.getAttribute('height') || '100%';
    const viewBox = svgRoot.getAttribute('viewBox') || '0 0 100 100';
    
    svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgElement.setAttribute('width', width);
    svgElement.setAttribute('height', height);
    svgElement.setAttribute('viewBox', viewBox);
  }
  
  // Create a new group for the selected countries
  const newGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  
  // Find all countries
  countryIds.forEach(id => {
    const country = svgDoc.getElementById(id);
    if (country) {
      newGroup.appendChild(country.cloneNode(true));
    }
  });
  
  // Add the group to the SVG
  svgElement.appendChild(newGroup);
  
  return svgElement;
}