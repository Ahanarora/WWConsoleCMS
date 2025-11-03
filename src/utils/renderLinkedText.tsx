// --------------------------------------------
// src/utils/renderLinkedText.tsx
// --------------------------------------------
import React from "react";
import { Link } from "react-router-dom";

export function renderLinkedText(text: string) {
  if (!text) return null;

  // Split the text into normal and linked parts
  const parts = text.split(/(\[.*?\]\(@(story|theme)\/[A-Za-z0-9_-]+\))/g);

  return parts.map((part, i) => {
    const match = part.match(/\[(.*?)\]\(@(story|theme)\/([A-Za-z0-9_-]+)\)/);
    if (!match) return <span key={i}>{part}</span>;

    const [, label, type, id] = match;
    const path = type === "story" ? `/story/${id}` : `/theme/${id}`;

    return (
      <Link
        key={i}
        to={path}
        className="text-blue-600 hover:underline font-medium"
      >
        {label}
      </Link>
    );
  });
}
