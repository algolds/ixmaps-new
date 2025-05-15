// src/components/AdminLabelEditor.tsx
'use client';

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { MapConfig } from '@/types'; // Use your specific LatLng type if needed
import { latLngToSvg, svgToLatLng } from '@/lib/coordinates-system'; // Import both conversion functions
import L from 'leaflet'; // Import Leaflet type
import getConfig from 'next/config';

// Get basePath from publicRuntimeConfig
const { publicRuntimeConfig } = getConfig() || {};
const basePath = publicRuntimeConfig?.basePath || '';
console.log('[AdminEditor] Component Scope: basePath from getConfig:', basePath);

// Interface for the position data - includes optional layerId
interface CountryPositionData {
  id: string;
  name: string;
  layerId: string | null; // Layer ID from the SVG structure (can be null)
  position: {
    x: number; // SVG X coordinate
    y: number; // SVG Y coordinate
  };
  // Add other potential fields from your JSON if needed for type safety
  tagName?: string;
  continent?: string | null;
  type?: string | null;
}

// Props for the component
interface AdminLabelEditorProps {
  map: L.Map | null; // Leaflet Map instance
  L: typeof L | null; // Leaflet library instance
  mapConfig: MapConfig; // Map configuration for coordinate conversion
  isVisible: boolean; // Controls whether the editor is active and visible
  onSaveSuccess: () => void; // Callback function prop for successful save
}

// --- TARGET LAYER ID ---
// Set this to the ID of the layer group you want to edit (e.g., 'political')
const TARGET_LAYER_ID = 'political';
// --- FILENAME TO LOAD/SAVE ---
// Ensure this matches the file your API writes to!
const DATA_FILE_PATH = `/maps/data/country_positions_ctm.json`;

