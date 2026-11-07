"use client";

import { useEffect } from "react";

export default function TestsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[tests/error.tsx]", error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-xl font-bold text-white">Something went wrong!</h2>
      <pre className="text-sm text-red-400 bg-red-500/10 p-4 rounded-lg max-w-xl overflow-auto whitespace-pre-wrap">
        {error.message}
        {error.digest && `\nDigest: ${error.digest}`}
        {error.stack && `\n\n${error.stack}`}
      </pre>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}
