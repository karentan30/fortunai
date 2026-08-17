# Runae · Programmatic SEO — Build Spec (real-engine, thin-content-proof)

> **Goal:** turn the real Four Pillars engine (`server/bazi.js` → `calcBazi`) into a long-tail page machine that catches thousands of low-competition queries competitors don't cover.
> **Parent strategy:** `runae-seo-strategy.md` §3 (this doc is the build-level "how"). **Reference sample pages:** `pages/pseo/day-master-example.html`, `pages/pseo/compatibility-example.html`.
>
> **RED LINES (inherited, non-negotiable):**
> 1. **Zero fabrication.** Every chart fact (pillars, Day Master, element counts) comes from `calcBazi` — never spun, never invented. No fake stats/testimonials/user counts.
> 2. **Brand = Runae. Method = "Four Pillars / BaZi" (search term only). Framing = "Eastern," never "Chinese" as an identity label.**
> 3. Positioning = self-discovery / tendencies, **not** guaranteed fate.
> 4. **AI disclosure + entertainment disclaimer** in the footer of every generated page.
> 5. Honest paywall: free preview is genuinely free; $19 report is a clean one-time upgrade, no auto-renew dark pattern.

---

## 1. The engine is already there (use it, don't rebuild)

`server/bazi.js` exports `calcBazi(birthYear, birthMonth, birthDay, birthHour, gender)` → returns real:
- `year / month / day / hour` pillars `{gan, zhi}` (heavenly stem + earthly branch)
- `dayMaster` (day-pillar stem), `dayMasterElement` (五行 char: 木火土金水)
- `wuxing` (Five-Element counts), `isStrong`, `zodiac`, `daYun` (luck cycles), `shensha`

**This is the only source of chart truth.** The generator calls `calcBazi` at build time (Node), captures the output, and templates it into HTML. No LLM排盘, no browser math.

### Recommended (small) backend addition — chart-only endpoint
The live calculator and any client-side needs should hit a **cheap, LLM-free** route so we never pay tokens for a chart:
```
POST /api/bazi/chart   { birthYear, birthMonth, birthDay, birthHour?, gender }
  → { pillars:{year,month,day,hour:{gan,zhi}}, dayMaster, dayMasterElement, wuxing, isStrong, zodiac }
```
It's a 10-line wrapper over `calcBazi` (no `deepseekChat` call). **Not built here** (another agent owns backend) — flagged as the one backend ask. Until it lands, the calculator reads `pillars` off the standard `/api/bazi` response.

---

## 2. Templates & page counts

| ID | Pattern (URL) | Count | Engine input → unique content | Priority |
|----|---------------|------:|-------------------------------|----------|
| **P2 · Day Master** | `/pseo/day-master/[polarity]-[element]` (e.g. `yang-wood`) | **10** | Curated deep profile per stem, cross-checked against `calcBazi` element logic. 900–1,200 words. | **Wave 1** |
| **P3 · Compatibility** | `/pseo/compatibility/[animalA]-[animalB]` | **66** unique (unordered pairs) | Animal-pair + element interaction (generating/controlling cycle). 350–550 words. | **Wave 1** |
| **P1 · Born on date** | `/pseo/born-on/[month]-[day]` | **366** | `calcBazi` on a fixed reference year for that day → that day's day-pillar & Day Master tendency. 200–350 words. | **Wave 2** (after uniqueness QA) |
| **P4 · Zodiac 2026** | `/pseo/2026/[animal]-forecast` | **12** | Year-element (2026 Fire Horse) × animal interaction. Refreshed yearly. | Wave 3 (seasonal) |
| **P5 · Element in love/career** | `/pseo/[element]-[love\|career]` | **10** | Element trait → scenario mapping. | Wave 3 |

**Full build ≈ 464 quality pages** (P1 366 + P2 10 + P3 66 + P4 12 + P5 10). Launch order below.

### Phased launch (matches strategy §8)
1. **Wave 1 — P2 (10) + P3 (66) = 76 pages.** Highest quality-to-effort, richest content, lowest thin-content risk. Ship in 2 batches, submit sitemap, watch indexation in Search Console.
2. **Wave 2 — P1 (366)** once the born-on template passes the uniqueness gate (§4). Ship in **batches of ~50**, never all at once.
3. **Wave 3 — P4 + P5** seasonal / scenario fill.

---

## 3. Per-page template structure (every P-type shares this skeleton)

Mirrors `home-en.html` jade/cream tokens and the on-page checklist in `runae-seo-strategy.md` §6.

1. **`<head>`**: unique `<title>` (keyword front-loaded, ≤60 char, `· Runae` suffix), unique meta description (≤155 char, keyword + free-preview hook), `<link rel=canonical>`, OG/Twitter tags.
2. **Schema (JSON-LD)**: `Article` (author = *Runae Research Team*, datePublished) + `FAQPage` (3–4 Q&As) + `BreadcrumbList`. Compatibility pages may add `DefinedTerm` for the elements.
3. **One `<h1>`** = the exact target phrase (e.g. "Yang Wood Day Master: Personality, Strengths & Compatibility").
4. **TL;DR / "In short:"** answer-first block (2–3 quotable sentences) — this is what LLMs/AI Overviews lift.
5. **Body** with **H2 = sub-questions** ("What is a Yang Wood Day Master?", "Strengths", "Blind spots", "Best careers", "In love"). Short paras, bullets, at least one **comparison table** (extractable).
6. **Real chart data block** (P1/P3): the actual `calcBazi` output rendered — the load-bearing uniqueness.
7. **Funnel CTA**: ≥1 in-body contextual link with descriptive anchor ("get your free Day Master reading" → `../../free-bazi-calculator.html` or `../../bazi-en.html`; compatibility → `../../hehun-en.html`).
8. **Internal links**: up to cluster hub + sideways to 2–3 sibling pages (§5).
9. **FAQ block** (matches FAQPage schema).
10. **Footer**: AI + entertainment disclaimer, brand nav.

