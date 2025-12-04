export const normalizeTag = (str: string): string =>
  str.trim().toLowerCase().replace(/\s+/g, "-");

export const dedupeTags = (arr: string[]): string[] =>
  Array.from(new Set(arr.map(normalizeTag).filter(Boolean)));
