# Runae · Numerology (Life Path Number)

> One line: **Give us your birthday and name, and Runae computes your core numerology numbers with exact Pythagorean math — then AI reads them.** The headline hook is a big, screenshottable **Life Path Number** ("What's your Life Path Number?"), the term Westerners already search millions of times a month.

Status: **v1 build** · Owner: product · Three files only:
- Front-end mockup: `pages/numerology.html`
- Reading route: `server/routes/numerology.js` (**built but NOT mounted** — Karen mounts centrally)
- This PRD: `docs/product/runae-numerology.md`

---

## 1. Why this is the out-of-China hook

- **Zero education cost.** Western audiences already know "Life Path Number." Unlike BaZi (needs a paragraph of explanation), numerology is instantly legible → best top-of-funnel entry for the English market.
- **Huge search demand.** `life path number`, `numerology calculator`, `life path number calculator` are high-volume evergreen queries (tens/hundreds of thousands/mo). We target them directly (see §6).
- **Screenshottable.** One giant number + archetype name ("7 · The Seeker") is built to be shared. Native share button + "What's yours?" copy drives an organic loop.
- **Cheap to serve, honest.** Numbers are deterministic JS; only the interpretation is an LLM call. No costly排盘 engine.

---

## 2. Core principle: rules compute the numbers, AI only interprets

Same discipline as "脚本算·AI 解释". **The LLM must never calculate or change a number.** JS computes all numbers via standard Pythagorean rules; the numbers are passed to the LLM as fixed facts, and the system prompt forbids recomputation. This kills the #1 failure mode (LLMs are bad at digit arithmetic and would give wrong numbers).

### Algorithms (all in `numerology.js`, verified against known values)

| Number | Rule | Source |
|---|---|---|
| **Life Path** | Reduce birth **year**, **month**, **day** each to one digit, sum, reduce again | date of birth |
| **Birthday** | Reduce the day-of-month | date of birth |
| **Expression / Destiny** | Sum **all** letters of full name (Pythagorean A=1…I=9, J=1…R=9, S=1…Z=8), reduce | full birth name |
| **Soul Urge / Heart's Desire** | Sum **vowels** only, reduce | full birth name |
| **Personality** | Sum **consonants** only, reduce | full birth name |
| **Personal Year** | Reduce (birth month + birth day + current year), reduce to 1–9 | DOB + today |

- **Pythagorean** letter map (standard, not Chaldean).
- **Master numbers 11, 22, 33** are preserved (not reduced) for Life Path / Expression / Soul Urge / Personality; **Personal Year** reduces to 1–9 per tradition.
- Compound form shown where relevant (e.g. `29/11`, `44/8`).

**Verification (already run):** 1990-12-25 → Life Path **11** (master); 2000-01-01 → **4**; "John Smith" → Expression **44/8**, Soul Urge **15/6**, Personality **29/11** — all match the standard method. Test hook exposed at `router.__calc`.

---

## 3. Input → Output

### Input (front-end `numerology.html`)
| Field | Required | Notes |
|---|---|---|
| First name | optional | Free reading works name-less (Life Path is DOB-only). Full name unlocks Expression/Soul Urge/Personality. |
| Date of birth | ✅ | native `<input type=date>` → `YYYY-MM-DD`; no birth time needed |

### API
`POST /api/numerology` — body `{ name?, birthdate:"YYYY-MM-DD" (or year/month/day), token? }`
- Returns `{ reading, profile:{ lifePath, lifePathCompound, birthday, personalYear, personalYearOf, expression, soulUrge, personality, hasName }, full, remaining, isMember }`
- **Free/guest:** all numbers computed & returned (so the UI can show locked chips as a teaser), but the **reading text covers Life Path only** + one-line Personal Year tease.
- **Member:** full reading (Life Path + Expression + Soul Urge + Personality + deep Personal Year).
- `{ upgrade:true, message }` when the daily free read is used up.

`GET /api/numerology/quota` — `{ isMember, tier, remaining, limit }`

### Output (result screen)
- Big gradient **Life Path Number** card + archetype name ("7 · The Seeker").
- Number **chips**: Birthday, Personal Year, and (if name given) Expression / Soul Urge / Personality — locked (🔒) for free users.
- AI **reading** in warm plain paragraphs.
- Unlock box → membership (hidden for members).
- **Share** button (native share / clipboard) + "Try another".

---

## 4. Free vs paid

| | Free (always) | Membership |
|---|---|---|
| Life Path Number + reading | ✅ | ✅ |
| Birthday & Personal Year numbers | ✅ (numbers) | ✅ |
| Expression / Soul Urge / Personality numbers | shown but 🔒 locked | ✅ |
| Full-profile deep reading + Personal Year forecast | — | ✅ |
| Daily free reads | 1 / day (generous, activation-first) | unlimited |

Pricing mirrors `home-en.html`: membership **$9.90/mo**. Life Path is the permanent free hook; the locked chips create the visible "there's more" pull.

Quota: reuses the oracle.js pattern — `_M.numerologyUsage` keyed by user/session/IP + day, members bypass. `NUM_FREE_DAILY = 1`.

---

## 5. Compliance & red lines (non-negotiable)

- **Zero fabrication.** Numbers are exact math; no invented "counters," testimonials, or accuracy claims.
- **AI-labeled** everywhere: hero badge, footer, and woven into the reading voice ("read to you by an AI").
- **Anti-fatalism.** Every reading closes with a "this isn't fate — what you do with it is yours" refrain. Every number is framed with both gifts and a growth edge; never "good" vs "bad" numbers.
- **No fear.** Never name diseases, never frighten. **Entertainment / self-reflection only — not medical, legal, or financial advice** (stated in footer + system prompt).
- "Eastern" brand voice elsewhere; numerology is explicitly **Western** here (correct framing, and the reason it's the out-of-China hook).

---

## 6. SEO

- **Title:** *Free Life Path Number Calculator · Numerology Reading | Runae*
- **Primary keywords:** `life path number`, `numerology calculator`, `life path number calculator`, `free numerology reading`; secondary `expression number`, `soul urge number`, `personal year`.
- On-page: H1 "What's your Life Path Number?", an "About your Life Path Number" explainer + 4-item FAQ (calculation method / difference from Expression & Soul Urge / free).
- **Structured data:** `FAQPage` JSON-LD embedded (calculation + free questions) to compete for AI Overviews / rich results.
- `canonical` + OG/Twitter cards set. **TODO for Karen:** add `numerology.html` to `sitemap.xml`.

---

## 7. Wiring (what Karen still does)

1. **Mount the route** in `server/index.js` alongside oracle:
   ```js
   app.use('/api', require('./routes/numerology'));
   ```
   ⚠️ Until this line is added, `numerology.html` will 404 on submit. This is the one known gap by design.
2. Add `numerology.html` to `sitemap.xml` + link it from `home-en.html` "More from Runae" grid (optional entry card).
3. `member-en.html` / `legal-us.html` / `privacy.html` links in the page assume the existing English pages.

---

## 8. Reuse & footprint

- Reuses `lib/llm` (`deepseekChat`, `buildReadingPrompt`), `lib/store` (`insertReading`, `memberTier`, quota persistence), `lib/utils`, `middleware` (`rateLimitMiddleware`) — identical patterns to `routes/oracle.js`.
- Design reuses the jade+cream token system from `home-en.html` verbatim.
- No changes to any existing backend, page, or shared file.
