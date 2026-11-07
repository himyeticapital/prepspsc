"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Extend Window interface for Speech Recognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "ghost" | "outline";
}

// Check if browser supports Web Speech API
const isSpeechRecognitionSupported = () => {
  if (typeof window === "undefined") return false;
  return !!(
    window.SpeechRecognition ||
    window.webkitSpeechRecognition
  );
};

export function VoiceInput({
  onTranscript,
  disabled = false,
  className,
  size = "icon",
  variant = "ghost",
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef<string>("");

  useEffect(() => {
    setIsSupported(isSpeechRecognitionSupported());
  }, []);

  const startListening = useCallback(async () => {
    if (!isSupported || disabled) return;

    // First, explicitly request microphone permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately - we just needed to trigger the permission prompt
      stream.getTracks().forEach(track => track.stop());
    } catch (permissionError) {
      console.error("Microphone permission error:", permissionError);
      toast.error(
        "Microphone access denied. Click the lock icon in your address bar → Site settings → Allow Microphone",
        { duration: 5000 }
      );
      return;
    }

    try {
      const SpeechRecognitionAPI =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognitionAPI) {
        toast.error("Speech recognition not supported in this browser");
        return;
      }

      const recognition = new SpeechRecognitionAPI();
      recognitionRef.current = recognition;

      recognition.lang = "en-IN"; // Indian English
      recognition.continuous = true;
      recognition.interimResults = true;

      transcriptRef.current = "";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Update with interim results for real-time feedback
        if (finalTranscript) {
          transcriptRef.current += finalTranscript;
          onTranscript(transcriptRef.current);
        } else if (interimTranscript) {
          // Show interim results but don't commit yet
          onTranscript(transcriptRef.current + interimTranscript);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);

        if (event.error === "not-allowed") {
          toast.error("Microphone access denied. Please allow microphone access.");
        } else if (event.error === "no-speech") {
          toast.info("No speech detected. Try again.");
        } else if (event.error === "network") {
          toast.error(
            "Voice recognition requires internet connection. Check your network or try using HTTPS.",
            { duration: 5000 }
          );
        } else if (event.error === "service-not-allowed") {
          toast.error(
            "Speech service not available. Try Chrome or Edge browser.",
            { duration: 5000 }
          );
        } else if (event.error !== "aborted") {
          toast.error("Voice input error. Please try again.");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.start();
    } catch (error) {
      console.error("Failed to start speech recognition:", error);
      toast.error("Failed to start voice input");
      setIsListening(false);
    }
  }, [isSupported, disabled, onTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Don't render if not supported
  if (!isSupported) {
    return null;
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={toggleListening}
      disabled={disabled}
      className={cn(
        "relative transition-all",
        isListening && "text-red-500 hover:text-red-600",
        className
      )}
      title={isListening ? "Stop recording" : "Voice input"}
    >
      {isListening ? (
        <>
          <MicOff className="w-5 h-5" />
          {/* Pulsing animation when recording */}
          <span className="absolute inset-0 rounded-md animate-pulse bg-red-500/20" />
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-pulse" />
        </>
      ) : (
        <Mic className="w-5 h-5" />
      )}
    </Button>
  );
}

// Hook for using voice input in custom implementations
export function useVoiceInput(options?: {
  onTranscript?: (text: string) => void;
}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setIsSupported(isSpeechRecognitionSupported());
  }, []);

  const startListening = useCallback(async () => {
    if (!isSupported) return;

    // First, explicitly request microphone permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch {
      console.error("Microphone permission denied");
      return;
    }

    try {
      const SpeechRecognitionAPI =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognitionAPI) return;

      const recognition = new SpeechRecognitionAPI();
      recognitionRef.current = recognition;

      recognition.lang = "en-IN";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript("");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let result = "";
        for (let i = 0; i < event.results.length; i++) {
          result += event.results[i][0].transcript;
        }
        setTranscript(result);
        options?.onTranscript?.(result);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (error) {
      console.error("Failed to start speech recognition:", error);
      setIsListening(false);
    }
  }, [isSupported, options]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    startListening,
    stopListening,
    toggleListening: isListening ? stopListening : startListening,
  };
}
