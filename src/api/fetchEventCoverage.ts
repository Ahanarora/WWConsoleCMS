// ----------------------------------------
// src/api/fetchEventCoverage.ts
// ----------------------------------------

import { functions, db } from "../firebase";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import type { SourceItem } from "@ww/shared";


// Raw shape coming back from the Cloud Function / Serper layer
export interface SerperSourceRaw {
  title: string;
  link: string;
  sourceName: string;
  imageUrl?: string | null;
  pubDate?: string | null;
  provider?: string; // sometimes returned by backend; optional here
}

// Canonical app-level response type should use shared types
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

function toSharedSourceItem(raw: SerperSourceRaw): SourceItem {
  // Normalize optional/undefined → null where applicable
  return {
    title: raw.title,
    link: raw.link,
    sourceName: raw.sourceName,
    imageUrl: raw.imageUrl ?? null,
    pubDate: raw.pubDate ?? null,
    provider: (raw.provider as any) ?? "serper",
  } as SourceItem;
}

// -----------------------------------------------------
// ✅ Old 3-argument version
// -----------------------------------------------------
export async function fetchEventCoverage(
  event: string,
  description: string,
  date?: string
): Promise<FetchEventCoverageResponse> {

  const callable = httpsCallable(functions, "fetchEventCoverage");

  try {
    const query = await buildSerperQuery({ title: event, event, description });
    console.log("🔍 Serper query:", query);

    // Backend might return either {sources: SerperSourceRaw[]} or already-shared-like sources.
    const result = await callable({ title: query, description, date });
    const data = result.data as any;

    const rawSources: SerperSourceRaw[] = Array.isArray(data?.sources)
      ? data.sources
      : [];

    const sources: SourceItem[] = rawSources.map(toSharedSourceItem);

    return { sources };
  } catch (error: any) {
    console.error("❌ Error calling fetchEventCoverage:", error);
    throw new Error(error.message || "Failed to fetch event coverage");
  }
}
