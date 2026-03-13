-- Migration: 018_coin_packages
-- Description: Coin shop — stores available in-app purchase coin packages.
-- Public read: anon + authenticated can read active packages.
-- Write: service_role only (managed via admin edge function).
-- Date: 2026-03-02

-- ---------------------------------------------------------------------------
-- TABLE: coin_packages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coin_packages (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT           NOT NULL,
  description           TEXT,
  coin_amount           INTEGER        NOT NULL CHECK (coin_amount > 0),
  price_usd             NUMERIC(10,2)  NOT NULL CHECK (price_usd >= 0),
  original_price_usd    NUMERIC(10,2),  -- NULL means no discount shown
  discount_percent      INTEGER        NOT NULL DEFAULT 0
                          CHECK (discount_percent >= 0 AND discount_percent <= 100),
  badge                 TEXT
                          CHECK (badge IN ('popular', 'best_value', 'new', 'limited')),
  is_featured           BOOLEAN        NOT NULL DEFAULT FALSE,
  is_active             BOOLEAN        NOT NULL DEFAULT TRUE,
  sort_order            INTEGER        NOT NULL DEFAULT 0,
  revenuecat_product_id TEXT,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE coin_packages IS 'In-app purchase coin packages available in the coin shop. Managed exclusively via admin panel.';
COMMENT ON COLUMN coin_packages.coin_amount IS 'Number of coins the player receives after a successful purchase.';
COMMENT ON COLUMN coin_packages.price_usd IS 'Displayed USD price (informational). Actual charge is through RevenueCat/StoreKit.';
COMMENT ON COLUMN coin_packages.original_price_usd IS 'Strike-through price shown when discount is active. NULL = no strike-through.';
COMMENT ON COLUMN coin_packages.discount_percent IS 'Discount badge percentage (0 = no discount). Must be consistent with price/original_price.';
COMMENT ON COLUMN coin_packages.badge IS 'Optional UI badge: popular | best_value | new | limited.';
COMMENT ON COLUMN coin_packages.is_featured IS 'When true the package is visually highlighted in the shop UI.';
COMMENT ON COLUMN coin_packages.is_active IS 'Inactive packages are hidden from public and not purchasable. Safe to deactivate without deletion.';
COMMENT ON COLUMN coin_packages.sort_order IS 'Ascending sort order for shop display.';
COMMENT ON COLUMN coin_packages.revenuecat_product_id IS 'RevenueCat/StoreKit product identifier used for purchase validation.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_coin_packages_is_active
  ON coin_packages (is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_coin_packages_sort_order
  ON coin_packages (sort_order);

-- ---------------------------------------------------------------------------
-- Auto-update updated_at trigger (re-uses fn_set_updated_at from migration 001)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'coin_packages_set_updated_at'
      AND tgrelid = 'coin_packages'::regclass
  ) THEN
    CREATE TRIGGER coin_packages_set_updated_at
      BEFORE UPDATE ON coin_packages
      FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE coin_packages ENABLE ROW LEVEL SECURITY;

-- Public read: anon and authenticated users may read active packages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'coin_packages'
      AND policyname = 'coin_packages_select_active_public'
  ) THEN
    CREATE POLICY coin_packages_select_active_public
      ON coin_packages
      FOR SELECT
      TO anon, authenticated
      USING (is_active = TRUE);
  END IF;
END
$$;

-- Service role full access (bypasses RLS anyway, but explicit for documentation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'coin_packages'
      AND policyname = 'coin_packages_service_role_all'
  ) THEN
    CREATE POLICY coin_packages_service_role_all
      ON coin_packages
      TO service_role
      USING (TRUE)
      WITH CHECK (TRUE);
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Seed: 5 example packages (idempotent — only inserts if table is empty)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM coin_packages LIMIT 1) THEN
    INSERT INTO coin_packages
      (name, description, coin_amount, price_usd, original_price_usd,
       discount_percent, badge, is_featured, is_active, sort_order, revenuecat_product_id)
    VALUES
      ('Küçük Paket',  '10 coin ile başla',         10,  0.99, NULL,   0, NULL,         FALSE, TRUE,  1, 'coins_10'),
      ('Orta Paket',   '20 coin + bonus',            20,  1.99, NULL,   0, 'popular',    FALSE, TRUE,  2, 'coins_20'),
      ('Büyük Paket',  '50 coin - popüler tercih',   50,  3.99, 4.99,  20, 'best_value', TRUE,  TRUE,  3, 'coins_50'),
      ('Mega Paket',   '100 coin + %30 indirim',    100,  6.99, 9.99,  30, 'best_value', FALSE, TRUE,  4, 'coins_100'),
      ('Süper Paket',  '200 coin özel fiyat',       200, 12.99, 19.99, 35, 'limited',    FALSE, FALSE, 5, 'coins_200');
  END IF;
END
$$;
