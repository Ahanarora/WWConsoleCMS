import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase";

const functions = getFunctions(app, "asia-south1");

interface FetchEventCoverageRequest {
  event: string;
  description: string;
  date?: string;
  debug?: boolean;
  keywords?: string[]; // ✅ added field
}


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
  ranked: number;
  trace?: any;
}

export async function fetchEventCoverage(
  data: FetchEventCoverageRequest
): Promise<FetchEventCoverageResponse> {
  try {
    
    const callable = httpsCallable(functions, "fetchEventCoverage");

    // Destructure from `data`
    const { event, description, date, debug } = data;

    // Call the Cloud Function
    const result = await callable({ event, description, date, debug });

    // Return its data
    return result.data as FetchEventCoverageResponse;
  } catch (error: any) {
    console.error("Error calling fetchEventCoverage:", error);
    throw new Error(error.message || "Failed to fetch event coverage");
  }
}
