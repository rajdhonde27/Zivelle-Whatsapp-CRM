"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Send, Sparkles, ExternalLink, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import type { CatalogProduct, CommerceSettings } from "@/types";

interface SendProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: CatalogProduct | null;
  settings?: CommerceSettings | null;
}

interface ConversationOption {
  id: string;
  contactName: string;
  contactPhone: string;
}

export function SendProductDialog({
  open,
  onOpenChange,
  product,
  settings,
}: SendProductDialogProps) {
  const [conversations, setConversations] = useState<ConversationOption[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string>("");
  const [mode, setMode] = useState<"native_catalog" | "store_link">("store_link");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelectedConvId("");

    // Default to native catalog if FB Catalog is configured
    if (settings?.meta_catalog_id) {
      setMode("native_catalog");
    } else {
      setMode("store_link");
    }

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
        toast.error("Failed to load active chats");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, settings]);

  const handleSend = async () => {
    if (!selectedConvId || !product) {
      toast.error("Select a conversation");
      return;
    }

    setSending(true);
    try {
      const payload = {
        conversationId: selectedConvId,
        mode,
        productRetailerId: product.retailer_id,
        title: product.title,
        price: product.price,
        currency: product.currency,
        description: product.description,
        image_url: product.image_url,
        url: product.url,
      };

      const res = await fetch("/api/whatsapp/send-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to send product");
      }

      toast.success(`Sent "${product.title}" to customer!`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error sending product");
    } finally {
      setSending(false);
    }
  };

  const hasMetaCatalog = !!settings?.meta_catalog_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Send to WhatsApp Chat
          </DialogTitle>
          <DialogDescription className="text-xs">
            Send {product?.title ? `"${product.title}"` : "this product"} directly to a customer
          </DialogDescription>
        </DialogHeader>

        {product && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20 my-2">
            <div className="h-16 w-16 aspect-square rounded-md bg-muted/30 overflow-hidden shrink-0 flex items-center justify-center border border-border/40 p-1">
              {product.image_url ? (
                <img src={product.image_url} alt="" className="h-full w-full object-contain" />
              ) : (
                <ShoppingBag className="h-6 w-6 text-muted-foreground/40 stroke-[1.5]" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-xs">
              <p className="font-semibold truncate text-foreground">{product.title}</p>
              <p className="text-muted-foreground">
                {product.currency} {Number(product.price).toFixed(2)} • SKU: {product.retailer_id}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3.5 my-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Select Contact / Conversation</Label>
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground h-9">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading active conversations...
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No active conversations found. Start a chat in the Inbox first.
              </p>
            ) : (
              <Select value={selectedConvId} onValueChange={(v) => { if (v) setSelectedConvId(v); }}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select a conversation" />
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

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Send Format</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("store_link")}
                className={`p-2.5 rounded-lg border text-left text-xs transition-all flex flex-col gap-1 ${
                  mode === "store_link"
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border/60 hover:bg-muted/30 text-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Store Checkout
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Card with direct checkout URL
                </span>
              </button>

              <button
                type="button"
                disabled={!hasMetaCatalog}
                onClick={() => setMode("native_catalog")}
                className={`p-2.5 rounded-lg border text-left text-xs transition-all flex flex-col gap-1 ${
                  !hasMetaCatalog
                    ? "opacity-50 cursor-not-allowed border-border/40"
                    : mode === "native_catalog"
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border/60 hover:bg-muted/30 text-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Native WhatsApp
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {hasMetaCatalog ? "In-app catalog view" : "Meta Catalog required"}
                </span>
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={sending}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sending || !selectedConvId || !product}
            className="h-8 text-xs"
          >
            {sending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
            ) : (
              <Send className="h-3 w-3 mr-1.5" />
            )}
            Send Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
