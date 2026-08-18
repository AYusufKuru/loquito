"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorDialogProps {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
}

export function ErrorDialog({
  open,
  title = "Hata",
  message,
  onClose,
}: ErrorDialogProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Kapat"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="error-dialog-title"
        className={cn(
          "relative z-10 w-full max-w-md rounded-lg border bg-card text-card-foreground shadow-lg",
          "animate-in fade-in-0 zoom-in-95 duration-200",
        )}
      >
        <div className="border-b px-4 py-3">
          <h2
            id="error-dialog-title"
            className="text-base font-semibold text-destructive"
          >
            {title}
          </h2>
        </div>
        <div className="px-4 py-4">
          <p className="whitespace-pre-wrap text-sm text-foreground">{message}</p>
        </div>
        <div className="flex justify-end border-t px-4 py-3">
          <Button type="button" onClick={onClose}>
            Tamam
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
