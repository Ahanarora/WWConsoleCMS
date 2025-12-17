// ----------------------------------------
// src/utils/firestoreHelpers.ts
// ----------------------------------------

import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  mapLegacyEventToEventBlock,
  updateEventBlockFromLegacy,
  normalizeTimeline,
  sanitizeSources,
} from "./timelineMappers";

/**
 * 🔹 SHARED DOMAIN TYPES
 * These now come from @ww/shared
 */
import type { TimelineBlock, SourceItem, TimelineEventBlock } from "@ww/shared";

// ---------------------------
// 🔹 LEGACY CMS EVENT SHAPE
// ---------------------------

export interface TimelineEvent {
  type?: "event";
  id?: string;
  phase?: boolean;
  title?: string;

  date?: string;
  event?: string;
  description?: string;
  significance?: number;
  sourceLink?: string;
  sources?: SourceItem[];

  contexts?: { term: string; explainer: string }[];
  faqs?: { question: string; answer: string }[];
  factCheck?: {
    confidenceScore: number;
    explanation: string;
    lastCheckedAt: number;
  };

  origin?: "external" | "ww";
  isHighlighted?: boolean;
}

// ---------------------------
// 🔹 Analysis Types
// ---------------------------

export interface Stakeholder {
  name: string;
  detail: string;
}

export interface QA {
  question: string;
  answer: string;
}

export interface AnalysisSection {
  stakeholders: Stakeholder[];
  faqs: QA[];
  future: QA[];
  [key: string]: any;
}

// ---------------------------
// 🔹 Main Draft Schema
// ---------------------------

export interface Draft {
  id?: string;
  type?: "Theme" | "Story";
  title: string;
  overview: string;
  category: string;
  subcategory: string;
  secondaryCategories?: string[];
  secondarySubcategories?: string[];
  allCategories?: string[];
  tags: string[];

  imageUrl?: string;
  sources?: SourceItem[];

  timeline: TimelineBlock[];

  cardDescription?: string;
  cardDescriptionHome?: string;
  cardDescriptionTheme?: string;
  cardDescriptionStory?: string;

  analysis?: Partial<AnalysisSection>;

  phases?: {
    title: string;
    description?: string;
    startIndex: number;
    endIndex?: number;
  }[];

  contexts?: { term: string; explainer: string }[];

  disableDepthToggle?: boolean;

  isPinned?: boolean;
  isPinnedFeatured?: boolean;
  pinnedCategory?: string | "All";
  isCompactCard?: boolean;

  keywords?: string[];
  status?: "draft" | "review" | "published";
  slug: string;
  editorNotes?: string;

  updatedAt?: any;
  createdAt?: any;
}

// ---------------------------
// 🔹 Firestore safety helper
// ---------------------------

function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}


function findUndefinedPaths(
  value: any,
  path = "root",
  out: string[] = []
): string[] {
  if (value === undefined) {
    out.push(path);
    return out;
  }
  if (value === null) return out;
  if (Array.isArray(value)) {
    value.forEach((v, i) => findUndefinedPaths(v, `${path}[${i}]`, out));
    return out;
  }
  if (typeof value === "object") {
    Object.keys(value).forEach((k) =>
      findUndefinedPaths(value[k], `${path}.${k}`, out)
    );
    return out;
  }
  return out;
}

// ---------------------------
// 🔹 Legacy Sanitizer
// ---------------------------

const sanitizeTimeline = (timeline: any[] = []): any[] =>
  (timeline || []).map((block: any) => {
    if (block?.type && block.type !== "event") {
  const { sources, factCheck, origin, ...rest } = block || {};
  return {
    ...rest,
    ...(sources ? { sources: sanitizeSources(sources || []) } : {}),
  };
}


    const {
  imageUrl,
  media,
  displayMode,
  sources,
  factCheck,   // ❌ explicitly drop
  origin,      // ❌ explicitly drop
  ...rest
} = block || {};

return {
  ...rest,
  type: "event",
  sources: sanitizeSources(sources || []),
};

  });

// ---------------------------
// 🔹 Helpers
// ---------------------------

const buildAllCategories = (
  primary?: string,
  secondary: string[] = []
): string[] => {
  const merged = [primary, ...(secondary || [])].filter(
    (c): c is string => !!c && c.trim().length > 0
  );
  return Array.from(new Set(merged.map((c) => c.trim())));
};

