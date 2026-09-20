// Catalog service for INE mock store
// Uses lightweight HTTP fetching for fast, responsive searching without browser overhead

const MOCK_STORE_URL = process.env.MOCK_STORE_URL || 'https://demo.inelabteamdev.com';

let catalogCache = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch products from the mock store catalog API
 * @param {number} maxPages - maximum pages to fetch
 */
export async function fetchAllCatalogProducts(maxPages = 10) {
  const now = Date.now();
  if (catalogCache && (now - lastFetchedAt < CACHE_TTL_MS)) {
    return catalogCache;
  }

  const allItems = [];
  try {
    for (let page = 1; page <= maxPages; page++) {
      const url = `${MOCK_STORE_URL}/api/catalog?page=${page}&pageSize=50`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!res.ok) {
        console.warn(`[Catalog] Failed to fetch page ${page}: status ${res.status}`);
        break;
      }

      const data = await res.json();
      if (!data.items || data.items.length === 0) {
        break;
      }

      allItems.push(...data.items);
      if (page >= data.pages) {
        break;
      }
    }

    if (allItems.length > 0) {
      catalogCache = allItems;
      lastFetchedAt = now;
      console.log(`[Catalog] Cached ${allItems.length} products from mock store.`);
    }
  } catch (error) {
    console.error('[Catalog] Error fetching catalog:', error.message);
    if (catalogCache) return catalogCache;
    throw error;
  }

  return catalogCache || [];
}

/**
 * Search the mock store catalog by keyword (matches name, brand, category, or SKU)
 * @param {string} query
 */
export async function searchCatalog(query) {
  const products = await fetchAllCatalogProducts(5);
  if (!query || query.trim() === '') {
    return products.slice(0, 20);
  }

  const q = query.toLowerCase().trim();
  const filtered = products.filter(p => {
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    );
  });

  return filtered.slice(0, 30);
}

/**
 * Fetch a single product's metadata from the mock store API
 * @param {number|string} productId
 */
export async function fetchProductDetails(productId) {
  const url = `${MOCK_STORE_URL}/api/product/${productId}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!res.ok) {
    throw new Error(`Product not found (status ${res.status})`);
  }

  return await res.json();
}

