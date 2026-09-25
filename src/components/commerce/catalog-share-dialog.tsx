"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShoppingBag,
  Send,
  Copy,
  Check,
  ExternalLink,
  Store,
  MessageSquare,
  Sparkles,
  HelpCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import type { CommerceSettings } from "@/types";

interface CatalogShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings?: CommerceSettings | null;
}

interface ConversationOption {
  id: string;
  contactName: string;
  contactPhone: string;
}

export function CatalogShareDialog({
  open,
  onOpenChange,
  settings,
}: CatalogShareDialogProps) {
  const [tab, setTab] = useState<"send_chat" | "wa_guide">("send_chat");
  const [conversations, setConversations] = useState<ConversationOption[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string>("");
  const [customMessage, setCustomMessage] = useState(
    "Welcome to our store! Explore our full product catalog and shop online directly inside WhatsApp."
  );
  const [footerText, setFooterText] = useState("Tap below to view items & order");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/conversations?limit=30");
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data.conversations)) {
          const mapped = data.conversations.map((c: any) => ({
            id: c.id,
            contactName: c.contact?.name || "Unknown",
            contactPhone: c.contact?.phone || "",
          }));
          setConversations(mapped);
          if (mapped.length > 0) setSelectedConvId(mapped[0].id);
        }
      } catch {
        // Best effort
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const handleSendCatalog = async () => {
    if (!selectedConvId) {
      toast.error("Please select a conversation");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/whatsapp/send-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConvId,
          mode: "catalog_message",
          bodyText: customMessage,
          footerText: footerText,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to send catalog message");
      }

      toast.success("Catalog message sent with native 'View catalog' button!");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send catalog");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Share WhatsApp Catalog with Customers
              </DialogTitle>
              <DialogDescription className="text-xs">
                How other people on WhatsApp see and open your catalog
              </DialogDescription>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="mt-3 flex rounded-lg bg-muted p-1 text-xs">
            <button
              type="button"
              onClick={() => setTab("send_chat")}
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                tab === "send_chat"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Send &ldquo;View Catalog&rdquo; Card
            </button>
            <button
              type="button"
              onClick={() => setTab("wa_guide")}
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                tab === "wa_guide"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Storefront Icon Setup Guide
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {tab === "send_chat" ? (
            <div className="space-y-4">
              {/* WhatsApp Message Preview Card */}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  What Customer Sees in WhatsApp:
                </span>
                <div className="max-w-xs rounded-xl bg-card border border-border/80 p-3.5 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Store className="h-4 w-4 text-emerald-500" />
                    <span>Product Catalog</span>
                  </div>
                  <p className="text-xs text-foreground/90 whitespace-pre-wrap">
                    {customMessage}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{footerText}</p>
                  <div className="pt-2 border-t border-border">
                    <div className="w-full py-1.5 text-center text-xs font-semibold text-emerald-500 bg-emerald-500/10 rounded-md flex items-center justify-center gap-1.5">
                      <ShoppingBag className="h-3.5 w-3.5" />
                      View catalog
                    </div>
                  </div>
                </div>
              </div>

              {/* Target Conversation */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Recipient Conversation</Label>
                {loading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground h-9">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading conversations...
                  </div>
                ) : conversations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No active chats. Start a chat with a customer first.
                  </p>
                ) : (
                  <Select value={selectedConvId} onValueChange={(v) => { if (v) setSelectedConvId(v); }}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select customer conversation" />
                    </SelectTrigger>
                    <SelectContent>
                      {conversations.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.contactName} ({c.contactPhone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Message customization */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Welcome / Message Text</Label>
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Footer Note</Label>
                <Input
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <Button
                onClick={handleSendCatalog}
                disabled={sending || !selectedConvId}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9 gap-1.5"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    Delivering Catalog to WhatsApp...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 mr-1" />
                    Send &ldquo;View Catalog&rdquo; Card to Customer
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Feature 1: The WhatsApp Header Storefront Icon */}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h4 className="font-semibold text-sm text-foreground">
                    The Permanent Storefront (🛍️) Icon in WhatsApp
                  </h4>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  When you connect a Meta Product Catalog to your WhatsApp Business Account (WABA),
                  WhatsApp automatically displays a <strong>Shopping Bag icon (🛍️)</strong> in the top
                  header of the chat next to your business name on every customer’s phone.
                </p>

                <div className="rounded-lg bg-card border border-border p-3 space-y-2">
                  <p className="font-medium text-foreground">How to turn it on in Meta:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                    <li>
                      Go to{" "}
                      <a
                        href="https://business.facebook.com/wa/manage/home/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline inline-flex items-center gap-0.5"
                      >
                        WhatsApp Manager <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </li>
                    <li>Click <strong>Account Tools</strong> in the left sidebar ➔ <strong>Catalog</strong>.</li>
                    <li>Select your Meta Product Catalog and click <strong>Connect Catalog</strong>.</li>
                    <li>Toggle <strong>Show Catalog</strong> to active.</li>
                  </ol>
                  <p className="text-[11px] text-emerald-400 font-medium pt-1">
                    ✓ Once linked, every person who opens your WhatsApp chat will see the 🛍️ button.
                  </p>
                </div>
              </div>

              {/* Feature 2: Direct Universal Catalog Link */}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <h4 className="font-semibold text-sm text-foreground">
                    Direct WhatsApp Catalog Web Links
                  </h4>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Meta generates a direct deep link for every WhatsApp catalog in the format{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">
                    https://wa.me/c/&lt;PHONE_NUMBER&gt;
                  </code>
                  . Anyone who clicks it from Instagram, Facebook, SMS, or QR codes will have your WhatsApp
                  storefront open instantly on their device.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