const AdminLabelEditor: React.FC<AdminLabelEditorProps> = ({
  map,
  L,
  mapConfig,
  isVisible,
  onSaveSuccess, // Destructure the new prop
}) => {
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  // State to hold ALL positions fetched from the file
  const [allPositions, setAllPositions] = useState<CountryPositionData[]>([]);
  // State to hold only the positions belonging to the TARGET_LAYER_ID for editing display
  const [editablePositions, setEditablePositions] = useState<
    CountryPositionData[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saving' | 'success' | 'error'
  >('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // --- Fetch Initial Data ---
  const fetchData = useCallback(async () => {
    // Fetch logic is now independent of isVisible, called explicitly
    console.log(`[AdminEditor] Fetching positions from ${DATA_FILE_PATH}...`);
    setIsLoading(true);
    setError(null);
    // Reset status only when initiating a fresh fetch, not necessarily on every call
    // setSaveStatus('idle');
    // setStatusMessage('');
    setAllPositions([]); // Clear previous full data
    setEditablePositions([]); // Clear previous editable data
    try {
      // Ensure cache is bypassed, especially during development
      const response = await fetch(DATA_FILE_PATH, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: CountryPositionData[] = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Fetched data is not an array.');
      }

      // Validate ALL fetched data
      const validData = data.filter(
        (item) =>
          item &&
          typeof item.id === 'string' && // Ensure ID is a non-empty string
          item.id.length > 0 &&
          typeof item.name === 'string' && // Name is a string (can be empty)
          // layerId is allowed to be null or string
          (item.layerId === null || typeof item.layerId === 'string') &&
          typeof item.position?.x === 'number' &&
          !isNaN(item.position.x) && // Explicit NaN check
          typeof item.position?.y === 'number' &&
          !isNaN(item.position.y), // Explicit NaN check
      );
      setAllPositions(validData); // Store all valid fetched positions
      console.log(
        `[AdminEditor] Loaded ${validData.length} total valid positions.`,
      );

      // --- FILTER DATA for the target layer ---
      const filteredData = validData.filter(
        (item) => item.layerId === TARGET_LAYER_ID,
      );
      setEditablePositions(filteredData); // Set only target layer items for editing display
      console.log(
        `[AdminEditor] Filtered ${filteredData.length} positions for layer '${TARGET_LAYER_ID}'.`,
      );
    } catch (e: any) {
      console.error('[AdminEditor] Fetch error:', e);
      setError(e.message || 'Failed to load positions');
      setAllPositions([]); // Clear data on error
      setEditablePositions([]); // Clear editable data on error
    } finally {
      setIsLoading(false);
    }
  }, []); // No dependencies, fetchData function reference is stable

  // Effect to fetch data only when the component becomes visible
  useEffect(() => {
    if (isVisible) {
      console.log('[AdminEditor] Visibility changed to true, fetching data...');
      // Reset status when becoming visible after being hidden
      setSaveStatus('idle');
      setStatusMessage('');
      fetchData();
    }
    // Intentionally not including fetchData in deps here,
    // we call it manually when visibility changes to true.
  }, [isVisible, fetchData]); // Include fetchData in dependencies

  // --- Memoize Draggable Icon Style ---
  const draggableIcon = useMemo(() => {
    if (!L) return null;
    // Use L! here as the check above ensures it's not null
    return L!.divIcon({
      className: 'admin-draggable-label', // CSS class for styling
      html: `<span>Edit Me</span>`, // Placeholder, replaced per marker
      iconSize: undefined, // Let CSS control size
      iconAnchor: [15, 5], // Adjust anchor point for better drag feel (centers roughly under cursor)
    });
  }, [L]);

  // --- Update Marker Position in State ---
  const handleMarkerDragEnd = useCallback(
    (event: L.DragEndEvent) => {
      if (!mapConfig) {
        console.warn(
          '[AdminEditor] mapConfig not available for coordinate conversion.',
        );
        return;
      }

      const marker = event.target as L.Marker;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore Accessing custom property added after creation
      const countryId = marker.options.countryId;
      const finalLatLng = marker.getLatLng();

      if (!countryId) {
        console.warn(
          '[AdminEditor] DragEnd event missing countryId in marker options.',
        );
        return;
      }

      try {
        // Convert Leaflet LatLng back to SVG coordinates
        const newSvgPos = latLngToSvg(
          finalLatLng.lat,
          finalLatLng.lng,
          mapConfig,
        );

        // --- IMPORTANT: Update BOTH state arrays immutably ---
        setEditablePositions((currentPositions) =>
          currentPositions.map((country) =>
            country.id === countryId
              ? { ...country, position: { x: newSvgPos.x, y: newSvgPos.y } }
              : country,
          ),
        );
        setAllPositions((currentAllPositions) =>
          currentAllPositions.map((country) =>
            country.id === countryId
              ? { ...country, position: { x: newSvgPos.x, y: newSvgPos.y } }
              : country,
          ),
        );
        // --- End state update ---

        // Update status for user feedback
        setSaveStatus('idle'); // Reset save status as changes are pending
        setStatusMessage('Position updated locally. Click Save to persist.');
        console.log(
          `[AdminEditor] Updated ${countryId} to SVG: ${newSvgPos.x.toFixed(2)}, ${newSvgPos.y.toFixed(2)}`,
        );
      } catch (e) {
        console.error(
          `[AdminEditor] Error converting LatLng to SVG for ${countryId}:`,
          e,
        );
        setStatusMessage(`Error updating ${countryId}. See console.`);
        // Optionally revert marker position visually or show a more prominent error
      }
    },
    [mapConfig], // mapConfig is a dependency for latLngToSvg
    // setEditablePositions and setAllPositions are stable setters, no need to list
  );

  // --- Effect to Manage Leaflet Markers ---
  useEffect(() => {
    // Ensure prerequisites are met before creating/updating markers
    if (!isVisible || !map || !L || isLoading || error || !draggableIcon) {
      // Cleanup if becoming invisible or prerequisites lost
      if (layerGroupRef.current) {
        console.log(
          '[AdminEditor] Cleaning up editor markers (visibility/prereqs).',
        );
        // Remove event listeners before removing the layer group
        layerGroupRef.current.eachLayer((layer) => {
          // Use L! here as well inside the cleanup check if needed
          if (layer instanceof L!.Marker) {
            layer.off('dragend', handleMarkerDragEnd); // Detach listener safely
          }
        });
        layerGroupRef.current.remove();
        layerGroupRef.current = null;
      }
      return; // Exit if not ready
    }

    // --- Clear previous layer group ---
    // (Handles cases where editablePositions changes while visible)
    if (layerGroupRef.current) {
      console.log('[AdminEditor] Clearing existing markers before redraw.');
      layerGroupRef.current.eachLayer((layer) => {
        // Use L! here too
        if (layer instanceof L!.Marker) {
          layer.off('dragend', handleMarkerDragEnd);
        }
      });
      layerGroupRef.current.remove();
      layerGroupRef.current = null; // Ensure we create a new one
    }

    // --- Create and add new layer group for editable markers ---
    console.log(
      `[AdminEditor] Creating ${editablePositions.length} draggable markers for layer '${TARGET_LAYER_ID}'...`,
    );
    // Apply L! here
    layerGroupRef.current = L!.layerGroup();
    const markers: L.Marker[] = []; // Array to hold created markers

    editablePositions.forEach((country) => {
      try {
        // Convert initial SVG position to Leaflet LatLng
        const initialLatLng = svgToLatLng(
          country.position.x,
          country.position.y,
          mapConfig,
        );

        // Apply L! here
        const markerLatLng = L!.latLng(initialLatLng.lat, initialLatLng.lng);

        // Clone the base draggable icon and set the specific HTML content
        // Apply L! here
        const icon = L!.divIcon({
          ...draggableIcon.options, // Inherit base style/anchor
          html: `<span title="ID: ${country.id}">${country.name}</span>`, // Show name, ID on hover
        });

        // Apply L! here
        const marker = L!.marker(markerLatLng, {
          icon: icon,
          draggable: true,
          zIndexOffset: 1000, // Ensure markers are above other map elements
        });

        // --- Add custom property AFTER marker creation ---
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore Leaflet allows adding custom options; bypass TypeScript check
        marker.options.countryId = country.id;
        // --- End custom property addition ---

        marker.on('dragend', handleMarkerDragEnd);
        markers.push(marker);
      } catch (e) {
        console.error(
          `[AdminEditor] Error creating marker for ${country.name} (ID: ${country.id}):`,
          e,
        );
        // Optionally add placeholder or skip marker
      }
    });

    // Add all created markers to the layer group
    markers.forEach((marker) => layerGroupRef.current?.addLayer(marker));
    // Add the layer group to the map
    layerGroupRef.current?.addTo(map); // Add null check for safety
    console.log(
      `[AdminEditor] Added ${markers.length} markers to map for layer '${TARGET_LAYER_ID}'.`,
    );

    // --- Cleanup function for this effect ---
    return () => {
      console.log('[AdminEditor] Cleaning up editor markers (effect cleanup).');
      if (layerGroupRef.current) {
        layerGroupRef.current.eachLayer((layer) => {
          // Apply L! here
          if (layer instanceof L!.Marker) {
            layer.off('dragend', handleMarkerDragEnd); // Detach listener
          }
        });
        layerGroupRef.current.remove(); // Remove layer group from map
        layerGroupRef.current = null; // Clear the ref
      }
    };
  }, [
    // Dependencies for the marker effect
    isVisible,
    map,
    L,
    isLoading,
    error,
    editablePositions, // Re-run if the filtered list changes
    mapConfig,
    handleMarkerDragEnd, // Re-run if the handler changes
    draggableIcon, // Re-run if the icon changes
  ]);

  // --- Save Handler ---
  const handleSave = async () => {
    // --- IMPORTANT: Save the *entire* `allPositions` array ---
    if (allPositions.length === 0) {
      setStatusMessage('No positions loaded to save.');
      return;
    }
    console.log(
      `[AdminEditor] Attempting to save all ${allPositions.length} positions...`,
    );
    // Log a sample of the data being sent
    console.log(
      '[AdminEditor] Data sample being sent:',
      JSON.stringify(allPositions.slice(0, 5), null, 2),
    );
    setSaveStatus('saving');
    setStatusMessage('Saving...');
    setError(null);

    try {
      // *** API endpoint for saving ***
      const response = await fetch('/api/save-label-positions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add authentication headers if needed
        },
        body: JSON.stringify(allPositions), // Send the complete, updated data
      });

      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg += ` - ${errorData.message || 'Unknown server error'}`;
        } catch (e) {
          errorMsg += ` - ${response.statusText}`;
        }
        throw new Error(errorMsg); // Throw error to be caught below
      }

      const result = await response.json();
      setSaveStatus('success');
      setStatusMessage(
        result.message ||
          `Saved ${result.count ?? allPositions.length} positions successfully!`,
      );
      console.log('[AdminEditor] Save successful:', result);

      // --- Notify parent component on success ---
      if (onSaveSuccess) {
        onSaveSuccess(); // Trigger parent to hide editor, refresh data, etc.
      }
      // --- End notification ---

    } catch (e: any) {
      console.error('[AdminEditor] Save error:', e);
      setError(e.message || 'Failed to save positions');
      setSaveStatus('error');
      setStatusMessage(`Error: ${e.message || 'Failed to save'}`);
    }
    // Note: We don't call fetchData here anymore, the parent component
    // should handle data refreshing if needed after onSaveSuccess is called.
  };

  // --- Render Save Button and Status UI ---
  if (!isVisible) {
    return null; // Don't render the editor UI if not visible
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '10px', // Position from top
        right: '10px', // Position from right
        zIndex: 1001, // Ensure it's above map controls like zoom
        backgroundColor: 'rgba(255, 255, 255, 0.9)', // Semi-transparent white background
        padding: '8px 12px', // Padding inside the box
        border: '1px solid #ccc', // Light grey border
        borderRadius: '5px', // Rounded corners
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)', // Subtle shadow
        display: 'flex', // Use flexbox for layout
        flexDirection: 'column', // Stack items vertically
        gap: '8px', // Space between elements
        fontSize: '12px', // Base font size
        fontFamily: 'Arial, sans-serif', // Consistent font
        minWidth: '150px', // Give it a minimum width
      }}
    >
      <h4 style={{ margin: '0 0 5px 0', textAlign: 'center' }}>Label Editor</h4>
      {/* Display loading indicator */}
      {isLoading && <div>Loading positions...</div>}
      {/* Display error message if fetch failed */}
      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
      {/* Display save controls only if not loading and no error */}
      {!isLoading && !error && (
        <>
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'} // Disable button while saving
            style={{
              padding: '5px 10px',
              cursor: saveStatus === 'saving' ? 'wait' : 'pointer',
              backgroundColor: saveStatus === 'saving' ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              opacity: saveStatus === 'saving' ? 0.7 : 1,
            }}
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save Positions'}
          </button>
          {/* Display status messages */}
          {statusMessage && (
            <div
              style={{
                marginTop: '5px',
                textAlign: 'center',
                color:
                  saveStatus === 'error'
                    ? 'red'
                    : saveStatus === 'success'
                      ? 'green'
                      : 'black', // Default color for idle/info messages
                fontWeight:
                  saveStatus === 'error' || saveStatus === 'success'
                    ? 'bold'
                    : 'normal',
              }}
            >
              {statusMessage}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminLabelEditor;