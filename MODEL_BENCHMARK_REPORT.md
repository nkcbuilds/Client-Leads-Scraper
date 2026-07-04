# LegalReach Model Benchmark Report

**Project:** LegalReach Lead Scraper  
**Date:** July 4, 2026  
**Report type:** Comprehensive performance & issue analysis  
**Benchmark URL:** `https://www.lw.com/en/people` (Latham & Watkins lawyer directory)

---

## Executive Summary

Two Google AI models were evaluated end-to-end through the LegalReach scraping pipeline: **Gemini 3.1 Flash Lite** and **Gemma 4 31B IT**. Both were tested with fallbacks disabled (`GEMINI_FALLBACK_MODELS=`) so results reflect each model in isolation.

**Winner: Gemini 3.1 Flash Lite**

| Metric | Gemini 3.1 Flash Lite | Gemma 4 31B IT |
|--------|----------------------|----------------|
| Pipeline time | **69.1s** | 220.9s |
| Valid records | **20** | 12 |
| Garbage records | **0** | 0 |
| Record recall vs. Gemini | 100% | 60% (12/20) |
| API errors during run | **None** | JSON parse failures + 4× HTTP 500 |
| Composite benchmark score | **249.3** | 151.8 |
| Production recommendation | **Yes — default model** | No — not reliable at scale |

Gemini 3.1 Flash Lite is faster, extracts more lawyers from the same page, produces zero garbage, and had no API failures during the benchmark. Gemma 4 31B produces valid records when it succeeds but loses ~40% of extractable leads due to chunk failures and server errors on large pages.

**Production configuration:** `GEMINI_MODEL=gemini-3.1-flash-lite` (500 requests/day free-tier limit).

---

## 1. Test Methodology

### 1.1 What Was Tested

Each model was evaluated at two levels:

1. **Smoke test** — Isolated API + extraction on a 3-person synthetic legal text sample (~200 characters).
2. **Full pipeline benchmark** — Complete LegalReach flow: Playwright crawl → page classification → scroll re-scrape → LLM extraction → validation → enrichment → deduplication → SQLite persistence.

### 1.2 Benchmark Configuration

| Setting | Value |
|---------|-------|
| Test URL | `https://www.lw.com/en/people` |
| Fallback models | Disabled (`GEMINI_FALLBACK_MODELS=`) |
| Crawl delay | 2000ms |
| Crawl concurrency | 2 |
| Page timeout | 30000ms |
| Gemini throttle | 3000ms minimum between API calls |
| Chunk size | 6000 chars (500 char overlap) |
| Response format | `application/json` (structured output) |
| Benchmark script | `backend/src/scripts/benchmark-models.js` |
| Database jobs | #13 (Gemini), #14 (Gemma) |

### 1.3 Scoring Formula

The automated winner selection uses a weighted composite score:

```
score = (valid_records × 10)
      - (garbage_records × 20)
      + (records_with_email × 2)
      + (avg_confidence × 5)
      + status_bonus (done=10, done_with_warnings=5)
      - (zero_records_penalty=50 if recordsFound=0)
      - (elapsed_seconds × 0.01)
```

This prioritizes **record count and quality** over raw speed, while still penalizing slow runs.

### 1.4 Page Context

The Latham & Watkins people directory is a JavaScript-rendered `profile_directory` page. The pipeline:

1. Classifies the page via heuristics (confidence 0.9).
2. Re-scrapes with scroll to load lazy-rendered lawyer cards.
3. Extracts people from the listing page text (no individual profile visits when ≥5 records found).
4. Enriches with inferred emails, domains, and confidence scores.
5. Deduplicates exact/fuzzy name matches.

Both benchmark runs used **identical crawl behavior** — differences in output are attributable to LLM extraction quality and reliability.

---

## 2. Models Under Test

### 2.1 Gemini 3.1 Flash Lite

| Property | Value |
|----------|-------|
| API model ID | `gemini-3.1-flash-lite` |
| Type | Gemini family (multimodal, instruction-tuned) |
| Expected daily limit | 500 requests/day (free tier) |
| JSON mode support | Full — honors `responseMimeType: application/json` |
| Typical latency (smoke test) | ~1.2s API ping, ~1.3s extraction |

