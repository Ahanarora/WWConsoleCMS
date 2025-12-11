// ----------------------------------------
// src/api/fetchSonarTimeline.ts
// ----------------------------------------

import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import type { Draft, TimelineEvent } from "../utils/firestoreHelpers";

interface FetchSonarTimelineResponse {
  events: Array<{
    date: string | null;
    title: string;
    description: string;
    importance?: number;
    sources: Array<{
      title: string;
      url: string;
      sourceName?: string;
      publishedAt?: string | null;
      imageUrl?: string | null;
    }>;
  }>;
}

/**
 * Calls Cloud Function fetchSonarTimeline and maps it
 * into your existing TimelineEvent structure.
 */
export async function fetchSonarTimelineForDraft(
  draft: Draft
): Promise<TimelineEvent[]> {
  const callable = httpsCallable<any, FetchSonarTimelineResponse>(
    functions,
    "fetchSonarTimeline"
  );

  const result = await callable({
    title: draft.title,
    overview: draft.overview,
  });

  const data = result.data;
  if (!data || !Array.isArray(data.events)) return [];

  const mapped: TimelineEvent[] = data.events.map((ev, index) => ({
    id: `sonar-${index}`,
    date: ev.date ?? "",
    event: ev.title ?? "",
    description: ev.description ?? "",
    significance: ev.importance ?? 2,

    imageUrl: ev.sources?.[0]?.imageUrl ?? "",
    sourceLink: ev.sources?.[0]?.url ?? "",

    sources:
      ev.sources?.map((s) => ({
        title: s.title ?? "",
        link: s.url ?? "",
        sourceName: s.sourceName ?? "",
        imageUrl: s.imageUrl ?? "",
        pubDate: s.publishedAt ?? "",   // <-- FIXED: always a string
      })) ?? [],

    contexts: [],
    faqs: [],
  }));

  return mapped;
}
