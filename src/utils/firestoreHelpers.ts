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
  provider?: "sonar" | "serper";

}

// ---------------------------
// 🔹 Event Media & Display
// ---------------------------

export type EventDisplayMode = "link-preview" | "ai-image";

export interface EventMedia {
  type: EventDisplayMode;

  // For link preview
  sourceIndex?: number; // index in sources[]

  // For AI / uploaded image
  imageUrl?: string;
  attribution?: string; // "AI-generated" | "Editor uploaded"
}


/**
 * ⭐ TimelineEvent now supports normal events + phases
 */
export interface TimelineEvent {
  id?: string;
  phase?: boolean;
  title?: string;

  date?: string;
  event?: string;
  description?: string;
  significance?: number;
  imageUrl?: string;
  sourceLink?: string;
  sources?: SourceItem[];
  contexts?: { term: string; explainer: string }[];
  faqs?: { question: string; answer: string }[];
  factCheck?: {
    confidenceScore: number;
    explanation: string;
    lastCheckedAt: number;
  };
    // ---------------------------
  // 🔹 WW Presentation Controls
  // ---------------------------

  origin?: "external" | "ww";

  displayMode?: EventDisplayMode;

  media?: EventMedia;

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


  timeline: TimelineEvent[];

  // Universal card description (used for card previews)
  cardDescription?: string;

  // Card descriptions per surface
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

  // Feature flags
  isPinned?: boolean;
  isPinnedFeatured?: boolean; // legacy support
  pinnedCategory?: string | "All";
  isCompactCard?: boolean;

  keywords?: string[];
  status?: "draft" | "review" | "published";
  slug: string;
  editorNotes?: string;

  updatedAt?: any;
  createdAt?: any;   // ⭐ NEW
}

// ---------------------------
// 🔹 Firestore CRUD Functions
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

/** Create a new draft with default fields */
const normalizeDraft = (data: Draft): Draft => ({
  ...data,
  isPinned: data.isPinned ?? data.isPinnedFeatured ?? false,
  secondaryCategories: data.secondaryCategories || [],
  secondarySubcategories: data.secondarySubcategories || [],
  allCategories:
    data.allCategories ||
    buildAllCategories(data.category, data.secondaryCategories || []),
});

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
    imageUrl: data.imageUrl || "",
   sources: (data.sources as SourceItem[]) || [],


    timeline: [],

    // Card previews
    cardDescription: data.cardDescription || "",

    // Card descriptions (separate from overview)
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
        ? data.title
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^\w-]/g, "")
        : ""),

    editorNotes: data.editorNotes || "",

    // ⭐ timestamps
    createdAt: serverTimestamp(),   // NEW
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, "drafts"), defaultDraft);
  return docRef.id;
};

/** Fetch all drafts */
export const fetchDrafts = async (): Promise<Draft[]> => {
  const snapshot = await getDocs(collection(db, "drafts"));
  return snapshot.docs.map((d) =>
    normalizeDraft({
      id: d.id,
      ...(d.data() as Draft),
    })
  );
};

/** Fetch one draft by ID */
export const fetchDraft = async (id: string): Promise<Draft | null> => {
  const docRef = doc(db, "drafts", id);
  const snapshot = await getDoc(docRef);
  return snapshot.exists()
    ? (normalizeDraft({
        id: snapshot.id,
        ...(snapshot.data() as Draft),
      }) as Draft)
    : null;
};

/** Generic partial update with merge support */
export const updateDraft = async (id: string, patch: Partial<Draft>) => {
  const ref = doc(db, "drafts", id);
  const mergedAllCategories = buildAllCategories(
    patch.category,
    patch.secondaryCategories || []
  );
  await setDoc(
    ref,
    {
      ...patch,
      ...(patch.category || patch.secondaryCategories
        ? { allCategories: mergedAllCategories }
        : {}),
      updatedAt: serverTimestamp(), // ⭐ do NOT overwrite createdAt
    },
    { merge: true }
  );
};