function ensureEventTitles(timeline: any[] = []): any[] {
  return (timeline || []).map((b: any) => {
    if (b?.type !== "event") return b;

    const title =
      (typeof b.title === "string" && b.title.trim().length > 0
        ? b.title
        : typeof b.event === "string" && b.event.trim().length > 0
        ? b.event
        : typeof b.description === "string" && b.description.trim().length > 0
        ? b.description.split(".")[0].trim()
        : "");

    return {
      ...b,
      title,
      // optional backward compatibility for WWFinal if it expects `event`
      event: typeof b.event === "string" && b.event.trim().length > 0 ? b.event : title,
    };
  });
}


const normalizeDraft = (data: Draft): Draft => ({
  ...data,
  isPinned: data.isPinned ?? data.isPinnedFeatured ?? false,
  secondaryCategories: data.secondaryCategories || [],
  secondarySubcategories: data.secondarySubcategories || [],
  allCategories:
    data.allCategories ||
    buildAllCategories(data.category, data.secondaryCategories || []),
  sources: sanitizeSources(data.sources || []),
  timeline: normalizeTimeline(sanitizeTimeline(data.timeline || [])),
});

// ---------------------------
// 🔹 Firestore CRUD
// ---------------------------

export const createDraft = async (data: Partial<Draft>) => {
  const defaultDraft: Draft = {
    title: data.title || "",
    type: data.type || "Theme",
    overview: data.overview || "",
    category: data.category || "",
    subcategory: data.subcategory || "",
    secondaryCategories: data.secondaryCategories || [],
    secondarySubcategories: data.secondarySubcategories || [],
    allCategories:
      data.allCategories ||
      buildAllCategories(data.category, data.secondaryCategories || []),
    tags: data.tags || [],
    imageUrl: data.imageUrl ?? "",
    sources: sanitizeSources((data.sources as SourceItem[]) || []),
    timeline: [],
    cardDescription: data.cardDescription || "",
    cardDescriptionHome: data.cardDescriptionHome || "",
    cardDescriptionTheme: data.cardDescriptionTheme || "",
    cardDescriptionStory: data.cardDescriptionStory || "",
    analysis: { stakeholders: [], faqs: [], future: [] },
    disableDepthToggle: data.disableDepthToggle || false,
    isPinned: data.isPinned ?? data.isPinnedFeatured ?? false,
    isPinnedFeatured: data.isPinnedFeatured ?? data.isPinned ?? false,
    isCompactCard: data.isCompactCard ?? false,
    pinnedCategory: data.pinnedCategory ?? "All",
    keywords: data.keywords || [],
    status: data.status || "draft",
    slug:
      data.slug ||
      (data.title
        ? data.title.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "")
        : ""),
    editorNotes: data.editorNotes || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, "drafts"), defaultDraft);
  return docRef.id;
};

export const fetchDrafts = async (): Promise<Draft[]> => {
  const snapshot = await getDocs(collection(db, "drafts"));
  return snapshot.docs.map((d) =>
    normalizeDraft({ id: d.id, ...(d.data() as Draft) })
  );
};

export const fetchDraft = async (id: string): Promise<Draft | null> => {
  const docRef = doc(db, "drafts", id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;

  const raw = snapshot.data() as Draft;
  const cleanedTimeline = normalizeTimeline(
    sanitizeTimeline(raw.timeline || [])
  );
  const cleanedSources = sanitizeSources(raw.sources || []);

  const needsCleanup =
    JSON.stringify(raw.timeline || []) !== JSON.stringify(cleanedTimeline) ||
    JSON.stringify(raw.sources || []) !== JSON.stringify(cleanedSources);

  if (needsCleanup) {
    await updateDoc(docRef, {
      timeline: cleanedTimeline,
      sources: cleanedSources,
      updatedAt: serverTimestamp(),
    });
  }

  return normalizeDraft({
    id: snapshot.id,
    ...raw,
    timeline: cleanedTimeline,
    sources: cleanedSources,
  });
};

export const updateDraft = async (id: string, patch: Partial<Draft>) => {
  const ref = doc(db, "drafts", id);
  const mergedAllCategories = buildAllCategories(
    patch.category,
    patch.secondaryCategories || []
  );

  const cleanedPatch = stripUndefined({
  ...patch,
  ...(patch.sources
    ? { sources: sanitizeSources(patch.sources as any[]) }
    : {}),
  ...(patch.timeline
    ? {
        timeline: normalizeTimeline(
          sanitizeTimeline(patch.timeline as any[])
        ),
      }
    : {}),
  ...(patch.category || patch.secondaryCategories
    ? { allCategories: mergedAllCategories }
    : {}),
  updatedAt: serverTimestamp(),
});

// 🔍 make undefined visible as missing keys in logs
const debugPayload = JSON.parse(JSON.stringify(cleanedPatch));

const undefinedPaths = findUndefinedPaths(cleanedPatch);
if (undefinedPaths.length) {
  console.error("🔥 Firestore write blocked — undefined at:", undefinedPaths);
  console.error("🔥 Payload (JSON-safe):", debugPayload);
  throw new Error(
    `Firestore write aborted due to undefined at: ${undefinedPaths.join(", ")}`
  );
}



  await setDoc(ref, cleanedPatch, { merge: true });
};

export const deleteDraft = async (id: string) => {
  const draftRef = doc(db, "drafts", id);
  const snap = await getDoc(draftRef);

  if (snap.exists()) {
    const data = snap.data() as Draft;
    const slug =
      data.slug ||
      (data.title
        ? data.title.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "")
        : id);
    const collectionName = data.type === "Story" ? "stories" : "themes";

    try {
      await deleteDoc(doc(db, collectionName, slug));
    } catch {}

    if (slug !== id) {
      try {
        await deleteDoc(doc(db, collectionName, id));
      } catch {}
    }
  }

  await deleteDoc(draftRef);
};

