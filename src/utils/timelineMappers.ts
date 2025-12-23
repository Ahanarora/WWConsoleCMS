// src/utils/timelineMappers.ts

import { nanoid } from "nanoid";
import type { TimelineEventBlock, TimelineBlock, SourceItem } from "@ww/shared";
import type { TimelineEvent } from "./firestoreHelpers";

// --------------------
// 🔹 Helpers
// --------------------

export const sanitizeSources = (sources: any[] = []): SourceItem[] =>
  (sources || []).map((src: any) => ({
    title: src?.title ?? "",
    link: src?.link ?? "",
    sourceName: src?.sourceName ?? "",
    imageUrl: src?.imageUrl ?? null,
    pubDate: src?.pubDate ?? null,
    provider: src?.provider ?? "manual",
    ...(src?.score != null ? { score: src.score } : {}),
  }));

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripUndefinedDeep) as any;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key, v]) =>
            v !== undefined &&
            key !== "origin"
        )
        .map(([k, v]) => [k, stripUndefinedDeep(v)])
    ) as any;
  }

  return value;
}

export const coerceSignificance = (value?: number): 1 | 2 | 3 => {
  if (value === 2 || value === 3) return value;
  return 1;
};

export const safeDate = (value?: string): string => value ?? "";

// --------------------
// 🔹 Mappers (THE FROZEN BOUNDARY)
// --------------------

/**
 * CMS legacy event -> shared TimelineEventBlock
 * Firestore-safe by construction.
 */
export const mapLegacyEventToEventBlock = (
  eventData: Partial<TimelineEvent>
): TimelineEventBlock => {
  const block: TimelineEventBlock = {
    id: nanoid(),
    type: "event",
    title: eventData.event ?? "",
    description: eventData.description ?? "",
    date: safeDate(eventData.date),
    significance: coerceSignificance(eventData.significance),
    sources: sanitizeSources(eventData.sources || []),
    factStatus:
      eventData.factStatus === "debated" ||
      eventData.factStatus === "partially_debated" ||
      eventData.factStatus === "consensus"
        ? eventData.factStatus
        : undefined,
    factNote: eventData.factNote ?? undefined,
    factUpdatedAt: eventData.factUpdatedAt ?? undefined,
  };

  return stripUndefinedDeep(block);
};

/**
 * Update an existing shared TimelineEventBlock from legacy CMS input.
 * CMS-only fields are stripped.
 */
export const updateEventBlockFromLegacy = (
  existing: TimelineEventBlock,
  eventData: Partial<TimelineEvent>
): TimelineEventBlock => {
  const updated: TimelineEventBlock = {
    ...existing,
    title: eventData.event ?? existing.title,
    description: eventData.description ?? existing.description,
    date:
      eventData.date !== undefined
        ? safeDate(eventData.date)
        : existing.date,
    significance:
      eventData.significance !== undefined
        ? coerceSignificance(eventData.significance)
        : existing.significance,
    sources:
      eventData.sources !== undefined
        ? sanitizeSources(eventData.sources)
        : existing.sources,
    factStatus:
      eventData.factStatus !== undefined
        ? (eventData.factStatus as any)
        : existing.factStatus,
    factNote:
      eventData.factNote !== undefined ? eventData.factNote : existing.factNote,
    factUpdatedAt:
      eventData.factUpdatedAt !== undefined
        ? eventData.factUpdatedAt
        : existing.factUpdatedAt,
  };

  return stripUndefinedDeep(updated);
};

/**
 * Read-time compatibility: ensure every block has a type.
 * (NO WRITES here)
 */
export const normalizeTimeline = (timeline: any[] = []): TimelineBlock[] =>
  (timeline || []).map((block: any) => {
    if (block?.type === "event" || block?.type === "image") return block;
    return { ...block, type: "event" } as TimelineEventBlock;
  });
