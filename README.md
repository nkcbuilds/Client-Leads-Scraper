# Client Leads Scraper (LegalReach)

A production-quality legal lead scraping system that accepts directory, award, and editorial URLs, extracts structured lawyer records with AI, enriches them with contact signals, deduplicates results, and exports clean lead sheets.

Built for a lawyer client who needs reliable leads from legal ranking pages, firm directories, and award lists — without site-specific hacks.

**Repository:** [github.com/nkcbuilds/Client-Leads-Scraper](https://github.com/nkcbuilds/Client-Leads-Scraper)

---

## Features

- **URL-based scraping** — Submit one or more source URLs from a web dashboard
- **JavaScript rendering** — Playwright handles SPAs, lazy loading, and pagination
- **Smart page classification** — Detects profile directories, list pages, articles, and search results
- **AI extraction** — Google Gemini extracts names, titles, companies, awards, and bios as structured JSON
- **Contact enrichment** — Infers company domains, likely emails, LinkedIn profiles, and phone numbers
- **Confidence scoring** — Each field and record gets a confidence score for human review
- **Deduplication** — Exact and fuzzy merge across overlapping records
- **Export** — CSV, Excel, and JSON download
- **Manual mode** — Paste HTML or text when live crawling is blocked
- **Job tracking** — Full scrape logs, status, and warnings per job
- **Windows-first** — One-click `start.bat` launcher; runs locally on a laptop

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18 |
| Backend | Express 4, Node.js (ES modules) |
| Database | SQLite (`better-sqlite3`) |
| Crawler | Playwright (Chromium) |
| AI / LLM | Google Gemini API (`@google/generative-ai`) |
| HTML parsing | Cheerio |
| Export | `xlsx`, custom CSV/JSON exporters |
| Queue | `p-queue` (concurrency-controlled job processing) |

---

## Architecture

```text
Frontend (Next.js :3000)
  └── Dashboard, job submission, results view, settings, export

Backend API (Express :3001)
  └── Jobs, people, settings, health, export endpoints

Job Queue (p-queue)
  └── Controls crawl + enrichment concurrency

Crawler (Playwright)
  └── Page load, scroll, pagination, blocked-page detection

Classifier
  └── Heuristic + optional Gemini classification

LLM Pipeline
  └── Clean → chunk → extract → validate → confidence score

Enrichment
  └── Domain, email pattern, LinkedIn, phone lookup

Deduplication
  └── Exact + fuzzy name/company merge

Storage (SQLite)
  └── jobs, people, contacts, scrape_log, settings

Exporter
  └── CSV, Excel, JSON
```

### Pipeline flow

1. User submits a URL (and optional label) from the dashboard
2. Backend creates a job and enqueues it
3. Playwright loads the page; classifier determines page type
4. For directories: scroll re-scrape to load lazy-rendered profiles
5. Page text is cleaned, chunked (~6000 chars), and sent to Gemini
6. Extracted records are validated (garbage name filter, confidence threshold)
7. Enrichment adds domain, email, LinkedIn, phone with confidence scores
8. Deduplication merges overlapping records
9. Results saved to SQLite; user views and exports from the dashboard

---

## Quick Start (Windows)

### Prerequisites

- **Node.js** 18+ (tested on v22)
- **Google Gemini API key** — [Get one here](https://aistudio.google.com/apikey)
- **Git** (optional, for cloning)

### 1. Clone and configure

```bash
git clone https://github.com/nkcbuilds/Client-Leads-Scraper.git
cd Client-Leads-Scraper
copy .env.example .env
```

Edit `.env` and set your API key:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.1-flash-lite
```

### 2. Launch (easiest)

Double-click **`start.bat`**. It will:

- Install backend and frontend dependencies
- Install Playwright Chromium
- Create data/log/output directories
- Start backend on `http://localhost:3001`
- Start frontend on `http://localhost:3000`

### 3. Manual launch

```bash
# Terminal 1 — Backend
cd backend
npm install
npx playwright install chromium
npm run dev

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**, paste a URL (e.g. `https://www.lw.com/en/people`), and click **Start Scrape**.

---

## Desktop App

The project can also be shipped as a desktop app using **Electron** on both **Windows** and **macOS**. The desktop wrapper:

- starts the backend API locally inside the app
- starts the Next.js frontend locally and loads it in a native desktop window
- checks for updates on launch with `electron-updater`
- can auto-download a published release and prompt the client to restart
- provisions a local Playwright Chromium runtime for scraping on clean client machines
- exposes a desktop diagnostics panel in the Settings screen for service health, runtime paths, and startup events

### Desktop development

```bash
npm install
npm run desktop:dev
```

This runs the Electron shell and boots the local frontend/backend automatically.

### Build for your current platform

```bash
npm run desktop:build
```

Artifacts are written to `dist/`.

### Platform-specific builds

```bash
# Windows
npm run desktop:build:win

# macOS (run this on a Mac)
npm run desktop:build:mac
```

Note: macOS artifacts must be built on macOS. Cross-building a proper `.dmg` from Windows is not the normal path.

### Auto-update flow

Auto updates work from **published releases**, not from every local git push by itself. The intended flow is:

1. Push code changes
2. Build a new desktop release
3. Publish the generated installer + update artifacts to **GitHub Releases**
4. Client app checks on startup, downloads the new version, and installs on restart

The current Electron builder config is pointed at the GitHub repo listed in the repository metadata. If you want private distribution later, we can switch to a private release feed or a generic update server.

### GitHub Actions desktop releases

This repo now includes a GitHub Actions workflow at `.github/workflows/desktop-release.yml`.

- pushes to `main` build and publish a fresh Windows desktop release automatically
- tags like `v1.2.0` build and publish a versioned release using that tag
- release assets include the installer, blockmap, and `latest.yml` required by `electron-updater`

That means the client app can check GitHub Releases on startup and offer the newest installer build automatically after CI publishes it.

### macOS note

The desktop runtime is now structured to work on macOS as well:

- backend and frontend run as child services instead of being loaded directly into Electron
- runtime data (SQLite DB, browser sessions, Playwright browsers) is stored in the app user-data directory instead of inside the app bundle
- Playwright Chromium is installed into app-managed storage on first run if needed

For a polished macOS client rollout, you should still plan to complete:

- Apple code signing
- notarization with real Apple credentials

Unsigned Mac builds can still be used for testing, but signed/notarized builds are the right path for normal client distribution and smoother auto-update behavior.

The repo now includes:

- generated desktop icons for Windows and macOS via `npm run desktop:generate-icons`
- a mac entitlements file at `desktop/assets/entitlements.mac.plist`
- a notarization hook at `desktop/notarize.js`
- GitHub Actions environment hooks for:
  - `APPLE_ID`
  - `APPLE_APP_SPECIFIC_PASSWORD`
  - `APPLE_TEAM_ID`

Once those secrets are configured in GitHub, the Mac desktop release path is much closer to production-ready.

---

## Configuration

All settings live in `.env` at the project root (see `.env.example`).

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend API port |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Frontend → backend URL |
| `GEMINI_API_KEY` | — | **Required** for AI extraction |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | Primary Gemini model |
| `GEMINI_FALLBACK_MODELS` | *(empty)* | Comma-separated fallback models |
| `GEMINI_MIN_INTERVAL_MS` | `3000` | Min delay between Gemini API calls |
| `CRAWL_DELAY_MS` | `2000` | Delay between page requests |
| `CRAWL_CONCURRENCY` | `2` | Max parallel page crawls |
| `CRAWL_TIMEOUT_MS` | `30000` | Page load timeout |
| `DB_PATH` | `./data/legalreach.db` | SQLite database path |

You can also set the Gemini API key from the **Settings** page in the dashboard.

---

## AI Model Selection

After benchmarking **Gemini 3.1 Flash Lite** vs **Gemma 4 31B**, Gemini 3.1 Flash Lite is the recommended production model:

| Model | Records (lw.com) | Time | API errors |
|-------|------------------|------|------------|
| **gemini-3.1-flash-lite** | **20** | **69s** | None |
| gemma-4-31b-it | 12 | 221s | JSON + HTTP 500 |

Gemini 3.1 Flash Lite has a **500 requests/day** free-tier limit, which is sufficient for typical daily scraping when the seed-page skip optimization is enabled (avoids visiting individual profile pages when the listing already yields ≥5 records).

See **[MODEL_BENCHMARK_REPORT.md](./MODEL_BENCHMARK_REPORT.md)** for the full analysis, issue taxonomy, and historical run data.

### Model commands

```bash
cd backend

# Quick smoke test for a single model
node src/scripts/test-model.js gemini-3.1-flash-lite

# Full head-to-head benchmark
npm run benchmark
npm run benchmark -- https://www.lw.com/en/people
```

---

## Dashboard

| Page | URL | Purpose |
|------|-----|---------|
| Home | `/` | Submit URLs, view job list, live/running status |
| Job detail | `/jobs/[id]` | Scrape logs, classification, pipeline warnings |
| Results | `/results/[id]` | Filtered people table, export buttons |
| Settings | `/settings` | Gemini API key, crawl settings |

### Input modes

- **Live** — Playwright crawls the URL directly
- **Manual** — Paste raw text or HTML when a site blocks automation

---

## API Reference

Base URL: `http://localhost:3001/api`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server health + Gemini configured status |
| `GET` | `/jobs` | List all jobs |
| `POST` | `/jobs` | Create job `{ url, label?, manual_text?, manual_html? }` |
| `GET` | `/jobs/:id` | Job detail + summary |
| `GET` | `/jobs/:id/logs` | Scrape log entries |
| `GET` | `/jobs/:id/people` | Enriched people for a job |
| `GET` | `/jobs/:id/export?format=csv\|xlsx\|json` | Download export |
| `GET` | `/people` | All people across jobs |
| `GET` | `/settings` | Current settings |
| `PUT` | `/settings` | Update settings (API key, crawl config) |

---

## Project Structure

```text
Client-Leads-Scraper/
├── README.md
├── MODEL_BENCHMARK_REPORT.md
├── MASTER_PROJECT_PLAN.md
├── .env.example
├── start.bat
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── server.js              # Express entry point
│   │   ├── api/                   # REST routes (jobs, people, export, settings)
│   │   ├── crawler/               # Playwright scraper, pipeline, link detection
│   │   ├── classifier/            # Page type classification
│   │   ├── llm/                   # Gemini client, extractor, validator, chunker
│   │   ├── enrichment/            # Domain, email, LinkedIn, phone, scoring
│   │   ├── dedup/                 # Deduplication logic
│   │   ├── exporters/             # CSV, Excel, JSON
│   │   ├── db/                    # SQLite schema + queries
│   │   ├── queue/                 # Job queue
│   │   ├── scripts/               # validate, audit, benchmark, test utilities
│   │   └── utils/                 # Logger, retry, env loader
│   └── test/                      # 22 unit tests
└── frontend/
    ├── package.json
    ├── pages/                     # Next.js pages (index, jobs, results, settings)
    ├── components/                # Layout, shared UI
    └── lib/                       # API client
```

---

## Scripts

Run from `backend/`:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend with file watch |
| `npm start` | Start backend (production) |
| `npm test` | Run 22 unit tests |
| `npm run validate` | Offline validation (DB, exports, APIs) |
| `npm run validate:live` | Live scrape validation run |
| `npm run audit` | Full audit across test URLs |
| `npm run benchmark` | Compare Gemini vs Gemma models |
| `npm run test:scrape` | Quick Playwright scrape test |

---

## Supported Page Types

| Type | Example | Strategy |
|------|---------|----------|
| Profile directory | `lw.com/en/people` | Scroll re-scrape, extract from listing, skip profiles if ≥5 records |
| List page | Award/ranking lists | Pagination follow, per-page extraction |
| Article / editorial | News mentioning lawyers | Single-page extraction |
| Search results | Filtered directory views | Extract visible results, may paginate |
| Blocked | Cloudflare, CAPTCHA | Logged clearly; use manual paste mode |

---

## Data Model

Each extracted person record includes:

- Name (first/last split for enrichment)
- Title, company, company domain
- Award name and year (when present)
- Bio snippet
- Email (inferred or found), LinkedIn, phone
- Source URL and source site
- LLM confidence and overall enrichment confidence
- Job ID linkage for traceability

Exports include all fields plus metadata (job label, export timestamp).

---

## Testing

```bash
cd backend
npm test
```

**22 unit tests** cover:

- Page classification (directory, award list)
- Link detection and pagination
- Deduplication (exact + distinct)
- Enrichment (domain inference, email guessing)
- Export formats (CSV, JSON, Excel)
- Validator (garbage names, confidence thresholds)
- Retry logic and blocked-page detection

---

## Known Limitations

- **Anti-bot sites** (e.g. Chambers.com) may block Playwright — use manual paste mode
- **Gemini quota** — Free tier has per-model daily limits; monitor at [ai.dev/rate-limit](https://ai.dev/rate-limit)
- **Email addresses** are pattern-inferred, not verified — marked with confidence scores
- **v1 scope** — Single-user local deployment; no multi-tenant SaaS or CRM integration

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| 0 records extracted | Check Gemini API key in Settings; verify quota not exhausted |
| "ClearExpand" or UI text as names | Rate limit triggered regex fallback — wait for quota reset or switch model |
| Page shows 0 lawyers but site has many | Ensure scroll re-scrape ran (check job logs for `profile_directory`) |
| Playwright errors | Run `npx playwright install chromium` in `backend/` |
| Frontend can't reach API | Confirm `NEXT_PUBLIC_API_URL` matches backend port |

---

## Development Roadmap

See **[MASTER_PROJECT_PLAN.md](./MASTER_PROJECT_PLAN.md)** for the full phased build plan. Current status:

- [x] Phase 1–2: Foundation, crawl, pagination
- [x] Phase 3: Classification + Gemini extraction
- [x] Phase 4: Enrichment + deduplication
- [x] Phase 5: Dashboard + export
- [x] Phase 6: Hardening, tests, rate limiting, benchmark
- [ ] Client-specific URL tuning
- [ ] Optional paid enrichment providers (Hunter, Apollo)
- [ ] PostgreSQL migration for server deployment

---

## License

Private client project. All rights reserved unless otherwise specified by the repository owner.

---

## Contributing

This is a client delivery project maintained by [nkcbuilds](https://github.com/nkcbuilds). For issues or feature requests, open a GitHub issue on this repository.
