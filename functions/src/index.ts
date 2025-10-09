/**
 * Firebase Cloud Functions entry point.
 */
import { initializeApp } from "firebase-admin/app";

// Initialize Firebase Admin SDK once
initializeApp();

// Export your callable functions
export { fetchEventCoverage } from "./fetchEventCoverage";
