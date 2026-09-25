"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  Store,
  Layers,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import type { CommerceSettings } from "@/types";

interface CommerceIntegrationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsSaved?: () => void;
}

export function CommerceIntegrationsModal({
  open,
  onOpenChange,
  onSettingsSaved,
}: CommerceIntegrationsModalProps) {
  const [activeTab, setActiveTab] = useState("meta");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Form states
  // Meta
  const [metaCatalogId, setMetaCatalogId] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [hasMetaToken, setHasMetaToken] = useState(false);
  const [metaLastSynced, setMetaLastSynced] = useState<string | null>(null);

  // Shopify
  const [shopifyDomain, setShopifyDomain] = useState("");
  const [shopifyAccessToken, setShopifyAccessToken] = useState("");
  const [hasShopifyToken, setHasShopifyToken] = useState(false);
  const [shopifyAutoSync, setShopifyAutoSync] = useState(false);
  const [shopifyLastSynced, setShopifyLastSynced] = useState<string | null>(null);

  // WooCommerce
  const [wcStoreUrl, setWcStoreUrl] = useState("");
  const [wcConsumerKey, setWcConsumerKey] = useState("");
  const [wcConsumerSecret, setWcConsumerSecret] = useState("");
  const [hasWcCreds, setHasWcCreds] = useState(false);
  const [wcAutoSync, setWcAutoSync] = useState(false);
  const [wcLastSynced, setWcLastSynced] = useState<string | null>(null);

  const [testResult, setTestResult] = useState<{
    provider: string;
    success: boolean;
    message: string;
  } | null>(null);

  // Load existing settings
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setTestResult(null);

    void (async () => {
      try {
        const res = await fetch("/api/commerce/settings");
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.settings) {
          const s = data.settings as CommerceSettings;
          setMetaCatalogId(s.meta_catalog_id || "");
          setHasMetaToken(!!s.has_meta_token);
          setMetaLastSynced(s.meta_last_synced_at || null);

          setShopifyDomain(s.shopify_shop_domain || "");
          setHasShopifyToken(!!s.has_shopify_token);
          setShopifyAutoSync(!!s.shopify_auto_sync);
          setShopifyLastSynced(s.shopify_last_synced_at || null);

          setWcStoreUrl(s.woocommerce_store_url || "");
          setHasWcCreds(!!s.has_woocommerce_credentials);
          setWcAutoSync(!!s.woocommerce_auto_sync);
          setWcLastSynced(s.woocommerce_last_synced_at || null);
        }
      } catch {
        toast.error("Failed to load commerce settings");
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  // Test live connection
  const handleTest = async (provider: "meta" | "shopify" | "woocommerce") => {
    setTesting(true);
    setTestResult(null);
    try {
      const payload: Record<string, unknown> = { provider };
      if (provider === "meta") {
        payload.catalogId = metaCatalogId;
        if (metaAccessToken) payload.accessToken = metaAccessToken;
      } else if (provider === "shopify") {
        payload.shopDomain = shopifyDomain;
        if (shopifyAccessToken) payload.accessToken = shopifyAccessToken;
      } else if (provider === "woocommerce") {
        payload.storeUrl = wcStoreUrl;
        if (wcConsumerKey) payload.consumerKey = wcConsumerKey;
        if (wcConsumerSecret) payload.consumerSecret = wcConsumerSecret;
      }

      const res = await fetch("/api/commerce/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        let msg = "Connection successful!";
        if (provider === "meta" && data.name) msg = `Connected to catalog "${data.name}" (${data.productCount ?? 0} items)`;
        if (provider === "shopify" && data.shopName) msg = `Connected to store "${data.shopName}" (${data.currency})`;
        if (provider === "woocommerce" && data.productCount !== undefined) msg = `Connected to store (${data.productCount} items found)`;

        setTestResult({ provider, success: true, message: msg });
        toast.success(msg);
      } else {
        const errorMsg = data.error || "Connection test failed";
        setTestResult({ provider, success: false, message: errorMsg });
        toast.error(errorMsg);
      }
    } catch (err) {
      const errTxt = err instanceof Error ? err.message : "Test failed";
      setTestResult({ provider, success: false, message: errTxt });
      toast.error(errTxt);
    } finally {
      setTesting(false);
    }
  };

  // Save Settings
  const handleSave = async (andSyncProvider?: "meta" | "shopify" | "woocommerce") => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        meta_catalog_id: metaCatalogId,
        shopify_shop_domain: shopifyDomain,
        shopify_auto_sync: shopifyAutoSync,
        woocommerce_store_url: wcStoreUrl,
        woocommerce_auto_sync: wcAutoSync,
      };

      if (metaAccessToken) payload.meta_access_token = metaAccessToken;
      if (shopifyAccessToken) payload.shopify_access_token = shopifyAccessToken;
      if (wcConsumerKey) payload.woocommerce_consumer_key = wcConsumerKey;
      if (wcConsumerSecret) payload.woocommerce_consumer_secret = wcConsumerSecret;

      const res = await fetch("/api/commerce/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      toast.success("Commerce settings saved");
      onSettingsSaved?.();

      if (andSyncProvider) {
        await handleSync(andSyncProvider);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // Sync Products
  const handleSync = async (provider: "meta" | "shopify" | "woocommerce") => {
    setSyncing(provider);
    try {
      const res = await fetch(`/api/commerce/sync/${provider}`, {
        method: "POST",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Sync failed");
      }

      toast.success(`Successfully synced ${data.count || 0} products from ${provider}!`);
      if (provider === "meta") setMetaLastSynced(data.synced_at);
      if (provider === "shopify") setShopifyLastSynced(data.synced_at);
      if (provider === "woocommerce") setWcLastSynced(data.synced_at);
      onSettingsSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Connect Product Catalogs</DialogTitle>
              <DialogDescription className="text-xs">
                Integrate Facebook Commerce Catalog, Shopify, and WooCommerce with WhatsApp
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v);
              setTestResult(null);
            }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="px-6 border-b border-border/40 bg-muted/20">
              <TabsList className="h-10 bg-transparent p-0 gap-6">
                <TabsTrigger
                  value="meta"
                  className="data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-1 text-xs gap-1.5"
                >
                  <Layers className="h-3.5 w-3.5 text-blue-500" />
                  Meta FB Catalog
                  {metaCatalogId && <Badge variant="secondary" className="h-4 text-[9px] px-1 bg-blue-500/10 text-blue-400">Linked</Badge>}
                </TabsTrigger>
                <TabsTrigger
                  value="shopify"
                  className="data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-1 text-xs gap-1.5"
                >
                  <Store className="h-3.5 w-3.5 text-emerald-500" />
                  Shopify
                  {shopifyDomain && <Badge variant="secondary" className="h-4 text-[9px] px-1 bg-emerald-500/10 text-emerald-400">Linked</Badge>}
                </TabsTrigger>
                <TabsTrigger
                  value="woocommerce"
                  className="data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-1 text-xs gap-1.5"
                >
                  <ShoppingBag className="h-3.5 w-3.5 text-purple-500" />
                  WooCommerce
                  {wcStoreUrl && <Badge variant="secondary" className="h-4 text-[9px] px-1 bg-purple-500/10 text-purple-400">Linked</Badge>}
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* META CATALOG TAB */}
              <TabsContent value="meta" className="m-0 space-y-4">
                <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3.5 text-xs text-muted-foreground space-y-1.5">
                  <p className="font-medium text-blue-400 flex items-center gap-1.5">
                    <Layers className="h-4 w-4" />
                    Official Facebook / Meta Product Catalog
                  </p>
                  <p>
                    Connecting your Meta Catalog enables native WhatsApp Product Cards and the
                    in-app WhatsApp Storefront. Customers can browse your inventory and send
                    carts directly inside chat.
                  </p>
                  <a
                    href="https://business.facebook.com/commerce"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:underline pt-0.5"
                  >
                    Open Meta Commerce Manager <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="meta-cat-id" className="text-xs font-medium">
                      Facebook Catalog ID <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="meta-cat-id"
                      placeholder="e.g. 102938475610293"
                      value={metaCatalogId}
                      onChange={(e) => setMetaCatalogId(e.target.value)}
                      className="text-xs h-9 font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Found in Meta Commerce Manager under <strong>Settings → Catalog ID</strong>.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="meta-token" className="text-xs font-medium">
                      Meta Access Token (Optional Override)
                    </Label>
                    <Input
                      id="meta-token"
                      type="password"
                      placeholder={hasMetaToken ? "•••••••••••••••• (saved)" : "Defaults to connected WhatsApp token"}
                      value={metaAccessToken}
                      onChange={(e) => setMetaAccessToken(e.target.value)}
                      className="text-xs h-9 font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Leave empty to automatically reuse your WhatsApp System User Token.
                    </p>
                  </div>

                  {metaLastSynced && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      Last synced: {new Date(metaLastSynced).toLocaleString()}
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* SHOPIFY TAB */}
              <TabsContent value="shopify" className="m-0 space-y-4">
                <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3.5 text-xs text-muted-foreground space-y-1.5">
                  <p className="font-medium text-emerald-400 flex items-center gap-1.5">
                    <Store className="h-4 w-4" />
                    Shopify Store Sync
                  </p>
                  <p>
                    Sync all products, prices, images, and inventory from your Shopify store into your
                    CRM. Agents can send items with 1-click direct checkout links.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="shopify-domain" className="text-xs font-medium">
                      Shopify Domain <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="shopify-domain"
                      placeholder="e.g. my-brand.myshopify.com"
                      value={shopifyDomain}
                      onChange={(e) => setShopifyDomain(e.target.value)}
                      className="text-xs h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="shopify-token" className="text-xs font-medium">
                      Admin API Access Token <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="shopify-token"
                      type="password"
                      placeholder={hasShopifyToken ? "•••••••••••••••• (saved)" : "shpat_xxxxxxxxxxxxxxxx"}
                      value={shopifyAccessToken}
                      onChange={(e) => setShopifyAccessToken(e.target.value)}
                      className="text-xs h-9 font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Create a Custom App in Shopify Admin (Settings → Apps → Develop apps) with{" "}
                      <code>read_products</code> scope.
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="space-y-0.5">
                      <Label htmlFor="shopify-auto" className="text-xs font-medium">
                        Auto-sync inventory
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Automatically refresh products on scheduled intervals
                      </p>
                    </div>
                    <Switch
                      id="shopify-auto"
                      checked={shopifyAutoSync}
                      onCheckedChange={setShopifyAutoSync}
                    />
                  </div>

                  {shopifyLastSynced && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      Last synced: {new Date(shopifyLastSynced).toLocaleString()}
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* WOOCOMMERCE TAB */}
              <TabsContent value="woocommerce" className="m-0 space-y-4">
                <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 p-3.5 text-xs text-muted-foreground space-y-1.5">
                  <p className="font-medium text-purple-400 flex items-center gap-1.5">
                    <ShoppingBag className="h-4 w-4" />
                    WooCommerce REST API
                  </p>
                  <p>
                    Connect your WordPress / WooCommerce store via REST API keys. Sync published
                    products, variations, prices, and stock levels.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="wc-url" className="text-xs font-medium">
                      Store URL <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="wc-url"
                      placeholder="e.g. https://my-store.com"
                      value={wcStoreUrl}
                      onChange={(e) => setWcStoreUrl(e.target.value)}
                      className="text-xs h-9"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="wc-key" className="text-xs font-medium">
                        Consumer Key <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="wc-key"
                        type="password"
                        placeholder={hasWcCreds ? "••••••••••••••••" : "ck_xxxxxxxxxxxx"}
                        value={wcConsumerKey}
                        onChange={(e) => setWcConsumerKey(e.target.value)}
                        className="text-xs h-9 font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="wc-secret" className="text-xs font-medium">
                        Consumer Secret <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="wc-secret"
                        type="password"
                        placeholder={hasWcCreds ? "••••••••••••••••" : "cs_xxxxxxxxxxxx"}
                        value={wcConsumerSecret}
                        onChange={(e) => setWcConsumerSecret(e.target.value)}
                        className="text-xs h-9 font-mono"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Generated in WooCommerce → Settings → Advanced → REST API (Read permission).
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <div className="space-y-0.5">
                      <Label htmlFor="wc-auto" className="text-xs font-medium">
                        Auto-sync inventory
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Keep products and pricing in sync
                      </p>
                    </div>
                    <Switch
                      id="wc-auto"
                      checked={wcAutoSync}
                      onCheckedChange={setWcAutoSync}
                    />
                  </div>

                  {wcLastSynced && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      Last synced: {new Date(wcLastSynced).toLocaleString()}
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* Test Result Banner */}
              {testResult && (
                <div
                  className={`mt-4 p-3 rounded-lg border text-xs flex items-start gap-2 ${
                    testResult.success
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-destructive/10 border-destructive/30 text-destructive"
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-border/60 bg-muted/10 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTest(activeTab as "meta" | "shopify" | "woocommerce")}
                disabled={testing || saving || !!syncing}
                className="h-8 text-xs"
              >
                {testing && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                Test Connection
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  disabled={saving || !!syncing}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSave()}
                  disabled={saving || !!syncing}
                  className="h-8 text-xs"
                >
                  {saving && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                  Save Settings
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSave(activeTab as "meta" | "shopify" | "woocommerce")}
                  disabled={saving || !!syncing}
                  className="h-8 text-xs"
                >
                  {syncing ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1.5" />
                  )}
                  Save & Sync Products
                </Button>
              </div>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
