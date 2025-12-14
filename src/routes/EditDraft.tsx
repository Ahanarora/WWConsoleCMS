// src/routes/EditDraft.tsx
// ----------------------------------------

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  fetchDraft,
  updateDraft,
  updateTimelineEvent,
  publishDraft,
  publishStory,
} from "../utils/firestoreHelpers";
import type { Draft, TimelineEvent, SourceItem } from "../utils/firestoreHelpers";

import {
  generateAnalysis,
  generateExplainersForEvent,
  generateContextsForTimelineEvent,
  generateContextsForAnalysis,
} from "../utils/gptHelpers";

import { fetchSonarTimelineForDraft } from "../api/fetchSonarTimeline";


import { fetchEventCoverage } from "../api/fetchEventCoverage";
import { renderLinkedText } from "../utils/renderLinkedText.tsx";
import { uploadToCloudinary } from "../utils/cloudinaryUpload";
import { getFaviconUrl, getFallbackFavicon, getInitials } from "../utils/getFaviconUrl";


const CATEGORY_OPTIONS = [
  {
    value: "Politics",
    subcategories: [
      "Elections & Power Transitions",
      "Government Policies & Bills",
      "Public Institutions & Judiciary",
      "Geopolitics & Diplomacy",
    ],
  },
  {
    value: "Business & Economy",
    subcategories: [
      "Macroeconomy",
      "Industries",
      "Markets & Finance",
      "Trade & Tariffs",
      "Corporate Developments",
    ],
  },
  {
    value: "World",
    subcategories: [
      "International Conflicts",
      "Global Governance",
      "Migration & Humanitarian Crises",
      "Elections Worldwide",
      "Science & Tech",
      "Environment",
    ],
  },
  {
    value: "India",
    subcategories: [
      "Social Issues",
      "Infrastructure & Development",
      "Science, Tech and Environment",
    ],
  },
];
const CATEGORY_VALUES = CATEGORY_OPTIONS.map((c) => c.value.toLowerCase());

const parseTags = (value: string): string[] =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const DISPLAY_MODES = [
  { value: "link-preview", label: "Publisher link preview" },
  { value: "ai-image", label: "AI / uploaded image" },
];


    
const normalizeText = (value?: string) => value || "";

function getFactCheckDotColor(score: number): string {
  if (score >= 85) return "#16a34a"; // green
  if (score >= 70) return "#eab308"; // yellow
  if (score >= 50) return "#f97316"; // orange
  return "#dc2626"; // red
}

