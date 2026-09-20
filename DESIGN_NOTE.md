# Design Note: Scraper Reliability, Trade-Offs & AI Corrections

**INE | Software Engineer Intern Assignment: Product Price Tracker**

---

## 1. How Scraping Reliability Was Achieved

The INE mock store (`https://demo.inelabteamdev.com/`) was deliberately engineered to fail naive crawlers, simple HTTP requests, and basic headless scripts. To ensure resilient, unattended scraping across hundreds of runs, several targeted reliability patterns were implemented:

### A. Simulating Human Cursor Dynamics & Dwell Time
- **The Defense**: The storefront tracks mouse interactions via an internal tracker class (`Ar`). The "Reveal price" button remains permanently disabled unless at least **8 cursor movement events** are recorded and the user hovers inside the `.price-block` container for at least **600 milliseconds** (`minDwellMs: 600`). In addition, click events verify `e.nativeEvent.isTrusted`.
- **The Solution**: In `backend/src/scraper.js`, Playwright calculates the bounding box of `.price-block`, computes smooth cursor waypoints with subtle sine-wave jitter, moves the cursor across the element over 480ms, and dwells for >750ms before interacting with the button. It then waits for the button to become enabled before issuing a trusted click.

### B. Defeating Obfuscation & DOM Decoy Traps
- **The Decoy Traps**:
  1. The mock storefront injects decoy elements into `.price-main` with classes like `.price-value` and attributes like `data-price="true"`, but styles them with `display: none` or `aria-hidden="true"` containing incorrect prices (e.g., ₹14,990 or ₹17,243).
  2. The maximum retail price (MRP) is rendered with `text-decoration: line-through` (e.g., ₹28,268).
  3. The active, visible price is dynamically split into individual spans or assigned obfuscated layout class hashes (e.g., `pv-k2` defined in `/api/layout`).
- **The Solution**: The scraper uses an in-browser evaluation filter:
  - Filters out any element with `display: none`, `visibility: hidden`, or `aria-hidden="true"`.
  - Excludes any element with `text-decoration: line-through` or tags `<s>` / `<del>`.
  - Discards discount percentage badges (`% off`).
  - Targets the genuinely visible, styled price element and reconstructs the character stream.

### C. Multi-Format Price Cleaning
The mock store intentionally cycles through international price formatting:
- Standard Indian comma format (`₹22,615`)
- European decimal comma with thousands dot (`₹22.615,00`)
- Spaced thousands (`₹22 615`)
- Trailing tax strings (`₹22,615/- (incl. of all taxes)`)
- Fullwidth Unicode digits (`₹２２，６１５` using `\uFF10-\uFF19` and `\uFF0C`)
- Indian Lakh notation (`Rs. 22,615.00`)
- Zero-width non-breaking spaces and joiners (`\u200B-\u200D`, `\uFEFF`, `\u00A0`)

Our `cleanPriceText()` normalizer strips all zero-width characters, converts fullwidth Unicode glyphs to standard ASCII numbers and commas, handles thousands dots vs decimal commas, strips currency symbols and trailing notices, and yields an accurate float.

### D. Retry Strategy with Exponential Backoff
- The mock storefront randomly introduces network delays, rate limits (429 status codes), and transient 500 errors ("Couldn't load the price. Try again").
- When a failure or "Try again" button is detected, the scraper retries up to 3 times with exponential backoff (1s, 2s).
- If all retries fail, the attempt is logged honestly as `failed`, and **no corrupt or empty price is written** to `tracked_products` or `price_history`.

---

## 2. Architectural Trade-Offs

| Decision | Approach Chosen | Trade-Off Rationale |
|---|---|---|
| **Catalog Search vs Scraping** | Lightweight HTTP for catalog search; Playwright for price scraping | Searching via `/api/catalog` is instant (<100ms) and uses zero browser memory. Playwright is reserved exclusively for product price scraping where JavaScript rendering and mouse simulation are genuinely required. |
| **Headed vs Headless Mode** | Configurable via flag (`headless: true` by default, `headless: false` for CLI run) | Background unattended runs consume minimal resources in headless mode; headed mode allows developers and evaluators to observe the browser actions live for demo recordings. |
| **Free-Tier Scheduling Constraint** | External Webhook Cron (`/api/scrape/cron`) | Free-tier Render backends sleep after 15 minutes of inactivity. Internal `setInterval()` loops cease functioning when the container spins down. An external cron service (such as `cron-job.org` running every 2 hours) wakes the instance up via HTTP and triggers the batch scrape reliably. |
| **Database Flexibility** | Supabase (PostgreSQL) with seamless local SQLite fallback | Enables instant local development and grading out-of-the-box without requiring initial cloud credential configuration, while supporting full Supabase PostgreSQL deployment in production. |

---

## 3. What AI Tools Got Wrong on the First Attempt & How It Was Corrected

When naive AI coding tools attempt this assignment, they consistently fall into three critical traps:

1. **Attempting Static HTML Scraping (`curl` / `cheerio` / `fetch`)**:
   - *AI Mistake*: The AI attempts to fetch `https://demo.inelabteamdev.com/product/:id` with `axios` or `fetch` and parse the HTML with Cheerio or regex.
   - *Failure*: The mock storefront is a Single Page Application (SPA). The raw HTML response contains only `<div id="root"></div>` with no product prices or stock data.
   - *Correction*: Recognized that JavaScript execution is mandatory. Adopted Playwright to boot a real browser context capable of executing client-side scripts.

2. **Falling for Decoy DOM Elements**:
   - *AI Mistake*: The AI selects elements using `.price-value` or `[data-price]`.
   - *Failure*: The mock store intentionally embeds dummy values (`display: none`) with those exact selector names. Querying them extracts fake, static prices.
   - *Correction*: Inspected computed styles (`window.getComputedStyle`) in the browser context to verify element visibility, disregard strike-through MRP elements, and target the active price component.

3. **Ignoring Mouse Hover & Dwell Prerequisites**:
   - *AI Mistake*: The AI locates `<button>Reveal price</button>` and immediately attempts `await page.click('button:has-text("Reveal price")')`.
   - *Failure*: The button is initially `disabled`. A direct click throws an actionability timeout or is ignored by the store's event listeners because the mouse tracker requires at least 8 moves and >600ms dwell time.
   - *Correction*: Added realistic cursor movement simulation with incremental coordinates and an intentional dwell delay (>750ms) before asserting that the button is enabled and clicking.

4. **Corrupting Numeric Prices with Unicode Formatting**:
   - *AI Mistake*: The AI uses `parseFloat(text.replace(/[^0-9.]/g, ''))`.
   - *Failure*: Fullwidth Unicode digits (`２２，６１５`) are stripped or mangled, European comma-decimals (`22.615,00`) become `22.61500` (off by a factor of 1000), and zero-width spaces cause NaN errors.
   - *Correction*: Implemented a dedicated multi-stage parser handling fullwidth normalization, character sanitization, and decimal-vs-thousands separator disambiguation.
