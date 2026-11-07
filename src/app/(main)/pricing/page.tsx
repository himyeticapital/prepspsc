"use client";

import { isAllFeaturesFree } from "@/lib/access";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuthStore, getTrialStatus } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Check,
  Crown,
  Zap,
  Loader2,
  X,
  Sparkles,
  Shield,
  Timer,
  Target,
  Palette,
  Trophy,
  BarChart3,
  Brain,
  Users,
  Bot,
} from "lucide-react";
import { toast } from "sonner";

declare global {
  interface Window {
    Cashfree?: (config: { mode: string }) => CashfreeInstance;
  }
}

interface CashfreeInstance {
  checkout: (options: {
    paymentSessionId: string;
    redirectTarget: string;
  }) => Promise<{ error?: { message: string }; paymentDetails?: { paymentMessage: string } }>;
}

// Feature comparison data
const featureComparison = [
  {
    category: "AI Study Tools",
    icon: Brain,
    features: [
      { name: "AI generations (mindmaps, summaries, flashcards, quiz, infographics)", free: "1 each/day", pro: "Unlimited" },
      { name: "Current affairs bot", free: true, pro: true },
      { name: "Typed blurt (active recall)", free: true, pro: true },
      { name: "Paper blurt (handwritten analysis)", free: false, pro: true },
      { name: "AI-powered test evaluation", free: true, pro: true },
      { name: "1.5x XP on AI-generated content", free: false, pro: true },
    ],
  },
  {
    category: "Tests & Quizzes",
    icon: Target,
    features: [
      { name: "Free mock tests", free: true, pro: true },
      { name: "Premium mock tests", free: false, pro: true },
      { name: "AI-powered essay evaluation", free: true, pro: true },
      { name: "Detailed score analytics per test", free: false, pro: true },
    ],
  },
  {
    category: "Gamification",
    icon: Trophy,
    features: [
      { name: "XP & Leveling system", free: "1x", pro: "1.5x multiplier" },
      { name: "Basic achievements (13 badges)", free: true, pro: true },
      { name: "Pro-exclusive achievements (5 badges)", free: false, pro: true },
      { name: "Streak shields (save your streak)", free: false, pro: "3/month" },
      { name: "Custom profile frames", free: false, pro: true },
    ],
  },
  {
    category: "Timer & Productivity",
    icon: Timer,
    features: [
      { name: "Pomodoro timer", free: "25 min fixed", pro: "15-90 min custom" },
      { name: "Session history", free: "7 days", pro: "Unlimited" },
      { name: "Study goals (weekly/monthly)", free: false, pro: true },
      { name: "Long break customization", free: false, pro: true },
    ],
  },
  {
    category: "Analytics & Insights",
    icon: BarChart3,
    features: [
      { name: "Basic stats", free: true, pro: true },
      { name: "Detailed performance analytics", free: false, pro: true },
      { name: "Topic-wise strength analysis", free: false, pro: true },
      { name: "Export session data", free: false, pro: true },
    ],
  },
  {
    category: "Community & Rooms",
    icon: Users,
    features: [
      { name: "Public study rooms", free: true, pro: true },
      { name: "Create & join premium rooms (invite Pro members)", free: false, pro: true },
    ],
  },
];

const plans = [
  {
    id: "monthly",
    name: "Pro Monthly",
    price: 999,
    period: "/month",
    description: "Full access to all features",
    highlight: "Most Popular",
    popular: true,
  },
  {
    id: "yearly",
    name: "Pro Yearly",
    price: 10000,
    period: "/year",
    description: "Best value for committed learners",
    highlight: "Save ₹1,988",
    savings: true,
  },
];

// Pro feature highlights
const proHighlights = [
  {
    icon: Bot,
    title: "Unlimited AI Generations",
    description: "Generate unlimited mindmaps, summaries, flashcards, quizzes & infographics",
    color: "text-emerald-400",
  },
  {
    icon: Target,
    title: "Premium Mock Tests",
    description: "Access tests designed for latest SPSC exam patterns",
    color: "text-cyan-400",
  },
  {
    icon: Sparkles,
    title: "1.5x XP Multiplier",
    description: "Level up faster with 50% more XP on every activity",
    color: "text-primary",
  },
  {
    icon: Shield,
    title: "3 Streak Shields/month",
    description: "Protect your study streak when life gets busy",
    color: "text-orange-400",
  },
  {
    icon: Timer,
    title: "Custom Pomodoro",
    description: "Set work sessions from 15 to 90 minutes",
    color: "text-blue-400",
  },
  {
    icon: Palette,
    title: "Profile Frames",
    description: "Stand out with exclusive profile customization",
    color: "text-purple-400",
  },
  {
    icon: Trophy,
    title: "Pro Achievements",
    description: "Unlock exclusive badges and milestones",
    color: "text-yellow-400",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description: "Topic-wise strength analysis & performance export",
    color: "text-rose-400",
  },
];

