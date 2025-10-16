import * as admin from "firebase-admin";

try {
  // Initialize only if no app exists
  if (!admin.apps.length) {
    admin.initializeApp();
  }
} catch (err) {
  console.warn("Firebase admin already initialized");
}

export { admin };
