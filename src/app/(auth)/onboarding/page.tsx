"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRESET_AVATARS, isPresetAvatar } from "@/lib/avatars";
import { Check, Loader2, ArrowRight, Sparkles, AlertCircle, MessageCircle, ExternalLink, User, Phone, ShieldCheck } from "lucide-react";
import { ExamSelector } from "@/components/ui/exam-selector";
import { cn } from "@/lib/utils";
import { getFirebaseAuth, RecaptchaVerifier, signInWithPhoneNumber } from "@/lib/firebase";
import type { ConfirmationResult } from "firebase/auth";

// Telegram bot username (set in environment)
const TELEGRAM_BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "PrepSPSCBot";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [saveError, setSaveError] = useState<string | null>(null);

  // Multi-step state: "profile" -> "bot" -> redirect
  const [currentStep, setCurrentStep] = useState<"profile" | "bot">("profile");
  const [preparingFor, setPreparingFor] = useState<string[]>([]);

  // Phone OTP state (for Google OAuth users who don't have a phone number)
  const [needsPhone, setNeedsPhone] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      // Get current profile to pre-fill username and check phone
      const [{ data: profile }, { data: privateProfile }] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("id", user.id)
          .single(),
        // Phone numbers are private: only the user (and admins) can read them
        supabase
          .from("profile_private")
          .select("phone_number")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      if (profile) {
        setUsername(profile.username || user.email?.split("@")[0] || "");
        // Only pre-fill if user already has a valid preset avatar
        if (isPresetAvatar(profile.avatar_url)) {
          setSelectedAvatar(profile.avatar_url);
        }
        // Check if user needs phone verification (Google OAuth users)
        if (!privateProfile?.phone_number) {
          setNeedsPhone(true);
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

  // Phone validation & OTP functions
  const validatePhone = (phoneValue: string): string | null => {
    if (!phoneValue) return null;
    const cleaned = phoneValue.replace(/[\s\-]/g, "").replace(/^\+91/, "").replace(/^91/, "").replace(/^0/, "");
    if (!/^\d{10}$/.test(cleaned)) return "Please enter a valid 10-digit phone number";
    if (!/^[6-9]/.test(cleaned)) return "Indian mobile numbers must start with 6, 7, 8, or 9";
    if (/^(\d)\1{9}$/.test(cleaned)) return "Please enter a valid phone number";
    return null;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d\s\-+]/g, "");
    setPhone(value);
    setPhoneError(validatePhone(value));
  };

  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(getFirebaseAuth(), "recaptcha-container-onboarding", {
        size: "invisible",
      });
    }
  };

  const handleSendOtp = async () => {
    const phoneValidationError = validatePhone(phone);
    if (phoneValidationError) {
      setPhoneError(phoneValidationError);
      return;
    }
    setIsSendingOtp(true);
    setOtpError(null);
    try {
      setupRecaptcha();
      const cleaned = phone.replace(/[\s\-]/g, "").replace(/^\+91/, "").replace(/^91/, "").replace(/^0/, "");
      const fullPhone = `+91${cleaned}`;
      const result = await signInWithPhoneNumber(getFirebaseAuth(), fullPhone, (window as any).recaptchaVerifier);
      setConfirmationResult(result);
      setOtpSent(true);
      setOtpCooldown(30);
      const interval = setInterval(() => {
        setOtpCooldown((prev) => {
          if (prev <= 1) { clearInterval(interval); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (error: any) {
      if (error.code === "auth/too-many-requests") {
        setOtpError("Too many attempts. Please try again later.");
      } else if (error.code === "auth/invalid-phone-number") {
        setOtpError("Invalid phone number. Please check and try again.");
      } else {
        setOtpError(`Failed to send OTP: ${error.code || error.message}`);
      }
      (window as any).recaptchaVerifier = null;
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!confirmationResult || otp.length !== 6) return;
    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      await confirmationResult.confirm(otp);
      setPhoneVerified(true);
    } catch (error: any) {
      if (error.code === "auth/invalid-verification-code") {
        setOtpError("Invalid OTP. Please check and try again.");
      } else if (error.code === "auth/code-expired") {
        setOtpError("OTP expired. Please request a new one.");
        setOtpSent(false);
      } else {
        setOtpError("Verification failed. Please try again.");
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleComplete = async () => {
    if (!userId) return;

    // Clear previous errors
    setSaveError(null);

    // Require avatar selection
    if (!selectedAvatar) {
      setSaveError("Please select an avatar to continue.");
      return;
    }

    setIsSaving(true);

    // Prepare update data
    const updateData: Record<string, unknown> = {
      avatar_url: selectedAvatar,
      username: username.toLowerCase().replace(/\s+/g, "_"),
    };

    // Save phone number if verified during onboarding (Google OAuth users)
    let verifiedPhone: string | null = null;
    if (needsPhone && phoneVerified && phone) {
      const cleaned = phone.replace(/[\s\-]/g, "").replace(/^\+91/, "").replace(/^91/, "").replace(/^0/, "");
      verifiedPhone = `+91${cleaned}`;
      updateData.phone_verified = true;
    }

    // Include exams if any were selected
    if (preparingFor.length > 0) {
      updateData.preparing_for = preparingFor;
    }

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", userId);

    if (error) {
      console.error("Error updating profile:", error);
      setSaveError("Failed to save profile. Please try again.");
      setIsSaving(false);
      return;
    }

    if (verifiedPhone) {
      const { error: phoneError } = await supabase
        .from("profile_private")
        .upsert({ id: userId, phone_number: verifiedPhone }, { onConflict: "id" });
      if (phoneError) {
        console.error("Error saving phone number:", phoneError);
        setSaveError("Failed to save your phone number. Please try again.");
        setIsSaving(false);
        return;
      }
    }

    // Move to bot step
    setIsSaving(false);
    setCurrentStep("bot");
  };

  // Handle bot step completion
  const handleBotComplete = () => {
    router.push("/dashboard?welcome=new");
  };

  const handleBotSkip = () => {
    router.push("/dashboard?welcome=new");
  };

  // Telegram deep link with user ID for account linking
  const telegramDeepLink = userId ? `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${userId}` : "";

  const botFeatures = [
    "Daily study reminders at 8 AM",
    "Quick quizzes on any topic",
    "Save notes from anywhere",
    "Progress updates & streak alerts",
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Render step content
  if (currentStep === "profile") {
    // Step 1: Profile setup
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
                Let&apos;s personalize your profile
              </p>
            </div>

            {/* Selected Avatar Preview */}
            <div className="flex justify-center mb-6">
              <motion.div
                key={selectedAvatar || "empty"}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={cn(
                  "relative w-24 h-24 rounded-full overflow-hidden border-4 shadow-lg",
                  selectedAvatar
                    ? "border-primary/30 shadow-primary/20"
                    : "border-white/10 shadow-none"
                )}
              >
                {selectedAvatar ? (
                  <Image
                    src={selectedAvatar}
                    alt="Selected avatar"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-white/5 flex items-center justify-center">
                    <User className="w-10 h-10 text-white/20" />
                  </div>
                )}
              </motion.div>
            </div>

            {/* Avatar Grid */}
            <div className="mb-6">
              <Label className="text-white/70 text-sm mb-3 block text-center">
                Choose your avatar <span className="text-destructive">*</span>
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

            {/* Exam Selection */}
            <div className="mb-6">
              <Label className="text-white/70 text-sm mb-2 block">
                What are you preparing for?
              </Label>
              <ExamSelector
                selected={preparingFor}
                onChange={setPreparingFor}
              />
            </div>

            {/* Phone Verification (for Google OAuth users) */}
            {needsPhone && (
              <div className="mb-6">
                <Label className="text-white/70 text-sm mb-2 block">
                  Verify your phone number <span className="text-destructive">*</span>
                </Label>
                {phoneVerified ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <ShieldCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-green-400">Phone verified</span>
                    <span className="text-sm text-white/40 ml-auto">{phone}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="tel"
                          placeholder="9876543210"
                          value={phone}
                          onChange={handlePhoneChange}
                          disabled={otpSent}
                          className={cn(
                            "pl-10 bg-white/5 text-white placeholder:text-white/40",
                            phone && !phoneError
                              ? "border-green-500 focus-visible:ring-green-500"
                              : phoneError
                              ? "border-destructive focus-visible:ring-destructive"
                              : "border-white/10"
                          )}
                          maxLength={15}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={!phone || !!phoneError || isSendingOtp || otpCooldown > 0}
                        variant={otpSent ? "outline" : "default"}
                        className="shrink-0"
                      >
                        {isSendingOtp ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : otpSent ? (
                          otpCooldown > 0 ? `${otpCooldown}s` : "Resend"
                        ) : (
                          "Send OTP"
                        )}
                      </Button>
                    </div>
                    {phoneError && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {phoneError}
                      </p>
                    )}
                    {!phoneError && !otpSent && (
                      <p className="text-xs text-white/40 mt-1">
                        Indian mobile number (10 digits). We&apos;ll send a verification OTP.
                      </p>
                    )}
                    {otpError && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {otpError}
                      </p>
                    )}
                    {otpSent && (
                      <div className="flex gap-2 mt-2">
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="Enter 6-digit OTP"
                          value={otp}
                          onChange={(e) => {
                            setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                            setOtpError(null);
                          }}
                          className={cn(
                            "tracking-widest text-center text-lg bg-white/5 text-white",
                            otpError ? "border-destructive" : "border-white/10"
                          )}
                          maxLength={6}
                        />
                        <Button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={otp.length !== 6 || isVerifyingOtp}
                          className="shrink-0 bg-green-600 hover:bg-green-700"
                        >
                          {isVerifyingOtp ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Verify"
                          )}
                        </Button>
                      </div>
                    )}
                  </>
                )}
                <div id="recaptcha-container-onboarding"></div>
              </div>
            )}

            {/* Error Message */}
            {saveError && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {saveError}
              </div>
            )}

            {/* Actions */}
            <div>
              <Button
                onClick={handleComplete}
                disabled={
                  isSaving ||
                  !selectedAvatar ||
                  !username.trim() ||
                  isCheckingUsername ||
                  isUsernameAvailable !== true ||
                  (needsPhone && !phoneVerified)
                }
                className="w-full bg-primary hover:bg-primary/90"
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

  // Step 3: Bot Connection
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="glass-card p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#0088cc]/20 flex items-center justify-center"
            >
              <MessageCircle className="w-10 h-10 text-[#0088cc]" />
            </motion.div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Connect Telegram Bot
            </h1>
            <p className="text-white/60 text-sm">
              Get study reminders and quick quizzes in Telegram
            </p>
          </div>

          {/* Features */}
          <div className="bg-white/5 rounded-lg p-4 mb-6 space-y-3">
            {botFeatures.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-3 text-sm text-white/80"
              >
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
                {feature}
              </motion.div>
            ))}
          </div>

          {/* Connect Button */}
          <Button
            onClick={() => {
              window.open(telegramDeepLink, "_blank");
              // Give user time to connect, then proceed
              setTimeout(handleBotComplete, 2000);
            }}
            className="w-full bg-[#0088cc] hover:bg-[#0088cc]/90 gap-2 mb-4"
            size="lg"
          >
            <MessageCircle className="w-5 h-5" />
            Connect Telegram
            <ExternalLink className="w-4 h-4" />
          </Button>

          {/* Instructions */}
          <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 mb-4 text-sm">
            <p className="text-white/70">
              <strong className="text-white">How it works:</strong>
            </p>
            <ol className="list-decimal list-inside mt-2 space-y-1 text-white/60">
              <li>Click the button above to open Telegram</li>
              <li>Press &quot;Start&quot; in the bot chat</li>
              <li>Your account links automatically!</li>
            </ol>
          </div>

          {/* Skip */}
          <button
            onClick={handleBotSkip}
            className="w-full text-center text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            Skip for now — connect later in Settings
          </button>
        </div>
      </motion.div>
    </div>
  );
}
