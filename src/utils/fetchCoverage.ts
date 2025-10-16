import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase";

const functions = getFunctions(app);

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

export async function fetchEventCoverage(
  event: string,
  description: string,
  date?: string
): Promise<FetchEventCoverageResponse> {
  try {
    const callable = httpsCallable(functions, "fetchEventCoverage");
    const result = await callable({ event, description, date });
    return result.data as FetchEventCoverageResponse;
  } catch (error: any) {
    console.error("Error calling fetchEventCoverage:", error);
    throw new Error(error.message || "Failed to fetch event coverage");
  }
}
