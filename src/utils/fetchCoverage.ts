import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase";

const functions = getFunctions(app, "asia-south1");

interface SourceItem {
  title: string;
  link: string;
  imageUrl: string | null;
  sourceName: string;
  pubDate?: string;
  score?: number;
}

interface FetchEventCoverageResponse {
  sources: SourceItem[];
}

interface FetchEventCoverageRequest {
  event: string;
  description?: string;
  date?: string;
  keywords?: string[];
}

/**
 * Calls the Cloud Function "fetchEventCoverage"
 * with full support for manual keyword overrides.
 */
export async function fetchEventCoverage(
  data: FetchEventCoverageRequest
): Promise<FetchEventCoverageResponse> {
  try {
    const callable = httpsCallable(functions, "fetchEventCoverage");
    const result = await callable(data);
    return result.data as FetchEventCoverageResponse;
  } catch (error: any) {
    console.error("Error calling fetchEventCoverage:", error);
    throw new Error(error.message || "Failed to fetch event coverage");
  }
}