### 2.2 Gemma 4 31B IT

| Property | Value |
|----------|-------|
| API model ID | `gemma-4-31b-it` |
| Type | Open Gemma family (31B parameters, instruction-tuned) |
| Expected daily limit | Not documented for this key |
| JSON mode support | Partial — often returns markdown/planning text instead of JSON |
| Typical latency (smoke test) | ~4–9s API ping, ~33s extraction |

---

## 3. Smoke Test Results

Synthetic input (3 lawyers in ~200 chars):

```
Jane Doe, Partner at Acme Law Firm, was named Leading Lawyer in 2024.
John Smith, General Counsel at Global Legal LLC, received the Excellence Award in 2023.
Megan M. Alessi, Partner at Latham & Watkins LLP, specializes in M&A.
```

### 3.1 Gemini 3.1 Flash Lite — PASS

| Step | Result | Time |
|------|--------|------|
| API reachability | `{"ok":true}` JSON returned | 1,187ms |
| People extraction | 3/3 correct (names, titles, companies, awards) | 1,268ms |
| JSON validity | Valid on first attempt | — |
| Confidence scores | 1.0 for all records | — |

**Sample output:** Jane Doe (Partner, Acme Law Firm), John Smith (General Counsel, Global Legal LLC), Megan M. Alessi (Partner, Latham & Watkins LLP).

### 3.2 Gemma 4 31B IT — PASS (after JSON retry fix)

| Attempt | Result | Time |
|---------|--------|------|
| First run (pre-fix) | **FAIL** — returned markdown planning text (`* Goal: Extract legal professionals...`) | API: 8,940ms |
| Second run (post-fix) | **PASS** — 3/3 correct after JSON retry logic | API: 4,367ms, extraction: 32,849ms |

**Issue observed:** Gemma ignored structured JSON mode on the first attempt and returned bullet-point planning prose. A JSON retry mechanism (up to 3 attempts with stricter prompt suffix) was added to `backend/src/llm/gemini.js` to handle this.

**Speed comparison (smoke test):** Gemma is **~25× slower** than Gemini 3.1 Flash Lite for the same 3-person extraction.

---

## 4. Full Pipeline Benchmark Results

### 4.1 Gemini 3.1 Flash Lite — Job #13

| Metric | Value |
|--------|-------|
| Status | `done_with_warnings` |
| Elapsed time | **69.1 seconds** |
| Pages scraped | 1 |
| Raw extracted | 21 |
| After dedup | **20 records** |
| Valid / garbage | 20 / 0 |
| With title | 20/20 (100%) |
| With company | 20/20 (100%) |
| With email (enriched) | 20/20 (100%) |
| Avg LLM confidence | 100% |
| Classification | `profile_directory` (heuristic, 0.9) |
| Profile pages visited | 0 (seed page yielded ≥5 records) |
| API errors | **None** |
| Warnings | 1 duplicate merged |

**Sample extracted names:**
- Manuel (Manny) A. Abascal
- Douglas Abernethy
- Stephanie Adams
- Erica E. Aho
- Nathan Ajiashvili

**Pipeline timeline:**
- 23:50:54 — Navigation started
- 23:51:09 — Classified as profile_directory, scroll re-scrape triggered
- 23:52:00 — 21 people extracted via Gemini (~51s for crawl + extraction)
- 23:52:00 — Job completed

### 4.2 Gemma 4 31B IT — Job #14

| Metric | Value |
|--------|-------|
| Status | `done_with_warnings` |
| Elapsed time | **220.9 seconds** (3.2× slower) |
| Pages scraped | 1 |
| Raw extracted | 12 |
| After dedup | **12 records** |
| Valid / garbage | 12 / 0 |
| With title | 12/12 (100%) |
| With company | 12/12 (100%) |
| With email (enriched) | 12/12 (100%) |
| Avg LLM confidence | 100% |
| Classification | `profile_directory` (heuristic, 0.9) |
| Profile pages visited | 0 |
| API errors | **Multiple** (see Issue Taxonomy) |
| Warnings | JSON parse failures, 4× HTTP 500 |

