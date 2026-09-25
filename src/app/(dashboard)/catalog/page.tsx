"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShoppingBag,
  Search,
  Plus,
  RefreshCw,
  ExternalLink,
  Layers,
  Store,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Edit2,
  Trash2,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  PackageCheck,
  TrendingUp,
  Link as LinkIcon,
  Share2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CommerceIntegrationsModal } from "@/components/commerce/commerce-integrations-modal";
import { ProductModal } from "@/components/commerce/product-modal";
import { SendProductDialog } from "@/components/commerce/send-product-dialog";
import { CatalogShareDialog } from "@/components/commerce/catalog-share-dialog";
import type { CatalogProduct, CommerceSettings } from "@/types";

export default function CatalogPage() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [settings, setSettings] = useState<CommerceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Pagination & Counts
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(48);
  const [totalCount, setTotalCount] = useState(0);
  const [inStockCount, setInStockCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");

  // Modals
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedProductToSend, setSelectedProductToSend] = useState<CatalogProduct | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [prodRes, setRes] = await Promise.all([
        fetch(
          `/api/commerce/products?page=${page}&limit=${pageSize}&search=${encodeURIComponent(search)}${
            sourceFilter !== "all" ? `&source=${sourceFilter}` : ""
          }${availabilityFilter !== "all" ? `&availability=${availabilityFilter}` : ""}`
        ),
        fetch("/api/commerce/settings"),
      ]);

      const prodData = await prodRes.json().catch(() => ({}));
      const setData = await setRes.json().catch(() => ({}));

      if (prodRes.ok && Array.isArray(prodData.products)) {
        setProducts(prodData.products);
        setTotalCount(typeof prodData.total === "number" ? prodData.total : prodData.products.length);
        setInStockCount(typeof prodData.inStockTotal === "number" ? prodData.inStockTotal : 0);
        setTotalPages(typeof prodData.totalPages === "number" ? Math.max(1, prodData.totalPages) : 1);
      }
      if (setRes.ok && setData.settings) {
        setSettings(setData.settings);
      }
    } catch {
      toast.error("Failed to load catalog data");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, sourceFilter, availabilityFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync all connected providers
  const handleSyncAll = async () => {
    setSyncingAll(true);
    let synced = 0;
    try {
      const providersToSync: Array<"meta" | "shopify" | "woocommerce"> = [];
      if (settings?.meta_catalog_id) providersToSync.push("meta");
      if (settings?.shopify_shop_domain) providersToSync.push("shopify");
      if (settings?.woocommerce_store_url) providersToSync.push("woocommerce");

      if (providersToSync.length === 0) {
        toast.info("No catalogs connected yet. Click 'Connect Stores' to get started.");
        setIntegrationsOpen(true);
        return;
      }

      for (const prov of providersToSync) {
        try {
          const res = await fetch(`/api/commerce/sync/${prov}`, { method: "POST" });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.success) {
            synced += data.count || 0;
          }
        } catch (e) {
          console.error(`Sync error for ${prov}:`, e);
        }
      }

      toast.success(`Sync completed! ${synced} items updated.`);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncingAll(false);
    }
  };

  const handleDeleteProduct = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to remove "${title}"?`)) return;
    try {
      const res = await fetch(`/api/commerce/products?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(`Removed "${title}"`);
        setProducts((prev) => prev.filter((p) => p.id !== id));
      } else {
        toast.error("Failed to delete product");
      }
    } catch {
      toast.error("Failed to delete product");
    }
  };

  // Calculations for stats
  const totalProducts = totalCount;
  const connectedCount =
    (settings?.meta_catalog_id ? 1 : 0) +
    (settings?.shopify_shop_domain ? 1 : 0) +
    (settings?.woocommerce_store_url ? 1 : 0);

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShoppingBag className="h-5 w-5" />
            </div>
            Product Catalog & Commerce
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect Facebook Product Catalog, Shopify, and WooCommerce to view, sync, and send
            products in WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            disabled={syncingAll || loading}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncingAll ? "animate-spin" : ""}`} />
            Sync All
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShareDialogOpen(true)}
            className="h-9 gap-1.5 text-xs font-medium border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share Catalog
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIntegrationsOpen(true)}
            className="h-9 gap-1.5 text-xs font-medium border-primary/30 hover:bg-primary/5"
          >
            <LinkIcon className="h-3.5 w-3.5 text-primary" />
            Connect Stores
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setEditingProduct(null);
              setProductModalOpen(true);
            }}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Products</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{totalProducts}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Connected Catalogs</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-2xl font-bold text-foreground">{connectedCount}</span>
                <span className="text-xs text-muted-foreground">/ 3 providers</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Store className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">In Stock Items</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{inStockCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
              <PackageCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active WhatsApp Catalog</p>
              <p className="text-sm font-semibold mt-1 flex items-center gap-1">
                {settings?.meta_catalog_id ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> Ready for WhatsApp
                  </span>
                ) : (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-4 w-4 text-amber-400" /> Not Connected
                  </span>
                )}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-xl border border-border/60 bg-card/40">
        <div className="flex flex-1 items-center gap-2.5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products by title, SKU, category..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="hidden sm:flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/40">
            {(["all", "meta", "shopify", "woocommerce", "manual"] as const).map((src) => (
              <Button
                key={src}
                variant={sourceFilter === src ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-xs capitalize"
                onClick={() => {
                  setSourceFilter(src);
                  setPage(1);
                }}
              >
                {src === "meta" ? "FB Catalog" : src}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <Select
            value={availabilityFilter}
            onValueChange={(v) => {
              setAvailabilityFilter(v || "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-32 text-xs">
              <SelectValue placeholder="Stock" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stock</SelectItem>
              <SelectItem value="in stock">In stock</SelectItem>
              <SelectItem value="out of stock">Out of stock</SelectItem>
              <SelectItem value="preorder">Preorder</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center border border-border/50 rounded-lg p-0.5 bg-muted/20">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setViewMode("table")}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Product Content Display */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs">Loading product catalog...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ShoppingBag className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">No products in catalog</h3>
          <p className="mb-4 mt-2 max-w-sm text-xs text-muted-foreground">
            Connect your Facebook Catalog, Shopify, or WooCommerce store to sync items, or add
            products manually.
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIntegrationsOpen(true)}
              className="text-xs"
            >
              Connect Integrations
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingProduct(null);
                setProductModalOpen(true);
              }}
              className="text-xs"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Product
            </Button>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <Card
              key={p.id}
              className="group overflow-hidden border-border/60 hover:border-border transition-all flex flex-col hover:shadow-md"
            >
              {/* Product Image - Proper Square 1:1 Aspect Ratio with Crisp Object-Contain */}
              <div className="relative aspect-square w-full bg-muted/20 overflow-hidden flex items-center justify-center border-b border-border/40 p-4">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.title}
                    className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-xs"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground/30 gap-1.5">
                    <ShoppingBag className="h-10 w-10 stroke-[1.5]" />
                    <span className="text-[10px]">No image</span>
                  </div>
                )}

                {/* Source Badge */}
                <div className="absolute top-2 left-2">
                  <Badge
                    variant="secondary"
                    className={`text-[10px] font-medium backdrop-blur-md shadow-sm capitalize ${
                      p.source === "meta"
                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        : p.source === "shopify"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : p.source === "woocommerce"
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.source === "meta" ? "FB Catalog" : p.source}
                  </Badge>
                </div>

                {/* Stock Status Badge */}
                <div className="absolute top-2 right-2">
                  <Badge
                    variant="outline"
                    className={`text-[9px] backdrop-blur-md ${
                      (p.raw_data as Record<string, unknown> | undefined)?.status === "draft"
                        ? "bg-muted/80 text-muted-foreground border-border/60"
                        : p.availability === "in stock"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {(p.raw_data as Record<string, unknown> | undefined)?.status === "draft"
                      ? "Draft"
                      : p.availability}
                  </Badge>
                </div>
              </div>

              {/* Card Body */}
              <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-base font-bold text-foreground">
                      {p.currency} {Number(p.price).toFixed(2)}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono truncate">
                      {p.retailer_id}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-foreground line-clamp-1 mt-1 group-hover:text-primary transition-colors">
                    {p.title}
                  </h4>

                  {p.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {p.description}
                    </p>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-1">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs flex-1 gap-1"
                    onClick={() => {
                      setSelectedProductToSend(p);
                      setSendDialogOpen(true);
                    }}
                  >
                    <Send className="h-3 w-3" />
                    Send to Chat
                  </Button>

                  {p.url && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      title="Open store product link"
                      onClick={() => window.open(p.url!, "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    title="Edit product"
                    onClick={() => {
                      setEditingProduct(p);
                      setProductModalOpen(true);
                    }}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    title="Delete product"
                    onClick={() => handleDeleteProduct(p.id, p.title)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className="w-12"></TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>SKU / ID</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id} className="border-border/40">
                  <TableCell className="p-2 pl-4">
                    <div className="h-9 w-9 rounded-md bg-muted overflow-hidden flex items-center justify-center border border-border/40">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ShoppingBag className="h-4 w-4 text-muted-foreground/40" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs font-semibold text-foreground">{p.title}</p>
                    {p.category && (
                      <p className="text-[10px] text-muted-foreground">{p.category}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={`text-[9px] capitalize ${
                        p.source === "meta"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          : p.source === "shopify"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : p.source === "woocommerce"
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                          : "text-muted-foreground"
                      }`}
                    >
                      {p.source === "meta" ? "FB Catalog" : p.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {p.retailer_id}
                  </TableCell>
                  <TableCell className="font-medium text-xs">
                    {p.currency} {Number(p.price).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-xs ${
                        (p.raw_data as Record<string, unknown> | undefined)?.status === "draft"
                          ? "text-muted-foreground"
                          : p.availability === "in stock"
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }`}
                    >
                      {(p.raw_data as Record<string, unknown> | undefined)?.status === "draft"
                        ? "draft"
                        : p.availability}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          setSelectedProductToSend(p);
                          setSendDialogOpen(true);
                        }}
                      >
                        <Send className="h-3 w-3" />
                        Send
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setEditingProduct(p);
                          setProductModalOpen(true);
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteProduct(p.id, p.title)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination Controls */}
      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs text-muted-foreground border-t border-border/40">
          <div className="flex items-center gap-2">
            <span>
              Showing{" "}
              <strong className="text-foreground font-semibold">
                {Math.min((page - 1) * pageSize + 1, totalCount)}
              </strong>{" "}
              to{" "}
              <strong className="text-foreground font-semibold">
                {Math.min(page * pageSize, totalCount)}
              </strong>{" "}
              of <strong className="text-foreground font-semibold">{totalCount}</strong> products
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  if (val) {
                    setPageSize(parseInt(val, 10));
                    setPage(1);
                  }
                }}
              >
                <SelectTrigger className="h-8 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24</SelectItem>
                  <SelectItem value="48">48</SelectItem>
                  <SelectItem value="96">96</SelectItem>
                  <SelectItem value="250">250</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={page <= 1 || loading}
                onClick={() => setPage(1)}
                title="First page"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                title="Previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>

              <span className="px-2 text-xs font-medium text-foreground">
                Page {page} of {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                title="Next page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={page >= totalPages || loading}
                onClick={() => setPage(totalPages)}
                title="Last page"
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Integration Settings Modal */}
      <CommerceIntegrationsModal
        open={integrationsOpen}
        onOpenChange={setIntegrationsOpen}
        onSettingsSaved={loadData}
      />

      {/* Add / Edit Product Modal */}
      <ProductModal
        open={productModalOpen}
        onOpenChange={setProductModalOpen}
        product={editingProduct}
        onSaved={loadData}
      />

      {/* Send Product Dialog */}
      <SendProductDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        product={selectedProductToSend}
        settings={settings}
      />

      <CatalogShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        settings={settings}
      />
    </div>
  );
}
