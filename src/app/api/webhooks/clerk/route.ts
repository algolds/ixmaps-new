// src/app/api/webhooks/clerk/route.ts
import { Webhook } from 'svix';
import { headers } from 'next/headers'; // Correct import
import { WebhookEvent, clerkClient } from '@clerk/nextjs/server'; // Correct import
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// --- Your Discord Config ---
const REQUIRED_GUILD_ID = '557016198932332565';
const REQUIRED_ADMIN_ROLE_ID = '557025114210697242';
// --- End Config ---

// --- Helper Function: Check Discord and Update Clerk ---
async function checkDiscordRolesAndUpdateClerk(userId: string) {
  console.log(`[Webhook] Processing user: ${userId}`);
  let userIsAdmin = false;
  let userIsInGuild = false;

  try {
    // 1. Get Discord Access Token from Clerk
    // FIX: Use clerkClient directly
    const oauthTokens = await clerkClient.users.getUserOauthAccessToken(userId, 'oauth_discord'); // No () after clerkClient

    if (!oauthTokens?.[0]?.token) {
      console.warn(`[Webhook] No Discord OAuth token found for user ${userId}. Cannot verify roles.`);
    } else {
      const accessToken = oauthTokens[0].token;
      console.log(`[Webhook] Found Discord token for user ${userId}.`);

      // 2. Check Guild Membership
      const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (guildsResponse.ok) {
        const guilds: { id: string }[] = await guildsResponse.json();
        userIsInGuild = guilds.some((g) => g.id === REQUIRED_GUILD_ID);
        console.log(`[Webhook] User ${userId} in required guild: ${userIsInGuild}`);

        if (userIsInGuild) {
          // 3. Check Role within Guild
          const memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${REQUIRED_GUILD_ID}/member`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (memberResponse.ok) {
            const memberDetails: { roles: string[] } = await memberResponse.json();
            userIsAdmin = memberDetails.roles.includes(REQUIRED_ADMIN_ROLE_ID);
            console.log(`[Webhook] User ${userId} has admin role: ${userIsAdmin}`);
          } else {
            console.warn(`[Webhook] Failed to fetch member details for user ${userId}: ${memberResponse.status}`);
          }
        }
      } else {
        console.warn(`[Webhook] Failed to fetch guilds for user ${userId}: ${guildsResponse.status}`);
      }
    }

    // 4. Update Clerk User Metadata
    const finalIsAdmin = userIsInGuild && userIsAdmin;

    console.log(`[Webhook] Updating Clerk metadata for user ${userId}: { isAdmin: ${finalIsAdmin} }`);
    // FIX: Use clerkClient directly
    await clerkClient.users.updateUserMetadata(userId, { // No () after clerkClient
      publicMetadata: {
        isAdmin: finalIsAdmin,
      },
    });
    console.log(`[Webhook] Clerk metadata updated for user ${userId}.`);

  } catch (error) {
    console.error(`[Webhook] Error processing user ${userId}:`, error);
    try {
      // FIX: Use clerkClient directly
      await clerkClient.users.updateUserMetadata(userId, { publicMetadata: { isAdmin: false } }); // No () after clerkClient
    } catch (updateError) {
      console.error(`[Webhook] Failed to set default metadata on error for user ${userId}:`, updateError);
    }
  }
}
// --- End Helper Function ---


// --- Webhook POST Handler ---
export async function POST(req: Request) {
  console.log('[Webhook] Received request...');
  // Get the necessary headers
  const headerPayload = headers(); // Call headers() once to get the object
  // FIX: Use .get() on the headerPayload object
  const svix_id = (await headerPayload).get("svix-id");
  const svix_timestamp = (await headerPayload).get("svix-timestamp");
  const svix_signature = (await headerPayload).get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error('[Webhook] Error: Missing svix headers');
    return new Response('Error occurred -- no svix headers', { status: 400 });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Get the webhook signing secret from environment variables
  const whSec = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

  if (!whSec) {
    console.error('[Webhook] Error: CLERK_WEBHOOK_SIGNING_SECRET not set in environment variables.');
    console.warn('[Webhook] CLERK_WEBHOOK_SIGNING_SECRET not set. Skipping verification (DEVELOPMENT ONLY).');
  } else {
     const wh = new Webhook(whSec);
     try {
       wh.verify(body, {
         "svix-id": svix_id,
         "svix-timestamp": svix_timestamp,
         "svix-signature": svix_signature,
       }) as WebhookEvent;
       console.log('[Webhook] Signature verified successfully.');
     } catch (err) {
       console.error('[Webhook] Error verifying webhook signature:', err);
       return new Response('Error occurred -- invalid signature', { status: 400 });
     }
  }

  // Cast payload to WebhookEvent type
  const evt = payload as WebhookEvent;

  // Handle the event type
  const eventType = evt.type;
  console.log(`[Webhook] Received event type: ${eventType}`);

  // Process user.created and session.created events
  if (eventType === 'user.created' || eventType === 'session.created') {
    let userId: string | undefined;
    // FIX: Access correct property based on event type
    if (eventType === 'user.created') {
        userId = evt.data.id;
    } else if (eventType === 'session.created') {
        // Ensure correct property access for session event data
        userId = evt.data.user_id;
    }

    if (userId) {
      // Run the check asynchronously
      checkDiscordRolesAndUpdateClerk(userId).catch(err => {
         console.error(`[Webhook] Background check failed for user ${userId}:`, err);
      });
    } else {
      console.warn(`[Webhook] Could not extract userId from event type ${eventType}`);
    }
  } else {
     console.log(`[Webhook] Skipping event type: ${eventType}`);
  }

  // Return a 200 response to acknowledge receipt
  console.log('[Webhook] Sending 200 OK response.');
  return new Response('', { status: 200 });
}

// Optional: Add GET handler for simple verification if needed
export async function GET() {
   return NextResponse.json({ message: "Clerk Webhook Endpoint Active" });
}
