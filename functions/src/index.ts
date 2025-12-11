// functions/src/index.ts

import { initializeApp } from "firebase-admin/app";

// Initialize Firebase Admin SDK once
initializeApp();

// Export your callable functions
export { fetchEventCoverage } from "./fetchEventCoverage";
export { fetchSonarTimeline } from "./fetchSonarTimeline";
