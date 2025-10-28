import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase";  // your initialized Firebase app

export interface SourceItem {
  title: string;
  link: string;
  imageUrl: string | null;
  sourceName: string;
  pubDate?: string;
}

export interface FetchEventCoverageResponse {
  sources: SourceItem[];
}

export async function fetchEventCoverage(
  event: string,
  description: string,
  date?: string
): Promise<FetchEventCoverageResponse> {
  const functions = getFunctions(app, "asia-south1"); // region of your deployment
  const callable = httpsCallable(functions, "fetchEventCoverage");
  const result = await callable({ event, description, date });
  return result.data as FetchEventCoverageResponse;
}