// ---------------------------
// 🔹 Timeline Mutations
// ---------------------------

export const updateTimelineBlock = async (
  id: string,
  index: number,
  block: TimelineBlock
) => {
  const draft = await fetchDraft(id);
  if (!draft) throw new Error("Draft not found");

  const updatedTimeline = [...draft.timeline];
  updatedTimeline[index] = block;

  await updateDraft(id, { timeline: updatedTimeline });
};

export const addTimelineBlock = async (id: string, block: TimelineBlock) => {
  const draft = await fetchDraft(id);
  if (!draft) throw new Error("Draft not found");

  const updatedTimeline = [...draft.timeline, block];
  await updateDraft(id, { timeline: updatedTimeline });
};

export const addTimelineEvent = async (
  id: string,
  eventData: Partial<TimelineEvent>
) => {
  const draft = await fetchDraft(id);
  if (!draft) throw new Error("Draft not found");

  const newBlock = mapLegacyEventToEventBlock(eventData);
  const updatedTimeline = [...draft.timeline, newBlock];

  await updateDraft(id, { timeline: updatedTimeline });
};

export const updateTimelineEvent = async (
  id: string,
  index: number,
  eventData: Partial<TimelineEvent>
) => {
  const draft = await fetchDraft(id);
  if (!draft) throw new Error("Draft not found");

  const updatedTimeline = [...draft.timeline];
  const existing = updatedTimeline[index];

  if (!existing || existing.type !== "event") return;

  updatedTimeline[index] = updateEventBlockFromLegacy(
    existing as TimelineEventBlock,
    eventData
  );

  await updateDraft(id, { timeline: updatedTimeline });
};

export const deleteTimelineEvent = async (id: string, index: number) => {
  const draft = await fetchDraft(id);
  if (!draft) throw new Error("Draft not found");

  const updatedTimeline = draft.timeline.filter((_, i) => i !== index);
  await updateDraft(id, { timeline: updatedTimeline });
};

// ---------------------------
// 🔹 Publishing
// ---------------------------

export const publishDraft = async (id: string) => {
  const draftRef = doc(db, "drafts", id);
  const snap = await getDoc(draftRef);
  if (!snap.exists()) throw new Error("Draft not found");

  const draft = snap.data() as Draft;
  const slug =
    draft.slug ||
    draft.title.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
    
const sanitizedTimeline = ensureEventTitles(normalizeTimeline(draft.timeline || []));


  const allSources =
    sanitizedTimeline
      .flatMap((ev: any) => ev.sources || [])
      .filter((s: any) => s?.link && s.link.startsWith("http")) || [];

  const collectionName = draft.type === "Story" ? "stories" : "themes";
  const publishRef = doc(db, collectionName, slug);

  const allCategories =
    draft.allCategories?.length
      ? draft.allCategories
      : buildAllCategories(draft.category, draft.secondaryCategories || []);

  await setDoc(publishRef, {
    ...draft,
    timeline: sanitizedTimeline,
    allCategories,
    sources: allSources,
    publishedAt: serverTimestamp(),
    createdAt: draft.createdAt || serverTimestamp(),
    status: "published",
  });

  await updateDoc(draftRef, {
    timeline: sanitizedTimeline,
    status: "published",
    updatedAt: serverTimestamp(),
  });
};

export const publishStory = async (id: string) => {
  await publishDraft(id);
};
