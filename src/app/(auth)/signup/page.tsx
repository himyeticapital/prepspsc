"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { fetchAuthPreflight } from "@/lib/auth-requests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Turnstile } from "@/components/ui/turnstile";
import { Mail, Chrome, Loader2, ArrowRight, User, Lock, AlertCircle, Check, Phone, ShieldCheck } from "lucide-react";
import { isDisposableDomain } from "@/lib/disposable-domains";
import { getFirebaseAuth, RecaptchaVerifier, signInWithPhoneNumber } from "@/lib/firebase";
import type { ConfirmationResult } from "firebase/auth";

const SIGNUP_UNCONFIRMED_MESSAGE = "We could not confirm whether your account was created. Check your email for a confirmation link or try signing in before trying again.";

export default function SignupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // Phone OTP state
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
  const [captchaAttempt, setCaptchaAttempt] = useState(0);

  // Common typos in popular email domains
  const DOMAIN_TYPO_CORRECTIONS: Record<string, string> = {
    "gmial.com": "gmail.com",
    "gmal.com": "gmail.com",
    "gamil.com": "gmail.com",
    "gnail.com": "gmail.com",
    "gmail.co": "gmail.com",
    "gmaill.com": "gmail.com",
    "gmails.com": "gmail.com",
    "outlok.com": "outlook.com",
    "outook.com": "outlook.com",
    "hotmal.com": "hotmail.com",
    "hotmial.com": "hotmail.com",
    "yahooo.com": "yahoo.com",
    "yaho.com": "yahoo.com",
    "googles.com": "google.com",
    "gogle.com": "google.com",
    "goggle.com": "google.com",
    "gooogle.com": "google.com",
    "protonmal.com": "protonmail.com",
    "protonmial.com": "protonmail.com",
    "rediffmal.com": "rediffmail.com",
  };

  const validateEmail = (emailValue: string): string | null => {
    if (!emailValue) return null;

    // Basic format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue)) {
      return "Please enter a valid email address";
    }

    const domain = emailValue.split("@")[1]?.toLowerCase();
    if (!domain) return "Please enter a valid email address";

    // Check for disposable email domains (200+ domains)
    if (isDisposableDomain(emailValue)) {
      return "Disposable or temporary email addresses are not allowed. Please use a permanent email.";
    }

    // Check for common typos
    if (DOMAIN_TYPO_CORRECTIONS[domain]) {
      return `Did you mean ${emailValue.split("@")[0]}@${DOMAIN_TYPO_CORRECTIONS[domain]}?`;
    }

    // Check for suspiciously short local part
    const localPart = emailValue.split("@")[0];
    if (localPart.length < 2) {
      return "Email address seems too short";
    }

    return null;
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    setEmailError(validateEmail(newEmail));
  };

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  // Indian phone number validation
  const validatePhone = (phoneValue: string): string | null => {
    if (!phoneValue) return null;
    const cleaned = phoneValue.replace(/[\s\-]/g, "").replace(/^\+91/, "").replace(/^91/, "").replace(/^0/, "");
    if (!/^\d{10}$/.test(cleaned)) return "Please enter a valid 10-digit phone number";
    if (!/^[6-9]/.test(cleaned)) return "Indian mobile numbers must start with 6, 7, 8, or 9";
    if (/^(\d)\1{9}$/.test(cleaned)) return "Please enter a valid phone number";
    if (["1234567890", "9876543210", "0123456789"].includes(cleaned)) return "Please enter a valid phone number";
    return null;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d\s\-+]/g, "");
    setPhone(value);
    setPhoneError(validatePhone(value));
  };

  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(getFirebaseAuth(), "recaptcha-container-signup", {
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
        console.error("Firebase OTP error:", error.code || error.message);
        setOtpError(`Failed to send OTP: ${error.code || error.message}`);
      }
      try { (window as any).recaptchaVerifier?.clear(); } catch {}
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

  const supabase = createClient();

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    let stage: "validation" | "captcha" | "signup" = "validation";
    let captchaAttempted = false;

    try {
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }

      // Validate email format
      const emailValidationError = validateEmail(email);
      if (emailValidationError) {
        setError(emailValidationError);
        return;
      }

      // Verify CAPTCHA
      if (turnstileToken) {
        stage = "captcha";
        captchaAttempted = true;
        const captchaRes = await fetchAuthPreflight("/api/auth/verify-captcha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: turnstileToken }),
        });
        if (!captchaRes.ok) {
          if (captchaRes.status === 429) {
            setError("Too many attempts. Please wait a few minutes and try again.");
          } else if (captchaRes.status === 503) {
            setError("Service temporarily unavailable. Please try again in a moment.");
          } else {
            setError("CAPTCHA verification failed. Please try again.");
          }
          return;
        }
      }

      // Server-side email validation (MX records + disposable domain check)
      stage = "validation";
      try {
        const emailCheckRes = await fetchAuthPreflight("/api/auth/validate-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        });
        if (!emailCheckRes.ok) {
          const emailCheckData = await emailCheckRes.json();
          setError(emailCheckData.error || "Email validation failed. Please use a valid email address.");
          return;
        }
      } catch {
        // If validation endpoint is down, allow through rather than blocking
      }

      const cleaned = phone.replace(/[\s\-]/g, "").replace(/^\+91/, "").replace(/^91/, "").replace(/^0/, "");
      stage = "signup";
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone_number: `+91${cleaned}`,
            phone_verified: true,
          },
          emailRedirectTo: `${window.location.origin}/callback?redirect=/onboarding`,
        },
      });

      if (error) {
        console.error("Signup request failed", { stage, error: error.name, status: error.status });
        setError(error.name === "AuthRetryableFetchError"
          ? SIGNUP_UNCONFIRMED_MESSAGE
          : error.message);
        return;
      }

      // Detect duplicate email: Supabase returns a user with empty identities
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError("An account with this email already exists. Please sign in instead.");
        return;
      }

      // Log signup IP (fire-and-forget, don't block signup flow)
      fetch("/api/auth/log-signup-ip", { method: "POST" }).catch(() => {});

      setMessage("Check your email for the confirmation link!");
    } catch (err) {
      // Log the stage, never the form values or CAPTCHA token.
      console.error("Signup request failed", {
        stage,
        error: err instanceof Error ? err.name : "UnknownError",
      });
      setError(stage === "signup"
        ? SIGNUP_UNCONFIRMED_MESSAGE
        : "Could not connect to CAPTCHA verification. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
      if (captchaAttempted) {
        // Turnstile tokens are single-use, including when a later step fails.
        setTurnstileToken(null);
        setCaptchaAttempt((attempt) => attempt + 1);
      }
    }
  };

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback?redirect=/onboarding`,
      },
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="glass-card p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold gradient-text mb-2">
              Join PrepSPSC
            </h1>
            <p className="text-muted-foreground">
              Start your Sikkim PSC preparation journey
            </p>
          </div>

          {/* Error/Message Display */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-3 mb-4 text-sm">
              {error}
            </div>
          )}

          {/* Google Signup */}
          <Button
            variant="outline"
            className="w-full mb-6"
            onClick={handleGoogleSignup}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Chrome className="w-4 h-4 mr-2" />
            )}
            Continue with Google
          </Button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or sign up with email
              </span>
            </div>
          </div>

          {/* Email Signup Form */}
          <form onSubmit={handleEmailSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={handleEmailChange}
                  className={`pl-10 pr-10 ${
                    email && emailError
                      ? "border-destructive focus-visible:ring-destructive"
                      : email && !emailError
                      ? "border-green-500 focus-visible:ring-green-500"
                      : ""
                  }`}
                  required
                />
                {email && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {emailError ? (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    ) : (
                      <Check className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                )}
              </div>
              {email && emailError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {emailError}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={6}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`pl-10 pr-10 ${
                    confirmPassword
                      ? password === confirmPassword
                        ? "border-green-500 focus-visible:ring-green-500"
                        : "border-destructive focus-visible:ring-destructive"
                      : ""
                  }`}
                  required
                  minLength={6}
                />
                {confirmPassword && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {password === confirmPassword ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                )}
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Passwords do not match
                </p>
              )}
            </div>

            {/* Phone Number + OTP Verification */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number <span className="text-destructive">*</span></Label>
              {phoneVerified ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <ShieldCheck className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-green-400">Phone verified</span>
                  <span className="text-sm text-muted-foreground ml-auto">{phone}</span>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="9876543210"
                        value={phone}
                        onChange={handlePhoneChange}
                        disabled={otpSent}
                        className={`pl-10 ${
                          phone && !phoneError
                            ? "border-green-500 focus-visible:ring-green-500"
                            : phoneError
                            ? "border-destructive focus-visible:ring-destructive"
                            : ""
                        }`}
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
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {phoneError}
                    </p>
                  )}
                  {!phoneError && !otpSent && !otpError && (
                    <p className="text-xs text-muted-foreground">
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
                    <div className="mt-1">
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="Enter 6-digit OTP"
                          value={otp}
                          onChange={(e) => {
                            setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                            setOtpError(null);
                          }}
                          className={`tracking-widest text-center text-lg ${
                            otpError ? "border-destructive" : ""
                          }`}
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
                    </div>
                  )}
                </>
              )}
              <div id="recaptcha-container-signup"></div>
            </div>

            <Turnstile
              key={captchaAttempt}
              onVerify={handleTurnstileVerify}
              onExpire={handleTurnstileExpire}
              className="mb-4 flex justify-center"
            />
            {message && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg p-3 text-sm flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                {message}
              </div>
            )}
            <Button
              type="submit"
              className="w-full primary-glow"
              disabled={isLoading || !turnstileToken || !!emailError || !phoneVerified || !!message}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              Create Account
            </Button>
          </form>

          {/* Terms */}
          <p className="text-xs text-center text-muted-foreground mt-4">
            By signing up, you agree to our{" "}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
          </p>

          {/* Login Link */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-primary hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>

      <footer className="mt-8 text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Made with ❤️ in Sikkim
        </p>
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
          <span className="text-white/20">·</span>
          <Link href="/refund-policy" className="hover:text-primary transition-colors">Refund Policy</Link>
          <span className="text-white/20">·</span>
          <Link href="/contact" className="hover:text-primary transition-colors">Contact</Link>
        </div>
      </footer>
    </div>
  );
}
