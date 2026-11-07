"use client";

import { useCallback } from "react";

interface CitationLinkProps {
  sourceId: string;
  sourceTitle: string;
  index: number;
}

export function CitationLink({ sourceId, sourceTitle, index }: CitationLinkProps) {
  const handleClick = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("notebook:highlight-source", { detail: { sourceId } })
    );
  }, [sourceId]);

  return (
    <button
      onClick={handleClick}
      title={sourceTitle}
      className="inline-flex items-center justify-center text-blue-400 hover:text-cyan-400 underline decoration-dotted cursor-pointer text-xs font-medium transition-colors"
    >
      [{index}]
    </button>
  );
}
