// src/app/api/save-label-positions/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { auth } from '@/auth'; // Import the auth utility from NextAuth.js setup
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
  // --- 1. Authentication & Authorization Check ---
  const session = await auth(); // Get the server-side session

  // Check if user is logged in
  if (!session?.user?.id) {
    console.warn('[API Save Labels] Unauthorized attempt: No session found.');
    return NextResponse.json(
      { success: false, message: 'Unauthorized: Not signed in.' },
      { status: 401 },
    );
  }

  // Check if the logged-in user has the admin flag (set during sign-in callback)
  if (!session.user.isAdmin) {
    console.warn(
      `[API Save Labels] Forbidden attempt: User ${session.user.id} is not admin.`,
    );
    return NextResponse.json(
      { success: false, message: 'Forbidden: Admin role required.' },
      { status: 403 },
    );
  }
  // --- End Authorization Check ---

  // --- 2. Method Check (Implicitly handled by POST function name) ---

  try {
    // Get request body
    const positions: PositionData[] = await req.json();

    // --- 3. Data Validation ---
    if (!Array.isArray(positions)) {
      console.warn('[API Save Labels] Invalid data: Expected an array.');
      return NextResponse.json(
        { success: false, message: 'Invalid data: Expected an array.' },
        { status: 400 },
      );
    }

    // More detailed validation (ensure this matches the actual data structure)
    const isValidData = positions.every(
      (p) =>
        p &&
        typeof p.id === 'string' &&
        p.id.length > 0 &&
        typeof p.name === 'string' &&
        (p.layerId === null || typeof p.layerId === 'string') && // Check layerId
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

    // --- 4. Define File Path ---
    // Ensure this filename matches what AdminLabelEditor READS from
    const filePath = path.resolve(
      process.cwd(),
      'public',
      'data',
      'country_positions_ctm.json', // Make sure this is the correct file
    );
    console.log(`[API Save Labels] Target file path: ${filePath}`);

    // --- 5. Write to File ---
    const jsonData = JSON.stringify(positions, null, 2);
    console.log(
      `[API Save Labels] Attempting to write ${positions.length} positions by User ID: ${session.user.id}...`,
    );
    await fs.promises.writeFile(filePath, jsonData, 'utf8');
    console.log(
      `[API Save Labels] Successfully completed writeFile operation for ${filePath}.`,
    );

    // --- 6. *** ADD AUDIT LOG *** ---
    try {
      const logEntry = await db.auditLog.create({
        data: {
          action: 'Updated Label Positions',
          details: `Saved ${positions.length} positions to ${path.basename(filePath)}.`, // Include filename for clarity
          userId: session.user.id, // Link to the user who performed the action
          // user: { connect: { id: session.user.id } } // Alternative way to link
        },
      });
      console.log(
        `[API Save Labels] Audit log created (ID: ${logEntry.id}) for user ${session.user.id}.`,
      );
    } catch (logError) {
      console.error('[API Save Labels] Failed to create audit log:', logError);
      // Decide if this should cause the main request to fail.
      // Usually, logging failures are logged but don't block the primary action.
      // You could potentially return a success response but include a warning.
    }
    // --- *** END AUDIT LOG *** ---

    // --- 7. Success Response ---
    return NextResponse.json({
      success: true,
      message: `Successfully saved ${positions.length} label positions.`,
      count: positions.length,
    });
  } catch (error: any) {
    // --- 8. Error Handling ---
    console.error('[API Save Labels] Error processing request:', error);

    // Check for specific file system errors
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