**Sample extracted names:**
- Megan Alessi
- Owen J.D. Alexander
- Shane P. Alexander
- Mary Rose Alexander
- Joe Alexander

**Pipeline timeline:**
- 23:52:02 — Navigation started
- 23:52:10 — Classified, scroll re-scrape triggered
- 23:53:39 — JSON parse failure, retry attempt 1
- 23:53:51 — JSON parse failure, retry attempt 2
- 23:53:59 — Chunk extraction failed (invalid JSON after 3 attempts)
- 23:54:12–23:54:41 — Four HTTP 500 Internal Server Errors on subsequent chunks
- 23:55:41 — 12 people extracted (partial success from surviving chunks)
- 23:55:41 — Job completed

---

## 5. Head-to-Head Record Comparison

### 5.1 Overlap Analysis

| Category | Count |
|----------|-------|
| Gemini records (Job #13) | 20 |
| Gemma records (Job #14) | 12 |
| **Shared by both models** | **11** |
| Only in Gemini (missed by Gemma) | **9** |
| Only in Gemma (missed by Gemini) | **1** |

### 5.2 Lawyers Found by Gemini but Missed by Gemma

1. Manuel (Manny) A. Abascal
2. Douglas Abernethy
3. Stephanie Adams
4. Erica E. Aho
5. Nathan Ajiashvili
6. Hamad M. Al-Hoshan
7. Basil Al-Jafari
8. Salman Al-Sudairi
9. Megan M. Alessi *(Gemma found "Megan Alessi" — same person, different name formatting)*

**Effective unique miss count:** 8 lawyers (excluding the Megan Alessi formatting difference).

### 5.3 Name Formatting Difference

| Gemini | Gemma |
|--------|-------|
| Megan M. Alessi | Megan Alessi |

Both are valid extractions of the same person. Gemma dropped the middle initial.

### 5.4 Quality of Shared Records

All 11 overlapping records had:
- Valid lawyer names (passed `isGarbageName()` filter)
- Title and company populated
- 100% LLM confidence
- Successfully enriched with inferred email addresses

**Conclusion:** When Gemma succeeds, output quality matches Gemini. The problem is **reliability and recall**, not per-record accuracy.

---

## 6. Issue Taxonomy

All issues encountered during testing, categorized by type, severity, and which model(s) were affected.

### 6.1 Category A: API Quota / Rate Limiting (HTTP 429)

| ID | Description | Model(s) | Severity | When |
|----|-------------|----------|----------|------|
| A-1 | `gemini-2.5-flash` per-minute quota exhausted | Legacy models | High | Pre-benchmark runs (Jobs #4–#8) |
| A-2 | `gemini-2.0-flash-lite` daily quota limit = 0 | Legacy models | Critical | Job #8 — 21 pages crawled, **0 records** |
| A-3 | Cascade of 429s across fallback chain | Legacy models | High | Jobs #5, #7, #8, #12 |
| A-4 | Rate limit triggered regex fallback → garbage UI text | Legacy models | Critical | Job #12 — "ClearExpand" extracted as a name |

**Benchmark impact:** Neither Gemini 3.1 Flash Lite nor Gemma 4 31B hit 429 errors during the formal benchmark (Jobs #13–#14). The 500/day limit on Flash Lite was sufficient for single-page directory extraction (~2–4 API calls per job).

**Mitigations in place:**
- `throttleGemini()` — 3s minimum interval between calls
- Exponential backoff on 429/503 (up to 3 retries)
- `GEMINI_FALLBACK_MODELS` configurable per environment
- Profile-page skip when seed yields ≥5 records (reduces API calls by ~25×)

---

### 6.2 Category B: JSON Parsing / Structured Output Failures

| ID | Description | Model(s) | Severity | When |
|----|-------------|----------|----------|------|
| B-1 | Model returns markdown planning text instead of JSON | **Gemma 4 31B** | High | Smoke test (pre-fix) |
| B-2 | JSON wrapped in code fences with trailing prose | **Gemma 4 31B** | High | Full benchmark Job #14 |
| B-3 | `Unexpected non-whitespace character after JSON at position 14` | **Gemma 4 31B** | High | Job #14, chunk 1 — all 3 retries failed |
| B-4 | Partial JSON with template placeholders (`...]}`) | **Gemma 4 31B** | Medium | Job #14 retry attempts 1–2 |

**Root cause:** Gemma 4 31B does not reliably honor `responseMimeType: application/json`. On large page chunks (~6000 chars), it tends to return explanatory markdown, truncated JSON, or JSON followed by commentary.

**Benchmark impact:** At least **1 full text chunk lost** for Gemma, directly causing 8–9 missing lawyer records.

**Mitigations applied:**
- `generateJsonWithFallback()` — up to 3 attempts with stricter "JSON only" suffix
- `parseJsonResponse()` — strips code fences, attempts regex extraction of `{...}` block
- Chunk-level error isolation — failed chunks are skipped, pipeline continues

**Mitigations still needed for Gemma:**
- Smaller chunk sizes (e.g., 3000 chars)
- Model-specific prompt tuning
- Post-processing to strip trailing non-JSON content more aggressively

---

### 6.3 Category C: Server-Side API Errors (HTTP 500)

| ID | Description | Model(s) | Severity | When |
|----|-------------|----------|----------|------|
| C-1 | `500 Internal Server Error` on `generateContent` | **Gemma 4 31B** | High | Job #14 — 4 consecutive failures |
| C-2 | `503 Service Unavailable` on legacy Gemini models | `gemini-2.5-flash` | Medium | Pre-benchmark Jobs #3–#4 |

**Root cause (Gemma):** Likely combination of large input tokens + model load on Google's infrastructure. The 31B model is heavier and may time out or fail internally on sustained extraction workloads.

**Benchmark impact:** 4 additional chunk failures for Gemma after JSON errors, compounding the recall gap.

**Mitigations in place:**
- Retry with exponential backoff (3 attempts per model)
- Per-chunk isolation (one failure doesn't crash the job)

---

### 6.4 Category D: Extraction Recall / Coverage Gaps

| ID | Description | Model(s) | Severity | When |
|----|-------------|----------|----------|------|
| D-1 | 40% fewer records from identical page | **Gemma 4 31B** | High | Benchmark — 12 vs 20 |
| D-2 | Chunk failures cause silent data loss | **Gemma 4 31B** | High | Job #14 — no fallback on directory pages |
| D-3 | Middle initials dropped in names | **Gemma 4 31B** | Low | "Megan Alessi" vs "Megan M. Alessi" |

**Root cause:** Gemma's chunk failures (Categories B + C) mean entire sections of the lawyer directory text are never parsed. The pipeline does not re-attempt failed chunks with a different model when fallbacks are disabled.

**Note:** On `profile_directory` pages, regex fallback is **intentionally disabled** to prevent garbage UI text extraction (see Category E).

---

### 6.5 Category E: Garbage / UI Noise in Extracted Records

| ID | Description | Model(s) | Severity | When |
|----|-------------|----------|----------|------|
| E-1 | "ClearExpand" extracted as person name | Regex fallback | Critical | Job #12 (rate-limited run) |
| E-2 | UI filter/facet text as names | Regex fallback | High | Historical runs before validator hardening |
| E-3 | Garbage filter catches UI noise post-extraction | Pipeline (validator) | Mitigated | `isGarbageName()` in `validator.js` |

**Benchmark impact:** **Zero garbage records** in both Job #13 and Job #14. The validator and disabled fallback on directory pages worked correctly.

**Patterns blocked by `isGarbageName()`:**
- `facet`, `search`, `loading`, `expand`, `clearexpand`, `dropdown`, `filter`
- All-caps strings >6 chars
- Single-token names >20 chars
- Parenthetical counts like `University(12)`

---

### 6.6 Category F: Crawl / Infrastructure Issues

| ID | Description | Model(s) | Severity | When |
|----|-------------|----------|----------|------|
| F-1 | Site blocked by anti-bot (Cloudflare) | N/A (crawl) | High | chambers.com — blocked in audit |
| F-2 | JS directory requires scroll to load profiles | N/A (crawl) | Medium | lw.com — fixed via scroll re-scrape |
| F-3 | Wasteful profile-page crawling (25 pages) | N/A (crawl) | Medium | Pre-optimization runs — fixed with seed skip |
| F-4 | Misclassification when Gemini unavailable | Heuristic fallback | Medium | Job #4 — classified as `article`, 0 records |

**Benchmark impact:** None for lw.com — both runs classified correctly, scrolled successfully, 1 page each.

---

### 6.7 Category G: Performance / Latency

| ID | Description | Model(s) | Severity | When |
|----|-------------|----------|----------|------|
| G-1 | Gemma 25× slower on smoke test extraction | **Gemma 4 31B** | High | 32.8s vs 1.3s |
| G-2 | Gemma 3.2× slower on full pipeline | **Gemma 4 31B** | Medium | 220.9s vs 69.1s |
| G-3 | Gemma API ping 4–9× slower | **Gemma 4 31B** | Low | 4–9s vs 1.2s |

**Impact:** At scale (hundreds of URLs/day), Gemma's latency would bottleneck the job queue and consume wall-clock time disproportionate to its recall.

---

## 7. Historical Context (Pre-Benchmark Runs)

Before the formal model comparison, the system was tested with older Gemini models. These runs inform the issue landscape but are not part of the head-to-head score.

| Job | Model (effective) | URL | Pages | Records | Key Issue |
|-----|-------------------|-----|-------|---------|-----------|
| #3 | gemini-2.5-flash | lw.com/people | 2 | 8 | 503 errors, partial extraction |
| #4 | gemini-2.5-flash → fallback | lw.com/people | 1 | 0 | Misclassified as `article` after API failures |
| #5 | gemini-2.5-flash | lw.com/people | 2 | 8 | 429 rate limits, eventual success |
| #6 | gemini-2.5-flash | lw.com/people | 1 | 0 | No scroll re-scrape — 0 records |
| #7 | gemini-2.5-flash | lw.com/people | 1 | **21** | Best pre-benchmark run (with scroll) |
| #8 | gemini-2.0-flash-lite (fallback) | lw.com/people | 21 | **0** | Full quota exhaustion — crawled 21 profiles for nothing |
| #12 | gemini-2.5-flash → regex fallback | lw.com/people | 1 | 4 | Rate limited; "ClearExpand" garbage name |

**Lesson learned:** Model selection and quota management are as important as crawl logic. Job #8 demonstrates the cost of falling back to a model with zero daily quota.

---

## 8. What Is Working Properly

The following pipeline components performed correctly during the benchmark and broader validation:

### 8.1 Crawler (Playwright)

- Successfully loads JavaScript-rendered Latham & Watkins directory
- Scroll re-scrape discovers lazy-loaded lawyer cards
- Blocked-page detection works (Chambers.com correctly flagged)
- Retry/backoff on navigation timeouts

### 8.2 Page Classification

- Heuristic classifier correctly identifies `profile_directory` at 0.9 confidence
- No Gemini call needed for classification on lw.com (saves quota)
- Fallback classification only triggers when Gemini is unavailable

### 8.3 Extraction (Gemini 3.1 Flash Lite)

- Single-pass extraction of 21 lawyers from scrolled directory text
- Valid JSON on first attempt for all chunks
- No garbage names in output
- Handles complex names: parentheses, middle initials, accented characters (José María Alonso)

### 8.4 Validation & Quality Filters

- `isGarbageName()` — 0 false positives in benchmark, catches UI noise in Job #12
- `filterValidPeople()` — requires name + (title or company)
- Confidence threshold (≥0.35) — all benchmark records at 1.0

### 8.5 Enrichment

- 100% email inference rate (20/20 Gemini, 12/12 Gemma)
- Company domain inferred from source site
- Overall confidence scoring applied

### 8.6 Deduplication

- 1 duplicate merged in Gemini run (21 raw → 20 final)
- Fuzzy name matching prevents duplicate contacts

### 8.7 Quota Optimization

- Seed-page skip: when listing yields ≥5 records, individual profile visits are skipped
- Reduced Job #13 from potential 25+ API calls to ~2–4
- Rate limiter prevents burst 429s

### 8.8 Export & API Layer

- CSV, Excel, JSON exports functional
- Dashboard job/results pages operational
- 22/22 unit tests passing

---

## 9. Recommendations

### 9.1 Production Model

**Use `gemini-3.1-flash-lite` as the default model.**

Rationale:
- Highest recall (20/20 lawyers on benchmark page)
- Fastest end-to-end (69s)
- Zero API errors during benchmark
- Fits within 500 requests/day free tier for typical daily workloads
- Reliable structured JSON output

### 9.2 Do Not Use Gemma 4 31B for Production Scraping

Rationale:
- 40% recall loss on identical input
- JSON reliability failures on large chunks
- HTTP 500 errors under load
- 3× slower with no quality advantage on successful records

Gemma may be suitable for **offline, single-document analysis** with small inputs and retry tolerance, but not for automated multi-chunk directory scraping.

### 9.3 Quota Management

| Scenario | Estimated API calls | Daily capacity (500 limit) |
|----------|--------------------|-----------------------------|
| Single directory page (seed skip) | 2–4 | ~125–250 URLs/day |
| Directory + 25 profile pages | 27–30 | ~16–18 URLs/day |
| Classification + extraction per page | 2 | ~250 pages/day |

**Recommendation:** Keep seed-page skip enabled. Monitor usage at [ai.dev/rate-limit](https://ai.dev/rate-limit).

### 9.4 Future Improvements

1. **Chunk failure recovery** — Re-attempt failed chunks with a fallback model (only when primary fails, not as default chain).
2. **Gemma-specific chunk size** — Reduce to 3000 chars if Gemma is ever needed.
3. **Extraction coverage metric** — Log `chunks_attempted / chunks_succeeded / chunks_failed` per job for observability.
4. **Multi-URL benchmark** — Test award list pages, smaller firm directories, and blocked sites to stress-test classification + extraction diversity.

---

## 10. Appendix

### A. Benchmark Job References

| Job ID | Label | Model | Records | Time | Status |
|--------|-------|-------|---------|------|--------|
| 13 | Benchmark: Gemini 3.1 Flash Lite | `gemini-3.1-flash-lite` | 20 | 69.1s | done_with_warnings |
| 14 | Benchmark: Gemma 4 31B IT | `gemma-4-31b-it` | 12 | 220.9s | done_with_warnings |

View in dashboard: `http://localhost:3000/jobs/13` and `/jobs/14`

### B. Commands to Reproduce

```bash
# Smoke test (single model)
cd backend
node src/scripts/test-model.js gemini-3.1-flash-lite
node src/scripts/test-model.js gemma-4-31b-it

# Full benchmark (both models, sequential)
npm run benchmark

# Full benchmark (custom URL)
npm run benchmark -- https://www.lw.com/en/people

# Unit tests
npm test
```

### C. Environment Configuration

```env
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_FALLBACK_MODELS=
GEMINI_MIN_INTERVAL_MS=3000
CRAWL_DELAY_MS=2000
CRAWL_CONCURRENCY=2
CRAWL_TIMEOUT_MS=30000
```

### D. Code Changes Made During Benchmark

| File | Change |
|------|--------|
| `backend/src/llm/gemini.js` | Default model → `gemini-3.1-flash-lite`; added `generateJsonWithFallback()` with 3-attempt JSON retry; improved `parseJsonResponse()` with fence stripping and regex fallback |
| `backend/src/scripts/benchmark-models.js` | New — sequential full-pipeline benchmark with scoring |
| `backend/src/scripts/test-model.js` | New — per-model smoke test |
| `.env` | `GEMINI_MODEL=gemini-3.1-flash-lite`, `GEMINI_FALLBACK_MODELS=` |

### E. Issue Severity Legend

| Severity | Definition |
|----------|------------|
| **Critical** | Job produces zero usable records or garbage data |
| **High** | Significant data loss (>20%) or repeated API failures |
| **Medium** | Partial degradation, recoverable with retries or fallbacks |
| **Low** | Cosmetic or minor formatting differences |
| **Mitigated** | Issue existed historically but is now handled by pipeline safeguards |

---

*Report generated from benchmark runs on July 3–4, 2026. Data sources: Job #13 and #14 database records, `backend/logs/app-2026-07-03.log`, terminal output from `npm run benchmark`, and smoke test scripts.*