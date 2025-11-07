// src/utils/renderLinkedText.tsx
import React from "react";
import { Link } from "react-router-dom";

/**
 * Converts markdown-style links into clickable React Router or external <a> links.
 * Examples:
 *   [Title](@story/abc123)
 *   [Title](@theme/xyz456)
 *   [Title](https://example.com)
 */
export function renderLinkedText(text: string): React.ReactNode {
  if (!text) return null;

  const pattern =
    /\[([^\]]+)\]\((@(?:story|theme)\/[A-Za-z0-9_-]+|https?:\/\/[^\s)]+)\)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const [full, label, target] = match;
    const before = text.slice(lastIndex, match.index);
    if (before) parts.push(<span key={lastIndex}>{before}</span>);

    if (target.startsWith("@story/")) {
      const id = target.replace("@story/", "");
      parts.push(
        <Link
          key={match.index}
          to={`/story/${id}`}
          className="text-blue-600 hover:underline"
        >
          {label}
        </Link>
      );
    } else if (target.startsWith("@theme/")) {
      const id = target.replace("@theme/", "");
      parts.push(
        <Link
          key={match.index}
          to={`/theme/${id}`}
          className="text-blue-600 hover:underline"
        >
          {label}
        </Link>
      );
    } else {
      parts.push(
        <a
          key={match.index}
          href={target}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {label}
        </a>
      );
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < text.length)
    parts.push(<span key="end">{text.slice(lastIndex)}</span>);

  return <>{parts}</>;
}
