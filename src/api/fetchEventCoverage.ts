// ----------------------------------------
// src/api/fetchEventCoverage.ts
// ----------------------------------------

import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export interface SourceItem {
  title: string;
  link: string;
  imageUrl: string | null;
  sourceName: string;
  pubDate?: string | null;
}

export interface FetchEventCoverageResponse {
  sources: SourceItem[];
}

/**
 * Builds the query text based on settings/global.serper.prompt
 * Replaces placeholders like {{title}}, {{event}}, or {{description}}
 */
async function buildSerperQuery({
  title,
  event,
  description,
}: {
  title?: string;
  event?: string;
  description?: string;
}) {
  try {
    const ref = doc(db, "settings", "global");
    const snap = await getDoc(ref);

    const rawPrompt = snap.exists()
      ? snap.data()?.serper?.prompt || "title"
      : "title";

    if (rawPrompt.trim().toLowerCase() === "title")
      return title || event || description || "";

    let query = rawPrompt;
    query = query
      .replace(/{{\s*title\s*}}/gi, title || "")
      .replace(/{{\s*event\s*}}/gi, event || "")
      .replace(/{{\s*description\s*}}/gi, description || "");

    return query.trim() || title || event || description || "";
  } catch (err) {
    console.error("⚠️ Error building Serper query:", err);
    return title || event || description || "";
  }
}

// -----------------------------------------------------
// ✅ Old 3-argument version
// -----------------------------------------------------
export async function fetchEventCoverage(
  event: string,
  description: string,
  date?: string
): Promise<FetchEventCoverageResponse> {
  const functions = getFunctions(app, "asia-south1");
  const callable = httpsCallable(functions, "fetchEventCoverage");

  try {
    const query = await buildSerperQuery({ title: event, event, description });
    console.log("🔍 Serper query:", query);

    const result = await callable({ title: query, description, date });
    return result.data as FetchEventCoverageResponse;
  } catch (error: any) {
    console.error("❌ Error calling fetchEventCoverage:", error);
    throw new Error(error.message || "Failed to fetch event coverage");
  }
}
