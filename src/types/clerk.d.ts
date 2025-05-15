// src/types/clerk.d.ts

// Define the structure of the object containing your custom claims
interface CustomJwtSessionClaims {
  metadata: {
    isAdmin?: boolean; // The flag for admin status within the metadata object
  };
  // Add other custom claims directly here if needed, e.g.:
  // customRole?: string;
}

// Define the structure for publicMetadata if accessed directly via user object
interface CustomPublicMetadata {
  isAdmin?: boolean; // The flag for admin status
}

// --- Augment Clerk Interfaces ---

// Augmentations for server-side usage (`@clerk/nextjs/server`)
declare module '@clerk/nextjs/server' {
  interface SessionClaims extends CustomJwtSessionClaims {} // Apply custom claims structure to server-side SessionClaims

  // Augment PublicUserData if you access metadata via auth().user.publicMetadata
  interface PublicUserData extends CustomPublicMetadata {}
}

// Augmentations for client-side usage (`@clerk/nextjs`)
declare module '@clerk/nextjs' {
  interface ActJWTClaim extends CustomJwtSessionClaims {} // Apply custom claims structure to client-side ActJWTClaim (used by useAuth().sessionClaims)

  // Augment UserPublicMetadata if you access metadata via useUser().user.publicMetadata
  interface UserPublicMetadata extends CustomPublicMetadata {}
}

// Ensure this file is treated as a module.
export {};