function getFactCheckBadgeClass(score: number): string {
  if (score >= 85) return "bg-green-100 text-green-800";
  if (score >= 70) return "bg-yellow-100 text-yellow-800";
  if (score >= 50) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

export default function EditDraft() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [selectionMap, setSelectionMap] = useState<
    Record<string, { start: number; end: number }>
  >({});
  const [isFactCheckModalOpen, setIsFactCheckModalOpen] = useState(false);
  const [factCheckJson, setFactCheckJson] = useState("");
  const [tagsInput, setTagsInput] = useState("");


  const [imageOptions, setImageOptions] = useState<string[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null);

  const [showTimeline, setShowTimeline] = useState(true);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  const uniq = (arr: string[]) => Array.from(new Set(arr));
  // Normalize categories to canonical strings and strip empties
  const normalizeCategoryValue = (value?: string): string => {
    if (!value) return "";
    const found = CATEGORY_OPTIONS.find(
      (c) => c.value.toLowerCase() === value.toLowerCase()
    );
    return found ? found.value : value;
  };

  const computeAllCategories = (
    primary?: string,
    secondary: string[] = []
  ): string[] => {
    // Merge primary + secondary, normalize, drop blanks, dedupe
    const merged = [primary, ...(secondary || [])]
      .filter((c): c is string => !!c?.trim?.().length)
      .map((c) => normalizeCategoryValue(c.trim()))
      .filter(Boolean);
    return Array.from(new Set(merged));
  };

  const primarySubcategories =
    CATEGORY_OPTIONS.find((c) => c.value === draft?.category)?.subcategories ||
    [];

  // Expose all subcategories so secondary selections are always available.
  const secondarySubcategoryOptions = uniq(
    CATEGORY_OPTIONS.flatMap((c) => c.subcategories || [])
  );

  const handlePrimaryCategoryChange = (value: string) => {
    if (!draft) return;
    const subs =
      CATEGORY_OPTIONS.find((c) => c.value === value)?.subcategories || [];
    const nextSub = subs.includes(draft.subcategory || "")
      ? draft.subcategory
      : subs[0] || "";
    const allCategories = computeAllCategories(
      value,
      draft.secondaryCategories || []
    );
    const nextPinned =
      draft.pinnedCategory && draft.pinnedCategory === draft.category
        ? value
        : draft.pinnedCategory;
    setDraft({
      ...draft,
      category: value,
      subcategory: nextSub,
      allCategories,
      pinnedCategory: nextPinned,
    });
  };



  const toggleSecondaryCategory = (cat: string, checked: boolean) => {
    if (!draft) return;
    const current = draft.secondaryCategories || [];
    const next = checked
      ? uniq([...current, cat])
      : current.filter((c) => c !== cat);
    const allCategories = computeAllCategories(draft.category, next);
    setDraft({
      ...draft,
      secondaryCategories: next,
      allCategories,
    });
    setUnsaved(true);
  };

  const ensureDraftShape = (data: Draft): Draft => ({
    ...data,
    // Guard against missing arrays/flags and keep categories normalized
    timeline: data.timeline || [],
    phases: data.phases || [],
    isPinned: data.isPinned ?? data.isPinnedFeatured ?? false,
    category: normalizeCategoryValue(data.category),
    secondaryCategories: (data.secondaryCategories || [])
      .map((c) => normalizeCategoryValue(c) || "")
      .filter(Boolean),
    secondarySubcategories: (data.secondarySubcategories || []).filter(Boolean),
    allCategories:
      data.allCategories?.filter(Boolean) ||
      computeAllCategories(data.category, data.secondaryCategories || []),
    tags: data.tags || [],
    cardDescription: normalizeText(data.cardDescription),
    cardDescriptionHome: normalizeText(data.cardDescriptionHome),
    cardDescriptionTheme: normalizeText(data.cardDescriptionTheme),
    cardDescriptionStory: normalizeText(data.cardDescriptionStory),
  });

  interface FactCheckResult {
    id: string;
    confidenceScore: number;
    confidenceExplanation: string;
  }

  const handleCopyEventsForFactCheck = () => {
    if (!draft || !draft.timeline || draft.timeline.length === 0) {
      alert("No timeline events to copy.");
      return;
    }

    const header = `You are a fact-checking assistant. For each event below, fact-check the explanation using the listed sources and your own browsing.

Return ONLY a JSON array of objects. Each object MUST have:
- "id": the event id (string, as provided)
- "confidenceScore": integer from 0 to 100
- "confidenceExplanation": short 1–3 sentence explanation of why you gave that score (number and credibility of sources, agreement between sources, recency, etc.)

Example of desired output:
[
  {
    "id": "event-1",
    "confidenceScore": 88,
    "confidenceExplanation": "Verified by multiple major outlets with consistent details."
  }
]

Events:
`;

    const body = draft.timeline
      .map((ev: TimelineEvent, idx: number) => {
        const sourcesText =
          ev.sources?.map((s) => `- ${s.link || s.title || s.sourceName || ""}`).join("\n") ||
          "- (no sources listed)";

        return [
          "#EVENT",
          `id: ${ev.id ?? `event-${idx + 1}`}`,
          `title: ${ev.event || ev.title || "(no title)"}`,
          `explanation: ${ev.description || "(no explanation)"}`,
          "",
          "sources:",
          sourcesText,
          "",
        ].join("\n");
      })
      .join("\n");

    const fullText = `${header}\n${body}`;

    if (!navigator?.clipboard) {
      alert("Clipboard not available in this browser.");
      return;
    }

    navigator.clipboard
      .writeText(fullText)
      .then(() => {
        alert("All events copied for fact-checking. Paste into ChatGPT.");
      })
      .catch((err) => {
        console.error("Clipboard error", err);
        alert("Failed to copy to clipboard.");
      });
  };

  const handleApplyFactCheckResults = async () => {
    if (!draft) return;

    try {
      const parsed = JSON.parse(factCheckJson) as FactCheckResult[];

      if (!Array.isArray(parsed)) {
        throw new Error("JSON is not an array");
      }

      const updatedTimeline: TimelineEvent[] = draft.timeline.map((ev, idx) => {
        const match = parsed.find((item) => item.id === ev.id || item.id === `event-${idx + 1}`);
        if (!match) return ev;

        return {
          ...ev,
          factCheck: {
            confidenceScore: match.confidenceScore,
            explanation: match.confidenceExplanation,
            lastCheckedAt: Date.now(),
          },
        };
      });

      const updatedDraft: Draft = {
        ...draft,
        timeline: updatedTimeline,
      };

      setSaving(true);
      const targetId = draft.id || id;
      if (!targetId) {
        throw new Error("Draft id missing.");
      }
      await updateDraft(targetId, { timeline: updatedTimeline });
      setDraft(updatedDraft);
      setIsFactCheckModalOpen(false);
      setFactCheckJson("");

      alert("Fact-check data applied to events.");
    } catch (err) {
      console.error(err);
      alert(
        "Could not parse JSON. Make sure you pasted valid JSON array with id, confidenceScore, and confidenceExplanation."
      );
    } finally {
      setSaving(false);
    }
  };

  const shiftPhasesAfterRemoval = (
    phases: Draft["phases"] = [],
    removedIndex: number,
    nextTimelineLength: number
  ): Draft["phases"] =>
    (phases || [])
      .filter((p) => p.startIndex !== removedIndex)
      .map((phase) => {
        const newStart =
          phase.startIndex > removedIndex ? phase.startIndex - 1 : phase.startIndex;
        let newEnd =
          typeof phase.endIndex === "number"
            ? phase.endIndex >= removedIndex
              ? phase.endIndex - 1
              : phase.endIndex
            : undefined;

        if (typeof newEnd === "number" && newEnd < newStart) {
          newEnd = newStart;
        }

        if (newStart >= nextTimelineLength) {
          return null;
        }

        return {
          ...phase,
          startIndex: newStart,
          endIndex: newEnd,
        };
      })
      .filter(Boolean) as Draft["phases"];

  const rememberSelection = (
    key: string,
    target: HTMLInputElement | HTMLTextAreaElement
  ) => {
    if (!target) return;
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    setSelectionMap((prev) => ({
      ...prev,
      [key]: { start, end },
    }));
  };

  const insertInternalLinkToken = (
    key: string,
    currentValue: string,
    applyValue: (next: string) => void
  ) => {
    let targetId = prompt(
      "Enter linked story/theme ID (e.g. story/abc123 or theme/xyz456):"
    );
    if (!targetId) return;

    targetId = targetId.replace(/^@+/, "").replace(/\[|\]|\(|\)/g, "").trim();
    if (!targetId) return;

    const sel = selectionMap[key];
    if (!sel || sel.start === sel.end) {
      alert("Select text in the field first, then click Link.");
      return;
    }

    const safeText = currentValue || "";
    const { start, end } = sel;
    const selectedText = safeText.substring(start, end);
    if (!selectedText) {
      alert("Selection is empty.");
      return;
    }

    const linkedText = `[${selectedText}](@${targetId})`;
    const newValue =
      safeText.substring(0, start) + linkedText + safeText.substring(end);

    applyValue(newValue);
    setUnsaved(true);
  };

  // ----------------------------
  // LOAD DRAFT
  // ----------------------------
  useEffect(() => {
    const load = async () => {
      try {
        if (!id) return;
        const data = await fetchDraft(id);
        const shaped = data ? ensureDraftShape(data) : null;
        setDraft(shaped);
        setTagsInput((shaped?.tags || []).join(", "));
      } catch (err) {
        console.error(err);
        alert("Failed to load draft.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  

  // Warn user if there are unsaved changes
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (unsaved) {
      e.preventDefault();
      e.returnValue = "";
    }
  };
  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [unsaved]);

  // ----------------------------
  // METADATA HANDLERS
  // ----------------------------
  const handleMetadataChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    if (!draft) return;
    const { name, value } = e.target;
    setDraft({ ...draft, [name]: value });
    setUnsaved(true);
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagsInput(e.target.value);
    setUnsaved(true);
  };

  const commitTags = (value: string) => {
    setDraft((prev) => (prev ? { ...prev, tags: parseTags(value) } : prev));
  };

  // ----------------------------
// CLOUDINARY — UPLOAD FROM MIDJOURNEY LINK
// ----------------------------
const handleCloudinaryUpload = async () => {
  const url = prompt("Paste Midjourney Image URL:");

  if (!url) return;

  try {
    const cloudUrl = await uploadToCloudinary(url);

    setDraft((prev) =>
      prev ? { ...prev, imageUrl: cloudUrl } : prev
    );

    setUnsaved(true);
    alert("✅ Uploaded to Cloudinary!");
  } catch (err) {
    console.error(err);
    alert("❌ Failed to upload image.");
  }
};


  const saveMetadata = async () => {
    if (!draft || !id) return;
    try {
      setSaving(true);
      // Recompute canonical categories and persist tags from freeform input
      const allCategories = computeAllCategories(
        draft.category,
        draft.secondaryCategories || []
      );
      const parsedTags = parseTags(tagsInput);
      const payload = {
        ...draft,
        allCategories: (allCategories || []).filter(Boolean),
        tags: parsedTags,
      };
      setDraft(payload);
      await updateDraft(id, payload);
      setUnsaved(false);
      alert("✅ Metadata saved");
    } catch (err: any) {
      console.error(err);
      alert("❌ Failed to save metadata: " + (err?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------
  // PUBLISH HANDLER
  // ----------------------------
  const handlePublish = async () => {
    if (!id || !draft) return;
    setPublishing(true);
    try {
      await updateDraft(id, { phases: draft.phases || [] });
      if (draft.type === "Story") {
        await publishStory(id);
        alert("✅ Story published successfully!");
      } else {
        await publishDraft(id);
        alert("✅ Theme published successfully!");
      }
    } catch (err: any) {
      console.error(err);
      alert("❌ Publish failed: " + err.message);
    } finally {
      setPublishing(false);
    }
  };

  // ----------------------------
  // GPT HANDLERS
  // ----------------------------
const handleGenerateTimeline = async () => {
  if (!draft || !id) return;

  setLoadingTimeline(true);

  try {
    // 1) Call Sonar via Cloud Function
    const newTimeline = await fetchSonarTimelineForDraft(draft);

    // 2) Save into draft (same shape as before)
    const updatedDraft: Draft = {
      ...draft,
      timeline: newTimeline,
      updatedAt: new Date().toISOString(),
    };

    setDraft(updatedDraft);

    await updateDraft(id, {
      timeline: newTimeline,
      updatedAt: updatedDraft.updatedAt,
    });

    setUnsaved(false);
    alert("✅ Timeline generated with Sonar and saved.");
  } catch (err: any) {
    console.error("Failed to generate timeline with Sonar:", err);
    alert("❌ Failed to generate timeline: " + (err.message || "Unknown error"));
  } finally {
    setLoadingTimeline(false);
  }
};


  const handleGenerateAnalysis = async () => {
    if (!draft || !id) return;
    setLoadingAnalysis(true);
    try {
      const analysis = await generateAnalysis(draft);
      await updateDraft(id, { analysis });
      const updated = await fetchDraft(id);
      setDraft(updated ? ensureDraftShape(updated) : null);
      alert("✅ Analysis generated successfully!");
    } catch (err: any) {
      console.error(err);
      alert("❌ Failed to generate analysis: " + err.message);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // ----------------------------
  // TIMELINE HANDLERS
  // ----------------------------
  const handleAddEvent = async () => {
    if (!id || !draft) return;
    const newItem: TimelineEvent = {
      date: "",
      event: "",
      description: "",
      significance: 1,
      imageUrl: "",
      sourceLink: "",
      sources: [],
      contexts: [],
      faqs: [],
      displayMode: "link-preview",
media: { type: "link-preview", sourceIndex: 0 },
origin: "external",
    };

    const updatedTimeline = [...(draft.timeline || []), newItem];
    setDraft({ ...draft, timeline: updatedTimeline });

    try {
      await updateDraft(id, { timeline: updatedTimeline });
      alert("🆕 Blank event added. Scroll to the end of the timeline to edit it.");
    } catch (err) {
      console.error("❌ Failed to add event:", err);
      alert("❌ Failed to add event. Please try again.");
      const refreshed = await fetchDraft(id);
      if (refreshed) setDraft(ensureDraftShape(refreshed));
    }
  };

  const handleUpdateEvent = async (index: number, field: keyof TimelineEvent, value: any) => {
    if (!id || !draft) return;
    const updatedTimeline = [...draft.timeline];
    updatedTimeline[index] = { ...updatedTimeline[index], [field]: value };
    setDraft({ ...draft, timeline: updatedTimeline });
    setUnsaved(true);
  };

  const handleDeleteEvent = async (index: number) => {
    if (!id || !draft) return;
    if (!window.confirm("Delete this event?")) return;

    const updatedTimeline = draft.timeline.filter((_, i) => i !== index);
    const adjustedPhases = shiftPhasesAfterRemoval(
      draft.phases || [],
      index,
      updatedTimeline.length
    );

    setDraft({ ...draft, timeline: updatedTimeline, phases: adjustedPhases });
    setUnsaved(true);

    try {
      await updateDraft(id, { timeline: updatedTimeline, phases: adjustedPhases });
      const refreshed = await fetchDraft(id);
      if (refreshed) {
        setDraft(ensureDraftShape(refreshed));
        setUnsaved(false);
      }
      alert("✅ Event deleted.");
    } catch (err) {
      console.error("❌ Failed to delete event:", err);
      alert("❌ Failed to delete event.");
      const refreshed = await fetchDraft(id);
      if (refreshed) setDraft(ensureDraftShape(refreshed));
    }
  };

  // ----------------------------
  // FETCH COVERAGE HANDLER (Serper)
  // ----------------------------
  const handleFetchCoverage = async (i: number, ev: TimelineEvent) => {
    if (!id || !draft) return;

    const eventTitle = ev.event?.trim();
    if (!eventTitle) {
      alert("Please add an event title before fetching coverage.");
      return;
    }

    const description = ev.description ?? "";

    try {
      console.log("🔗 Fetching Serper coverage for:", eventTitle);
      const result = await fetchEventCoverage(eventTitle, description, ev.date || "");

      if (result.sources?.length) {
        const normalizedSources = result.sources.map((s) => ({
          ...s,
          imageUrl: s.imageUrl ?? null,
        }));

        const existingSources: SourceItem[] = draft.timeline[i].sources || [];


const serperSources: SourceItem[] = normalizedSources.map((s) => ({
  title: s.title,
  link: s.link,
  sourceName: s.sourceName,
  imageUrl: s.imageUrl ?? null,
  pubDate: s.pubDate,
  provider: "serper",
}));


const mergedSources = [
  ...existingSources,
  ...serperSources.filter(
    (s) => !existingSources.some((e) => e.link === s.link)
  ),
];

const updatedEvent = {
  ...draft.timeline[i],
  sources: mergedSources,
  imageUrl:
    mergedSources.find((s) => s.imageUrl)?.imageUrl ||
    draft.timeline[i].imageUrl,
    displayMode: draft.timeline[i].displayMode || "link-preview",
media: draft.timeline[i].media || { type: "link-preview", sourceIndex: 0 },
origin: draft.timeline[i].origin || "external",

};


        await updateTimelineEvent(id, i, updatedEvent);
        const updatedTimeline = [...draft.timeline];
        updatedTimeline[i] = updatedEvent;

        

        // Refresh from Firestore so UI and persistence match after auto-fetch
        const refreshed = await fetchDraft(id);
        if (refreshed) {
          setDraft(ensureDraftShape(refreshed as Draft));
        } else {
          setDraft(ensureDraftShape({ ...draft, timeline: updatedTimeline }));
        }
        setUnsaved(true);

        alert(`✅ Found ${result.sources.length} sources for "${ev.event}"`);
      } else {
        alert("⚠️ No relevant sources found for this event");
      }

      console.log("📰 Sources:", result.sources);
    } catch (e: any) {
      console.error("❌ Error fetching coverage:", e);
      alert("❌ Failed to fetch coverage: " + e.message);
    }
  };

  // ----------------------------
  // RENDER
  // ----------------------------
  if (loading) return <div className="p-6">Loading...</div>;
  if (!draft) return <div className="p-6 text-red-500">Draft not found</div>;

  return (
    <>
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">Edit Draft</h1>
        {unsaved && (
  <p className="text-yellow-600 text-sm mt-1">⚠️ You have unsaved changes</p>
)}

        <div className="flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:underline"
          >
            ← Back
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {publishing
              ? "Publishing…"
              : draft?.type === "Story"
                ? "✅ Publish Story"
                : "✅ Publish Theme"}
          </button>

        </div>
      </div>

      {/* METADATA */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-semibold mb-4">Metadata</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Title */}
          <input
            name="title"
            value={draft.title}
            onChange={handleMetadataChange}
            placeholder="Title"
            className="border p-2 rounded"
          />

          {/* Category */}
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-700 font-medium">
              Primary Category
            </label>
            <select
              name="category"
              value={draft.category}
              onChange={(e) => handlePrimaryCategoryChange(e.target.value)}
              className="border p-2 rounded"
            >
              <option value="">Select category</option>
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.value}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategory */}
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-700 font-medium">
              Primary Subcategory
            </label>
            <select
              name="subcategory"
              value={draft.subcategory}
              onChange={(e) =>
                setDraft({ ...draft, subcategory: e.target.value })
              }
              className="border p-2 rounded"
              disabled={!draft.category}
            >
              <option value="">Select subcategory</option>
              {primarySubcategories.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          {/* Secondary Categories */}
          <div className="md:col-span-2 flex flex-col gap-2">
            <label className="text-sm text-gray-700 font-medium">
              Secondary Categories
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.filter((c) => c.value !== draft.category).map(
                (cat) => (
                  <label
                    key={`sec-cat-${cat.value}`}
                    className="flex items-center gap-2 border rounded px-2 py-1 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={
                        draft.secondaryCategories?.includes(cat.value) || false
                      }
                      onChange={(e) =>
                        toggleSecondaryCategory(cat.value, e.target.checked)
                      }
                    />
                    <span>{cat.value}</span>
                  </label>
                )
              )}
            </div>
          </div>

          {/* Secondary Subcategories */}
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-sm text-gray-700 font-medium">
              Secondary Subcategories
            </label>
            <select
              multiple
              value={draft.secondarySubcategories || []}
              onChange={(e) => {
                const selected = Array.from(
                  e.target.selectedOptions
                ).map((opt) => opt.value);
                setDraft({
                  ...draft,
                  secondarySubcategories: selected,
                });
              }}
              className="border p-2 rounded h-28"
            >
              {secondarySubcategoryOptions.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">
              Hold Ctrl/Cmd to select multiple.
            </p>
          </div>

          {/* Universal Card Description */}
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-sm text-gray-700 font-medium">
              Card Preview (all screens)
            </label>
            <textarea
              name="cardDescription"
              value={draft.cardDescription || ""}
              onChange={handleMetadataChange}
              placeholder="Short blurb shown under the title on cards (used instead of Overview)"
              rows={3}
              className="border p-2 rounded"
            />
            <p className="text-xs text-gray-500">
              Leave blank to fall back to the overview.
            </p>
          </div>

          {/* Tags */}
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-sm text-gray-700 font-medium">Tags</label>
            <input
              type="text"
              value={tagsInput}
              onChange={handleTagsChange}
              onBlur={() => commitTags(tagsInput)}
              placeholder="Comma-separated tags (e.g. politics, elections, policy)"
              className="border p-2 rounded"
            />
            <p className="text-xs text-gray-500">
              Saved as a tag list; you can decide how to use them later.
            </p>
          </div>


          {/* Image URL */}
          <input
            name="imageUrl"
            value={draft.imageUrl || ""}
            onChange={handleMetadataChange}
            placeholder="Main Thumbnail / Cover Image URL"
            className="border p-2 rounded md:col-span-2"
          />

          <button
  type="button"
  onClick={handleCloudinaryUpload}
  className="px-3 py-2 bg-purple-600 text-white rounded md:col-span-2 hover:bg-purple-700"
>
  ☁️ Upload Image from Midjourney Link
</button>
np

          {/* Live thumbnail preview */}
          {draft.imageUrl && (
            <div className="md:col-span-2 flex justify-start items-center gap-4">
              <img
                src={draft.imageUrl}
                alt="Cover"
                className="w-48 h-32 object-cover rounded border"
                onError={(e) => {
                  const url = draft.imageUrl ?? "";
                  try {
                    if (url.startsWith("http")) {
                      const origin = new URL(url).origin;
                      e.currentTarget.src = `${origin}/favicon.ico`;
                    } else {
                      e.currentTarget.src =
                        "https://via.placeholder.com/150x100?text=No+Image";
                    }
                  } catch {
                    e.currentTarget.src =
                      "https://via.placeholder.com/150x100?text=No+Image";
                  }
                }}
              />
              <p className="text-gray-600 text-sm">
                Preview of your main thumbnail
              </p>
            </div>
          )}

          {/* ⭐ Tiny Pin to Featured */}
          <div className="flex items-center gap-3 md:col-span-2 mt-2">
            <input
              type="checkbox"
              id="isPinned"
              checked={draft.isPinned || false}
              onChange={async (e) => {
                const checked = e.target.checked;
                setDraft({ ...draft, isPinned: checked });

                if (id) {
                  try {
                    await updateDraft(id, {
                      isPinned: checked,
                      isPinnedFeatured: checked,
                    });
                  } catch (err) {
                    console.error("❌ Failed to update isPinned:", err);
                  }
                }
              }}
              className="w-4 h-4"
            />

            <label htmlFor="isPinned" className="text-sm text-gray-800">
              Pin as Featured
            </label>

            {/* Category selector only when pinned */}
            {draft.isPinned && (
              <select
                value={draft.pinnedCategory || "All"}
                onChange={async (e) => {
                  const val = e.target.value;
                  setDraft({ ...draft, pinnedCategory: val });

                  if (id) {
                    try {
                      await updateDraft(id, { pinnedCategory: val });
                    } catch (err) {
                      console.error("❌ Failed to update pinnedCategory:", err);
                    }
                  }
                }}
                className="border p-1 rounded text-sm"
              >
                <option value="All">All Categories</option>
                <option value={draft.category}>{draft.category}</option>
              </select>
            )}
          </div>

        {/* 🧱 Compact Card Toggle */}
        <div className="flex items-start gap-3 md:col-span-2">
          <input
            type="checkbox"
            id="isCompactCard"
            checked={draft.isCompactCard || false}
            onChange={async (e) => {
              const checked = e.target.checked;
              setDraft({ ...draft, isCompactCard: checked });

              if (id) {
                try {
                  await updateDraft(id, { isCompactCard: checked });
                } catch (err) {
                  console.error("❌ Failed to update isCompactCard:", err);
                }
              }
            }}
            className="w-4 h-4 mt-1"
          />
          <label htmlFor="isCompactCard" className="text-sm text-gray-800">
            Render as compact card
            <span className="block text-gray-500 text-xs">
              Home/Stories/Themes screens on WWFinal will show only the title and a small
              thumbnail when enabled.
            </span>
          </label>
        </div>


          {/* Overview */}
          <textarea
            name="overview"
            value={draft.overview || ""}
            onChange={handleMetadataChange}
            onSelect={(e) =>
              rememberSelection("overview", e.target as HTMLTextAreaElement)
            }
            placeholder="Overview"
            rows={3}
            className="border p-2 rounded md:col-span-2"
          />
          <div className="md:col-span-2 flex items-center gap-2 text-xs text-blue-600 mt-1">
            <button
              type="button"
              onClick={() =>
                insertInternalLinkToken(
                  "overview",
                  draft.overview || "",
                  (next) => setDraft({ ...draft, overview: next })
                )
              }
              className="text-blue-600 hover:underline"
            >
              🔗 Link selected text
            </button>
            <span className="text-gray-500">
              Select text in the overview box, then click to link another story/theme.
            </span>
          </div>
          <div className="md:col-span-2 text-sm text-gray-600">
            {renderLinkedText(draft.overview || "")}
          </div>
        </div>

        {/* 🧭 Depth Toggle Setting */}
<div className="flex items-center gap-2 mt-4">
  <input
    type="checkbox"
    id="disableDepthToggle"
    checked={draft.disableDepthToggle || false}
    onChange={async (e) => {
      const checked = e.target.checked;
      setDraft({ ...draft, disableDepthToggle: checked });
      if (id) {
        try {
          await updateDraft(id, { disableDepthToggle: checked });
          console.log("✅ disableDepthToggle updated to:", checked);
        } catch (err) {
          console.error("❌ Failed to update disableDepthToggle:", err);
          alert("❌ Failed to update disableDepthToggle.");
        }
      }
    }}
    className="w-4 h-4"
  />
  <label htmlFor="disableDepthToggle" className="text-sm text-gray-700">
    Disable Depth Toggle in App
  </label>
</div>


        {/* 🧠 Context Explainers for Overview */}
<div className="mt-6">
  <h3 className="text-lg font-semibold mb-2">Context Explainers (Overview)</h3>
  <p className="text-sm text-gray-500 mb-3">
    Add terms that will be highlighted in the overview for reader context.
  </p>

  {(draft.contexts || []).map((ctx, i) => (
    <div key={i} className="flex gap-2 items-center mb-2">
      <input
        type="text"
        value={ctx.term}
        onChange={(e) => {
          const updated = [...(draft.contexts || [])];
          updated[i].term = e.target.value;
          setDraft({ ...draft, contexts: updated });
        }}
        placeholder="Term"
        className="border p-2 rounded flex-1"
      />
      <input
        type="text"
        value={ctx.explainer}
        onChange={(e) => {
          const updated = [...(draft.contexts || [])];
          updated[i].explainer = e.target.value;
          setDraft({ ...draft, contexts: updated });
        }}
        placeholder="Explainer"
        className="border p-2 rounded flex-[2]"
      />
      <button
        onClick={() => {
          const updated = (draft.contexts || []).filter((_, j) => j !== i);
          setDraft({ ...draft, contexts: updated });
        }}
        className="text-red-500 text-sm hover:underline"
      >
        ✖
      </button>
    </div>
  ))}

  <button
    onClick={() =>
      setDraft({
        ...draft,
        contexts: [...(draft.contexts || []), { term: "", explainer: "" }],
      })
    }
    className="text-blue-600 text-sm hover:underline"
  >
    ➕ Add new context term
  </button>
</div>

{/* ✨ GPT Auto-suggest */}
<button
  onClick={async () => {
    if (!draft.overview) {
      alert("Please write an overview first!");
      return;
    }
    try {
      const confirm = window.confirm("Use GPT to suggest contextual explainers?");
      if (!confirm) return;

      // Optional loading flag
      setSaving(true);
      const { generateContexts } = await import("../utils/gptHelpers");
      const suggested = await generateContexts(draft.overview);

      if (!suggested || suggested.length === 0) {
        alert("No terms found.");
        return;
      }

      const merged = [...(draft.contexts || []), ...suggested];
      setDraft({ ...draft, contexts: merged });
      alert(`✅ Added ${suggested.length} suggested context terms.`);
    } catch (err: any) {
      console.error("❌ GPT error:", err);
      alert("Failed to fetch GPT suggestions. Check console.");
    } finally {
      setSaving(false);
    }
  }}
  className="text-purple-600 text-sm hover:underline mt-2"
>
  ✨ Suggest Contexts with GPT
</button>


        <button
          onClick={saveMetadata}
          disabled={saving}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {saving ? "Saving..." : "Save Metadata"}
        </button>
      </div>

      

      

      {/* TIMELINE */}
<div className="bg-white p-6 rounded-lg shadow">
  <div className="flex justify-between items-center mb-4">
    <h2 className="text-xl font-semibold">Chronology of Events</h2>

    <div className="flex gap-3 items-center">
      {/* 🧠 Generate Timeline */}
      <button
        onClick={handleGenerateTimeline}
        disabled={loadingTimeline}
        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loadingTimeline ? "Generating…" : "🧠 Generate Timeline"}
      </button>


      <button
        type="button"
        className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
        onClick={handleCopyEventsForFactCheck}
        disabled={!draft || !draft.timeline || draft.timeline.length === 0}
      >
        Copy Events for Fact-Check
      </button>

      <button
        type="button"
        className="px-3 py-1 rounded border border-blue-600 text-blue-600 text-sm hover:bg-blue-50 disabled:opacity-50"
        onClick={() => setIsFactCheckModalOpen(true)}
        disabled={!draft || !draft.timeline || draft.timeline.length === 0}
      >
        Apply Fact-Check Results
      </button>

      {/* ➕ Add Event */}
      <button
        onClick={handleAddEvent}
        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
      >
        ➕ Add Event
      </button>

      {/* 💾 Save Timeline */}
<button
  onClick={async () => {
    if (!id || !draft) return;
    try {
      setSaving(true);
      await updateDraft(id, {
        timeline: draft.timeline,
        phases: draft.phases || [],
      });
      setUnsaved(false);
      alert("✅ Timeline saved successfully!");
    } catch (err) {
      console.error("❌ Timeline save failed:", err);
      alert("❌ Failed to save timeline.");
    } finally {
      setSaving(false);
    }
  }}
  className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
>
  💾 Save Timeline
</button>

      {/* 👁️ Toggle Show/Hide */}
      <button
        onClick={() => setShowTimeline(!showTimeline)}
        className="text-sm text-blue-600 hover:underline"
      >
        {showTimeline ? "Hide" : "Show"}
      </button>
    </div>
  </div>

  {showTimeline && (
    <>
      {draft.timeline.length === 0 ? (
        <p className="text-gray-500 mb-3">No events yet.</p>
      ) : (
        <div className="space-y-4 mb-4">
          {draft.timeline.map((ev, i) => (
            <div key={i} className="mb-6">
              {/* Insert Phase button BEFORE this event */}
              <button
                className="text-purple-600 text-xs hover:underline mb-2"
                onClick={() => {
                  const newPhase = {
                    title: "New Phase",
                    startIndex: i,
                    endIndex: i,
                  };
                  const phases = [...(draft.phases || []), newPhase];
                  setDraft({ ...draft, phases });
                  setUnsaved(true);
                }}
              >
                ➕ Insert Phase Here
              </button>

              {/* PHASE EDITOR */}
{(draft.phases || [])
  .filter((p) => p.startIndex === i)
  .map((phase) => {
    const realIdx = (draft.phases || []).indexOf(phase);
    const timelineLength = draft.timeline.length;
    const lastPossible = Math.max(
      phase.startIndex,
      timelineLength > 0 ? timelineLength - 1 : phase.startIndex
    );
    const currentEndValue = Math.min(
      Math.max(phase.startIndex, phase.endIndex ?? phase.startIndex),
      lastPossible
    );
    const startEventLabel =
      draft.timeline[phase.startIndex]?.event ||
      `Event ${phase.startIndex + 1}`;

    return (
      <div
        key={`phase-${realIdx}`}
        className="border border-purple-300 bg-purple-50 p-3 rounded mb-3"
      >
        {/* TITLE INPUT */}
        <input
          value={phase.title || ""}
          onChange={(e) => {
            const phases = [...(draft.phases || [])];
            phases[realIdx] = { ...phase, title: e.target.value };
            setDraft({ ...draft, phases });
            setUnsaved(true);
          }}
          className="border p-2 rounded w-full"
          placeholder="Phase title"
        />

        <p className="text-xs text-gray-600 mt-1">
          Starts at event #{phase.startIndex + 1}: {startEventLabel}
        </p>

        <label className="text-xs text-gray-600 mt-2 block">
          End this phase after event
          <select
            className="border p-2 rounded w-full mt-1 text-sm"
            value={currentEndValue}
            onChange={(e) => {
              const nextValue = Number(e.target.value);
              const safeValue = Math.max(phase.startIndex, nextValue);
              const phases = [...(draft.phases || [])];
              phases[realIdx] = { ...phase, endIndex: safeValue };
              setDraft({ ...draft, phases });
              setUnsaved(true);
            }}
          >
            {draft.timeline.map((ev, idx) => (
              <option
                key={`phase-${realIdx}-end-${idx}`}
                value={idx}
                disabled={idx < phase.startIndex}
              >
                #{idx + 1} · {ev.event || `Event ${idx + 1}`}
              </option>
            ))}
          </select>
        </label>

        {/* DELETE PHASE */}
        <button
          className="text-red-600 text-xs mt-1 hover:underline"
          onClick={() => {
            const phases = (draft.phases || []).filter(
              (_, idx) => idx !== realIdx
            );
            setDraft({ ...draft, phases });
            setUnsaved(true);
          }}
        >
          ✖ Remove Phase
        </button>
      </div>
    );
  })}


              <div className="border p-3 rounded">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                <input
                  value={ev.date || ""}
                  onChange={(e) =>
                    handleUpdateEvent(i, "date", e.target.value)
                  }
                  placeholder="Date"
                  className="border p-2 rounded"
                />
                <input
                  value={ev.event}
                  onChange={(e) =>
                    handleUpdateEvent(i, "event", e.target.value)
                  }
                  placeholder="Event"
                  className="border p-2 rounded"
                />
                <input
                  value={ev.imageUrl || ""}
                  onChange={(e) =>
                    handleUpdateEvent(i, "imageUrl", e.target.value)
                  }
                  placeholder="Image URL"
                  className="border p-2 rounded"
                />
                {/* 🔗 Multiple Source Links */}
<div className="space-y-2">
  <label className="text-sm font-medium text-gray-700">Sources</label>

  {(ev.sources || []).map((src, j) => (
    <div key={j} className="flex gap-2 items-center">
      <input
        value={src.link}
        onChange={(e) => {
          const newSources = [...(ev.sources || [])];
          newSources[j].link = e.target.value;
          handleUpdateEvent(i, "sources", newSources);
        }}
        placeholder={`Source link #${j + 1}`}
        className="border p-2 rounded w-full"
      />
      <button
        onClick={() => {
          const newSources = (ev.sources || []).filter((_, idx) => idx !== j);
          handleUpdateEvent(i, "sources", newSources);
        }}
        className="text-red-600 text-sm hover:underline"
      >
        ✖
      </button>
    </div>
  ))}

  <button
    onClick={() => {
      const newSources = [...(ev.sources || []), { title: "", link: "", sourceName: "" }];
      handleUpdateEvent(i, "sources", newSources);
    }}
    className="text-blue-600 text-sm hover:underline"
  >
    ➕ Add another link
  </button>
</div>

              </div>

              <textarea
                value={ev.description || ""}
                onChange={(e) => {
                  handleUpdateEvent(i, "description", e.target.value);
                }}
                onSelect={(e) =>
                  rememberSelection(
                    `timeline-${i}`,
                    e.target as HTMLTextAreaElement
                  )
                }
                placeholder="Description"
                rows={2}
                className="border p-2 rounded w-full mb-2"
              />

              {/* 🔗 Link selected text */}
              <button
                onClick={() =>
                  insertInternalLinkToken(
                    `timeline-${i}`,
                    ev.description || "",
                    (next) => {
                      const updatedTimeline = [...draft.timeline];
                      updatedTimeline[i] = { ...ev, description: next };
                      setDraft({ ...draft, timeline: updatedTimeline });
                    }
                  )
                }
                className="text-blue-600 text-xs hover:underline mb-2"
              >
                🔗 Link selected text
              </button>

{/* Preview of description with clickable links */}
<div className="text-sm text-gray-700 mt-2">
{renderLinkedText(ev.description ?? "")}
</div>

              {ev.factCheck && typeof ev.factCheck.confidenceScore === "number" && (
                <div className="mt-3 text-xs text-gray-700 border-t pt-2 border-dashed border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={
                        "inline-flex items-center px-2 py-0.5 rounded-full font-semibold " +
                        getFactCheckBadgeClass(ev.factCheck.confidenceScore)
                      }
                    >
                      {ev.factCheck.confidenceScore}% fact-check confidence
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        backgroundColor: getFactCheckDotColor(
                          ev.factCheck.confidenceScore
                        ),
                      }}
                    ></span>
                  </div>
                  {ev.factCheck.explanation && (
                    <p className="leading-snug">{ev.factCheck.explanation}</p>
                  )}
                  {ev.factCheck.lastCheckedAt && (
                    <p className="mt-1 text-[10px] text-gray-400">
                      Last checked:{" "}
                      {new Date(ev.factCheck.lastCheckedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {/* 🧠 Context Explainers for this Event */}
<div className="mt-2">
  <h4 className="text-sm font-medium mb-1">Context Explainers</h4>
  {(ev.contexts || []).map((ctx, j) => (
    <div key={j} className="flex gap-2 items-center mb-1">
      <input
        type="text"
        value={ctx.term}
        onChange={(e) => {
          const newContexts = [...(ev.contexts || [])];
          newContexts[j].term = e.target.value;
          handleUpdateEvent(i, "contexts", newContexts);
        }}
        placeholder="Term"
        className="border p-1 rounded flex-1"
      />
      <input
        type="text"
        value={ctx.explainer}
        onChange={(e) => {
          const newContexts = [...(ev.contexts || [])];
          newContexts[j].explainer = e.target.value;
          handleUpdateEvent(i, "contexts", newContexts);
        }}
        placeholder="Explainer"
        className="border p-1 rounded flex-[2]"
      />
      <button
        onClick={() => {
          const newContexts = (ev.contexts || []).filter((_, k) => k !== j);
          handleUpdateEvent(i, "contexts", newContexts);
        }}
        className="text-red-600 text-xs hover:underline"
      >
        ✖
      </button>
    </div>
  ))}
  <button
    onClick={() => {
      const newContexts = [...(ev.contexts || []), { term: "", explainer: "" }];
      handleUpdateEvent(i, "contexts", newContexts);
    }}
    className="text-blue-600 text-xs hover:underline"
  >
    ➕ Add term
  </button>
</div>

{/* ✨ GPT Context Auto-Suggest for this Event */}
<button
  onClick={async () => {
    try {
      setSaving(true);
      const suggested = await generateContextsForTimelineEvent(ev);
      if (!suggested?.length) {
        alert("No contextual terms found for this event.");
        return;
      }

      const merged = [...(ev.contexts || []), ...suggested];
      handleUpdateEvent(i, "contexts", merged);
      alert(`✅ Added ${suggested.length} contextual explainers for this event.`);
    } catch (err) {
      console.error("GPT error (event contexts):", err);
      alert("❌ Failed to generate contexts for this event.");
    } finally {
      setSaving(false);
    }
  }}
  className="text-purple-600 text-xs hover:underline mt-1 block"
>
  ✨ Suggest Contexts with GPT
</button>


{/* ✨ GPT Explainer Generator for this event */}
<button
  onClick={async () => {
    const eventTitle = ev.event?.trim();
    const eventDescription = ev.description?.trim();

    if (!eventTitle || !eventDescription) {
      alert("Please add an event title and description first.");
      return;
    }

    const eventData = {
      event: eventTitle,
      description: eventDescription,
      contexts: ev.contexts || [],
    };

    if (!eventData.contexts.length) {
      alert("Please add at least one term first.");
      return;
    }

    try {
      setSaving(true);
      const { generateExplainersForEvent } = await import("../utils/gptHelpers");
      const suggested = await generateExplainersForEvent(eventData);

      if (!suggested.length) {
        alert("No explainers returned.");
        return;
      }

      // Merge GPT explainers into event’s contexts
      const merged = (eventData.contexts || []).map((ctx) => {
        const found = suggested.find(
          (s) => s.term.toLowerCase() === ctx.term.toLowerCase()
        );
        return found ? { ...ctx, explainer: found.explainer } : ctx;
      });

      handleUpdateEvent(i, "contexts", merged);
      alert(`✅ Added ${suggested.length} explainers.`);
    } catch (err: any) {
      console.error("GPT error:", err);
      alert("Failed to generate explainers for this event.");
    } finally {
      setSaving(false);
    }
  }}
                        className="text-purple-600 text-xs hover:underline mt-2 block"
>
  ✨ Generate Explainers for this Event
</button>

              {/* Event FAQs */}
              <div className="mt-3">
                <h4 className="text-sm font-medium mb-2">Event FAQs</h4>
                {(ev.faqs || []).map((faq, faqIdx) => (
                  <div
                    key={faqIdx}
                    className="flex flex-col md:flex-row gap-2 mb-2"
                  >
                    <input
                      type="text"
                      value={faq.question || ""}
                      onChange={(e) => {
                        const nextFaqs = [...(ev.faqs || [])];
                        nextFaqs[faqIdx] = {
                          ...nextFaqs[faqIdx],
                          question: e.target.value,
                        };
                        handleUpdateEvent(i, "faqs", nextFaqs);
                      }}
                      placeholder="Question"
                      className="border p-2 rounded flex-1"
                    />
                    <textarea
                      value={faq.answer || ""}
                      onChange={(e) => {
                        const nextFaqs = [...(ev.faqs || [])];
                        nextFaqs[faqIdx] = {
                          ...nextFaqs[faqIdx],
                          answer: e.target.value,
                        };
                        handleUpdateEvent(i, "faqs", nextFaqs);
                      }}
                      placeholder="Answer"
                      rows={2}
                      className="border p-2 rounded flex-[2]"
                    />
                    <button
                      onClick={() => {
                        const nextFaqs = (ev.faqs || []).filter(
                          (_, idx) => idx !== faqIdx
                        );
                        handleUpdateEvent(i, "faqs", nextFaqs);
                      }}
                      className="text-red-600 text-sm hover:underline self-start"
                    >
                      ✖
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const nextFaqs = [...(ev.faqs || []), { question: "", answer: "" }];
                    handleUpdateEvent(i, "faqs", nextFaqs);
                  }}
                  className="text-blue-600 text-sm hover:underline"
                >
                  ➕ Add FAQ
                </button>
              </div>

              <label className="block text-sm text-gray-600 mb-1">
                Importance
              </label>
              <select
                value={ev.significance}
                onChange={(e) =>
                  handleUpdateEvent(i, "significance", Number(e.target.value))
                }
                className="border p-2 rounded mb-2"
              >
                <option value={1}>Low</option>
                <option value={2}>Medium</option>
                <option value={3}>High</option>
              </select>

              {/* Buttons */}
<div className="flex gap-4 items-center mt-2">
  <button
    onClick={() => handleDeleteEvent(i)}
    className="text-red-600 text-sm hover:underline"
  >
    Delete
  </button>

  <button
    onClick={() => handleFetchCoverage(i, ev)}
    className="text-blue-600 text-sm hover:underline"
  >
    🔗 Fetch Top Sources
  </button>

  

  <button
    onClick={async () => {
      if (!id) return;
      try {
        setSaving(true);
        await updateTimelineEvent(id, i, draft.timeline[i]);
        setUnsaved(false);
        alert("✅ Event saved!");
      } catch (err) {
        console.error(err);
        alert("❌ Failed to save event.");
      } finally {
        setSaving(false);
      }
    }}
    className="text-green-600 text-sm hover:underline"
  >
    💾 Save Event
  </button>
</div>



              {/* Top Sources */}
              {ev.sources && ev.sources.length > 0 && (
                <div className="mt-3 border-t pt-2">
                  <h4 className="text-sm font-semibold mb-2">Top Sources:</h4>
                  <div className="space-y-2">
                    {ev.sources.map((s: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center space-x-3 border p-2 rounded-md hover:bg-gray-50"
                      >
                        {(() => {
  const faviconKit = getFaviconUrl(s.link);
  const fallback = getFallbackFavicon(s.link);
  const initials = getInitials(s.sourceName || s.title || "");

  return (
    <>
      {/* FaviconKit → fallback → initials */}
      <img
        src={faviconKit || ""}
        className="w-10 h-10 object-cover rounded bg-gray-100"
        onError={(e) => {
          if (e.currentTarget.src !== fallback) {
            e.currentTarget.src = fallback || "";
          } else {
            e.currentTarget.style.display = "none";
          }
        }}
        style={{ display: faviconKit ? "block" : "none" }}
        alt={s.sourceName || "source"}
      />

      {/* If favicon hidden → show initials */}
      {!faviconKit && (
        <div className="w-10 h-10 rounded bg-gray-800 text-white flex items-center justify-center">
          {initials}
        </div>
      )}
    </>
  );
})()}

                        <div className="flex flex-col">
                          <a
                            href={s.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 font-medium hover:underline"
                          >
                            {s.title}
                          </a>
                          <span className="text-gray-500 text-xs">
                            {s.sourceName}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          ))}
        </div>
      )}
    </>
  )}
</div>

      {/* ANALYSIS */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Analysis</h2>
          <button
            onClick={handleGenerateAnalysis}
            disabled={loadingAnalysis}
            className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {loadingAnalysis ? "Generating…" : "🧠 Generate Analysis"}
          </button>
        </div>

        {showAnalysis && (
          <div className="space-y-4">
            {["stakeholders", "faqs", "future"].map((sectionKey) => {
              const analysis = draft.analysis as Record<string, any>;
              const section = analysis?.[sectionKey] || [];
              const labels: Record<string, string> = {
                stakeholders: "Stakeholders",
                faqs: "FAQs",
                future: "Future Questions",
              };

              return (
                <details key={sectionKey} className="border rounded-lg p-3 group">
                  <summary className="cursor-pointer font-semibold text-blue-700 select-none flex justify-between items-center">
                    {labels[sectionKey]}
                    <span className="text-gray-500 group-open:rotate-90 transition-transform">
                      ▶
                    </span>
                  </summary>

                  <div className="mt-2 space-y-3">
                    {/* ➕ Add button */}
                    <button
                      onClick={() => {
                        const updated = { ...draft };
                        const list = analysis?.[sectionKey] || [];
                        const newItem =
                          sectionKey === "stakeholders"
                            ? { name: "", detail: "" }
                            : { question: "", answer: "" };
                        updated.analysis = {
                          ...analysis,
                          [sectionKey]: [...list, newItem],
                        };
                        setDraft(updated);
                      }}
                      className="text-sm text-green-700 hover:underline"
                    >
                      ➕ Add {labels[sectionKey].slice(0, -1)}
                    </button>

                    {/* ✨ GPT Suggest Contexts for Analysis Section */}
<button
  onClick={async () => {
    const sectionItems = draft.analysis?.[sectionKey] || [];
    if (!sectionItems.length) {
      alert("No items to analyze yet.");
      return;
    }

    try {
      setSaving(true);
      const suggested = await generateContextsForAnalysis(sectionKey, sectionItems);
      if (!suggested?.length) {
        alert("No contextual terms found.");
        return;
      }

      const nextAnalysis = { ...(draft.analysis || {}) };
      const mergedContexts = [...(nextAnalysis.contexts || []), ...suggested];
      nextAnalysis.contexts = mergedContexts;
      setDraft({ ...draft, analysis: nextAnalysis });
      alert(`✅ Added ${suggested.length} contextual explainers from ${sectionKey}.`);
    } catch (err) {
      console.error("GPT error (analysis contexts):", err);
      alert("❌ Failed to generate analysis contexts.");
    } finally {
      setSaving(false);
    }
  }}
  className="text-purple-600 text-xs hover:underline mt-1 block"
>
  ✨ Suggest Contexts with GPT
</button>


                    {/* Items list */}
                    {section.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No {labels[sectionKey]} yet.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {section.map((item: any, idx: number) => (
                          <li
                            key={idx}
                            className="p-3 bg-gray-50 rounded-md border text-sm space-y-2"
                          >
                            {sectionKey === "stakeholders" ? (
                              <>
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => {
                                    const updated = { ...draft };
                                    (
                                      (updated.analysis as Record<string, any>)[
                                      sectionKey
                                      ][idx]
                                    ).name = e.target.value;
                                    setDraft(updated);
                                  }}
                                  onSelect={(e) =>
                                    rememberSelection(
                                      `stakeholder-name-${idx}`,
                                      e.target as HTMLInputElement
                                    )
                                  }
                                  placeholder="Name"
                                  className="w-full border p-1 rounded"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    insertInternalLinkToken(
                                      `stakeholder-name-${idx}`,
                                      item.name || "",
                                      (next) => {
                                        const updated = { ...draft };
                                        (
                                          (updated.analysis as Record<string, any>)[
                                            sectionKey
                                          ][idx]
                                        ).name = next;
                                        setDraft(updated);
                                      }
                                    )
                                  }
                                  className="text-xs text-blue-600 hover:underline mt-1 text-left"
                                >
                                  🔗 Link selected text
                                </button>
                                <textarea
                                  value={item.detail}
                                  onChange={(e) => {
                                    const updated = { ...draft };
                                    (
                                      (updated.analysis as Record<string, any>)[
                                      sectionKey
                                      ][idx]
                                    ).detail = e.target.value;
                                    setDraft(updated);
                                  }}
                                  onSelect={(e) =>
                                    rememberSelection(
                                      `stakeholder-detail-${idx}`,
                                      e.target as HTMLTextAreaElement
                                    )
                                  }
                                  placeholder="Detail"
                                  className="w-full border p-1 rounded"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    insertInternalLinkToken(
                                      `stakeholder-detail-${idx}`,
                                      item.detail || "",
                                      (next) => {
                                        const updated = { ...draft };
                                        (
                                          (updated.analysis as Record<string, any>)[
                                            sectionKey
                                          ][idx]
                                        ).detail = next;
                                        setDraft(updated);
                                      }
                                    )
                                  }
                                  className="text-xs text-blue-600 hover:underline mt-1 text-left"
                                >
                                  🔗 Link selected text
                                </button>
                              </>
                            ) : (
                              <>
                                <input
                                  type="text"
                                  value={item.question}
                                  onChange={(e) => {
                                    const updated = { ...draft };
                                    (
                                      (updated.analysis as Record<string, any>)[
                                      sectionKey
                                      ][idx]
                                    ).question = e.target.value;
                                    setDraft(updated);
                                  }}
                                  onSelect={(e) =>
                                    rememberSelection(
                                      `${sectionKey}-question-${idx}`,
                                      e.target as HTMLInputElement
                                    )
                                  }
                                  placeholder="Question"
                                  className="w-full border p-1 rounded"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    insertInternalLinkToken(
                                      `${sectionKey}-question-${idx}`,
                                      item.question || "",
                                      (next) => {
                                        const updated = { ...draft };
                                        (
                                          (updated.analysis as Record<string, any>)[
                                            sectionKey
                                          ][idx]
                                        ).question = next;
                                        setDraft(updated);
                                      }
                                    )
                                  }
                                  className="text-xs text-blue-600 hover:underline mt-1 text-left"
                                >
                                  🔗 Link selected text
                                </button>
                                <textarea
                                  value={item.answer}
                                  onChange={(e) => {
                                    const updated = { ...draft };
                                    (
                                      (updated.analysis as Record<string, any>)[
                                      sectionKey
                                      ][idx]
                                    ).answer = e.target.value;
                                    setDraft(updated);
                                  }}
                                  onSelect={(e) =>
                                    rememberSelection(
                                      `${sectionKey}-answer-${idx}`,
                                      e.target as HTMLTextAreaElement
                                    )
                                  }
                                  placeholder="Answer"
                                  className="w-full border p-1 rounded"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    insertInternalLinkToken(
                                      `${sectionKey}-answer-${idx}`,
                                      item.answer || "",
                                      (next) => {
                                        const updated = { ...draft };
                                        (
                                          (updated.analysis as Record<string, any>)[
                                            sectionKey
                                          ][idx]
                                        ).answer = next;
                                        setDraft(updated);
                                      }
                                    )
                                  }
                                  className="text-xs text-blue-600 hover:underline mt-1 text-left"
                                >
                                  🔗 Link selected text
                                </button>
                              </>
                            )}

                        

                            {/* ❌ Delete button */}
                            <button
                              onClick={() => {
                                const updated = { ...draft };
                                const list = [...(analysis?.[sectionKey] || [])];
                                list.splice(idx, 1);
                                updated.analysis = {
                                  ...analysis,
                                  [sectionKey]: list,
                                };
                                setDraft(updated);
                              }}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Delete
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}

        <div className="mt-6 border-t pt-4">
          <h3 className="text-lg font-semibold mb-2">
            Analysis Context Explainers
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            These terms will be highlighted within Stakeholders, FAQs, and Future sections.
          </p>

          {(draft.analysis?.contexts || []).map((ctx: any, idx: number) => (
            <div key={idx} className="flex gap-2 items-center mb-2">
              <input
                type="text"
                value={ctx.term}
                onChange={(e) => {
                  const nextAnalysis = { ...(draft.analysis || {}) };
                  const updatedContexts = [...(nextAnalysis.contexts || [])];
                  updatedContexts[idx] = {
                    ...updatedContexts[idx],
                    term: e.target.value,
                  };
                  nextAnalysis.contexts = updatedContexts;
                  setDraft({ ...draft, analysis: nextAnalysis });
                }}
                placeholder="Term"
                className="border p-2 rounded flex-1"
              />
              <input
                type="text"
                value={ctx.explainer}
                onChange={(e) => {
                  const nextAnalysis = { ...(draft.analysis || {}) };
                  const updatedContexts = [...(nextAnalysis.contexts || [])];
                  updatedContexts[idx] = {
                    ...updatedContexts[idx],
                    explainer: e.target.value,
                  };
                  nextAnalysis.contexts = updatedContexts;
                  setDraft({ ...draft, analysis: nextAnalysis });
                }}
                placeholder="Explainer"
                className="border p-2 rounded flex-[2]"
              />
              <button
                type="button"
                onClick={() => {
                  const nextAnalysis = { ...(draft.analysis || {}) };
                  const updatedContexts = (nextAnalysis.contexts || []).filter(
                    (_: any, i: number) => i !== idx
                  );
                  nextAnalysis.contexts = updatedContexts;
                  setDraft({ ...draft, analysis: nextAnalysis });
                }}
                className="text-red-600 text-sm hover:underline"
              >
                ✖
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => {
              const nextAnalysis = { ...(draft.analysis || {}) };
              nextAnalysis.contexts = [
                ...(nextAnalysis.contexts || []),
                { term: "", explainer: "" },
              ];
              setDraft({ ...draft, analysis: nextAnalysis });
            }}
            className="text-blue-600 text-sm hover:underline"
          >
            ➕ Add analysis context term
          </button>
        </div>

              {/* 💾 Save button */}
      <button
        onClick={async () => {
          if (!id) return;
          try {
            await updateDraft(id, { analysis: draft.analysis });
            setUnsaved(false);
            alert("✅ Analysis saved successfully!");
          } catch (err: any) {
            console.error(err);
            alert("❌ Failed to save analysis: " + err.message);
          }
        }}
        className="mt-4 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
      >
        💾 Save Analysis
      </button>
    </div>
  </div>
    {isFactCheckModalOpen && (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-4">
          <h2 className="text-lg font-semibold mb-2">Apply Fact-Check Results</h2>
          <p className="text-sm text-gray-600 mb-3">
            Paste the JSON array returned by ChatGPT. Each item should include
            <code className="bg-gray-100 px-1 mx-1 rounded">id</code>,
            <code className="bg-gray-100 px-1 mx-1 rounded">confidenceScore</code>
            and
            <code className="bg-gray-100 px-1 mx-1 rounded">
              confidenceExplanation
            </code>
            .
          </p>

          <textarea
            className="w-full h-64 border rounded p-2 font-mono text-xs"
            value={factCheckJson}
            onChange={(e) => setFactCheckJson(e.target.value)}
            placeholder='[{"id":"event-1","confidenceScore":88,"confidenceExplanation":"..."}]'
          />

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="px-3 py-1 rounded border text-sm"
              onClick={() => {
                setIsFactCheckModalOpen(false);
                setFactCheckJson("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
              onClick={handleApplyFactCheckResults}
              disabled={saving}
            >
              {saving ? "Applying..." : "Apply"}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
