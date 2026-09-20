-- INE Product Price Tracker - Supabase (PostgreSQL) Schema
-- Run this script in your Supabase project's SQL Editor (SQL Editor -> New query -> Run)

-- 1. Tracked Products Table
CREATE TABLE IF NOT EXISTS tracked_products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT,
    brand TEXT,
    category TEXT,
    sku TEXT,
    description TEXT,
    current_price NUMERIC(10, 2),
    current_stock TEXT,
    is_in_stock BOOLEAN DEFAULT true,
    last_scraped_at TIMESTAMPTZ,
    last_status TEXT, -- 'success', 'retried', 'failed'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Price and Stock History Table
CREATE TABLE IF NOT EXISTS price_history (
    id BIGSERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
    price NUMERIC(10, 2) NOT NULL,
    stock_status TEXT,
    scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Scrape Logs Table (Honest Logging of Every Attempt)
CREATE TABLE IF NOT EXISTS scrape_logs (
    id BIGSERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES tracked_products(id) ON DELETE CASCADE,
    attempt INTEGER DEFAULT 1,
    status TEXT NOT NULL, -- 'success', 'retried', 'failed'
    duration_ms INTEGER,
    error_message TEXT,
    price_found NUMERIC(10, 2),
    stock_found TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_scraped_at ON price_history(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_product_id ON scrape_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_created_at ON scrape_logs(created_at DESC);

