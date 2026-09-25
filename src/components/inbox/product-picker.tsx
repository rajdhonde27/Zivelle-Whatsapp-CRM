"use client";

import { useEffect, useState } from "react";
import {
  ShoppingBag,
  Search,
  ExternalLink,
  Loader2,
  CheckCircle2,
  BookOpen,
  Send,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CatalogProduct, CommerceSettings } from "@/types";

interface ProductPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onSuccess?: () => void;
}

export function ProductPicker({
  open,
  onOpenChange,
  conversationId,
  onSuccess,
}: ProductPickerProps) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [settings, setSettings] = useState<CommerceSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch products and commerce settings when opened
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedProduct(null);

    void (async () => {
      try {
        const [prodRes, setRes] = await Promise.all([
          fetch(`/api/commerce/products?limit=250&search=${encodeURIComponent(search)}${sourceFilter !== "all" ? `&source=${sourceFilter}` : ""}`),
          fetch("/api/commerce/settings"),
        ]);

        const prodData = await prodRes.json().catch(() => ({}));
        const setData = await setRes.json().catch(() => ({}));

        if (!cancelled) {
          if (prodRes.ok && Array.isArray(prodData.products)) {
            setProducts(prodData.products);
          }
          if (setRes.ok && setData.settings) {
            setSettings(setData.settings);
          }
        }
      } catch (e) {
        if (!cancelled) setError("Failed to load products");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, search, sourceFilter]);

  const handleSend = async (mode: "native_catalog" | "store_link" | "catalog_message") => {
    if (!conversationId) return;
    setSending(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        conversationId,
        mode,
      };

      if (mode === "catalog_message") {
        payload.bodyText = "Welcome to our store! Browse our full catalog below.";
      } else if (selectedProduct) {
        payload.productRetailerId = selectedProduct.retailer_id;
        payload.title = selectedProduct.title;
        payload.price = selectedProduct.price;
        payload.currency = selectedProduct.currency;
        payload.description = selectedProduct.description;
        payload.image_url = selectedProduct.image_url;
        payload.url = selectedProduct.url;
      }

      const res = await fetch("/api/whatsapp/send-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to send product");
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const hasMetaCatalog = !!settings?.meta_catalog_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Send Product / Catalog</DialogTitle>
              <DialogDescription className="text-xs">
                Send catalog items or direct store checkout links to the customer
              </DialogDescription>
            </div>
          </div>

          {/* Quick action: Send full catalog */}
          <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5">
            <div className="flex items-center gap-2.5 text-xs">
              <div className="h-7 w-7 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div>
                <span className="font-semibold text-foreground">Send Full WhatsApp Catalog</span>
                <p className="text-[11px] text-muted-foreground">
                  Delivers an interactive card with a native &ldquo;View catalog&rdquo; button
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="default"
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
              disabled={sending}
              onClick={() => handleSend("catalog_message")}
            >
              {sending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
              Send Catalog
            </Button>
          </div>
        </DialogHeader>

        {/* Search & Filter Bar */}
        <div className="px-6 py-3 border-b border-border/40 flex items-center gap-3 bg-muted/20">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products by title, SKU, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {(["all", "meta", "shopify", "woocommerce"] as const).map((src) => (
              <Button
                key={src}
                variant={sourceFilter === src ? "secondary" : "ghost"}
                size="sm"
                className="h-8 text-xs capitalize"
                onClick={() => setSourceFilter(src)}
              >
                {src}
              </Button>
            ))}
          </div>
        </div>

        {/* Product Grid / List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 min-h-[260px] max-h-[380px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs">Loading catalog products...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground gap-2">
              <ShoppingBag className="h-8 w-8 stroke-[1.5] text-muted-foreground/60" />
              <p className="text-sm font-medium">No products found</p>
              <p className="text-xs max-w-sm">
                Connect your Meta Catalog, Shopify, or WooCommerce store in the{" "}
                <a href="/catalog" className="text-primary hover:underline">
                  Catalog Dashboard
                </a>{" "}
                to sync items.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {products.map((p) => {
                const isSelected = selectedProduct?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProduct(isSelected ? null : p)}
                    className={`group relative flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                        : "border-border/60 hover:border-border hover:bg-muted/30"
                    }`}
                  >
                    {/* Square Image / Fallback */}
                    <div className="h-16 w-16 shrink-0 aspect-square rounded-md bg-muted/30 overflow-hidden border border-border/40 flex items-center justify-center p-1">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.title}
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <ShoppingBag className="h-6 w-6 text-muted-foreground/40 stroke-[1.5]" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-medium text-xs truncate text-foreground group-hover:text-primary">
                          {p.title}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 ml-auto" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                        <span className="font-semibold text-foreground">
                          {p.currency} {Number(p.price).toFixed(2)}
                        </span>
                        <span>•</span>
                        <span className="truncate">SKU: {p.retailer_id}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1 py-0 h-4 capitalize ${
                            p.source === "meta"
                              ? "text-blue-400 border-blue-500/30"
                              : p.source === "shopify"
                              ? "text-emerald-400 border-emerald-500/30"
                              : p.source === "woocommerce"
                              ? "text-purple-400 border-purple-500/30"
                              : "text-muted-foreground"
                          }`}
                        >
                          {p.source}
                        </Badge>
                        <span
                          className={`text-[10px] ${
                            p.availability === "in stock"
                              ? "text-emerald-400"
                              : "text-amber-400"
                          }`}
                        >
                          {p.availability}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer / Send Options */}
        <div className="px-6 py-4 border-t border-border/60 bg-muted/10 flex flex-col gap-2">
          {error && <p className="text-xs text-destructive font-medium">{error}</p>}

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground truncate">
              {selectedProduct ? (
                <>
                  Selected: <span className="font-medium text-foreground">{selectedProduct.title}</span> (
                  {selectedProduct.currency} {Number(selectedProduct.price).toFixed(2)})
                </>
              ) : (
                "Select a product above to send"
              )}
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={sending}
                className="h-8 text-xs"
              >
                Cancel
              </Button>

              {/* Native WhatsApp Catalog Button (when Meta catalog exists) */}
              {hasMetaCatalog && selectedProduct && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selectedProduct || sending}
                  onClick={() => handleSend("native_catalog")}
                  className="h-8 text-xs border-primary/40 hover:bg-primary/10"
                  title="Sends official WhatsApp interactive product card"
                >
                  {sending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1 text-primary" />
                  )}
                  Send WhatsApp Product
                </Button>
              )}

              {/* Direct Store Link Button */}
              <Button
                size="sm"
                disabled={!selectedProduct || sending}
                onClick={() => handleSend("store_link")}
                className="h-8 text-xs"
              >
                {sending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <ExternalLink className="h-3 w-3 mr-1" />
                )}
                Send with Checkout Link
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
