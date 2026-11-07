"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRESET_AVATARS, DEFAULT_AVATAR } from "@/lib/avatars";
import { Check, Loader2, ArrowRight, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(DEFAULT_AVATAR);
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      // Get current profile to pre-fill username
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUsername(profile.username || user.email?.split("@")[0] || "");
        // If user already has an avatar set, they might have completed onboarding
        if (profile.avatar_url) {
          setSelectedAvatar(profile.avatar_url);
        }
      }

      setIsLoading(false);
    };

    checkUser();
  }, [supabase, router]);

  // Debounced username availability check
  useEffect(() => {
    const normalizedUsername = username.toLowerCase().replace(/\s+/g, "_").trim();

    // Reset state if username is empty or too short
    if (!normalizedUsername || normalizedUsername.length < 3) {
      setIsUsernameAvailable(null);
      setUsernameError(normalizedUsername.length > 0 && normalizedUsername.length < 3
        ? "Username must be at least 3 characters"
        : null);
      return;
    }

    // Validate username format (alphanumeric and underscores only)
    if (!/^[a-z0-9_]+$/.test(normalizedUsername)) {
      setIsUsernameAvailable(false);
      setUsernameError("Only letters, numbers, and underscores allowed");
      return;
    }

    setIsCheckingUsername(true);
    setUsernameError(null);

    const checkUsername = async () => {
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", normalizedUsername)
        .neq("id", userId || "")
        .single();

      setIsCheckingUsername(false);

      if (existingUser) {
        setIsUsernameAvailable(false);
        setUsernameError("This username is already taken");
      } else {
        setIsUsernameAvailable(true);
        setUsernameError(null);
      }
    };

    const debounceTimer = setTimeout(checkUsername, 500);
    return () => clearTimeout(debounceTimer);
  }, [username, userId, supabase]);

  const handleComplete = async () => {
    if (!userId) return;

    setIsSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        avatar_url: selectedAvatar,
        username: username.toLowerCase().replace(/\s+/g, "_"),
      })
      .eq("id", userId);

    if (error) {
      console.error("Error updating profile:", error);
      setIsSaving(false);
      return;
    }

    // Redirect to dashboard with welcome param for new users
    router.push("/dashboard?welcome=new");
  };

  const handleSkip = () => {
    router.push("/dashboard?welcome=new");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="glass-card p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center"
            >
              <Sparkles className="w-8 h-8 text-primary" />
            </motion.div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Welcome to PrepSPSC!
            </h1>
            <p className="text-white/60">
              Let's personalize your profile
            </p>
          </div>

          {/* Selected Avatar Preview */}
          <div className="flex justify-center mb-6">
            <motion.div
              key={selectedAvatar}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-primary/30 shadow-lg shadow-primary/20"
            >
              <Image
                src={selectedAvatar}
                alt="Selected avatar"
                fill
                className="object-cover"
              />
            </motion.div>
          </div>

          {/* Avatar Grid */}
          <div className="mb-6">
            <Label className="text-white/70 text-sm mb-3 block text-center">
              Choose your avatar
            </Label>
            <div className="grid grid-cols-5 gap-3 justify-items-center">
              {PRESET_AVATARS.map((avatar) => {
                const isSelected = selectedAvatar === avatar.src;
                return (
                  <motion.button
                    key={avatar.id}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedAvatar(avatar.src)}
                    className={cn(
                      "relative w-12 h-12 rounded-full overflow-hidden transition-all",
                      "border-2",
                      isSelected
                        ? "border-primary ring-2 ring-primary/30 ring-offset-2 ring-offset-zinc-900"
                        : "border-white/10 hover:border-white/30"
                    )}
                    title={avatar.label}
                    type="button"
                  >
                    <Image
                      src={avatar.src}
                      alt={avatar.label}
                      fill
                      className="object-cover"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white drop-shadow-lg" />
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Username Input */}
          <div className="mb-6">
            <Label htmlFor="username" className="text-white/70 text-sm mb-2 block">
              Choose your username
            </Label>
            <div className="relative">
              <Input
                id="username"
                type="text"
                placeholder="your_username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={cn(
                  "bg-white/5 text-white placeholder:text-white/40 pr-10",
                  username.trim().length >= 3 && isUsernameAvailable === true
                    ? "border-green-500 focus-visible:ring-green-500"
                    : usernameError
                    ? "border-destructive focus-visible:ring-destructive"
                    : "border-white/10"
                )}
              />
              {username.trim().length >= 3 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isCheckingUsername ? (
                    <Loader2 className="w-4 h-4 text-white/50 animate-spin" />
                  ) : isUsernameAvailable ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : usernameError ? (
                    <AlertCircle className="w-4 h-4 text-destructive" />
                  ) : null}
                </div>
              )}
            </div>
            {usernameError ? (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {usernameError}
              </p>
            ) : isUsernameAvailable ? (
              <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Username is available
              </p>
            ) : (
              <p className="text-xs text-white/40 mt-1">
                This will be visible to other students
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleSkip}
              className="flex-1 border-white/10 text-white hover:bg-white/10"
            >
              Skip for now
            </Button>
            <Button
              onClick={handleComplete}
              disabled={isSaving || !username.trim() || isCheckingUsername || isUsernameAvailable !== true}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
