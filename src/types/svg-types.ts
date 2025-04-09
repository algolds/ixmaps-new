/**
 * SVG Layer related types
 */

/**
 * SVG Layer information
 */
export interface SVGLayer {
    id: string;
    name: string;
    svgElement: SVGElement;
    originalElement: Element;
    parentId?: string;
    visible?: boolean;
  }
  
  /**
   * SVG Layer visibility state
   */
  export interface SVGLayerState {
    id: string;
    name: string;
    visible: boolean;
    parentId?: string;
    children?: SVGLayerState[];
  }
  
  /**
   * SVG Layer control options
   */
  export interface SVGLayerControlOptions {
    position?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
    collapsed?: boolean;
    autoZIndex?: boolean;
  }