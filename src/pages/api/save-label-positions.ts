// src/api/save-label-positions.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs'; // Node.js file system module
import path from 'path'; // Node.js path module

// Define the expected structure of individual position objects in the request body
interface PositionData {
  id: string;
  name: string;
  position: {
    x: number;
    y: number;
  };
}

// Define the structure for the API response
type ResponseData = {
  success: boolean;
  message: string;
  error?: string; // Optional error details
  count?: number; // Optional count of saved items
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
) {
  // --- 1. Authorization Check (CRITICAL!) ---
  // WARNING: This is a placeholder ONLY for development.
  // Replace this with a robust authentication and authorization mechanism
  // before deploying to any non-local environment. Check user sessions,
  // API keys, JWT tokens, or other appropriate methods.
  const isAuthorized = process.env.NODE_ENV === 'development'; // Example: Allow only in dev
  // const isAuthorized = checkUserSession(req); // Example: Replace with real check

  if (!isAuthorized) {
    console.warn('[API Save Labels] Unauthorized attempt.');
    return res
      .status(403)
      .json({ success: false, message: 'Forbidden: Not authorized.' });
  }
  // --- End Authorization Check ---

  // --- 2. Method Check ---
  if (req.method !== 'POST') {
    console.log(`[API Save Labels] Method Not Allowed: ${req.method}`);
    res.setHeader('Allow', ['POST']); // Inform client which methods are allowed
    return res
      .status(405)
      .json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  try {
    const positions: PositionData[] = req.body;

    // --- 3. Data Validation ---
    if (!Array.isArray(positions)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid data: Expected an array.' });
    }

    // More detailed validation of each item in the array
    const isValidData = positions.every(
      (p) =>
        p &&
        typeof p.id === 'string' &&
        p.id.length > 0 && // Ensure ID is not empty
        typeof p.name === 'string' && // Allow empty name? Decide based on requirements
        typeof p.position === 'object' &&
        p.position !== null &&
        typeof p.position.x === 'number' &&
        !isNaN(p.position.x) && // Check for NaN
        typeof p.position.y === 'number' &&
        !isNaN(p.position.y), // Check for NaN
    );

    if (!isValidData) {
      console.warn('[API Save Labels] Invalid data format received in array.');
      return res.status(400).json({
        success: false,
        message: 'Invalid data format for one or more items received.',
      });
    }

    // --- 4. Define File Path ---
    // Construct the absolute path to the JSON file within the 'public' directory
    const filePath = path.resolve(
      process.cwd(), // Gets the root directory of the Next.js project
      'public',
      'data',
      'political_layer_shapes_ctm.json',
    );
    console.log(`[API Save Labels] Target file path: ${filePath}`);

    // --- 5. Write to File ---
    // Use JSON.stringify with indentation (null, 2) for better readability
    const jsonData = JSON.stringify(positions, null, 2);

    // Asynchronously write the file, overwriting existing content
    await fs.promises.writeFile(filePath, jsonData, 'utf8');

    console.log(
      `[API Save Labels] Successfully wrote ${positions.length} positions to ${filePath}.`,
    );
    // --- 6. Success Response ---
    return res.status(200).json({
      success: true,
      message: `Successfully saved ${positions.length} label positions.`,
      count: positions.length,
    });
  } catch (error: any) {
    // --- 7. Error Handling ---
    console.error('[API Save Labels] Error processing request:', error);

    // Check for specific file system errors (optional)
    let statusCode = 500;
    let errorMessage = 'Internal Server Error saving positions.';
    if (error.code === 'ENOENT') {
      statusCode = 404; // Or 500 if the file *should* always exist
      errorMessage = 'Error: Target data file not found.';
    } else if (error.code === 'EACCES') {
      statusCode = 500; // Permissions issue is a server config problem
      errorMessage = 'Error: Server does not have permission to write the file.';
    }

    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: error.message || 'Unknown error', // Provide specific error message if available
    });
  }
}
