import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project'));

let supabase = null;
let sqliteDb = null;

if (isSupabaseConfigured) {
  console.log('[Database] Connecting to Supabase at:', supabaseUrl);
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.log('[Database] Supabase credentials not provided. Using local SQLite database as fallback.');
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'local.db');
  sqliteDb = new Database(dbPath);

  // Initialize SQLite tables matching schema.sql
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS tracked_products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT,
      brand TEXT,
      category TEXT,
      sku TEXT,
      description TEXT,
      current_price REAL,
      current_stock TEXT,
      is_in_stock INTEGER DEFAULT 1,
      last_scraped_at TEXT,
      last_status TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      price REAL NOT NULL,
      stock_status TEXT,
      scraped_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES tracked_products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scrape_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      attempt INTEGER DEFAULT 1,
      status TEXT NOT NULL,
      duration_ms INTEGER,
      error_message TEXT,
      price_found REAL,
      stock_found TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES tracked_products(id) ON DELETE CASCADE
    );
  `);
}

export async function getTrackedProducts() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('tracked_products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } else {
    const stmt = sqliteDb.prepare('SELECT * FROM tracked_products ORDER BY created_at DESC');
    return stmt.all().map(p => ({ ...p, is_in_stock: Boolean(p.is_in_stock) }));
  }
}

export async function getTrackedProductById(id) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('tracked_products')
      .select('*')
      .eq('id', Number(id))
      .maybeSingle();
    if (error) throw error;
    return data;
  } else {
    const stmt = sqliteDb.prepare('SELECT * FROM tracked_products WHERE id = ?');
    const p = stmt.get(Number(id));
    return p ? { ...p, is_in_stock: Boolean(p.is_in_stock) } : null;
  }
}

export async function upsertTrackedProduct(product) {
  const payload = {
    id: Number(product.id),
    name: product.name,
    slug: product.slug || '',
    brand: product.brand || '',
    category: product.category || '',
    sku: product.sku || '',
    description: product.description || '',
    current_price: product.current_price !== undefined ? product.current_price : null,
    current_stock: product.current_stock || null,
    is_in_stock: product.is_in_stock !== undefined ? product.is_in_stock : true,
    last_scraped_at: product.last_scraped_at || null,
    last_status: product.last_status || null,
    updated_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('tracked_products')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const stmt = sqliteDb.prepare(`
      INSERT INTO tracked_products (id, name, slug, brand, category, sku, description, current_price, current_stock, is_in_stock, last_scraped_at, last_status, updated_at)
      VALUES (@id, @name, @slug, @brand, @category, @sku, @description, @current_price, @current_stock, @is_in_stock, @last_scraped_at, @last_status, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        slug = excluded.slug,
        brand = excluded.brand,
        category = excluded.category,
        sku = excluded.sku,
        description = excluded.description,
        current_price = COALESCE(excluded.current_price, tracked_products.current_price),
        current_stock = COALESCE(excluded.current_stock, tracked_products.current_stock),
        is_in_stock = COALESCE(excluded.is_in_stock, tracked_products.is_in_stock),
        last_scraped_at = COALESCE(excluded.last_scraped_at, tracked_products.last_scraped_at),
        last_status = COALESCE(excluded.last_status, tracked_products.last_status),
        updated_at = excluded.updated_at
    `);
    stmt.run({
      ...payload,
      is_in_stock: payload.is_in_stock ? 1 : 0
    });
    return getTrackedProductById(product.id);
  }
}

export async function deleteTrackedProduct(id) {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('tracked_products')
      .delete()
      .eq('id', Number(id));
    if (error) throw error;
    return true;
  } else {
    const stmt = sqliteDb.prepare('DELETE FROM tracked_products WHERE id = ?');
    stmt.run(Number(id));
    return true;
  }
}

export async function updateProductScrapeResult(id, { price, stock, isInStock, status }) {
  const now = new Date().toISOString();
  if (isSupabaseConfigured) {
    const updateData = {
      last_scraped_at: now,
      last_status: status,
      updated_at: now
    };
    if (price !== null && price !== undefined) {
      updateData.current_price = price;
    }
    if (stock !== null && stock !== undefined) {
      updateData.current_stock = stock;
    }
    if (isInStock !== null && isInStock !== undefined) {
      updateData.is_in_stock = isInStock;
    }

    const { data, error } = await supabase
      .from('tracked_products')
      .update(updateData)
      .eq('id', Number(id))
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    let query = 'UPDATE tracked_products SET last_scraped_at = ?, last_status = ?, updated_at = ?';
    const params = [now, status, now];

    if (price !== null && price !== undefined) {
      query += ', current_price = ?';
      params.push(price);
    }
    if (stock !== null && stock !== undefined) {
      query += ', current_stock = ?';
      params.push(stock);
    }
    if (isInStock !== null && isInStock !== undefined) {
      query += ', is_in_stock = ?';
      params.push(isInStock ? 1 : 0);
    }

    query += ' WHERE id = ?';
    params.push(Number(id));

    sqliteDb.prepare(query).run(...params);
    return getTrackedProductById(id);
  }
}

export async function addPriceHistory({ productId, price, stockStatus }) {
  const now = new Date().toISOString();
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('price_history')
      .insert({
        product_id: Number(productId),
        price: Number(price),
        stock_status: stockStatus || 'In stock',
        scraped_at: now
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const stmt = sqliteDb.prepare(`
      INSERT INTO price_history (product_id, price, stock_status, scraped_at)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(Number(productId), Number(price), stockStatus || 'In stock', now);
    return { id: info.lastInsertRowid, product_id: productId, price, stock_status: stockStatus, scraped_at: now };
  }
}

export async function getPriceHistory(productId, limit = 50) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('product_id', Number(productId))
      .order('scraped_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } else {
    const stmt = sqliteDb.prepare(`
      SELECT * FROM price_history
      WHERE product_id = ?
      ORDER BY scraped_at ASC
      LIMIT ?
    `);
    return stmt.all(Number(productId), limit);
  }
}

export async function addScrapeLog({ productId, attempt = 1, status, durationMs, errorMessage, priceFound, stockFound }) {
  const now = new Date().toISOString();
  const payload = {
    product_id: Number(productId),
    attempt: Number(attempt),
    status, // 'success', 'retried', 'failed'
    duration_ms: durationMs || 0,
    error_message: errorMessage || null,
    price_found: priceFound !== undefined ? priceFound : null,
    stock_found: stockFound || null,
    created_at: now
  };

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('scrape_logs')
      .insert(payload)
      .select()
      .single();
    if (error) {
      console.error('[DB] Error inserting scrape log:', error);
      return null;
    }
    return data;
  } else {
    const stmt = sqliteDb.prepare(`
      INSERT INTO scrape_logs (product_id, attempt, status, duration_ms, error_message, price_found, stock_found, created_at)
      VALUES (@product_id, @attempt, @status, @duration_ms, @error_message, @price_found, @stock_found, @created_at)
    `);
    const info = stmt.run(payload);
    return { id: info.lastInsertRowid, ...payload };
  }
}

export async function getScrapeLogs(productId, limit = 50) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('scrape_logs')
      .select('*')
      .eq('product_id', Number(productId))
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } else {
    const stmt = sqliteDb.prepare(`
      SELECT * FROM scrape_logs
      WHERE product_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(Number(productId), limit);
  }
}

