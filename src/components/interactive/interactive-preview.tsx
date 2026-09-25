"use client";

import { ExternalLink, List, Phone, Copy, Reply } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { InteractiveMessagePayload } from "@/lib/whatsapp/interactive";

/**
 * WhatsApp-style read-only or interactive render of an interactive message. Used both
 * in the builder's live preview and by the inbox message bubble so a
 * sent buttons/list message shows the same way it does on the phone.
 *
 * The buttons/rows can optionally trigger actions (URL open, phone call, code copy)
 * when `interactive` is true. Kept namespace-free so it can
 * be dropped into the composer, the automation builder, and the
 * quick-replies manager without namespace coupling: fallback
 * labels shown for empty fields default to plain English, and a host
 * that has a translator can pass its own via `labels`.
 */
export interface InteractivePreviewLabels {
  /** Shown in place of an empty body. */
  body?: string;
  /** Shown in place of an untitled reply button. */
  button?: string;
  /** Shown in place of an empty list button label. */
  menu?: string;
  /** Shown when code is copied. */
  codeCopied?: string;
}

export function InteractivePreview({
  payload,
  className,
  labels,
  interactive = false,
}: {
  payload: InteractiveMessagePayload;
  className?: string;
  labels?: InteractivePreviewLabels;
  interactive?: boolean;
}) {
  const bodyLabel = labels?.body ?? "Message body…";
  const buttonLabel = labels?.button ?? "Button";
  const menuLabel = labels?.menu ?? "Menu";
  const codeCopiedLabel = labels?.codeCopied ?? "Code copied to clipboard!";

  return (
    <div
      className={cn(
        "w-full max-w-[260px] overflow-hidden rounded-lg bg-card text-foreground shadow-sm ring-1 ring-border",
        className,
      )}
    >
      <div className="px-3 py-2">
        {payload.header ? (
          <p className="mb-1 break-words text-sm font-semibold">
            {payload.header}
          </p>
        ) : null}
        <p className="whitespace-pre-wrap break-words text-sm">
          {payload.body || (
            <span className="text-muted-foreground">{bodyLabel}</span>
          )}
        </p>
        {payload.footer ? (
          <p className="mt-1 break-words text-[11px] text-muted-foreground">
            {payload.footer}
          </p>
        ) : null}
      </div>

      {payload.kind === "buttons" ? (
        <div className="flex flex-col border-t border-border">
          {payload.buttons.map((b, i) => {
            const btnType = b.type || "quick_reply";
            const isClickable = interactive && btnType !== "quick_reply";

            const handleClick = (e: React.MouseEvent) => {
              if (!interactive) return;
              e.stopPropagation();
              if (btnType === "url" && b.url) {
                window.open(b.url, "_blank", "noopener,noreferrer");
              } else if (btnType === "call_phone_number" && b.phone_number) {
                window.open(`tel:${b.phone_number}`);
              } else if (btnType === "copy_code" && b.code) {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(b.code);
                }
                toast.success(`${codeCopiedLabel}: ${b.code}`);
              }
            };

            return (
              <button
                key={b.id || i}
                type="button"
                disabled={!isClickable}
                onClick={handleClick}
                className={cn(
                  "flex items-center justify-center gap-1.5 border-t border-border py-2 text-sm font-medium text-primary first:border-t-0 transition-colors",
                  isClickable &&
                    "hover:bg-primary/10 active:bg-primary/20 cursor-pointer",
                )}
              >
                {btnType === "url" ? (
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                ) : btnType === "call_phone_number" ? (
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                ) : btnType === "copy_code" ? (
                  <Copy className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Reply className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">{b.title || buttonLabel}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <button
          type="button"
          disabled
          className="flex w-full items-center justify-center gap-1.5 border-t border-border py-2 text-sm font-medium text-primary"
        >
          <List className="h-3.5 w-3.5" />
          <span className="truncate">{payload.button_label || menuLabel}</span>
        </button>
      )}
    </div>
  );
}
