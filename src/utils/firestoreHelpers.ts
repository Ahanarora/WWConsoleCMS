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

// ---------------------------
// 🔹 Type Definitions
// ---------------------------

// Each timeline event in a draft
export interface SourceItem {
  title: string;
  link: string;
  imageUrl: string | null;
  sourceName: string;
  pubDate?: string;
  score?: number;
}

export interface TimelineEvent {
  date: string;
  event: string;
  description: string;
  significance: number;
  imageUrl?: string;
  sourceLink?: string;
  sources?: SourceItem[];
  contexts?: { term: string; explainer: string }[];
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
  [key: string]: any; // for dynamic UI safety
}

export interface TimelinePhase {
  title: string;
  description?: string;
  events: TimelineEvent[];
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
  tags: string[];
  imageUrl?: string;
  sources: string[];
  timeline: TimelineEvent[];
  contexts?: { term: string; explainer: string }[];

  /**
   * ✅ analysis is optional for drafts that don't have it yet
   */
  analysis?: Partial<AnalysisSection>;

  /**
   * 🧭 NEW: Optional flag to disable depth toggle in the app
   */
  disableDepthToggle?: boolean;

  keywords?: string[];
  status?: "draft" | "review" | "published";
  slug: string;
  editorNotes?: string;
  updatedAt?: any;
    usePhasedTimeline?: boolean; // toggle for enabling phases
  phases?: TimelinePhase[];    // AI-generated or manual grouping
}

// ---------------------------
// 🔹 Firestore CRUD Functions
// ---------------------------

/** Create a new draft with default fields */
export const createDraft = async (data: Partial<Draft>) => {
  const defaultDraft: Draft = {
    title: data.title || "",
    type: data.type || "Theme",
    overview: data.overview || "",
    category: data.category || "",
    subcategory: data.subcategory || "",
    tags: data.tags || [],
    imageUrl: data.imageUrl || "",
    sources: data.sources || [],
    timeline: [],
    analysis: { stakeholders: [], faqs: [], future: [] },
    disableDepthToggle: data.disableDepthToggle || false,

    status: data.status || "draft",
    slug:
      data.slug ||
      (data.title
        ? data.title.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "")
        : ""),
    editorNotes: data.editorNotes || "",
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, "drafts"), defaultDraft);
  return docRef.id;
};

/** Fetch all drafts */
export const fetchDrafts = async (): Promise<Draft[]> => {
  const snapshot = await getDocs(collection(db, "drafts"));
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Draft),
  }));
};

/** Fetch one draft by ID */
export const fetchDraft = async (id: string): Promise<Draft | null> => {
  const docRef = doc(db, "drafts", id);
  const snapshot = await getDoc(docRef);
  return snapshot.exists()
    ? ({ id: snapshot.id, ...(snapshot.data() as Draft) } as Draft)
    : null;
};

/** Generic partial update with merge support */
export const updateDraft = async (id: string, patch: Partial<Draft>) => {
  const ref = doc(db, "drafts", id);
  await setDoc(
    ref,
    {
      ...patch,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

/** Delete draft */
export const deleteDraft = async (id: string) => {
  await deleteDoc(doc(db, "drafts", id));
};

// ---------------------------
// 🔹 Timeline Helpers
// ---------------------------

/** Add a new event to a draft timeline */
export const addTimelineEvent = async (
  id: string,
  eventData: Partial<TimelineEvent>
) => {
  const draft = await fetchDraft(id);
  if (!draft) throw new Error("Draft not found");

  const newEvent: TimelineEvent = {
    date: eventData.date || "",
    event: eventData.event || "",
    description: eventData.description || "",
    significance: eventData.significance || 1,
    imageUrl: eventData.imageUrl || "",
    sourceLink: eventData.sourceLink || "",
    sources: eventData.sources || [],
  };

  const updatedTimeline = [...(draft.timeline || []), newEvent];
  await updateDraft(id, { timeline: updatedTimeline });
};

/** Update a specific timeline event */
export const updateTimelineEvent = async (
  id: string,
  index: number,
  eventData: Partial<TimelineEvent>
) => {
  const draft = await fetchDraft(id);
  if (!draft) throw new Error("Draft not found");

  const updatedTimeline = [...(draft.timeline || [])];
  updatedTimeline[index] = { ...updatedTimeline[index], ...eventData };

  await updateDraft(id, { timeline: updatedTimeline });
};

/** Delete a timeline event */
export const deleteTimelineEvent = async (id: string, index: number) => {
  const draft = await fetchDraft(id);
  if (!draft) throw new Error("Draft not found");

  const updatedTimeline = draft.timeline.filter((_, i) => i !== index);
  await updateDraft(id, { timeline: updatedTimeline });
};

// ---------------------------
// 🔹 Publishing
// ---------------------------

/** Publish a draft (routes automatically to 'stories' or 'themes') */
export const publishDraft = async (id: string) => {
  const draftRef = doc(db, "drafts", id);
  const snap = await getDoc(draftRef);
  if (!snap.exists()) throw new Error("Draft not found");

  const draft = snap.data() as Draft;
  const slug =
    draft.slug ||
    draft.title.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");

  // Collect all event-level sources
  const allSources =
    draft.timeline
      ?.flatMap((ev) => ev.sources || [])
      .filter((s) => s?.link && s.link.startsWith("http")) || [];

  const collectionName = draft.type === "Story" ? "stories" : "themes";
  const publishRef = doc(db, collectionName, slug);

  await setDoc(publishRef, {
    ...draft,
    sources: allSources,
    publishedAt: serverTimestamp(),
    status: "published",
  });

  await updateDoc(draftRef, { status: "published", updatedAt: serverTimestamp() });

  console.log(
    `✅ Published ${draft.type} → /${collectionName}/${slug} with ${allSources.length} sources`
  );
};

/** Optional: direct story publisher */
export const publishStory = async (id: string) => {
  await publishDraft(id);
};
