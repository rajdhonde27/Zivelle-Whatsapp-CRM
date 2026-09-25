-- ============================================================
-- 043_commerce_catalog.sql
--
-- Facebook / Meta Product Catalog, Shopify, and WooCommerce
-- Integration for WhatsApp CRM.
--
--   1. `commerce_settings` — account-level credentials and connection
--      states for Meta Product Catalog, Shopify Admin API, and
--      WooCommerce REST API. Tokens are stored encrypted (AES-256-GCM).
--
--   2. `catalog_products` — unified local catalog synced across
--      Meta Catalog, Shopify, WooCommerce, and manual entries.
--      Provides retailer_id / SKU indexing for WhatsApp Cloud API
--      single/multi product interactive messages.
--
--   3. `messages.content_type` CHECK widened to allow 'order'
--      and `messages.order_details` JSONB column for incoming
--      customer WhatsApp cart / order payloads.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- 1. Commerce Settings ----------------------------------------
CREATE TABLE IF NOT EXISTS commerce_settings (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id                  UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  created_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Meta / Facebook Product Catalog
  meta_catalog_id             TEXT,
  meta_access_token           TEXT, -- Optional override; falls back to whatsapp_config if null
  meta_last_synced_at         TIMESTAMPTZ,

  -- Shopify Integration
  shopify_shop_domain         TEXT, -- e.g. "my-brand.myshopify.com"
  shopify_access_token        TEXT, -- AES-256-GCM encrypted
  shopify_auto_sync           BOOLEAN NOT NULL DEFAULT false,
  shopify_last_synced_at      TIMESTAMPTZ,

  -- WooCommerce Integration
  woocommerce_store_url       TEXT, -- e.g. "https://example.com"
  woocommerce_consumer_key    TEXT, -- AES-256-GCM encrypted
  woocommerce_consumer_secret TEXT, -- AES-256-GCM encrypted
  woocommerce_auto_sync       BOOLEAN NOT NULL DEFAULT false,
  woocommerce_last_synced_at  TIMESTAMPTZ,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commerce_settings_account
  ON commerce_settings(account_id);

ALTER TABLE commerce_settings ENABLE ROW LEVEL SECURITY;

-- Settings-class policies (mirrors whatsapp_config / ai_configs):
-- Any account member can view so inbox / UI can adapt;
-- Only admin+ can update or delete.
DROP POLICY IF EXISTS commerce_settings_select ON commerce_settings;
DROP POLICY IF EXISTS commerce_settings_insert ON commerce_settings;
DROP POLICY IF EXISTS commerce_settings_update ON commerce_settings;
DROP POLICY IF EXISTS commerce_settings_delete ON commerce_settings;

CREATE POLICY commerce_settings_select ON commerce_settings FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY commerce_settings_insert ON commerce_settings FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

CREATE POLICY commerce_settings_update ON commerce_settings FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

CREATE POLICY commerce_settings_delete ON commerce_settings FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- 2. Catalog Products -----------------------------------------
CREATE TABLE IF NOT EXISTS catalog_products (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id                  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  retailer_id                 TEXT NOT NULL,
  source                      TEXT NOT NULL CHECK (source IN ('meta', 'shopify', 'woocommerce', 'manual')),
  title                       TEXT NOT NULL,
  description                 TEXT,
  price                       NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  currency                    TEXT NOT NULL DEFAULT 'USD',
  image_url                   TEXT,
  url                         TEXT,
  availability                TEXT NOT NULL DEFAULT 'in stock'
                                CHECK (availability IN ('in stock', 'out of stock', 'preorder')),
  category                    TEXT,
  raw_data                    JSONB,
  last_synced_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT catalog_products_account_source_retailer_key UNIQUE (account_id, source, retailer_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_products_account
  ON catalog_products(account_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_retailer
  ON catalog_products(account_id, retailer_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_source
  ON catalog_products(account_id, source);

ALTER TABLE catalog_products ENABLE ROW LEVEL SECURITY;

-- Catalog products policies:
-- Any member can view/search products (agents send them in inbox);
-- Agent+ can create/update manual products; service_role/admin can sync.
DROP POLICY IF EXISTS catalog_products_select ON catalog_products;
DROP POLICY IF EXISTS catalog_products_insert ON catalog_products;
DROP POLICY IF EXISTS catalog_products_update ON catalog_products;
DROP POLICY IF EXISTS catalog_products_delete ON catalog_products;

CREATE POLICY catalog_products_select ON catalog_products FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY catalog_products_insert ON catalog_products FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY catalog_products_update ON catalog_products FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

CREATE POLICY catalog_products_delete ON catalog_products FOR DELETE
  USING (is_account_member(account_id, 'agent'));

-- 3. Messages table updates for orders & products --------------
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_content_type_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_content_type_check
  CHECK (content_type IN (
    'text', 'image', 'document', 'audio', 'video',
    'location', 'template', 'interactive', 'order'
  ));

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS order_details JSONB;

COMMENT ON COLUMN messages.order_details IS
  'Structured order payload from WhatsApp customer cart / order webhook '
  '(order.catalog_id, order.product_items, order.text).';