export default function PricingPage() {
  if (isAllFeaturesFree()) return <AllFeaturesFreeNotice />;
  return <PaidPlans />;
}

function AllFeaturesFreeNotice() {
  const router = useRouter();
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="widget-glass max-w-lg w-full p-8 rounded-2xl text-center"
      >
        <div className="w-14 h-14 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-5">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">PrepSPSC is free</h1>
        <p className="text-white/60 mb-6">
          Every feature — AI study tools, mock tests, premium rooms, streak shields and more — is now
          unlocked for everyone. No subscription needed.
        </p>
        <Button onClick={() => router.push("/dashboard")} className="gap-2">
          <Check className="w-4 h-4" />
          Start studying
        </Button>
      </motion.div>
    </div>
  );
}

function PaidPlans() {
  const router = useRouter();
  const { profile, fetchProfile } = useAuthStore();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  // Check if Pro user is within 7 days of expiry (eligible for renewal)
  const isNearExpiry = (() => {
    if (!profile?.is_pro_member || !profile?.pro_expires_at) return false;
    const expiresAt = new Date(profile.pro_expires_at);
    const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 7;
  })();

  const canRenew = profile?.is_pro_member && isNearExpiry;
  const trial = getTrialStatus(profile);

  const loadCashfreeScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Cashfree) {
        resolve(true);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSubscribe = async (planId: string) => {
    setIsLoading(planId);

    try {
      // Load Cashfree script
      const isLoaded = await loadCashfreeScript();
      if (!isLoaded) {
        toast.error("Failed to load payment gateway");
        return;
      }

      // Create order
      const response = await fetch("/api/cashfree/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create order");
      }

      // Open Cashfree checkout
      const cashfreeMode =
        process.env.NEXT_PUBLIC_CASHFREE_ENV === "production"
          ? "production"
          : "sandbox";
      const cashfree = window.Cashfree!({ mode: cashfreeMode });

      const result = await cashfree.checkout({
        paymentSessionId: data.paymentSessionId,
        redirectTarget: "_modal",
      });

      if (result.error) {
        toast.error(result.error.message || "Payment was cancelled");
        return;
      }

      // Verify payment on server
      const verifyResponse = await fetch("/api/cashfree/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: data.orderId,
          planId,
        }),
      });

      if (verifyResponse.ok) {
        await fetchProfile();
        toast.success(canRenew ? "Subscription renewed successfully!" : "Welcome to Pro! Enjoy premium features.");
        router.push("/dashboard");
      } else {
        toast.error("Payment verification failed");
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center p-6 rounded-2xl backdrop-blur-md bg-background/60"
      >
        <Badge className="mb-4 bg-accent/10 text-accent border-accent/20">
          <Crown className="w-3 h-3 mr-1" />
          Upgrade to Pro
        </Badge>
        <h1 className="text-3xl md:text-4xl font-bold mb-4 drop-shadow-lg">
          Supercharge Your <span className="gradient-text">Preparation</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto drop-shadow-sm">
          Start with a 7-day free trial. Then unlock all premium features with Pro.
        </p>
      </motion.div>

      {/* Trial Status Banner */}
      {trial?.isActive && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 text-center"
        >
          <p className="text-orange-400 font-medium">
            You&apos;re on your free trial — {trial.daysLeft} {trial.daysLeft === 1 ? "day" : "days"} left. Upgrade now to keep all features.
          </p>
        </motion.div>
      )}
      {trial?.isExpired && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-center"
        >
          <p className="text-red-400 font-medium">
            Your free trial has ended. Upgrade to Pro to unlock all features.
          </p>
        </motion.div>
      )}

      {/* Plans Grid */}
      <div className="grid md:grid-cols-2 gap-6 pt-4">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              "glass-card p-6 relative flex flex-col overflow-visible",
              plan.popular && "border-primary/50 primary-glow scale-105 z-10"
            )}
          >
            {plan.highlight && (
              <Badge
                className={cn(
                  "absolute -top-3 left-1/2 -translate-x-1/2",
                  plan.popular
                    ? "bg-primary text-primary-foreground"
                    : plan.savings
                    ? "bg-green-500 text-white"
                    : "bg-secondary"
                )}
              >
                {plan.highlight}
              </Badge>
            )}

            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold">
                  {plan.price === 0 ? "Free" : `₹${plan.price.toLocaleString()}`}
                </span>
                {plan.period && (
                  <span className="text-muted-foreground">{plan.period}</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {plan.description}
              </p>
              {plan.id === "yearly" && (
                <p className="text-xs text-green-400 mt-1">
                  ₹833/month when billed yearly
                </p>
              )}
            </div>

            <div className="flex-1" />

            <Button
              className={cn(
                "w-full",
                plan.popular ? "primary-glow" : ""
              )}
              size="lg"
              disabled={
                (profile?.is_pro_member && !canRenew && !trial?.isActive) ||
                isLoading !== null
              }
              onClick={() => handleSubscribe(plan.id)}
            >
              {isLoading === plan.id ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              {canRenew
                ? "Renew Now"
                : trial?.isActive || trial?.isExpired
                ? "Upgrade Now"
                : profile?.is_pro_member
                ? "Current Plan"
                : "Subscribe Now"}
            </Button>
          </motion.div>
        ))}
      </div>

      {/* Pro Feature Highlights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="py-8"
      >
        <h2 className="text-2xl font-bold text-center mb-8 drop-shadow-lg">
          What You Get with <span className="text-primary">Pro</span>
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {proHighlights.map((highlight, index) => (
            <motion.div
              key={highlight.title}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + index * 0.05 }}
              className="p-4 rounded-xl bg-background/70 backdrop-blur-md border border-white/10 hover:border-white/20 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0",
                    highlight.color
                  )}
                >
                  <highlight.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{highlight.title}</h3>
                  <p className="text-sm text-white/60">{highlight.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Feature Comparison Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="py-8"
      >
        <h2 className="text-2xl font-bold text-center mb-8 drop-shadow-lg">
          Full Feature Comparison
        </h2>
        <div className="rounded-xl border border-white/10 overflow-hidden backdrop-blur-md bg-background/80">
          {/* Header */}
          <div className="grid grid-cols-2 bg-white/10 border-b border-white/10">
            <div className="p-4 font-medium text-white/60">Feature</div>
            <div className="p-4 text-center font-medium">
              <span className="text-primary flex items-center justify-center gap-1">
                <Crown className="w-4 h-4" />
                Included in Pro
              </span>
            </div>
          </div>

          {/* Categories */}
          {featureComparison.map((category) => (
            <div key={category.category}>
              {/* Category header */}
              <div className="grid grid-cols-2 bg-white/[0.06] border-b border-white/10">
                <div className="p-3 col-span-2 font-semibold text-white flex items-center gap-2">
                  {category.icon && <category.icon className="w-4 h-4 text-primary" />}
                  {category.category}
                </div>
              </div>

              {/* Features */}
              {category.features.map((feature) => (
                <div
                  key={feature.name}
                  className="grid grid-cols-2 border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="p-3 text-sm text-white/80">{feature.name}</div>
                  <div className="p-3 text-center">
                    {typeof feature.pro === "boolean" ? (
                      feature.pro ? (
                        <Check className="w-5 h-5 text-primary mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-white/20 mx-auto" />
                      )
                    ) : (
                      <span className="text-sm text-primary font-medium">
                        {feature.pro}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </motion.div>

      {/* CTA Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="p-8 rounded-2xl bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 text-center backdrop-blur-md"
      >
        <Crown className="w-12 h-12 text-accent mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-white mb-2">
          {profile?.is_pro_member && !trial?.isActive
            ? "Ready to accelerate your preparation?"
            : "Start your 7-day free trial"}
        </h3>
        <p className="text-white/70 mb-6 max-w-lg mx-auto">
          {profile?.is_pro_member && !trial?.isActive
            ? "Join aspirants who are leveling up their Sikkim PSC preparation with Pro features"
            : "Experience all Pro features free for 7 days, then choose a plan that works for you"}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            size="lg"
            onClick={() => handleSubscribe("yearly")}
            disabled={(profile?.is_pro_member && !canRenew) || isLoading !== null}
            className="primary-glow"
          >
            {isLoading === "yearly" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            {canRenew ? "Renew Yearly" : "Get Pro Yearly"} - ₹10,000
            <Badge className="ml-2 bg-green-500 text-white border-green-600">
              Save ₹1,988
            </Badge>
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => handleSubscribe("monthly")}
            disabled={(profile?.is_pro_member && !canRenew) || isLoading !== null}
          >
            {isLoading === "monthly" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {canRenew ? "Renew Monthly" : "Try Pro Monthly"} - ₹999
          </Button>
        </div>
      </motion.div>

      {/* Trust signals */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-center text-sm text-muted-foreground pb-8 drop-shadow-sm"
      >
        <p>Secure payment powered by Cashfree</p>
        <p className="mt-1">7-day free trial • Cancel anytime • No hidden fees • Instant access</p>
      </motion.div>
    </div>
  );
}
