// src/utils/analysis.ts (new helper file)
import type { AnalysisSection } from "./firestoreHelpers";

export function ensureAnalysis(a?: Partial<AnalysisSection>): AnalysisSection {
  return {
    stakeholders: a?.stakeholders ?? [],
    faqs:         a?.faqs ?? [],
    future:       a?.future ?? [],
  };
}
