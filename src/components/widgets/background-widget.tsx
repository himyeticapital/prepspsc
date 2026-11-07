"use client";

import { useState } from "react";
import { Check, ImageOff } from "lucide-react";
import { useWidgetStore } from "@/stores/widget-store";
import { BACKGROUNDS } from "@/types/widget.types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

function BackgroundThumbnail({ src, alt }: { src: string; alt: string }) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (hasError) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center">
        <ImageOff className="w-6 h-6 text-white/30" />
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={cn(
          "w-full h-full object-cover transition-opacity",
          isLoading ? "opacity-0" : "opacity-100"
        )}
        loading="lazy"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
      />
    </>
  );
}

export function BackgroundWidget() {
  const { currentBackground, setBackground } = useWidgetStore();

  return (
    <div className="p-4">
      <p className="text-xs text-white/50 mb-3">Choose your study ambiance</p>

      <ScrollArea className="h-[320px] pr-2">
        <div className="grid grid-cols-2 gap-3">
          {BACKGROUNDS.map((bg) => {
            const isSelected = currentBackground === bg.url;
            const isSolid = bg.url.startsWith("solid:");
            const solidColor = isSolid ? bg.url.replace("solid:", "") : null;

            return (
              <button
                key={bg.id}
                onClick={() => setBackground(bg.url)}
                className={cn(
                  "relative aspect-video rounded-xl overflow-hidden",
                  "ring-2 ring-offset-2 ring-offset-zinc-900 transition-all",
                  isSelected ? "ring-primary" : "ring-transparent hover:ring-white/30"
                )}
              >
                {isSolid ? (
                  // Solid color background
                  <div
                    className="w-full h-full"
                    style={{ backgroundColor: solidColor || "#000" }}
                  />
                ) : (
                  // Image background with error handling
                  <BackgroundThumbnail src={bg.thumbnail} alt={bg.name} />
                )}

                {/* Overlay with name */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2">
                  <span className="text-xs text-white font-medium">{bg.name}</span>
                </div>

                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Info */}
      <p className="text-xs text-white/30 mt-4 text-center">
        Background changes are saved automatically
      </p>
    </div>
  );
}
