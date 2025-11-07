// src/utils/renderLinkedText.tsx
import React from "react";
import { Link } from "react-router-dom";

/**
 * Renders text that may contain:
 * - [Label](@story/abc123)
 * - [Label](@theme/xyz456)
 * - [Reuters](https://reuters.com)
 * into clickable links in the CMS.
 */
export function renderLinkedText(text: string) {
  if (!text) return <span>{text}</span>;

  // ✅ Fix nested GPT-style patterns like:
  // [$34 billion ](@[US Tariff Saga 2025](@story/6Xp1NZb08do99XBaaIgV))
  const cleaned = text.replace(
    /\]\(@\[([^\]]+)\]\(@(story|theme)\/([A-Za-z0-9_-]+)\)\)/g,
    "](@$2/$3)"
  );

  // Match [label](target)
  const regex =
    /\[([^\]]+)\]\((@(?:story|theme)\/[A-Za-z0-9_-]+|https?:\/\/[^\s)]+)\)/g;

  type Node =
    | { type: "text"; value: string }
    | { type: "link"; label: string; target: string };

  const nodes: Node[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cleaned)) !== null) {
    const [full, label, target] = match;
    const before = cleaned.slice(lastIndex, match.index);
    if (before) nodes.push({ type: "text", value: before });
    nodes.push({ type: "link", label, target });
    lastIndex = match.index + full.length;
  }

  if (lastIndex < cleaned.length) {
    nodes.push({ type: "text", value: cleaned.slice(lastIndex) });
  }

  return (
    <span style={{ display: "inline", flexWrap: "wrap", lineHeight: "1.6" }}>
      {nodes.map((n, i) => {
        if (n.type === "text") {
          return <span key={i}>{n.value}</span>;
        }

        const { label, target } = n;
        const isInternal =
          target.startsWith("@story/") || target.startsWith("@theme/");
        const isTheme = target.startsWith("@theme/");
        const id = isInternal ? target.split("/")[1] : "";

        if (isInternal) {
          return (
            <Link
              key={i}
              to={`/${isTheme ? "themes" : "stories"}/${id}`}
              style={{
                color: "#2563EB",
                textDecoration: "underline",
                marginRight: 2,
              }}
            >
              {label}
            </Link>
          );
        }

        // External link
        return (
          <a
            key={i}
            href={target}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#2563EB",
              textDecoration: "underline",
              marginRight: 2,
            }}
          >
            {label}
          </a>
        );
      })}
    </span>
  );
}
