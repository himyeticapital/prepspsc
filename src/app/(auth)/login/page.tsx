"use client";

import { useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Turnstile } from "@/components/ui/turnstile";
import { Chrome, Loader2, ArrowRight, FlaskConical } from "lucide-react";
import { loadOnboardingState } from "@/lib/onboarding";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // Email login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  const supabase = createClient();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Verify CAPTCHA
      if (turnstileToken) {
        const captchaRes = await fetch("/api/auth/verify-captcha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: turnstileToken }),
        });
        if (!captchaRes.ok) {
          if (captchaRes.status === 429) {
            setError("Too many login attempts. Please wait a few minutes and try again.");
          } else if (captchaRes.status === 503) {
            setError("Service temporarily unavailable. Please try again in a moment.");
          } else {
            setError("CAPTCHA verification failed. Please try again.");
          }
          // Reset token so user gets a fresh challenge
          setTurnstileToken(null);
          setIsLoading(false);
          return;
        }
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setIsLoading(false);
        return;
      }

      // Check the saved phone too, including previously half-saved Google accounts.
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { complete } = await loadOnboardingState(supabase, user.id);
        if (!complete) {
          router.refresh();
          router.push("/onboarding");
          return;
        }
      }

      // Use router.refresh() to update server state, then redirect
      router.refresh();
      router.push(redirectTo);
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/callback?redirect=${redirectTo}`,
        },
      });

      if (error) {
        setError(error.message);
        setIsGoogleLoading(false);
      }
      // Note: On success, browser will redirect to Google, so loading stays true
    } catch {
      setError("Failed to connect to Google. Please try again.");
      setIsGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address first");
      return;
    }

    setIsResettingPassword(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setError(error.message);
      } else {
        setMessage("Password reset link sent to your email!");
      }
    } catch {
      setError("Failed to send reset email. Please try again.");
    } finally {
      setIsResettingPassword(false);
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
              PrepSPSC
            </h1>
            <p className="text-muted-foreground">
              Sign in to continue your preparation
            </p>
          </div>

          {/* Error/Message Display */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-3 mb-4 text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-primary/10 border border-primary/20 text-primary rounded-lg p-3 mb-4 text-sm">
              {message}
            </div>
          )}

          {/* Google Login */}
          <Button
            variant="outline"
            className="w-full mb-6"
            onClick={handleGoogleLogin}
            disabled={isLoading || isGoogleLoading}
          >
            {isGoogleLoading ? (
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
                Or continue with email
              </span>
            </div>
          </div>

          {/* Email Login */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isResettingPassword}
                  className="text-xs text-primary hover:underline disabled:opacity-50"
                >
                  {isResettingPassword ? "Sending..." : "Forgot password?"}
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Turnstile
              onVerify={handleTurnstileVerify}
              onExpire={handleTurnstileExpire}
              className="mb-4 flex justify-center"
            />
            <Button
              type="submit"
              className="w-full primary-glow"
              disabled={isLoading || isGoogleLoading || !turnstileToken}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              Sign In
            </Button>
          </form>

          {/* Sign Up Link */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-primary hover:underline font-medium"
            >
              Sign up
            </Link>
          </p>

          {/* Test Login - Development Only */}
          {process.env.NODE_ENV === "development" && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Development
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                onClick={() => router.push("/dashboard?preview=true")}
              >
                <FlaskConical className="w-4 h-4 mr-2" />
                Test Login (Preview Mode)
              </Button>
            </>
          )}
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

function LoginFormFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="glass-card p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold gradient-text mb-2">
              PrepSPSC
            </h1>
            <p className="text-muted-foreground">
              Sign in to continue your preparation
            </p>
          </div>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  );
}