/** Delete draft and any published doc (stories/themes) that matches its slug */
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
    } catch (err) {
      console.warn("⚠️ Failed to delete published doc (ignoring):", err);
    }

    // Also attempt delete by draft ID in case the published doc used the ID as key
    if (slug !== id) {
      try {
        await deleteDoc(doc(db, collectionName, id));
      } catch (err) {
        console.warn("⚠️ Failed to delete published doc by ID (ignoring):", err);
      }
    }
  }

  await deleteDoc(draftRef);
};

// ---------------------------
// 🔹 Timeline Helpers
// ---------------------------

/**
 * Add a new event or phase block
 */
export const addTimelineEvent = async (
  id: string,
  eventData: Partial<TimelineEvent>
) => {
  const draft = await fetchDraft(id);
  if (!draft) throw new Error("Draft not found");

  let newBlock: TimelineEvent;

  if (eventData.phase) {
    newBlock = {
      phase: true,
      title: eventData.title || "New Phase",
    };
  } else {
    newBlock = {
          date: eventData.date || "",
    event: eventData.event || "",
    description: eventData.description || "",
    significance: eventData.significance || 1,

    // legacy support
    imageUrl: eventData.imageUrl || "",
    sourceLink: eventData.sourceLink || "",
    sources: eventData.sources || [],

    contexts: eventData.contexts || [],
    faqs: eventData.faqs || [],

    // ---------------------------
    // 🔹 Default WW presentation
    // ---------------------------
    origin: eventData.origin || "external",

    displayMode: eventData.displayMode || "link-preview",

    media:
      eventData.media ||
      (eventData.sources && eventData.sources.length > 0
        ? { type: "link-preview", sourceIndex: 0 }
        : undefined),

    isHighlighted: false,
      
    };
  }

  const updatedTimeline = [...(draft.timeline || []), newBlock];
  await updateDraft(id, { timeline: updatedTimeline });
};

/** Update timeline block */
export const updateTimelineEvent = async (
  id: string,
  index: number,
  eventData: Partial<TimelineEvent>
) => {
  const draft = await fetchDraft(id);
  if (!draft) throw new Error("Draft not found");

  const updatedTimeline = [...(draft.timeline || [])];
  updatedTimeline[index] = {
    ...updatedTimeline[index],
    ...eventData,
  };

  await updateDraft(id, { timeline: updatedTimeline });
};

/** Delete timeline block */
export const deleteTimelineEvent = async (id: string, index: number) => {
  const draft = await fetchDraft(id);
  if (!draft) throw new Error("Draft not found");

  const updatedTimeline = draft.timeline.filter((_, i) => i !== index);
  await updateDraft(id, { timeline: updatedTimeline });
};

// ---------------------------
// 🔹 Publishing
// ---------------------------

/**
 * Publish a draft → /stories or /themes
 * ⭐ preserves createdAt
 */
export const publishDraft = async (id: string) => {
  const draftRef = doc(db, "drafts", id);
  const snap = await getDoc(draftRef);
  if (!snap.exists()) throw new Error("Draft not found");

  const draft = snap.data() as Draft;
  const slug =
    draft.slug ||
    draft.title.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");

  const allSources =
    draft.timeline
      ?.flatMap((ev) => ev.sources || [])
      .filter((s) => s?.link && s.link.startsWith("http")) || [];

  const collectionName = draft.type === "Story" ? "stories" : "themes";
  const publishRef = doc(db, collectionName, slug);
  const allCategories = draft.allCategories?.length
    ? draft.allCategories
    : buildAllCategories(draft.category, draft.secondaryCategories || []);

  await setDoc(publishRef, {
    ...draft,
    allCategories,
    sources: allSources,
    publishedAt: serverTimestamp(),
    createdAt: draft.createdAt || serverTimestamp(),   // ⭐ preserve original
    status: "published",
  });

  await updateDoc(draftRef, {
    status: "published",
    updatedAt: serverTimestamp(),
  });

  console.log(
    `✅ Published ${draft.type} → /${collectionName}/${slug} with ${allSources.length} sources`
  );
};

export const publishStory = async (id: string) => {
  await publishDraft(id);
};
