"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Info } from "lucide-react";

interface UploadTipsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadTipsDialog({ open, onOpenChange }: UploadTipsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            Tips For Best Results
          </DialogTitle>
          <DialogDescription>
            Follow these guidelines to ensure accurate AI evaluation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tips List */}
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span className="text-sm">
                Write neatly with sufficient spacing between lines
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span className="text-sm">
                Ensure your answer is the only content present in the image
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span className="text-sm">
                Click images of your written answer and compile them into a PDF using tools like{" "}
                <a
                  href="https://www.ilovepdf.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  ilovepdf.com
                </a>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span className="text-sm">Keep the PDF file size under 5 MB</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span className="text-sm">Limit the PDF to a maximum of 5 pages</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span className="text-sm">
                Ensure the pages in the PDF are in portrait format
              </span>
            </li>
          </ul>

          {/* Visual Examples */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            {/* Good Example */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-medium">Good</span>
              </div>
              <div className="relative aspect-[3/4] rounded-lg overflow-hidden border-2 border-green-500/30 bg-secondary/30">
                <div className="absolute inset-0 p-3 flex flex-col">
                  <div className="space-y-2">
                    <div className="h-2 bg-foreground/20 rounded w-3/4"></div>
                    <div className="h-2 bg-foreground/20 rounded w-full"></div>
                    <div className="h-2 bg-foreground/20 rounded w-5/6"></div>
                    <div className="h-2 bg-foreground/20 rounded w-full"></div>
                    <div className="h-2 bg-foreground/20 rounded w-2/3"></div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-2 bg-foreground/20 rounded w-full"></div>
                    <div className="h-2 bg-foreground/20 rounded w-4/5"></div>
                    <div className="h-2 bg-foreground/20 rounded w-full"></div>
                  </div>
                </div>
                <div className="absolute bottom-2 right-2">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Clear, well-spaced writing
              </p>
            </div>

            {/* Bad Example */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-red-500">
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Avoid</span>
              </div>
              <div className="relative aspect-[3/4] rounded-lg overflow-hidden border-2 border-red-500/30 bg-secondary/30">
                <div className="absolute inset-0 p-2 flex flex-col">
                  <div className="space-y-0.5">
                    <div className="h-1.5 bg-foreground/30 rounded w-full"></div>
                    <div className="h-1.5 bg-foreground/30 rounded w-full"></div>
                    <div className="h-1.5 bg-foreground/30 rounded w-full"></div>
                    <div className="h-1.5 bg-foreground/30 rounded w-full"></div>
                    <div className="h-1.5 bg-foreground/30 rounded w-full"></div>
                    <div className="h-1.5 bg-foreground/30 rounded w-full"></div>
                    <div className="h-1.5 bg-foreground/30 rounded w-full"></div>
                    <div className="h-1.5 bg-foreground/30 rounded w-full"></div>
                    <div className="h-1.5 bg-foreground/30 rounded w-full"></div>
                    <div className="h-1.5 bg-foreground/30 rounded w-full"></div>
                  </div>
                </div>
                <div className="absolute bottom-2 right-2">
                  <XCircle className="w-6 h-6 text-red-500" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Cramped, unclear writing
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
