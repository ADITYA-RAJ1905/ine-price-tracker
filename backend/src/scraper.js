import { chromium } from 'playwright';
import {
  updateProductScrapeResult,
  addPriceHistory,
  addScrapeLog,
  getTrackedProductById
} from './db.js';

const MOCK_STORE_URL = process.env.MOCK_STORE_URL || 'https://demo.inelabteamdev.com';

/**
 * Normalizes price string extracted from the mock store DOM.
 * Handles fullwidth Unicode numbers, zero-width characters, Indian currency format,
 * euro formatting, trailing tax notices, and decimals.
 * @param {string} rawText
 * @returns {number|null}
 */
export function cleanPriceText(rawText) {
  if (!rawText) return null;

  // 1. Strip zero-width spaces, joiners, and non-breaking spaces
  let s = rawText.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').trim();

  // 2. Convert fullwidth unicode digits (\uFF10-\uFF19) to standard ASCII 0-9
  s = s.replace(/[\uFF10-\uFF19]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248));

  // 3. Convert fullwidth punctuation (e.g. fullwidth comma \uFF0C, period \uFF0E)
  s = s.replace(/\uFF0C/g, ',');
  s = s.replace(/\uFF0E/g, '.');

  // 4. Remove trailing notices like "/- (incl. of all taxes)"
  s = s.replace(/\/-\s*\(.*?\)/gi, '');

  // 5. Remove currency symbols and labels
  s = s.replace(/[₹$€£]|Rs\.?|INR/gi, '').trim();

  // 6. Handle decimal vs thousands separator formats
  if (/,\d{2}$/.test(s)) {
    // Euro decimal: e.g. "22.615,00" -> 22615.00
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/\.\d{2}$/.test(s)) {
    // Standard decimal: e.g. "22,615.00" -> 22615.00
    s = s.replace(/,/g, '');
  } else {
    // No decimals, or dot/comma as thousands separators
    // If dot is followed by 3 digits like "22.615", it's a thousands separator
    if (/\.\d{3}$/.test(s)) {
      s = s.replace(/\./g, '');
    }
    s = s.replace(/,/g, '');
  }

  // 7. Remove remaining spaces (e.g. "22 615")
  s = s.replace(/\s+/g, '');

  // 8. Extract numeric portion
  const match = s.match(/\d+(\.\d+)?/);
  if (!match) return null;

  const num = parseFloat(match[0]);
  return isNaN(num) ? null : num;
}

/**
 * Scrapes a single product's current price and stock from the mock store.
 * @param {number|string} productId
 * @param {Object} options
 * @param {boolean} options.headless - whether to run browser headless or headed
 * @param {number} options.maxRetries - number of retry attempts for failed loads
 * @returns {Promise<Object>} scrape result
 */
