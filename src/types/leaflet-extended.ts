import * as L from 'leaflet';

/**
 * Extended Leaflet Types
 * 
 * This file contains extended type definitions for Leaflet to avoid using 'any' types.
 */

// Leaflet instance type
export type LeafletInstance = typeof L;

// Map instance type
export type LeafletMapInstance = L.Map;

// Layer types
export type LeafletLayer = L.Layer;
export type LeafletLayerGroup = L.LayerGroup;
export type LeafletImageOverlay = L.ImageOverlay;

// Control types
export type LeafletControl = L.Control;
export type LeafletControlOptions = L.ControlOptions;

// Event types
export type LeafletMouseEvent = L.LeafletMouseEvent;
export type LeafletEvent = L.LeafletEvent;

// Marker types
export type LeafletMarker = L.Marker;
export type LeafletCircleMarker = L.CircleMarker;
export type LeafletDivIcon = L.DivIcon;

// Dom utilities
export interface LeafletDomUtil {
  create: (tagName: string, className?: string, container?: HTMLElement) => HTMLElement;
  addClass: (el: HTMLElement, name: string) => void;
  removeClass: (el: HTMLElement, name: string) => void;
}

// Extended control interface
export interface ExtendedControlOptions extends L.ControlOptions {
  position?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  collapsed?: boolean;
}

// DOM Event utilities
export interface LeafletDomEvent {
  on: (el: HTMLElement, types: string, fn: any, context?: any) => void;
  off: (el: HTMLElement, types: string, fn: any, context?: any) => void;
  stopPropagation: (ev: Event) => void;
  preventDefault: (ev: Event) => void;
  disableScrollPropagation: (el: HTMLElement) => void;
  disableClickPropagation: (el: HTMLElement) => void;
}