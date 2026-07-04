# LegalReach Master Project Plan

## 1. Purpose

We are building a production-quality legal lead scraping system for a lawyer client. The product will accept legal ranking, award, directory, and editorial URLs, extract structured professional records, enrich them with public contact signals, deduplicate the results, and export a clean lead sheet the client can actually use.

This document is the single source of truth for how we will build the project.

## 2. Final Product Definition

The application should:

- Accept one or more source URLs from a simple UI
- Crawl pages that may use JavaScript, pagination, and lazy loading
- Classify page types before extraction
- Extract people, titles, companies, awards, bios, and source metadata
- Enrich records with company domain, likely email, LinkedIn, and phone when available
- Score confidence for each extracted and enriched field
- Deduplicate overlapping records across multiple sources
- Store jobs and results locally in SQLite
- Export CSV, Excel, and JSON
- Run on a Windows laptop first, with optional Linux server deployment later

## 3. Scope

### In scope

- Legal directories
- Award lists
- Ranking pages
- Article and editorial pages
- Company website follow-up pages
- PDF text extraction where source pages link to PDFs
- Local dashboard for non-technical use

### Out of scope for v1

- Full multi-user SaaS
- Full CRM integration
- Automatic CAPTCHA solving
- Aggressive anti-bot bypass systems
- Massive distributed crawling

## 4. Source Document Reconciliation

The two original project documents had a few mismatches. This master plan resolves them as follows:

- UI stack: we will use `Next.js` for the frontend and `Express` for the backend.
- Storage: we will start with `SQLite` for local delivery and keep the code structured so we can move to `PostgreSQL` later if needed.
- Enrichment: v1 will use free/public-source enrichment first. Paid providers such as Hunter or Apollo will be treated as optional future plug-ins, not core requirements.
- Scraping approach: we will use a general-purpose pipeline, not hardcoded selectors for only a few sites.
- Blocked pages: if a site prevents automated access, the system will log it clearly and allow manual review instead of pretending the scrape succeeded.

## 5. Product Principles

- Reliability over cleverness
- Clear job status and error reporting
- Reusable pipeline over site-by-site hacks
- Human-review path for low-confidence results
- Public-source-first enrichment
- Respectful crawling with delays, retries, and transparent failure handling

## 6. High-Level Architecture

```text
Frontend (Next.js)
  -> submit URLs, view jobs, inspect results, export files

Backend API (Express)
  -> receives jobs, manages settings, exposes results, triggers exports

Job Queue
  -> controls crawl and enrichment concurrency

Crawler Layer
  -> Playwright-based rendering, pagination, raw text extraction

Classifier Layer
  -> determines page type and crawl strategy

LLM Extraction Layer
  -> chunking, extraction, parsing, validation, confidence scoring

Enrichment Layer
  -> domain discovery, public email discovery/patterning, LinkedIn lookup, phone lookup

Deduplication Layer
  -> exact and fuzzy merge rules across sources

Storage Layer
  -> SQLite for jobs, people, contacts, logs, settings

Exporter Layer
  -> CSV, Excel, JSON
```

## 7. Core Workflow

```text
1. User submits a URL and label
2. Backend creates a job
3. Crawler loads the page and collects raw content
4. Classifier decides whether the page is:
   - profile directory
   - list page
   - article/editorial
   - search results
5. Crawl strategy follows pagination and detail pages as needed
6. Text is cleaned and chunked
7. LLM extracts structured person records as JSON
8. Records are validated and low-confidence rows are filtered or flagged
9. Enrichment attempts domain, email, LinkedIn, and phone discovery
10. Deduplication merges overlapping records
11. Results are saved in SQLite
12. User views and exports the final lead set
```

## 8. Supported Page Types

### Profile directory

- Example: legal ranking directories with one profile per person
- Strategy: collect profile links, visit each profile, extract individual records

### List or table page

- Example: award winner lists or ranking tables
- Strategy: extract page-level entries and follow pagination

### Article or editorial page

- Example: commentary pages that mention lawyers or in-house counsel in prose
- Strategy: extract article body and use the LLM to identify professionals from text

### Search results page

- Example: sites where people appear behind internal search
- Strategy: submit known queries when available and crawl the result pages

## 9. Tech Stack

### Frontend

- Next.js
- React
- Simple dashboard UI focused on jobs, results, exports, and settings

### Backend

- Node.js
- Express
- `p-queue` for concurrency and retry-friendly orchestration

### Crawling

- Playwright for browser rendering
- Cheerio for static HTML parsing when a full browser is not needed

### LLM

- Gemini Flash for page classification and structured extraction
- Prompt-driven JSON output with strict parsing and validation

### Data and export

- SQLite for local persistence
- CSV, Excel, JSON exporters

## 10. Proposed Folder Structure

```text
LeadsScraper/
  frontend/
    pages/
    components/
    lib/
  backend/
    src/
      api/
      crawler/
      llm/
      enrichment/
      queue/
      db/
      utils/
      exporters/
      sources/
      server.js
    data/
    logs/
    output/
  mcps/
  .env.example
  start.bat
  start.sh
  MASTER_PROJECT_PLAN.md
```

## 11. Backend Modules

### API

- Create jobs
- Query jobs
- Query results
- Export results
- Manage settings

### Crawler

- Browser setup
- Request strategy
- Pagination detection
- Content extraction
- Retry and timeout handling
- Blocked-page detection

### Classifier

- Lightweight URL and HTML inspection
- LLM-assisted page-type classification

### LLM pipeline

- Text cleaning
- Chunking with overlap
- Extraction prompt
- JSON parser
- Validator
- Extraction confidence scorer

### Enrichment

- Company domain finder
- Public email discovery
- Email pattern generation
- LinkedIn finder
- Phone finder
- Enrichment confidence scorer

### Deduplication

- Exact match by normalized name + company
- Fuzzy match by normalized name + domain
- Post-enrichment email-based merge

## 12. Data Model

We will keep five main tables:

- `jobs`
- `people`
- `contacts`
- `scrape_log`
- `settings`

### Jobs

Tracks URL, label, status, counts, errors, and timestamps.

### People

Stores extracted person-level fields:

- name
- first_name
- last_name
- title
- company
- company_domain
- source_site
- source_url
- award_name
- award_year
- bio
- raw_snippet
- llm_confidence

### Contacts

Stores enrichment outputs:

- email
- email_status
- email_source
- email_pattern
- phone
- phone_source
- linkedin_url
- linkedin_source
- company_domain
- domain_source
- overall_confidence
- confidence_label

### Scrape log

Stores page-level operational logs, including blocked pages and timeouts.

### Settings

Stores runtime config such as API keys, crawl delay, concurrency, and output path.

## 13. Extraction Strategy

### Step 1: Clean text

- Remove navigation noise where possible
- Normalize whitespace
- Keep enough source context for auditing

### Step 2: Chunk text

- Split long pages into manageable chunks
- Use chunk overlap to avoid cutting off person mentions across boundaries

### Step 3: Extract JSON

Each record should aim to return:

- `name`
- `title`
- `company`
- `company_domain` when inferable
- `award_name`
- `award_year`
- `bio`
- `source_url`
- `confidence`

### Step 4: Validate

- Require `name`
- Require at least one of `title` or `company`
- Normalize obvious formatting issues
- Reject malformed outputs

### Step 5: Score

- Keep strong records automatically
- Flag medium-confidence rows for review
- Drop clearly weak garbage rows

## 14. Enrichment Strategy

V1 enrichment will prioritize public and low-cost methods:

### Company domain

- Infer from company name using public web search and company website discovery

### Email

- Prefer publicly visible emails found on company pages, PDFs, filings, or press material
- If no public email exists, infer likely patterns only when company domain is strong
- Mark guessed addresses clearly as guessed, not verified

### LinkedIn

- Find probable public LinkedIn profile URLs via search

### Phone

- Use public corporate filings, press releases, company contact pages, and public legal profiles

### Confidence labels

- `HIGH`
- `MEDIUM`
- `LOW`
- `UNVERIFIED`

### Future extension

Optional paid enrichers such as Hunter or Apollo can be added later behind provider adapters without changing the rest of the pipeline.

## 15. Deduplication Rules

### Exact merge

- Same normalized name and same normalized company or domain

### Fuzzy merge

- Similar normalized name and same company/domain
- Merge only above threshold, otherwise send to review queue

### Contact-based merge

- Shared verified email means records should merge

### Merge behavior

- Preserve all source URLs
- Preserve all source sites
- Keep strongest field value for each contact field
- Maintain confidence and provenance

## 16. UI Plan

### Dashboard pages

- Home / add source
- Jobs / progress
- Results table
- Settings

### Core UI features

- URL submission with label
- Live job progress
- Count of pages scraped and records found
- Error and blocked-page visibility
- Filter by source, confidence, and company
- Export buttons for CSV, Excel, JSON

## 17. Failure Handling

The system must fail clearly, not silently.

### We will explicitly handle

- Timeout
- Cloudflare or anti-bot block
- Empty extraction
- Invalid LLM JSON
- Duplicate records
- Missing enrichment data
- Partial job completion

### User-visible outcomes

- `done`
- `done_with_warnings`
- `blocked`
- `failed`

## 18. Compliance and Safety Guardrails

- Respect site terms and practical rate limits
- Use conservative delays and concurrency
- Do not build CAPTCHA-solving workflows into v1
- Clearly log blocked sites for manual handling
- Keep provenance for every extracted record
- Never label guessed contact data as verified

## 19. Delivery Model

### Laptop-first delivery

The client should be able to run the tool locally on Windows with:

- `start.bat`
- local SQLite database
- browser UI on localhost
- output files written to a local folder

### Optional server deployment

Later we can support:

- Linux VPS
- PM2 or similar process manager
- reverse proxy
- PostgreSQL if scale grows

## 20. Implementation Roadmap

### Phase 1: foundation

- Set up repo structure
- Set up backend and frontend apps
- Create SQLite schema
- Add settings management
- Add basic logging

Deliverable: app skeleton runs locally and saves jobs.

### Phase 2: crawl pipeline

- Build Playwright wrapper
- Add raw page extraction
- Add pagination detection
- Add blocked-page detection
- Add scrape log entries

Deliverable: URLs can be crawled and raw page content can be captured reliably.

### Phase 3: classification and extraction

- Add page classifier
- Add text cleaner and chunker
- Add Gemini extraction prompts
- Add parser and validator
- Save extracted people records

Deliverable: app extracts structured people data from real legal pages.

### Phase 4: enrichment and deduplication

- Add domain finder
- Add public contact discovery
- Add email pattern inference
- Add LinkedIn and phone search helpers
- Add exact and fuzzy deduplication

Deliverable: results become lead-ready instead of just scraped text.

### Phase 5: dashboard and export

- Build add-source page
- Build jobs page
- Build results table and filters
- Build export endpoints and UI
- Build settings page

Deliverable: non-technical client can operate the system end to end.

### Phase 6: hardening

- Add retries and backoff
- Improve logging and error summaries
- Add test fixtures
- Test on representative legal sites
- Tune delays, chunking, thresholds, and confidence rules

Deliverable: stable client-ready release.

## 21. Recommended Build Order

We should implement in this order:

1. Backend skeleton and database
2. Simple job creation and storage
3. Playwright crawler
4. Raw extraction pipeline
5. LLM extraction and persistence
6. Enrichment modules
7. Deduplication
8. Exporters
9. Frontend dashboard
10. Hardening and packaging

## 22. Definition of Done for v1

V1 is done when:

- A user can submit a URL from the dashboard
- The system can crawl supported legal pages
- The system can extract structured people rows
- The system can enrich at least some public contact data
- The system can deduplicate repeated professionals
- The user can inspect results and export them
- Failures are visible and understandable
- The app runs on a Windows laptop without developer intervention

## 23. Immediate Next Steps

The first implementation sprint should produce:

1. Final repo structure
2. Backend Express server
3. SQLite schema and DB helpers
4. Job creation API
5. Basic Playwright crawler
6. One end-to-end scrape test against a simple source page

That gives us the first working spine of the product and lets us iterate with confidence.
