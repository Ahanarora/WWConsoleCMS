// ----------------------------------------
// src/utils/fetchCoverage.ts
// ----------------------------------------

import { functions } from "../firebase";
import { httpsCallable } from "firebase/functions";
import type { SourceItem } from "@ww/shared";


interface FetchEventCoverageRequest {
  event: string;
  description: string;
  date?: string;
  debug?: boolean;
  keywords?: string[]; // ✅ added field
}

// Raw backend shape (do NOT name this SourceItem)
interface CoverageSourceRaw {
  title: string;
  link: string;
  sourceName: string;
  imageUrl?: string | null;
  pubDate?: string | null;
  score?: number;
  provider?: string;
}

interface FetchEventCoverageResponse {
  sources: SourceItem[];
  ranked: number;
  trace?: any;
}

function toSharedSourceItem(raw: CoverageSourceRaw): SourceItem {
  return {
    title: raw.title,
    link: raw.link,
    sourceName: raw.sourceName,
    imageUrl: raw.imageUrl ?? null,
    pubDate: raw.pubDate ?? null,
    provider: (raw.provider as any) ?? "serper",
    // if your shared type includes score, this will be accepted; otherwise it’s harmlessly ignored at runtime
    ...(raw.score != null ? { score: raw.score } : {}),
  } as SourceItem;
}

export async function fetchEventCoverage(
  data: FetchEventCoverageRequest
): Promise<FetchEventCoverageResponse> {
  try {
    const callable = httpsCallable(functions, "fetchEventCoverage");

    const { event, description, date, debug, keywords } = data;

    const result = await callable({ event, description, date, debug, keywords });
    const payload = result.data as any;

    const rawSources: CoverageSourceRaw[] = Array.isArray(payload?.sources)
      ? payload.sources
      : [];

    const sources: SourceItem[] = rawSources.map(toSharedSourceItem);

    return {
      sources,
      ranked: typeof payload?.ranked === "number" ? payload.ranked : sources.length,
      trace: payload?.trace,
    };
  } catch (error: any) {
    console.error("Error calling fetchEventCoverage:", error);
    throw new Error(error.message || "Failed to fetch event coverage");
  }
}
