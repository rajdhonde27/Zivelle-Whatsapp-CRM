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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { CatalogProduct, ProductAvailability } from "@/types";

interface ProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: CatalogProduct | null;
  onSaved?: () => void;
}

export function ProductModal({
  open,
  onOpenChange,
  product,
  onSaved,
}: ProductModalProps) {
  const [title, setTitle] = useState("");
  const [retailerId, setRetailerId] = useState("");
  const [price, setPrice] = useState("0.00");
  const [currency, setCurrency] = useState("USD");
  const [availability, setAvailability] = useState<ProductAvailability>("in stock");
  const [imageUrl, setImageUrl] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setTitle(product.title || "");
      setRetailerId(product.retailer_id || "");
      setPrice(product.price ? String(product.price) : "0.00");
      setCurrency(product.currency || "USD");
      setAvailability(product.availability || "in stock");
      setImageUrl(product.image_url || "");
      setUrl(product.url || "");
      setCategory(product.category || "");
      setDescription(product.description || "");
    } else {
      setTitle("");
      setRetailerId(`SKU-${Date.now().toString().slice(-6)}`);
      setPrice("0.00");
      setCurrency("USD");
      setAvailability("in stock");
      setImageUrl("");
      setUrl("");
      setCategory("");
      setDescription("");
    }
  }, [product, open]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Product title is required");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        id: product?.id,
        title: title.trim(),
        retailer_id: retailerId.trim() || `SKU-${Date.now().toString().slice(-6)}`,
        price: parseFloat(price) || 0,
        currency: currency.trim().toUpperCase() || "USD",
        availability,
        image_url: imageUrl.trim() || null,
        url: url.trim() || null,
        category: category.trim() || null,
        description: description.trim() || null,
        source: product?.source || "manual",
      };

      const res = await fetch("/api/commerce/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to save product");
      }

      toast.success(product ? "Product updated" : "Product created");
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error saving product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <DialogTitle>{product ? "Edit Product" : "Add Product"}</DialogTitle>
          <DialogDescription className="text-xs">
            {product
              ? "Update product pricing, availability, and catalog details"
              : "Add a new item to your unified CRM product catalog"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Product Title <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="e.g. Wireless Noise-Cancelling Headphones"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xs h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">SKU / Retailer ID</Label>
              <Input
                placeholder="e.g. HEADPHONE-BLK-01"
                value={retailerId}
                onChange={(e) => setRetailerId(e.target.value)}
                className="text-xs h-9 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Category</Label>
              <Input
                placeholder="e.g. Electronics"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Price</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="99.99"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="text-xs h-9 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Currency</Label>
              <Input
                placeholder="USD"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                className="text-xs h-9 uppercase font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Availability</Label>
              <Select
                value={availability}
                onValueChange={(v) => setAvailability(v as ProductAvailability)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in stock">In stock</SelectItem>
                  <SelectItem value="out of stock">Out of stock</SelectItem>
                  <SelectItem value="preorder">Preorder</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Product Image URL</Label>
            <Input
              placeholder="https://example.com/images/product.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="text-xs h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Direct Store / Checkout URL</Label>
            <Input
              placeholder="https://yourstore.com/products/headphones"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="text-xs h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Description</Label>
            <Textarea
              rows={3}
              placeholder="Features, specs, and details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-xs resize-none"
            />
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-border/60 bg-muted/10 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-8 text-xs"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
            {product ? "Save Changes" : "Create Product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
