import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase";

// If you deployed without specifying a region, the default is "us-central1".
// If you explicitly deployed to asia-south1, change the second arg here to "asia-south1".
const functions = getFunctions(app, "us-central1");

interface FetchEventCoverageResponse {
  imageUrl: string | null;
  sourceLink: string | null;
}

export async function fetchEventCoverage(
  event: string,
  description: string,
  date?: string
): Promise<FetchEventCoverageResponse> {
  try {
    const callable = httpsCallable<
      { event: string; description?: string; date?: string },
      FetchEventCoverageResponse
    >(functions, "fetchEventCoverage");

    const result = await callable({ event, description, date });
    // Helpful debug:
    console.log("[fetchEventCoverage] result:", result.data);
    return result.data;
  } catch (error: any) {
    console.error("Error calling fetchEventCoverage:", error);
    throw new Error(error?.message || "Failed to fetch event coverage");
  }
}
