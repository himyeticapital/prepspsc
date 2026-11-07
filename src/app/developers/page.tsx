"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Key,
  Copy,
  Check,
  AlertTriangle,
  Search,
  FileText,
  BarChart3,
  Trophy,
  Bookmark,
  Zap,
  ExternalLink,
  Code2,
  Shield,
  Loader2,
  Terminal,
  Sparkles,
  Phone,
  ShieldCheck,
  AlertCircle,
  Mail,
} from "lucide-react";
import { Turnstile } from "@/components/ui/turnstile";
import { getFirebaseAuth, RecaptchaVerifier, signInWithPhoneNumber } from "@/lib/firebase";
import type { ConfirmationResult } from "firebase/auth";

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.de", "grr.la",
  "guerrillamailblock.com", "tempmail.com", "temp-mail.org", "temp-mail.io",
  "throwaway.email", "yopmail.com", "yopmail.fr", "sharklasers.com",
  "guerrillamail.info", "guerrillamail.net", "getnada.com", "tempail.com",
  "dispostable.com", "mailnesia.com", "maildrop.cc", "discard.email",
  "fakeinbox.com", "trashmail.com", "trashmail.me", "trashmail.net",
  "10minutemail.com", "10minutemail.net", "minutemail.com",
  "emailondeck.com", "mailcatch.com", "incognitomail.org",
  "mohmal.com", "burnermail.io", "harakirimail.com",
  "crazymailing.com", "tmail.ws", "spamgourmet.com",
  "mailnator.com", "mytemp.email", "tempinbox.com",
  "jetable.org", "trashymail.com", "tempr.email",
  "mailforspam.com", "spamfree24.org", "wegwerfmail.de",
  "trash-mail.com", "byom.de", "anonymbox.com",
  "tempmailer.com", "tmpmail.net", "tmpmail.org",
  "bupmail.com", "mailsac.com", "inboxbear.com",
  "tempmailaddress.com", "emailfake.com", "generator.email",
  "guerrillamail.biz", "emkei.cz", "mailtemp.info",
  "nespf.com",
]);

interface SignupResponse {
  success: boolean;
  api_key: string;
  key_prefix: string;
  tier: string;
  rate_limit_rpm: number;
  monthly_quota: number;
}

const API_FEATURES = [
  {
    icon: Search,
    title: "Semantic PYQ Search",
    description:
      "Search previous year questions using natural language with AI-powered vector similarity.",
  },
  {
    icon: FileText,
    title: "Mock Test Generation",
    description:
      "Generate exam-pattern mock tests from a curated bank of real PYQ questions.",
  },
  {
    icon: BarChart3,
    title: "Progress Tracking",
    description:
      "Track study streaks, XP, test scores, and topic-wise performance analytics.",
  },
  {
    icon: Trophy,
    title: "Leaderboard",
    description:
      "Access real-time leaderboards for competitive motivation among aspirants.",
  },
  {
    icon: Bookmark,
    title: "Bookmarks",
    description:
      "Save and retrieve bookmarked questions for spaced repetition review.",
  },
];

