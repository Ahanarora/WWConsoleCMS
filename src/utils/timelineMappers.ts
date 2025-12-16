// src/utils/timelineMappers.ts

import { nanoid } from "nanoid";
import type { TimelineEventBlock, TimelineBlock, SourceItem } from "@ww/shared";
import type { TimelineEvent } from "./firestoreHelpers";

// ---- helpers ----

export const sanitizeSources = (sources: any[] = []): SourceItem[] =>
  (sources || []).map((src: any) => {
    const { imageUrl, preview, ...rest } = src || {};
    return rest;
  });

export const coerceSignificance = (value?: number): 1 | 2 | 3 => {
  if (value === 2 || value === 3) return value;
  return 1;
};

export const safeDate = (value?: string): string => value ?? "";

// ---- mappers (THE FROZEN BOUNDARY) ----

/**
 * CMS legacy event -> shared TimelineEventBlock
 * Only domain-safe fields cross the boundary.
 */
export const mapLegacyEventToEventBlock = (
  eventData: Partial<TimelineEvent>
): TimelineEventBlock => {
  return {
    id: nanoid(),
    type: "event",
    title: eventData.event || "",
    description: eventData.description || "",
    date: safeDate(eventData.date),
    significance: coerceSignificance(eventData.significance),
    sources: sanitizeSources(eventData.sources || []),
  };
};

/**
 * Update an existing shared TimelineEventBlock from legacy CMS input.
 * No spreading. No CMS-only fields.
 */
export const updateEventBlockFromLegacy = (
  existing: TimelineEventBlock,
  eventData: Partial<TimelineEvent>
): TimelineEventBlock => {
  return {
    ...existing,
    title: eventData.event ?? existing.title,
    description: eventData.description ?? existing.description,
    date: eventData.date !== undefined ? safeDate(eventData.date) : existing.date,
    significance:
      eventData.significance !== undefined
        ? coerceSignificance(eventData.significance)
        : existing.significance,
    sources:
      eventData.sources !== undefined
        ? sanitizeSources(eventData.sources)
        : existing.sources,
  };
};

/**
 * Read-time compatibility: ensure every block has a type.
 */
export const normalizeTimeline = (timeline: any[] = []): TimelineBlock[] =>
  (timeline || []).map((block: any) => {
    if (block?.type === "event" || block?.type === "image") return block;
    return { ...block, type: "event" } as TimelineEventBlock;
  });