export async function scrapeProductPrice(productId, options = {}) {
  const { headless = true, maxRetries = 3 } = options;
  const startTime = Date.now();
  const url = `${MOCK_STORE_URL}/product/${productId}`;

  console.log(`[Scraper] Starting scrape for product ${productId} (mode: ${headless ? 'headless' : 'HEADED'})`);

  let browser = null;
  let attempt = 1;
  let lastError = null;

  while (attempt <= maxRetries) {
    const attemptStartTime = Date.now();
    try {
      browser = await chromium.launch({
        headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      });

      const page = await context.newPage();

      // Navigate to product page
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

      // Wait for the price block to render in React
      const priceBlock = page.locator('.price-block');
      await priceBlock.waitFor({ state: 'attached', timeout: 10000 });

      // If price is already revealed (e.g. cached or fast load), check directly
      const successLocator = page.locator('.price-success');
      const isAlreadyRevealed = await successLocator.isVisible().catch(() => false);

      if (!isAlreadyRevealed) {
        // Find the "Reveal price" button
        const revealBtn = page.locator('button:has-text("Reveal price")');
        await revealBtn.waitFor({ state: 'attached', timeout: 5000 });

        // Anti-bot requirement: hover with at least 8 moves and >600ms dwell time
        const box = await priceBlock.boundingBox();
        if (!box) {
          throw new Error('Price block bounding box not available');
        }

        // Simulate realistic mouse movement across the price block
        const steps = 12;
        for (let i = 0; i < steps; i++) {
          const x = box.x + 20 + (i * (box.width - 40)) / steps;
          const y = box.y + box.height / 2 + (Math.sin(i) * 10);
          await page.mouse.move(x, y);
          await page.waitForTimeout(40);
        }

        // Dwell inside element to satisfy minDwellMs (600ms requirement)
        await page.waitForTimeout(750);

        // Wait for button to become enabled
        await page.waitForFunction(() => {
          const btn = document.querySelector('button[aria-label="Reveal price"]');
          return btn && !btn.disabled;
        }, { timeout: 4000 });

        // Click the reveal button
        await revealBtn.click();
      }

      // Handle loading, retrying, or error states from mock store
      const maxWaitSeconds = 15;
      const pollStart = Date.now();
      let revealed = false;

      while ((Date.now() - pollStart) < maxWaitSeconds * 1000) {
        // Check if price-success is visible
        if (await page.locator('.price-success').isVisible().catch(() => false)) {
          revealed = true;
          break;
        }

        // Check if store returned an error with "Try again" button
        const tryAgainBtn = page.locator('.price-error button:has-text("Try again")');
        if (await tryAgainBtn.isVisible().catch(() => false)) {
          console.warn(`[Scraper] Store showed error state on product ${productId}. Clicking Try again...`);
          await page.waitForTimeout(500);
          await tryAgainBtn.click();
        }

        await page.waitForTimeout(500);
      }

      if (!revealed) {
        // Grab error text if present
        const errText = await page.locator('.price-error').textContent().catch(() => 'Timeout waiting for price');
        throw new Error(`Store failed to reveal price: ${errText.trim()}`);
      }

      // Extract Price & Stock with anti-decoy verification
      const extracted = await page.evaluate(() => {
        const successBlock = document.querySelector('.price-success');
        if (!successBlock) return null;

        const priceMain = successBlock.querySelector('.price-main');
        if (!priceMain) return null;

        // Decoy defense:
        // Mock store injects fake prices with display:none, aria-hidden:true, and strike-through MRP
        const children = Array.from(priceMain.children);
        let realPriceText = '';

        for (const child of children) {
          const style = window.getComputedStyle(child);
          const isHidden = style.display === 'none' || style.visibility === 'hidden' || child.getAttribute('aria-hidden') === 'true';
          const isStrikeThrough = style.textDecorationLine === 'line-through' || child.tagName === 'S' || child.tagName === 'DEL';
          const isBadge = child.className.includes('bd-') || child.textContent.includes('% off');

          if (!isHidden && !isStrikeThrough && !isBadge) {
            // Found the visible, active price element
            realPriceText = child.textContent;
            break;
          }
        }

        // Fallback: look for element with font-size >= 2rem or pv- class
        if (!realPriceText) {
          const potential = priceMain.querySelector('[class*="pv-"], [style*="2.4rem"]');
          if (potential) realPriceText = potential.textContent;
        }

        // Stock badge extraction
        const stockElem = successBlock.querySelector('.stock-badge');
        const stockText = stockElem ? stockElem.textContent.trim() : 'Unknown';
        const isOutOfStock = stockElem ? stockElem.classList.contains('out-stock') : stockText.toLowerCase().includes('out of stock');

        return {
          rawPrice: realPriceText,
          stockText,
          isOutOfStock
        };
      });

      if (!extracted || !extracted.rawPrice) {
        throw new Error('Failed to locate visible price element in DOM');
      }

      const finalPrice = cleanPriceText(extracted.rawPrice);
      if (finalPrice === null || isNaN(finalPrice) || finalPrice <= 0) {
        throw new Error(`Extracted invalid price: "${extracted.rawPrice}"`);
      }

      const durationMs = Date.now() - startTime;
      console.log(`[Scraper] Successfully extracted price: ₹${finalPrice}, stock: "${extracted.stockText}" (${durationMs}ms)`);

      // 1. Update tracked product in database
      await updateProductScrapeResult(productId, {
        price: finalPrice,
        stock: extracted.stockText,
        isInStock: !extracted.isOutOfStock,
        status: 'success'
      });

      // 2. Add entry to price history
      await addPriceHistory({
        productId,
        price: finalPrice,
        stockStatus: extracted.stockText
      });

      // 3. Record honest success log
      await addScrapeLog({
        productId,
        attempt,
        status: 'success',
        durationMs,
        errorMessage: null,
        priceFound: finalPrice,
        stockFound: extracted.stockText
      });

      await browser.close();
      browser = null;

      return {
        success: true,
        productId,
        price: finalPrice,
        stock: extracted.stockText,
        isInStock: !extracted.isOutOfStock,
        attempt,
        durationMs
      };

    } catch (err) {
      lastError = err;
      const attemptDuration = Date.now() - attemptStartTime;
      console.warn(`[Scraper] Attempt ${attempt} failed for product ${productId}: ${err.message}`);

      if (browser) {
        try { await browser.close(); } catch (_) {}
        browser = null;
      }

      // Log the retry or failure honestly
      const status = attempt < maxRetries ? 'retried' : 'failed';
      await addScrapeLog({
        productId,
        attempt,
        status,
        durationMs: attemptDuration,
        errorMessage: err.message,
        priceFound: null,
        stockFound: null
      });

      if (attempt < maxRetries) {
        attempt++;
        // Exponential backoff before retry (e.g. 1s, 2s)
        await new Promise(res => setTimeout(res, 1000 * attempt));
      } else {
        break;
      }
    }
  }

  // If all attempts failed, update product status to 'failed' (without erasing past price)
  const totalDuration = Date.now() - startTime;
  console.error(`[Scraper] All ${maxRetries} attempts failed for product ${productId}. Error: ${lastError?.message}`);

  await updateProductScrapeResult(productId, {
    price: null, // Keep existing price untouched in database
    stock: null,
    isInStock: null,
    status: 'failed'
  });

  return {
    success: false,
    productId,
    error: lastError?.message || 'Scraping failed after all retries',
    attempts: attempt,
    durationMs: totalDuration
  };
}

/**
 * Scrapes all currently tracked products sequentially (used for scheduled runs).
 * @param {Object} options
 */
export async function scrapeAllTrackedProducts(options = {}) {
  console.log('[Scraper] Scheduled batch scrape initiated.');
  const tracked = await import('./db.js').then(m => m.getTrackedProducts());

  if (!tracked || tracked.length === 0) {
    console.log('[Scraper] No tracked products to scrape.');
    return { total: 0, successful: 0, failed: 0, results: [] };
  }

  console.log(`[Scraper] Found ${tracked.length} tracked products to scrape.`);
  const results = [];
  let successful = 0;
  let failed = 0;

  for (const product of tracked) {
    try {
      const res = await scrapeProductPrice(product.id, options);
      results.push(res);
      if (res.success) successful++;
      else failed++;
    } catch (e) {
      console.error(`[Scraper] Unhandled error scraping product ${product.id}:`, e);
      failed++;
      results.push({ success: false, productId: product.id, error: e.message });
    }
    // Small delay between products to be polite
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`[Scraper] Batch scrape completed. Success: ${successful}, Failed: ${failed}`);
  return { total: tracked.length, successful, failed, results };
}

