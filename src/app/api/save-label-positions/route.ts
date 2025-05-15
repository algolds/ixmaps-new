// src/app/api/save-label-positions/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
// Removed: import { auth } from '@/auth'; // Authentication is removed
import { db } from '@/lib/db'; // Import your Prisma client instance

// Define the expected structure of individual position objects in the request body
interface PositionData {
  id: string;
  name: string;
  layerId: string | null;
  position: {
    x: number;
    y: number;
  };
  // Include other fields if they are present in the data being saved
  tagName?: string;
  continent?: string | null;
  type?: string | null;
}

// Define the structure for the API response (used internally for typing)
type ResponseData = {
  success: boolean;
  message: string;
  error?: string;
  count?: number;
};

// Use App Router Route Handler signature for POST method
export async function POST(req: Request): Promise<NextResponse<ResponseData>> {
  // --- Authentication & Authorization Removed ---

  try {
    // Get request body
    const positions: PositionData[] = await req.json();

    // --- Data Validation ---
    if (!Array.isArray(positions)) {
      console.warn('[API Save Labels] Invalid data: Expected an array.');
      return NextResponse.json(
        { success: false, message: 'Invalid data: Expected an array.' },
        { status: 400 },
      );
    }

    const isValidData = positions.every(
      (p) =>
        p &&
        typeof p.id === 'string' &&
        p.id.length > 0 &&
        typeof p.name === 'string' &&
        (p.layerId === null || typeof p.layerId === 'string') &&
        typeof p.position === 'object' &&
        p.position !== null &&
        typeof p.position.x === 'number' &&
        !isNaN(p.position.x) &&
        typeof p.position.y === 'number' &&
        !isNaN(p.position.y),
    );

    if (!isValidData) {
      console.warn('[API Save Labels] Invalid data format received in array.');
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid data format for one or more items received.',
        },
        { status: 400 },
      );
    }

    // --- Define File Path ---
    const filePath = path.resolve(
      process.cwd(),
      'public',
      'data',
      'country_positions_ctm.json',
    );
    console.log(`[API Save Labels] Target file path: ${filePath}`);

    // --- Write to File ---
    const jsonData = JSON.stringify(positions, null, 2);
    // Removed user ID from log message
    console.log(
      `[API Save Labels] Attempting to write ${positions.length} positions...`,
    );
    await fs.promises.writeFile(filePath, jsonData, 'utf8');
    console.log(
      `[API Save Labels] Successfully completed writeFile operation for ${filePath}.`,
    );

    // --- *** ADD AUDIT LOG (Corrected) *** ---
    try {
      // NOTE: Since auth is removed and userId is optional in the schema,
      // we omit the userId field entirely here. Prisma will handle it.
      const logEntry = await db.auditLog.create({
        data: {
          action: 'Updated Label Positions',
          details: `Saved ${positions.length} positions to ${path.basename(filePath)}.`,
          // userId field is omitted entirely because it's optional in the schema
          // and we don't have a user context here.
        },
      });
      // Removed user ID from log message as it's not available
      console.log(`[API Save Labels] Audit log created (ID: ${logEntry.id}).`);
    } catch (logError) {
      console.error('[API Save Labels] Failed to create audit log:', logError);
      // Decide if this should cause the main request to fail.
      // Usually, logging failures are logged but don't block the primary action.
    }
    // --- *** END AUDIT LOG *** ---

    // --- Success Response ---
    return NextResponse.json({
      success: true,
      message: `Successfully saved ${positions.length} label positions.`,
      count: positions.length,
    });
  } catch (error: any) {
    // --- Error Handling ---
    console.error('[API Save Labels] Error processing request:', error);

    let statusCode = 500;
    let errorMessage = 'Internal Server Error saving positions.';
    if (error.code === 'ENOENT') {
      statusCode = 404; // Or 500 if the file *should* always exist
      errorMessage = 'Error: Target data file not found.';
    } else if (error.code === 'EACCES') {
      statusCode = 500; // Permissions issue is a server config problem
      errorMessage = 'Error: Server does not have permission to write the file.';
    } else if (error instanceof SyntaxError && error.message.includes('JSON')) {
      // Handle potential JSON parsing errors from req.json()
      statusCode = 400;
      errorMessage = 'Invalid JSON data received in request body.';
    }

    // Return error response using NextResponse
    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
        error: error.message || 'Unknown error',
      },
      { status: statusCode },
    );
  }
}

// Optional: Add handlers for other HTTP methods if needed
// export async function GET(req: Request) { ... }
