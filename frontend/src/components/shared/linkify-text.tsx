"use client";

import { Fragment } from "react";
import { ExternalLink } from "lucide-react";

const URL_REGEX =
  /https?:\/\/[^\s,)}\]]+/g;

interface LinkifyTextProps {
  text: string;
  className?: string;
}

/**
 * Renders text with auto-linked URLs.
 * URLs become clickable links that open in a new tab.
 */
export function LinkifyText({ text, className }: LinkifyTextProps) {
  const parts: (string | { url: string; key: number })[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push({ url: match[0], key: key++ });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return (
    <span className={className}>
      {parts.map((part) =>
        typeof part === "string" ? (
          part
        ) : (
          <a
            key={part.key}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1 break-all"
          >
            {part.url}
            <ExternalLink className="h-3 w-3 flex-shrink-0 inline" />
          </a>
        )
      )}
    </span>
  );
}