export default function DeveloperPortalPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [appName, setAppName] = useState("");
  const [appDescription, setAppDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiKeyData, setApiKeyData] = useState<SignupResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // Email OTP state
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [isSendingEmailOtp, setIsSendingEmailOtp] = useState(false);
  const [isVerifyingEmailOtp, setIsVerifyingEmailOtp] = useState(false);
  const [emailOtpError, setEmailOtpError] = useState<string | null>(null);
  const [emailOtpCooldown, setEmailOtpCooldown] = useState(0);

  // Phone OTP state
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [isSendingPhoneOtp, setIsSendingPhoneOtp] = useState(false);
  const [isVerifyingPhoneOtp, setIsVerifyingPhoneOtp] = useState(false);
  const [phoneOtpError, setPhoneOtpError] = useState<string | null>(null);
  const [phoneOtpCooldown, setPhoneOtpCooldown] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

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

  // Email OTP handlers
  const handleSendEmailOtp = async () => {
    const emailVal = email.trim().toLowerCase();
    if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      setEmailOtpError("Please enter a valid email address first.");
      return;
    }
    const domain = emailVal.split("@")[1];
    if (domain && DISPOSABLE_DOMAINS.has(domain)) {
      setEmailOtpError("Disposable emails are not allowed.");
      return;
    }
    setIsSendingEmailOtp(true);
    setEmailOtpError(null);
    try {
      const res = await fetch("/api/developer-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", email: emailVal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailOtpError(data.error || "Failed to send code.");
        return;
      }
      setEmailOtpSent(true);
      setEmailOtpCooldown(30);
      const interval = setInterval(() => {
        setEmailOtpCooldown((prev) => {
          if (prev <= 1) { clearInterval(interval); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setEmailOtpError("Network error. Please try again.");
    } finally {
      setIsSendingEmailOtp(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (emailOtp.length !== 6) return;
    setIsVerifyingEmailOtp(true);
    setEmailOtpError(null);
    try {
      const res = await fetch("/api/developer-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", email: email.trim().toLowerCase(), code: emailOtp }),
      });
      const data = await res.json();
      if (data.verified) {
        setEmailVerified(true);
      } else {
        setEmailOtpError(data.error || "Invalid code. Please try again.");
      }
    } catch {
      setEmailOtpError("Network error. Please try again.");
    } finally {
      setIsVerifyingEmailOtp(false);
    }
  };

  // Phone OTP handlers (Firebase)
  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(getFirebaseAuth(), "recaptcha-container-dev", {
        size: "invisible",
      });
    }
  };

  const handleSendPhoneOtp = async () => {
    const phoneValidationError = validatePhone(phone);
    if (phoneValidationError) {
      setPhoneError(phoneValidationError);
      return;
    }
    setIsSendingPhoneOtp(true);
    setPhoneOtpError(null);
    try {
      setupRecaptcha();
      const cleaned = phone.replace(/[\s\-]/g, "").replace(/^\+91/, "").replace(/^91/, "").replace(/^0/, "");
      const fullPhone = `+91${cleaned}`;
      const result = await signInWithPhoneNumber(getFirebaseAuth(), fullPhone, (window as any).recaptchaVerifier);
      setConfirmationResult(result);
      setPhoneOtpSent(true);
      setPhoneOtpCooldown(30);
      const interval = setInterval(() => {
        setPhoneOtpCooldown((prev) => {
          if (prev <= 1) { clearInterval(interval); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (error: any) {
      if (error.code === "auth/too-many-requests") {
        setPhoneOtpError("Too many attempts. Please try again later.");
      } else if (error.code === "auth/invalid-phone-number") {
        setPhoneOtpError("Invalid phone number. Please check and try again.");
      } else {
        setPhoneOtpError(`Failed to send OTP: ${error.code || error.message}`);
      }
      (window as any).recaptchaVerifier = null;
    } finally {
      setIsSendingPhoneOtp(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!confirmationResult || phoneOtp.length !== 6) return;
    setIsVerifyingPhoneOtp(true);
    setPhoneOtpError(null);
    try {
      await confirmationResult.confirm(phoneOtp);
      setPhoneVerified(true);
    } catch (error: any) {
      if (error.code === "auth/invalid-verification-code") {
        setPhoneOtpError("Invalid OTP. Please check and try again.");
      } else if (error.code === "auth/code-expired") {
        setPhoneOtpError("OTP expired. Please request a new one.");
        setPhoneOtpSent(false);
      } else {
        setPhoneOtpError("Verification failed. Please try again.");
      }
    } finally {
      setIsVerifyingPhoneOtp(false);
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !appName.trim() || !appDescription.trim() || !websiteUrl.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const emailVal = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    const domain = emailVal.split("@")[1];
    if (domain && DISPOSABLE_DOMAINS.has(domain)) {
      toast.error("Disposable or temporary email addresses are not allowed. Please use a real email.");
      return;
    }

    try {
      const parsed = new URL(websiteUrl.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) {
        toast.error("Website URL must start with http:// or https://");
        return;
      }
      const blockedDomains = [
        "google.com","google.co.in","youtube.com","facebook.com","meta.com",
        "instagram.com","twitter.com","x.com","linkedin.com","github.com",
        "microsoft.com","apple.com","amazon.com","netflix.com","whatsapp.com",
        "telegram.org","reddit.com","wikipedia.org","yahoo.com","bing.com",
        "stackoverflow.com","medium.com","discord.com","tiktok.com",
        "supabase.com","vercel.com","netlify.com","cloudflare.com",
        "openai.com","anthropic.com","stripe.com","razorpay.com",
        "example.com","test.com","localhost",
      ];
      const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
      if (blockedDomains.includes(hostname)) {
        toast.error("Please enter your own website or app URL, not a well-known platform.");
        return;
      }
    } catch {
      toast.error("Please enter a valid website URL (e.g. https://yourapp.com)");
      return;
    }

    if (!emailVerified) {
      toast.error("Please verify your email address.");
      return;
    }

    if (!phoneVerified) {
      toast.error("Please verify your phone number.");
      return;
    }

    if (!turnstileToken) {
      toast.error("Please complete the CAPTCHA verification.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Read honeypot value from the hidden field
      const honeypotValue = (document.getElementById("company_field") as HTMLInputElement)?.value || "";
      const cleanedPhone = phone.replace(/[\s\-]/g, "").replace(/^\+91/, "").replace(/^91/, "").replace(/^0/, "");

      const res = await fetch("/api/developer-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          app_name: appName.trim(),
          app_description: appDescription.trim(),
          website_url: websiteUrl.trim(),
          turnstile_token: turnstileToken,
          company: honeypotValue,
          phone_number: `+91${cleanedPhone}`,
          phone_verified: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Something went wrong. Please try again.");
        if (res.status === 403) setTurnstileToken(null);
        return;
      }

      setApiKeyData(data);
      toast.success("API key generated successfully!");
    } catch {
      toast.error("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyApiKey() {
    if (!apiKeyData?.api_key) return;
    try {
      await navigator.clipboard.writeText(apiKeyData.api_key);
      setCopied(true);
      toast.success("API key copied to clipboard!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Failed to copy. Please select and copy manually.");
    }
  }

  const apiBaseUrl = "https://qqqditxzghqzodvauxth.supabase.co/functions/v1/pyq-api";

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-blue-500/10" />
        <div className="relative mx-auto max-w-5xl px-6 py-20 text-center">
          <Badge
            variant="outline"
            className="mb-4 border-emerald-500/30 text-emerald-400"
          >
            <Key className="mr-1.5 size-3" />
            Developer API
          </Badge>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            PrepSPSC Developer API
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-400">
            Build on top of Sikkim&apos;s most comprehensive PYQ database.
            Semantic search, mock test generation, progress analytics, and more
            — all accessible via a simple REST API.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Badge variant="secondary" className="text-xs">
              Free tier: 10 RPM
            </Badge>
            <Badge variant="secondary" className="text-xs">
              1,000 requests/month
            </Badge>
            <Badge variant="secondary" className="text-xs">
              No credit card required
            </Badge>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-16">
        {/* Commercial Use Attribution Requirement */}
        <div className="mb-12 border border-emerald-500/30 rounded-xl bg-emerald-500/5 p-6 sm:p-8">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Commercial Use Attribution Requirement
              </h3>
              <p className="text-emerald-400 text-sm mt-1 font-medium">
                Anyone using this API for commercial purposes MUST provide attribution by linking back to PrepSPSC.
              </p>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm text-zinc-400 mb-2">Required attribution format:</p>
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 font-mono text-sm text-zinc-300">
              PYQ data provided by{" "}
              <span className="text-emerald-400">
                &lt;a href=&quot;https://prepspsc.com&quot;&gt;PrepSPSC&lt;/a&gt;
              </span>
            </div>
          </div>

          <p className="text-sm text-zinc-400">
            This includes but is not limited to: websites, applications, trading bots, research reports, or any service that generates revenue. Personal use is permitted without attribution.
          </p>
        </div>

        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          {/* Left Column: Sign-up Form or Key Display */}
          <div>
            {!apiKeyData ? (
              <Card className="border-zinc-800 bg-zinc-900/50">
                <CardHeader>
                  <CardTitle className="text-xl text-white">
                    Get your API key
                  </CardTitle>
                  <CardDescription>
                    Sign up to get a free API key instantly. No approval
                    required.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-zinc-300">
                        Your Name <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        id="name"
                        placeholder="Karma Bhutia"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500"
                      />
                    </div>

                    {/* Email + OTP Verification */}
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-zinc-300">
                        Email Address <span className="text-red-400">*</span>
                      </Label>
                      {emailVerified ? (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                          <ShieldCheck className="w-5 h-5 text-green-500" />
                          <span className="text-sm text-green-400">Email verified</span>
                          <span className="text-sm text-zinc-400 ml-auto">{email}</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex gap-2">
                            <Input
                              id="email"
                              type="email"
                              placeholder="karma@gmail.com"
                              value={email}
                              onChange={(e) => { setEmail(e.target.value); setEmailOtpError(null); }}
                              disabled={emailOtpSent}
                              className="border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500"
                            />
                            <Button
                              type="button"
                              onClick={handleSendEmailOtp}
                              disabled={!email.trim() || isSendingEmailOtp || emailOtpCooldown > 0}
                              variant={emailOtpSent ? "outline" : "default"}
                              className="shrink-0"
                            >
                              {isSendingEmailOtp ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : emailOtpSent ? (
                                emailOtpCooldown > 0 ? `${emailOtpCooldown}s` : "Resend"
                              ) : (
                                <>
                                  <Mail className="w-4 h-4 mr-1" />
                                  Send Code
                                </>
                              )}
                            </Button>
                          </div>
                          {emailOtpError && (
                            <p className="text-xs text-red-400 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {emailOtpError}
                            </p>
                          )}
                          {emailOtpSent && !emailOtpError && (
                            <p className="text-xs text-zinc-400">Check your inbox for the 6-digit code.</p>
                          )}
                          {emailOtpSent && (
                            <div className="flex gap-2 mt-1">
                              <Input
                                type="text"
                                inputMode="numeric"
                                placeholder="Enter 6-digit code"
                                value={emailOtp}
                                onChange={(e) => {
                                  setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                                  setEmailOtpError(null);
                                }}
                                className="tracking-widest text-center text-lg border-zinc-700 bg-zinc-800/50 text-white"
                                maxLength={6}
                              />
                              <Button
                                type="button"
                                onClick={handleVerifyEmailOtp}
                                disabled={emailOtp.length !== 6 || isVerifyingEmailOtp}
                                className="shrink-0 bg-green-600 hover:bg-green-700"
                              >
                                {isVerifyingEmailOtp ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  "Verify"
                                )}
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Phone + OTP Verification */}
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-zinc-300">
                        Phone Number <span className="text-red-400">*</span>
                      </Label>
                      {phoneVerified ? (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                          <ShieldCheck className="w-5 h-5 text-green-500" />
                          <span className="text-sm text-green-400">Phone verified</span>
                          <span className="text-sm text-zinc-400 ml-auto">{phone}</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                              <Input
                                id="phone"
                                type="tel"
                                placeholder="9876543210"
                                value={phone}
                                onChange={handlePhoneChange}
                                disabled={phoneOtpSent}
                                className={`pl-10 border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500 ${
                                  phone && !phoneError
                                    ? "border-green-500 focus-visible:ring-green-500"
                                    : phoneError
                                    ? "border-red-500 focus-visible:ring-red-500"
                                    : ""
                                }`}
                                maxLength={15}
                              />
                            </div>
                            <Button
                              type="button"
                              onClick={handleSendPhoneOtp}
                              disabled={!phone || !!phoneError || isSendingPhoneOtp || phoneOtpCooldown > 0}
                              variant={phoneOtpSent ? "outline" : "default"}
                              className="shrink-0"
                            >
                              {isSendingPhoneOtp ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : phoneOtpSent ? (
                                phoneOtpCooldown > 0 ? `${phoneOtpCooldown}s` : "Resend"
                              ) : (
                                "Send OTP"
                              )}
                            </Button>
                          </div>
                          {phoneError && (
                            <p className="text-xs text-red-400 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {phoneError}
                            </p>
                          )}
                          {!phoneError && !phoneOtpSent && !phoneOtpError && phone && (
                            <p className="text-xs text-zinc-400">
                              Indian mobile number (10 digits). We&apos;ll send a verification OTP.
                            </p>
                          )}
                          {phoneOtpError && (
                            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {phoneOtpError}
                            </p>
                          )}
                          {phoneOtpSent && (
                            <div className="flex gap-2 mt-1">
                              <Input
                                type="text"
                                inputMode="numeric"
                                placeholder="Enter 6-digit OTP"
                                value={phoneOtp}
                                onChange={(e) => {
                                  setPhoneOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                                  setPhoneOtpError(null);
                                }}
                                className="tracking-widest text-center text-lg border-zinc-700 bg-zinc-800/50 text-white"
                                maxLength={6}
                              />
                              <Button
                                type="button"
                                onClick={handleVerifyPhoneOtp}
                                disabled={phoneOtp.length !== 6 || isVerifyingPhoneOtp}
                                className="shrink-0 bg-green-600 hover:bg-green-700"
                              >
                                {isVerifyingPhoneOtp ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  "Verify"
                                )}
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                      <div id="recaptcha-container-dev"></div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="appName" className="text-zinc-300">
                        App / Project Name{" "}
                        <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        id="appName"
                        placeholder="My Study App"
                        value={appName}
                        onChange={(e) => setAppName(e.target.value)}
                        required
                        className="border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="appDescription" className="text-zinc-300">
                        App Description{" "}
                        <span className="text-red-400">*</span>
                      </Label>
                      <Textarea
                        id="appDescription"
                        placeholder="Briefly describe what you're building..."
                        value={appDescription}
                        onChange={(e) => setAppDescription(e.target.value)}
                        required
                        rows={3}
                        className="border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="websiteUrl" className="text-zinc-300">
                        Website URL{" "}
                        <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        id="websiteUrl"
                        type="url"
                        placeholder="https://yourapp.com"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        required
                        className="border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500"
                      />
                    </div>

                    {/* Honeypot — hidden from real users, bots auto-fill it */}
                    <div className="absolute -left-[9999px]" aria-hidden="true">
                      <label htmlFor="company_field">Company</label>
                      <input
                        type="text"
                        id="company_field"
                        name="company"
                        tabIndex={-1}
                        autoComplete="off"
                      />
                    </div>

                    {/* Turnstile CAPTCHA */}
                    <Turnstile
                      onVerify={(token) => setTurnstileToken(token)}
                      onExpire={() => setTurnstileToken(null)}
                      onError={() => setTurnstileToken(null)}
                      className="flex justify-center"
                    />

                    <Button
                      type="submit"
                      disabled={isSubmitting || !turnstileToken || !emailVerified || !phoneVerified}
                      className="w-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                      size="lg"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="animate-spin" />
                          Generating key...
                        </>
                      ) : (
                        <>
                          <Key />
                          Generate Free API Key
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* API Key Display */}
                <Card className="border-emerald-500/30 bg-emerald-950/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg text-emerald-400">
                      <Check className="size-5" />
                      Your API Key
                    </CardTitle>
                    <CardDescription>
                      This key will only be shown once. Copy it now and store it
                      securely.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 overflow-x-auto rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2.5 font-mono text-sm text-emerald-300">
                        {apiKeyData.api_key}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={copyApiKey}
                        className="shrink-0 border-zinc-700 hover:bg-zinc-800"
                      >
                        {copied ? (
                          <Check className="size-4 text-emerald-400" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </Button>
                    </div>

                    <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-950/20 p-3">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
                      <p className="text-sm text-amber-300">
                        Save this key now. You won&apos;t be able to see it
                        again. If you lose it, you&apos;ll need to contact
                        support for a replacement.
                      </p>
                    </div>

                    <Separator className="bg-zinc-800" />

                    <div className="grid grid-cols-3 gap-3 text-center text-sm">
                      <div>
                        <div className="font-semibold text-white">
                          {apiKeyData.tier.toUpperCase()}
                        </div>
                        <div className="text-zinc-500">Tier</div>
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          {apiKeyData.rate_limit_rpm} RPM
                        </div>
                        <div className="text-zinc-500">Rate Limit</div>
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          {apiKeyData.monthly_quota.toLocaleString()}
                        </div>
                        <div className="text-zinc-500">Monthly Quota</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Start After Key */}
                <Card className="border-zinc-800 bg-zinc-900/50">
                  <CardHeader>
                    <CardTitle className="text-lg text-white">
                      Quick Start
                    </CardTitle>
                    <CardDescription>
                      Try your first API call right now.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm text-zinc-400">
                        Search for PYQ questions:
                      </p>
                      <pre className="overflow-x-auto rounded-md border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-300">
                        {`curl -X POST ${apiBaseUrl} \\
  -H "Authorization: Bearer ${apiKeyData.api_key}" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "fundamental rights", "subject": "Indian Polity", "limit": 5}'`}
                      </pre>
                      <p className="text-sm text-zinc-400">
                        Generate a mock test:
                      </p>
                      <pre className="overflow-x-auto rounded-md border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-300">
                        {`curl -X POST ${apiBaseUrl}/mock-test \\
  -H "Authorization: Bearer ${apiKeyData.api_key}" \\
  -H "Content-Type: application/json" \\
  -d '{"pattern": "undersecretary-prelims"}'`}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Right Column: Info & Features */}
          <div className="space-y-8">
            {/* ClawHub / OpenClaw */}
            <div>
              <h2 className="mb-3 text-lg font-semibold text-white">
                ClawHub / OpenClaw Access
              </h2>
              <p className="mb-3 text-sm text-zinc-400">
                This API is also available as an OpenClaw skill on ClawHub, making it accessible to 100K+ AI agents.
              </p>
              <div className="space-y-2 text-sm text-zinc-400">
                <div className="flex items-center gap-2">
                  <Zap className="size-4 text-emerald-400" />
                  <span>
                    Install:{" "}
                    <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-emerald-300">
                      npx clawdhub install prepspsc-pyq
                    </code>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Code2 className="size-4 text-emerald-400" />
                  <span>
                    Skill ID:{" "}
                    <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-emerald-300">
                      prepspsc-pyq@1.0.0
                    </code>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ExternalLink className="size-4 text-emerald-400" />
                  <a
                    href="https://clawhub.ai/skills/prepspsc-pyq"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:underline"
                  >
                    View on ClawHub Registry
                  </a>
                </div>
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* MCP Server */}
            <div>
              <h2 className="mb-3 text-lg font-semibold text-white">
                <Terminal className="mr-2 inline size-5" />
                MCP Server (for AI Agents)
              </h2>
              <p className="mb-3 text-sm text-zinc-400">
                Connect directly from any MCP-compatible AI
                agent. All 11 tools show up natively — just type
                &quot;generate me an SPSC mock test&quot;.
              </p>
              <div className="space-y-3 text-sm text-zinc-400">
                <div>
                  <p className="mb-1 text-xs font-medium text-zinc-300">
                    Add to your MCP client settings:
                  </p>
                  <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs text-emerald-300">
{`{
  "mcpServers": {
    "prepspsc": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "env": {
        "PREPSPSC_API_KEY": "sk_live_YOUR_KEY"
      }
    }
  }
}`}
                  </pre>
                </div>
                <div className="flex items-center gap-2">
                  <ExternalLink className="size-4 text-emerald-400" />
                  <a
                    href="https://prepspsc.com/.well-known/agents.json"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:underline"
                  >
                    Agent Protocol Discovery
                  </a>
                  <span className="text-zinc-600">|</span>
                  <a
                    href="https://prepspsc.com/.well-known/mcp.json"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:underline"
                  >
                    MCP Tool Definitions
                  </a>
                </div>
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* AI Question Generation */}
            <div>
              <h2 className="mb-3 text-lg font-semibold text-white">
                <Sparkles className="mr-2 inline size-5" />
                AI Question Generation
              </h2>
              <p className="mb-3 text-sm text-zinc-400">
                Use the 7,400+ real PYQs as few-shot reference examples to
                generate unlimited new questions with any LLM. Each question
                includes topics, cognitive level, difficulty, and exam metadata
                — everything your AI needs to match real SPSC exam standards.
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-xs text-zinc-400">
                <li>Fetch exam patterns to understand subject distribution</li>
                <li>Search for reference questions on your target topic</li>
                <li>
                  Use returned questions as few-shot examples in your AI prompt
                </li>
                <li>
                  Match the format: question + 4 options + correct answer +
                  explanation
                </li>
              </ol>
            </div>

            <Separator className="bg-zinc-800" />

            {/* API Features */}
            <div>
              <h2 className="mb-4 text-xl font-semibold text-white">
                What you can build
              </h2>
              <div className="grid gap-3">
                {API_FEATURES.map((feature) => (
                  <div
                    key={feature.title}
                    className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-zinc-800">
                      <feature.icon className="size-4 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white">
                        {feature.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Free Tier Details */}
            <div>
              <h2 className="mb-3 text-lg font-semibold text-white">
                Free Tier Includes
              </h2>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-400" />
                  10 requests per minute rate limit
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-400" />
                  1,000 API calls per month
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-400" />
                  Full access to PYQ search and mock tests
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-400" />
                  Semantic vector search with AI embeddings
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-400" />
                  JSON responses with detailed metadata
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-400" />
                  No credit card required
                </li>
              </ul>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Quick Start (before key is generated) */}
            {!apiKeyData && (
              <div>
                <h2 className="mb-3 text-lg font-semibold text-white">
                  Quick Start
                </h2>
                <p className="mb-3 text-sm text-zinc-400">
                  Once you have your API key, making requests is simple:
                </p>
                <pre className="overflow-x-auto rounded-md border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-300">
                  {`curl -X POST ${apiBaseUrl} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "Sikkim history", "subject": "History", "limit": 5}'`}
                </pre>
              </div>
            )}

            {/* Links */}
            <div className="flex flex-wrap gap-3">
              <a
                href="https://prepspsc.com/.well-known/mcp.json"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                >
                  <Code2 className="size-4" />
                  Full API Docs
                  <ExternalLink className="size-3" />
                </Button>
              </a>
              <div>
                <Button
                  variant="outline"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                  asChild
                >
                  <a href="mailto:prepspsc@protonmail.com">
                    <Shield className="size-4" />
                    Request Higher Limits
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Authentication Section */}
        <div className="mt-16">
          <Separator className="mb-12 bg-zinc-800" />
          <h2 className="mb-6 text-center text-2xl font-bold text-white">
            Authentication
          </h2>
          <div className="mx-auto max-w-2xl">
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardContent className="pt-6">
                <p className="mb-4 text-sm text-zinc-400">
                  All API requests must include your API key in the{" "}
                  <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-emerald-300">
                    Authorization: Bearer
                  </code>{" "}
                  header:
                </p>
                <pre className="overflow-x-auto rounded-md border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-300">
                  {`// Using fetch
const response = await fetch("${apiBaseUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer sk_live_your_key_here"
  },
  body: JSON.stringify({
    query: "fundamental rights Article 14",
    subject: "Indian Polity",
    limit: 10
  })
});

const data = await response.json();
console.log(data.questions);`}
                </pre>
                <div className="mt-4 flex items-start gap-2 rounded-md border border-blue-500/20 bg-blue-950/20 p-3">
                  <Shield className="mt-0.5 size-4 shrink-0 text-blue-400" />
                  <p className="text-sm text-blue-300">
                    Your API key is hashed on our servers. We never store the
                    raw key. Keep it secret and never expose it in client-side
                    code.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 border-t border-zinc-800 pt-8 text-center">
          <p className="text-sm text-zinc-500">
            PrepSPSC Developer API — Built for exam preparation app builders.
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Need help? Contact{" "}
            <a
              href="mailto:prepspsc@protonmail.com"
              className="text-emerald-500 hover:underline"
            >
              prepspsc@protonmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
