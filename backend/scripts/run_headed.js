#!/usr/bin/env node

/**
 * Headed Scraper Runner for INE Product Price Tracker
 * 
 * Usage:
 *   npm run scrape:headed
 *   npm run scrape:headed -- 54
 *   npm run scrape:headed -- 431
 * 
 * This script opens a VISIBLE Chromium browser window and runs the scraper
 * against the INE mock store so you can record a 2 to 4 minute demo video.
 */

import { scrapeProductPrice } from '../src/scraper.js';
import dotenv from 'dotenv';

dotenv.config();

const args = process.argv.slice(2);
const productId = args[0] || '54';

console.log('======================================================');
console.log('  INE Observable (Headed) Scraper Run                 ');
console.log('======================================================');
console.log(` Target Product ID: ${productId}`);
console.log(` Target URL: https://demo.inelabteamdev.com/product/${productId}`);
console.log(` Mode: HEADED (Visible Browser Window)`);
console.log(' Starting browser in 3 seconds... Get your recorder ready!');
console.log('======================================================\n');

setTimeout(async () => {
  try {
    const result = await scrapeProductPrice(productId, {
      headless: false, // Run in HEADED mode
      maxRetries: 3
    });

    console.log('\n------------------------------------------------------');
    if (result.success) {
      console.log(' SCRAPE RESULT: SUCCESS!');
      console.log(` Product ID : ${result.productId}`);
      console.log(` Price      : ₹${result.price}`);
      console.log(` Stock      : ${result.stock}`);
      console.log(` In Stock   : ${result.isInStock ? 'YES' : 'NO'}`);
      console.log(` Attempt    : ${result.attempt}`);
      console.log(` Duration   : ${result.durationMs}ms`);
    } else {
      console.log(' SCRAPE RESULT: FAILED (Recorded Honestly)');
      console.log(` Error      : ${result.error}`);
      console.log(` Attempts   : ${result.attempts}`);
      console.log(` Duration   : ${result.durationMs}ms`);
    }
    console.log('------------------------------------------------------\n');
    process.exit(result.success ? 0 : 1);
  } catch (err) {
    console.error('\n[Fatal Error]:', err.message);
    process.exit(1);
  }
}, 3000);

