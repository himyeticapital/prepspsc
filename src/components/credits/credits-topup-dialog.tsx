"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buyCreditPack } from "./cashfree-checkout";

interface Pack {
  id: string;
  label: string;
  amountPaise: number;
  betterAnswers: number;
}

interface CreditsInfo {
  balancePaise: number;
  betterAnswerPricePaise: number;
  betterAnswersLeft: number;
  packs: Pack[];
}

const rupees = (paise: number) => {
  const r = paise / 100;
  return Number.isInteger(r) ? `₹${r}` : `₹${r.toFixed(2)}`;
};

export async function fetchCreditsInfo(): Promise<CreditsInfo | null> {
  const res = await fetch("/api/credits", { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

interface CreditsTopUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToppedUp?: (balancePaise: number) => void;
  reason?: string;
}

export function CreditsTopUpDialog({ open, onOpenChange, onToppedUp, reason }: CreditsTopUpDialogProps) {
  const [info, setInfo] = useState<CreditsInfo | null>(null);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    if (open) fetchCreditsInfo().then(setInfo);
  }, [open]);

  const buy = async (packId: string) => {
    setBuying(packId);
    try {
      const result = await buyCreditPack(packId);
      if (result.ok) {
        toast.success(`Credits added. Balance: ${rupees(result.balancePaise)}`);
        onToppedUp?.(result.balancePaise);
        onOpenChange(false);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Something went wrong with the payment. Please try again.");
    } finally {
      setBuying(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-purple-400" /> AI credits
          </DialogTitle>
          <DialogDescription>
            {reason ??
              "Everything in PrepSPSC is free. Credits are only for optional better answers from a stronger AI model."}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl bg-white/5 p-4 text-center">
          <p className="text-xs text-white/50">Your balance</p>
          <p className="text-3xl font-semibold text-white">{info ? rupees(info.balancePaise) : "…"}</p>
          {info && (
            <p className="text-xs text-white/50">
              {info.betterAnswersLeft} better answer{info.betterAnswersLeft === 1 ? "" : "s"} at{" "}
              {rupees(info.betterAnswerPricePaise)} each
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(info?.packs ?? []).map((pack) => (
            <Button
              key={pack.id}
              variant="outline"
              disabled={buying !== null}
              onClick={() => buy(pack.id)}
              className="h-auto flex-col gap-0.5 py-3"
            >
              {buying === pack.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span className="text-base font-semibold">{pack.label}</span>
                  <span className="text-[11px] text-white/50">{pack.betterAnswers} answers</span>
                </>
              )}
            </Button>
          ))}
        </div>

        <p className="text-[11px] leading-relaxed text-white/40">
          Paid securely through Cashfree. If a better answer fails, the ₹5 goes back to your balance
          automatically. Credits don&apos;t expire. See the{" "}
          <Link href="/terms" className="underline">terms</Link> for refunds.
        </p>
      </DialogContent>
    </Dialog>
  );
}
