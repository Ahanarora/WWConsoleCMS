// functions/src/index.ts

import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({
  region: "asia-south1",
});


// Initialize Firebase Admin SDK once
initializeApp();

// Export your callable functions
export { fetchEventCoverage } from "./fetchEventCoverage";
export { fetchSonarTimeline } from "./fetchSonarTimeline";
