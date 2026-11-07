"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CreditsTopUpDialog, fetchCreditsInfo } from "./credits-topup-dialog";

interface BetterAnswerButtonProps {
  /** Sends the request for the better answer (the server charges ₹5 and refunds on failure). */
  request: () => Promise<Response>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess: (data: any) => void;
  /** What is being upgraded, e.g. "summary". */
  what?: string;
  compact?: boolean;
  className?: string;
}

/**
 * "Not happy with this answer?" — redo it with the stronger model for ₹5 from AI credits.
 * Asks once before charging, and opens the top-up dialog when the balance is too low.
 */
export function BetterAnswerButton({ request, onSuccess, what = "answer", compact, className }: BetterAnswerButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [balancePaise, setBalancePaise] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  const openConfirm = async () => {
    setConfirmOpen(true);
    const info = await fetchCreditsInfo();
    setBalancePaise(info?.balancePaise ?? 0);
  };

  const run = async () => {
    setConfirmOpen(false);
    setRunning(true);
    try {
      const res = await request();
      const data = await res.json().catch(() => ({}));
      if (res.status === 402 && data.code === "INSUFFICIENT_CREDITS") {
        setTopUpOpen(true);
        return;
      }
      if (!res.ok) {
        toast.error(`${data.error || "The better answer failed."} You were not charged.`);
        return;
      }
      toast.success("Better answer ready.");
      onSuccess(data);
    } catch {
      toast.error("The better answer failed. You were not charged.");
    } finally {
      setRunning(false);
    }
  };

  const lowBalance = balancePaise !== null && balancePaise < 500;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={openConfirm}
        disabled={running}
        title={`Redo this ${what} with a stronger AI model (₹5)`}
        className={cn(
          compact ? "h-8 w-8 p-0" : "gap-1.5",
          "text-purple-300/70 hover:text-purple-200",
          className
        )}
      >
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
        {!compact && <span>Better answer · ₹5</span>}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Get a better {what}?</DialogTitle>
            <DialogDescription>
              We&apos;ll redo it with Gemini 3 Flash, our stronger model. It costs ₹5 from your AI credits.
              If it fails, you get the ₹5 back.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-white/60">
            Balance: {balancePaise === null ? "…" : `₹${(balancePaise / 100).toFixed(balancePaise % 100 ? 2 : 0)}`}
          </p>
          <DialogFooter className="gap-2">
            {lowBalance ? (
              <Button
                onClick={() => {
                  setConfirmOpen(false);
                  setTopUpOpen(true);
                }}
              >
                Top up credits
              </Button>
            ) : (
              <Button onClick={run} disabled={balancePaise === null}>
                Pay ₹5 and redo
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreditsTopUpDialog
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
        onToppedUp={(b) => setBalancePaise(b)}
        reason="You need ₹5 in AI credits for a better answer. Everything else stays free."
      />
    </>
  );
}
