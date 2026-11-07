"use client";

import { useEffect, useRef, useState } from "react";
import { useWidgetStore } from "@/stores/widget-store";
import { LOFI_STREAMS } from "@/types/widget.types";

// YouTube IFrame API types
declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        options: {
          height: string;
          width: string;
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  setVolume: (volume: number) => void;
  loadVideoById: (videoId: string) => void;
  cueVideoById: (videoId: string) => void;
  destroy: () => void;
  getPlayerState: () => number;
}

/**
 * MusicProvider - Persistent YouTube player that stays mounted
 * This component should be placed in the root layout so the player
 * persists across page navigations and widget open/close states.
 */
export function MusicProvider() {
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const playerRef = useRef<YTPlayer | null>(null);
  const initAttempted = useRef(false);

  // Subscribe to store state
  const isMusicPlaying = useWidgetStore((state) => state.isMusicPlaying);
  const currentStreamIndex = useWidgetStore((state) => state.currentStreamIndex);
  const volume = useWidgetStore((state) => state.volume);

  const currentStream = LOFI_STREAMS[currentStreamIndex];

  // Load YouTube IFrame API and initialize player (runs once)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (playerRef.current) return;
    if (initAttempted.current) return;

    const createPlayer = () => {
      if (playerRef.current) return;
      if (initAttempted.current) return;

      const existingElement = document.getElementById("yt-music-player");
      if (!existingElement) {
        console.error("YouTube player element not found");
        return;
      }

      initAttempted.current = true;

      try {
        playerRef.current = new window.YT.Player("yt-music-player", {
          height: "200",
          width: "200",
          videoId: LOFI_STREAMS[0].youtubeId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              console.log("YouTube player ready (MusicProvider)");
              setIsPlayerReady(true);
              const state = useWidgetStore.getState();
              event.target.setVolume(state.volume);
            },
            onStateChange: (event) => {
              if (event.data === 1) {
                console.log("YouTube player is playing");
              } else if (event.data === 0) {
                // Video ended, replay
                playerRef.current?.playVideo();
              }
            },
            onError: (event) => {
              console.error("YouTube player error:", event.data);
            },
          },
        });
      } catch (e) {
        console.error("Failed to create YouTube player:", e);
      }
    };

    // Load API if not already loaded
    if (!window.YT || !window.YT.Player) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = createPlayer;
    } else {
      setTimeout(createPlayer, 100);
    }

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // Ignore
        }
        playerRef.current = null;
        setIsPlayerReady(false);
        initAttempted.current = false;
      }
    };
  }, []);

  // Handle play/pause
  useEffect(() => {
    if (!playerRef.current || !isPlayerReady) return;

    try {
      if (isMusicPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    } catch (e) {
      console.error("Error controlling playback:", e);
    }
  }, [isMusicPlaying, isPlayerReady]);

  // Handle volume change
  useEffect(() => {
    if (!playerRef.current || !isPlayerReady) return;

    try {
      playerRef.current.setVolume(volume);
    } catch (e) {
      console.error("Error setting volume:", e);
    }
  }, [volume, isPlayerReady]);

  // Handle stream change
  useEffect(() => {
    if (!playerRef.current || !isPlayerReady) return;

    try {
      if (isMusicPlaying) {
        // If playing, load and play the new stream
        playerRef.current.loadVideoById(currentStream.youtubeId);
      } else {
        // If paused, just cue the video (doesn't auto-play)
        playerRef.current.cueVideoById(currentStream.youtubeId);
      }
    } catch (e) {
      console.error("Error changing stream:", e);
    }
  }, [currentStreamIndex, currentStream.youtubeId, isPlayerReady, isMusicPlaying]);

  // Render hidden YouTube player element
  return (
    <div
      className="fixed -left-[9999px] -top-[9999px] w-[200px] h-[200px] overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      <div id="yt-music-player" />
    </div>
  );
}
