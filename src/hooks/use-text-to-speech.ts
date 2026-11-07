"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseTextToSpeechOptions {
  defaultRate?: number;
  defaultVoiceLang?: string;
}

interface UseTextToSpeechReturn {
  // State
  isSpeaking: boolean;
  isPaused: boolean;
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  rate: number;
  currentMessageId: number | null;

  // Actions
  speak: (text: string, messageId?: number) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  setSelectedVoice: (voice: SpeechSynthesisVoice | null) => void;
  setRate: (rate: number) => void;
}

// Check if browser supports Web Speech Synthesis API
const isSpeechSynthesisSupported = () => {
  if (typeof window === "undefined") return false;
  return "speechSynthesis" in window;
};

// Strip markdown formatting for cleaner TTS
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1") // Bold
    .replace(/\*(.*?)\*/g, "$1") // Italic
    .replace(/`(.*?)`/g, "$1") // Inline code
    .replace(/#{1,6}\s/g, "") // Headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Links
    .replace(/[*_~`]/g, "") // Remaining markdown chars
    .trim();
}

export function useTextToSpeech(
  options: UseTextToSpeechOptions = {}
): UseTextToSpeechReturn {
  const { defaultRate = 1.0, defaultVoiceLang = "en-IN" } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] =
    useState<SpeechSynthesisVoice | null>(null);
  const [rate, setRate] = useState(defaultRate);
  const [currentMessageId, setCurrentMessageId] = useState<number | null>(null);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Check support and load voices
  useEffect(() => {
    const supported = isSpeechSynthesisSupported();
    setIsSupported(supported);

    if (!supported) return;

    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      if (availableVoices.length === 0) return;

      setVoices(availableVoices);

      // Try to find preferred voice in this order:
      // 1. Google UK English Female (best quality)
      // 2. Any UK English voice
      // 3. Any English voice
      // 4. First available voice
      const googleUKFemale = availableVoices.find(
        (v) => v.name === "Google UK English Female"
      );
      const ukEnglishVoice = availableVoices.find(
        (v) => v.lang === "en-GB" || v.name.toLowerCase().includes("uk")
      );
      const englishVoice = availableVoices.find((v) =>
        v.lang.startsWith("en")
      );
      const preferredVoice =
        googleUKFemale || ukEnglishVoice || englishVoice || availableVoices[0];

      // Only set if we don't already have a selected voice
      setSelectedVoice((current) => current || preferredVoice);
    };

    // Load voices immediately (might work in some browsers)
    loadVoices();

    // Also listen for voices to load (required in Chrome)
    speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      speechSynthesis.onvoiceschanged = null;
    };
  }, [defaultVoiceLang]);

  // Load saved preferences from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedRate = localStorage.getItem("tts-rate");
    const savedVoiceName = localStorage.getItem("tts-voice");

    if (savedRate) {
      setRate(parseFloat(savedRate));
    }

    if (savedVoiceName && voices.length > 0) {
      const savedVoice = voices.find((v) => v.name === savedVoiceName);
      if (savedVoice) {
        setSelectedVoice(savedVoice);
      }
    }
  }, [voices]);

  // Save preferences to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("tts-rate", rate.toString());
  }, [rate]);

  useEffect(() => {
    if (typeof window === "undefined" || !selectedVoice) return;
    localStorage.setItem("tts-voice", selectedVoice.name);
  }, [selectedVoice]);

  const speak = useCallback(
    (text: string, messageId?: number) => {
      if (!isSupported) return;

      // Cancel any ongoing speech
      speechSynthesis.cancel();

      // Clean text for TTS
      const cleanText = stripMarkdown(text);
      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utteranceRef.current = utterance;

      // Set voice and rate
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = rate;
      utterance.pitch = 1;

      // Event handlers
      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
        setCurrentMessageId(messageId ?? null);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setCurrentMessageId(null);
        utteranceRef.current = null;
      };

      utterance.onerror = (event) => {
        // Don't log 'interrupted' errors - they happen when we cancel speech
        if (event.error !== "interrupted") {
          console.error("Speech synthesis error:", event.error);
        }
        setIsSpeaking(false);
        setIsPaused(false);
        setCurrentMessageId(null);
        utteranceRef.current = null;
      };

      utterance.onpause = () => {
        setIsPaused(true);
      };

      utterance.onresume = () => {
        setIsPaused(false);
      };

      // Speak!
      speechSynthesis.speak(utterance);
    },
    [isSupported, selectedVoice, rate]
  );

  const stop = useCallback(() => {
    if (!isSupported) return;
    speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentMessageId(null);
    utteranceRef.current = null;
  }, [isSupported]);

  const pause = useCallback(() => {
    if (!isSupported || !isSpeaking) return;
    speechSynthesis.pause();
    setIsPaused(true);
  }, [isSupported, isSpeaking]);

  const resume = useCallback(() => {
    if (!isSupported || !isPaused) return;
    speechSynthesis.resume();
    setIsPaused(false);
  }, [isSupported, isPaused]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported) {
        speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  return {
    isSpeaking,
    isPaused,
    isSupported,
    voices,
    selectedVoice,
    rate,
    currentMessageId,
    speak,
    stop,
    pause,
    resume,
    setSelectedVoice,
    setRate,
  };
}