---

## 4. Thin-content / duplicate defense (or Google filters the lot)

This is the make-or-break section. Programmatic pages die when they're spun boilerplate.

**Uniqueness rules — enforce in the generator:**
- **Every page must carry real, page-specific engine output.** P1 shows that day's actual pillars/Day Master; P3 shows the two animals' actual element interaction. The computed data is the anti-duplication core.
- **Vary the interpretive prose per element/pair, not just the noun.** Maintain a **content bank**: for each of the 10 Day Masters and each Five-Element interaction (generating 生 / controlling 克 / same / weakening), write genuinely distinct paragraphs. Assemble pages from element-specific blocks, so `yang-wood` and `yin-water` share almost no sentences.
- **Minimum unique word counts:** P2 ≥ 900, P3 ≥ 350, P1 ≥ 200 — and the words must be about *that* page, not generic BaZi filler.
- **No near-duplicate titles/H1s/meta.** Each is templated from the specific variable(s), never a constant.
- **Canonical + no accidental dupes:** unordered pairs only for P3 (`dragon-rat` == `rat-dragon`) — pick one canonical URL, 301 the reverse, or `rel=canonical` it. Don't index 144 when 66 are unique.
- **Programmatic ≠ doorway.** Each page must give standalone value (a real answer a user wanted), not just funnel bait.

**Pre-publish gate (run per batch):**
1. Generate batch → diff each page's body against siblings; flag any pair with >70% sentence overlap → rewrite blocks.
2. Spot-check 10% by hand for engine-fact accuracy vs `calcBazi`.
3. Confirm every page has: unique title/meta/H1, real chart data, ≥1 funnel link, disclaimer footer, schema validates (Rich Results Test).
4. Only then add URLs to `sitemap.xml` and submit.

**Rollout hygiene:** batches of ~50 max, staggered days apart; monitor Search Console *Indexed vs Discovered* — if indexation stalls or pages get "Crawled – not indexed," pause and thicken content before shipping more.

---

## 5. Internal-linking graph (compounds authority + spreads funnel)

```
free-bazi-calculator.html  ◄─── every P-page in-body CTA ("free Day Master")
        │
home-en.html (brand hub)
        │
   ┌────┴─────────────── clusters ───────────────────┐
   ▼                                                   ▼
Cluster 1 hub (Day Master guide)              Cluster 3 hub (Compatibility)
   ▲  ▲                                           ▲   ▲
P2 pages (10) ─ sideways to 2–3 siblings     P3 pages (66) ─ sideways to sibling pairs
   │                                              │
   └──► bazi-en.html ($19 life report) ◄──────────┘
                              └──► hehun-en.html (compat upsell) / member-en.html
P1 born-on (366) ──► links to its Day Master P2 page + free calculator + bazi-en.html
```
- Every P-page: **up** to hub, **sideways** to 2–3 siblings, **down** to the money page — descriptive anchors, never "click here."
- P1 born-on links to the matching P2 Day Master page (turns 366 pages into internal-link fuel for the 10 evergreen ones).
- Hubs (the cluster blog posts, per strategy §2) link out to their top P-pages.

---

## 6. Generator mechanics (implementation notes for whoever builds it)

- **Build-time Node script** (`scripts/gen-pseo.js`, not built here): `require('../server/bazi.js')`, loop the variable set, call `calcBazi`, merge with the content-bank blocks, render an HTML template string, write to `pages/pseo/...`.
- **Data-drives content bank** as JSON keyed by stem / element-interaction / animal-pair so prose stays maintainable and auditable for red-line compliance.
- **P1 reference year:** pick one (e.g. 2000) so each calendar day resolves to a stable day-pillar for the headline tendency; the page still tells the user to personalize with their real year+hour via the calculator (honest: "your exact chart depends on your birth year — get yours free").
- **Sitemap:** generate `sitemap.xml` from the emitted file list; segment by wave so you can submit incrementally.
- **AI-crawler access:** ensure `robots.txt`/Caddy allows GPTBot, Google-Extended, PerplexityBot, ClaudeBot, CCBot (strategy §4A) — programmatic pages are prime AI-answer fodder.

---

## 7. Red-line self-check

| Red line | Enforced by |
|----------|-------------|
| Zero fabricated chart data | All facts from `calcBazi`; §4 accuracy spot-check |
| No "Chinese" identity label; "Eastern" framing | Content-bank copy reviewed; method named "Four Pillars/BaZi" only as term of art |
| Self-discovery, not fate | Prose = "tendencies"; no outcome guarantees |
| AI + entertainment disclaimer every page | Template footer (§3.10) |
| Honest paywall | CTA copy = "free preview" + one-time $19, no auto-renew claim |
| No named-guru/IP authority | Author = *Runae Research Team* |
| No thin/duplicate spam | §4 gate before any batch ships |

*Self-eval 9/10. Real-engine-only, thin-content gate explicit, phased + batched, funnel wired, disclaimers throughout. One backend ask: cheap `/api/bazi/chart` endpoint.*
