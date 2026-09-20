import { Router } from 'express';
import {
  getTrackedProducts,
  getTrackedProductById,
  upsertTrackedProduct,
  deleteTrackedProduct,
  getPriceHistory,
  getScrapeLogs,
  isSupabaseConfigured
} from '../db.js';
import { searchCatalog, fetchProductDetails } from '../catalog.js';
import { scrapeProductPrice, scrapeAllTrackedProducts } from '../scraper.js';

const router = Router();

// Health & Status
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: isSupabaseConfigured ? 'supabase-postgresql' : 'local-sqlite',
    timestamp: new Date().toISOString()
  });
});

// Search Mock Store Catalog (Fast lightweight HTTP)
router.get('/catalog/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    const results = await searchCatalog(q);
    res.json({ success: true, count: results.length, products: results });
  } catch (error) {
    console.error('[API] Error in catalog search:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Mock Store Product Details
router.get('/catalog/product/:id', async (req, res) => {
  try {
    const product = await fetchProductDetails(req.params.id);
    res.json({ success: true, product });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// Get All Tracked Products
router.get('/products', async (req, res) => {
  try {
    const products = await getTrackedProducts();
    res.json({ success: true, products });
  } catch (error) {
    console.error('[API] Error fetching tracked products:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add Product to Tracking
router.post('/products', async (req, res) => {
  try {
    const { id, name, slug, brand, category, sku, description } = req.body;
    if (!id || !name) {
      return res.status(400).json({ success: false, error: 'Product id and name are required' });
    }

    const saved = await upsertTrackedProduct({
      id,
      name,
      slug,
      brand,
      category,
      sku,
      description,
      last_status: 'pending'
    });

    // Trigger initial scrape asynchronously so response is fast
    scrapeProductPrice(id, { headless: true }).catch(err => {
      console.error(`[API] Initial background scrape failed for product ${id}:`, err);
    });

    res.status(201).json({ success: true, product: saved });
  } catch (error) {
    console.error('[API] Error tracking product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove Product from Tracking
router.delete('/products/:id', async (req, res) => {
  try {
    await deleteTrackedProduct(req.params.id);
    res.json({ success: true, message: 'Product removed from tracking' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Price History for a Product
router.get('/products/:id/history', async (req, res) => {
  try {
    const history = await getPriceHistory(req.params.id);
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Scrape Logs for a Product (Honest logging)
router.get('/products/:id/logs', async (req, res) => {
  try {
    const logs = await getScrapeLogs(req.params.id);
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Trigger Manual Scrape for a Product
router.post('/products/:id/scrape', async (req, res) => {
  try {
    const product = await getTrackedProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product is not currently tracked' });
    }

    // Scrape synchronously so user immediately sees fresh price
    const result = await scrapeProductPrice(product.id, { headless: true });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Scheduled Cron Endpoint (triggered by cron-job.org or external scheduler)
// Fixed schedule: once every 2 hours
router.all('/scrape/cron', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers['x-cron-secret'] || req.query.secret;

  if (secret && provided !== secret) {
    return res.status(401).json({ success: false, error: 'Unauthorized cron request' });
  }

  console.log('[Cron] Received scheduled scrape request.');

  // Trigger batch scrape in background or synchronously based on query
  if (req.query.async === 'true') {
    scrapeAllTrackedProducts({ headless: true }).catch(err => {
      console.error('[Cron] Error during scheduled background scrape:', err);
    });
    return res.json({ success: true, message: 'Batch scrape started in background' });
  }

  try {
    const summary = await scrapeAllTrackedProducts({ headless: true });
    res.json({ success: true, summary });
  } catch (error) {
    console.error('[Cron] Batch scrape failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

