# INE Product Price Tracker (Web Scraping)

A full-stack web application designed for the **INE Software Engineer Intern Assignment**. The application allows users to search products from INE's hosted mock storefront (`https://demo.inelabteamdev.com/`), track their prices and stock levels on a fixed 2-hour schedule, visualize historical price fluctuations via interactive charts and tables, inspect honest per-attempt scrape logs, and run the scraper in observable headed mode.

---

## Deliverables & Submission Links

- **Hosted Frontend (Vercel)**: `https://your-frontend-deployment.vercel.app` *(Replace with your live URL)*
- **Hosted Backend (Render)**: `https://your-backend-service.onrender.com` *(Replace with your live URL)*
- **GitHub Repository**: `https://github.com/your-username/ine-price-tracker` *(Replace with your repo URL)*
- **Screen Recording (Headed Mode Demo)**: `https://youtu.be/...` or Google Drive link *(2 to 4 minute demo)*
- **Design Note**: See [`DESIGN_NOTE.md`](./DESIGN_NOTE.md)

---

## Tech Stack

- **Frontend**: React.js (Vite), custom responsive dashboard UI, SVG interactive price charts, deployed on **Vercel**.
- **Backend**: Node.js (Express), modular REST API, deployed on **Render**.
- **Database**: **Supabase (PostgreSQL)** for tracked products, price history, and scrape logs (with automatic local SQLite fallback for seamless offline dev).
- **Web Scraping**: **Playwright (Chromium)** with cursor movement simulation, dwell interval management, anti-decoy verification, and retry backoff.
- **Scheduling**: External cron webhook (`/api/scrape/cron`) triggered via **cron-job.org** every 2 hours (handles free-tier backend sleep).

---

## Key Features

1. **Lightweight Mock Store Search**:
   - Searches the mock store catalog instantly using lightweight HTTP requests against `/api/catalog` without launching a browser.
   - Filter by product name, brand, category, or SKU with live auto-suggest.

2. **Resilient Browser Scraping (The Core Challenge)**:
   - **Hover & Dwell Simulation**: Solves the storefront's anti-bot requirement of at least 8 mouse moves and >600ms dwell time before enabling the "Reveal price" button.
   - **Decoy Evasion**: Filters out hidden dummy elements (`.price-value`, `[data-price]`, `display: none`) and strike-through MRP elements (`text-decoration: line-through`).
   - **Multi-Format Normalization**: Handles European decimals (`16.961,00`), Indian formats (`₹16,961`), fullwidth Unicode digits (`１６，９６１`), zero-width characters, and custom badges.
   - **Retry & Error Recovery**: Recovers from simulated 429 rate limits, slow responses, and store error states using exponential backoff.

3. **Price & Stock History**:
   - Visual trend line charts showing historical price shifts over time.
   - History table tracking price changes, stock availability badges (`In stock`, `Out of stock`), and timestamps.

4. **Honest Scrape Logging**:
   - Every scrape attempt is recorded with its exact timestamp, attempt number, duration in milliseconds, outcome status (`success`, `retried`, or `failed`), and error details.
   - Failures and retries are recorded honestly, and corrupted or empty data is never written to the product price history.

5. **Observable (Headed) Run Mode**:
   - Dedicated CLI command to launch a visible Chromium browser window, allowing evaluators to watch the scraper navigate, hover, dwell, click, and extract data in real time.

---

## Project Structure

```
INE/
├── backend/
│   ├── scripts/
│   │   └── run_headed.js        # Observable (headed) scraper runner for screen recording
│   ├── src/
│   │   ├── catalog.js           # Lightweight HTTP mock store search & metadata
│   │   ├── db.js                # Supabase client + local SQLite fallback
│   │   ├── index.js             # Express server entry point
│   │   ├── routes/
│   │   │   └── api.js           # REST endpoints (/products, /history, /logs, /scrape/cron)
│   │   └── scraper.js           # Playwright scraper with hover/dwell & decoy evasion
│   ├── package.json
│   ├── render.yaml              # Render.com deployment configuration
│   ├── schema.sql               # Supabase PostgreSQL database schema
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── PriceChart.jsx           # SVG price trend visualization
│   │   │   ├── ProductDetailModal.jsx   # Details modal (chart, history, scrape logs)
│   │   │   ├── ProductSearch.jsx        # Instant mock store catalog search & picker
│   │   │   ├── ScrapeLogsTable.jsx      # Honest scrape attempt & failure log table
│   │   │   └── TrackedProductList.jsx   # Grid of tracked products with live status
│   │   ├── App.jsx              # Main dashboard view
│   │   ├── index.css            # Responsive dark-theme styling
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── vercel.json              # Vercel deployment rewrite rules
│   └── vite.config.js
├── .github/workflows/
│   └── ci.yml                   # GitHub Actions CI workflow
├── DESIGN_NOTE.md               # Detailed design note explaining reliability & AI corrections
├── package.json                 # Root script runner
└── README.md                    # Setup & documentation
```

---

## Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### 2. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies (installs Playwright, Express, Supabase client, SQLite)
npm install

# Copy environment template
cp .env.example .env
```

*(Optional: If you have Supabase credentials, paste them in `backend/.env`. If omitted, the backend will automatically use a local SQLite database in `backend/data/local.db` with zero configuration).*

Start the backend server:
```bash
npm run dev
```
The backend will run on `http://localhost:5000`. Test health at `http://localhost:5000/api/health`.

### 3. Frontend Setup
In a new terminal:
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Observable (Headed) Run for Screen Recording

The assignment requires submitting a **2 to 4 minute screen recording** of the scraper running in headed mode against the mock store.

Run the headed scraper runner with:
```bash
# From the root directory:
npm run scrape:headed

# Or run against a specific product ID (e.g. product 54 or 431):
npm run scrape:headed -- 54
npm run scrape:headed -- 431
```

### What to Showcase in Your Recording:
1. **Window Launch**: The Chromium browser window opens and navigates to the mock store product page.
2. **Hover Simulation**: The cursor moves across the `.price-block` container and dwells for >600ms until "Reveal price" enables.
3. **Price & Stock Extraction**: The button is clicked, handles the loading spinner, evades decoy prices, and displays the true price and stock status.
4. **Honest Logging**: Show the terminal or frontend dashboard displaying the recorded scrape attempt and status (`success`, `durationMs`).
5. **Handling Error/Retry**: Mention how the scraper detects "Try again" buttons or retries with exponential backoff if the store responds with slow or 429 errors.

---

## Database Configuration (Supabase)

To connect to Supabase:
1. Log in to [Supabase](https://supabase.com) and create a new project.
2. Go to the **SQL Editor** tab -> **New Query**.
3. Copy and paste the contents of [`backend/schema.sql`](./backend/schema.sql) and click **Run**.
4. Navigate to **Project Settings** -> **API**.
5. Copy your **Project URL** and **Service Role Key** (or Anon Key).
6. Set them in `backend/.env`:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   ```
7. Restart the backend. The health endpoint will now indicate `database: 'supabase-postgresql'`.

---

## Scheduled Scraping (Every 2 Hours via cron-job.org)

Free-tier serverless or container hosts (like Render) go to sleep after 15 minutes of inactivity. An internal `setInterval` loop cannot survive when the container sleeps.

### Setup Instructions for cron-job.org:
1. Create a free account at [cron-job.org](https://cron-job.org).
2. Click **Create Cronjob**.
3. **URL**: `https://your-render-service.onrender.com/api/scrape/cron`
4. **Schedule**: Set to **Every 2 hours** (`0 */2 * * *`).
5. **Request Method**: `POST`
6. **Headers**: Add:
   ```
   x-cron-secret: ine_cron_secret_2026
   ```
7. Click **Create**. Every 2 hours, cron-job.org will wake your backend service, scrape all tracked products, and update their history and logs.

---

## Production Deployment

### Backend on Render.com
1. Create a new **Web Service** on [Render](https://render.com) connected to your GitHub repository.
2. Root Directory: `backend`
3. Environment: `Node`
4. Build Command:
   ```bash
   npm install && npx playwright install chromium --with-deps
   ```
5. Start Command:
   ```bash
   npm start
   ```
6. Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `CRON_SECRET`: `ine_cron_secret_2026`
   - `SUPABASE_URL`: `<your-supabase-url>`
   - `SUPABASE_SERVICE_ROLE_KEY`: `<your-supabase-key>`
   - `MOCK_STORE_URL`: `https://demo.inelabteamdev.com`

### Frontend on Vercel
1. Import your GitHub repository into [Vercel](https://vercel.com).
2. Framework Preset: `Vite`
3. Root Directory: `frontend`
4. Environment Variables:
   - `VITE_API_URL`: `https://your-render-service.onrender.com`
5. Deploy. The `vercel.json` ensures all routes route cleanly to `index.html`.

---

## Evaluation Criteria Alignment

| Requirement | Implementation Details |
|---|---|
| **Scraping Reliability** | Simulates 8+ cursor movements and >600ms dwell; auto-detects and retries on transient errors with exponential backoff up to 3 attempts. |
| **Correctness under Difficulty** | Evades hidden decoy elements (`.price-value`, `[data-price]`, `display: none`) and strike-through MRPs; normalizes European decimals, fullwidth Unicode digits, and zero-width spaces. |
| **Honest History & Logging** | Every attempt is logged with timestamp, status (`success`, `retried`, `failed`), and error string. Corrupted data is never written on failure. |
| **Judgment** | Lightweight HTTP for catalog search (<100ms); Playwright browser strictly reserved for JavaScript-rendered price scraping; webhook cron for sleep-safe scheduling. |
| **Observable Headed Mode** | `npm run scrape:headed -- <id>` runs a visible browser window with step-by-step terminal logs for video recording. |
| **Deployment Ready** | `render.yaml` for Render backend, `vercel.json` for Vercel frontend, `schema.sql` for Supabase PostgreSQL. |

