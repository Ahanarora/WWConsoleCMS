// ----------------------------------------
// src/utils/firestoreHelpers.ts (fixed)
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
  serverTimestamp,
} from "firebase/firestore";

// ---------------------------
// 🔹 Type Definitions
// ---------------------------

// Each timeline event in a draft
export interface TimelineEvent {
  date: string;
  event: string;
  description: string;
  significance: number; // 1–3
  imageUrl?: string;
  sourceLink?: string;
}

// Analysis structure (3 collapsible tabs)
export interface AnalysisSection {
  stakeholders: { name: string; detail: string }[];
  faqs: { question: string; answer: string }[];
  future: { question: string; answer: string }[];
}

// Main Draft schema
export interface Draft {
  id?: string;
  title: string;
  overview: string;
  category: string;
  subcategory: string;
  tags: string[];
  status: string;
  imageUrl?: string;
  sources: string[];
  timeline: TimelineEvent[];
  analysis: AnalysisSection;
  updatedAt?: any;
}

// ---------------------------
// 🔹 Firestore CRUD Functions
// ---------------------------

/** Create a new draft with full schema defaults */
export const createDraft = async (data: Partial<Draft>) => {
  const defaultDraft: Draft = {
    title: data.title || "",
    overview: data.overview || "",
    category: data.category || "",
    subcategory: data.subcategory || "",
    tags: data.tags || [],
    status: data.status || "draft",
    imageUrl: data.imageUrl || "",
    sources: data.sources || [],
    timeline: [],
    analysis: { stakeholders: [], faqs: [], future: [] },
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

/** Generic update for any fields */
export const updateDraft = async (id: string, newData: Partial<Draft>) => {
  const docRef = doc(db, "drafts", id);
  await updateDoc(docRef, {
    ...newData,
    updatedAt: serverTimestamp(),
  });
};

/** Delete draft */
export const deleteDraft = async (id: string) => {
  const docRef = doc(db, "drafts", id);
  await deleteDoc(docRef);
};

// ---------------------------
// 🔹 Timeline Helpers
// ---------------------------

/** Add a new event to timeline */
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
  };

  const updatedTimeline = [...(draft.timeline || []), newEvent];
  await updateDraft(id, { timeline: updatedTimeline });
};

/** Update an existing event in timeline */
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

/** Delete an event from timeline */
export const deleteTimelineEvent = async (id: string, index: number) => {
  const draft = await fetchDraft(id);
  if (!draft) throw new Error("Draft not found");

  const updatedTimeline = draft.timeline.filter((_, i) => i !== index);
  await updateDraft(id, { timeline: updatedTimeline });
};
