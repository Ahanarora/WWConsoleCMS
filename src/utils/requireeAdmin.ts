import { HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as functions from "firebase-functions";

// Reads from firebase functions config: admin.uid
const ADMIN_UID = functions.config()?.admin?.uid;

export function requireAdmin(request: any) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  if (!ADMIN_UID) {
    logger.error("ADMIN_UID missing from functions config (admin.uid).");
    throw new HttpsError("failed-precondition", "Server not configured.");
  }
  if (request.auth.uid !== ADMIN_UID) {
    throw new HttpsError("permission-denied", "Admin only.");
  }
}
