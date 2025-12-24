import { HttpsError } from "firebase-functions/v2/https";

const ADMIN_UID = process.env.ADMIN_UID;

export function requireAdmin(request: any) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  if (!ADMIN_UID) {
    throw new HttpsError("failed-precondition", "ADMIN_UID not configured.");
  }

  if (request.auth.uid !== ADMIN_UID) {
    throw new HttpsError("permission-denied", "Admin only.");
  }
}
