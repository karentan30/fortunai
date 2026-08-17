# Runae · Best Time to Reach Out (最佳联系时机 / 择时求复合)

> One line: **Give us two birthdays and a relationship, and Runae shows the specific dates + hours in the next 30 days when reaching out to that person is most likely to land well** — each window with a one-line "why" (from both charts) and a suggested tone. Timing guidance, not a promise.

Status: **Design v1** · Owner: product · Reuses `server/lib/bazi-engine` · Two files only:
- Front-end mockup: `pages/best-timing.html`
- This design doc: `docs/product/runae-best-timing-feature.md`

---

## 1. Why this is the viral hook

Every "should I text my ex / crush / the person I ghosted" moment is high-emotion and shareable. Competitors (Co-Star, Fatetell, 测测) give vague daily vibes. **We give a calendar with concrete, screenshottable golden windows** ("Oct 12, 7–9pm ⭐ best") — the奇门择时 feeling, productized for dating. The result card is designed to be screenshotted ("my golden windows to text him") and sent to friends → organic loop.

---

## 2. Input → Output

### Input
| Field | Required | Notes |
|---|---|---|
| Your birth date (solar Y/M/D) | ✅ | reuses bazi-en input pattern |
| Your birth hour (时辰) | optional | "Unknown" allowed; still ~80% useful (day pillar drives most of it) |
| Your gender | ✅ | engine needs it |
| Their birth date (solar Y/M/D) | ✅ | |
| Their birth hour | optional | "I only know roughly" allowed → falls back to day-pillar-only scoring |
| Relationship scenario | ✅ | one of: `crush` (暧昧) / `ex_reconcile` (前任·求复合) / `win_over` (想搞定某人) / `cold_contact` (好久没联系) |
| Window length | fixed | next 30 days (free shows 1 window; paid shows all) |

### Output (per window)
```
{ date: "2026-10-12", label: "best" | "good",
  hourStart: 19, hourEnd: 21, shichen: "戌 Dog Hour",
  score: 0..100,
  why: "Their emotional/communication star is activated and your energy runs smooth today.",  // one line, plain English
  tone: "Warm and light — a low-pressure check-in, not a big talk." }
```
Result = a **calendar-style highlight strip** of 3–6 windows over 30 days, each expandable to why + tone.

---

## 3. Divination algorithm — RULE-BASED, the LLM never invents dates

**Hard rule (efficacy + trust red line):** dates and hours come 100% from the deterministic bazi engine + a fixed scoring rubric. The LLM is used ONLY to phrase the `why` and `tone` sentences from structured facts we already computed. **No LLM ever picks or ranks a day.** (Same discipline as the report engine: "we do NOT compute pillars in the browser — a local approximation would be dishonest.")

### 3.1 Reuse the existing engine for 流日/流时

The engine already ships two pure helpers — use these directly, no re-running a full natal calc:
- **流日 (day pillar):** `getDayGanZhi(year, month, day)` → `{gan, zhi}` — `server/lib/bazi-engine/yiqi-core/ganzhi.js:104`
- **流时 (hour pillar):** `getHourGanZhi(dayGan, hour)` → `{gan, zhi}` (五鼠遁法) — `ganzhi.js:123`

Chain them: `const d = getDayGanZhi(2026,10,12); const h = getHourGanZhi(d.gan, 19);` gives Oct 12 2026 19:00's 流日+流时. Deterministic, jieqi-accurate.

Natal charts for the two people use `computeBaziChart({year,month,day,hour,gender})` (`index.js:30`), which returns `bazi.{siZhu, dayMaster, shiShen (per-pillar ten-gods), cangGan (hidden-stem ten-gods), enrichment.{五行统计, 旺衰, 调候用神}}` — everything we need is precomputed there.

### 3.2 What we precompute once (both people)

From `computeBaziChart` on each person we already get:
- `dayMaster` (日主 gan) + its element → each person's core self.
- `siZhu` four pillars {gan, zhi}.
- `cangGan[*].shiShen` → **ten-gods labels** already computed per hidden stem (正官/七杀/正印/偏印/比肩/劫财/食神/伤官/正财/偏财).
- `enrichment.五行统计` (element counts), `enrichment.旺衰` (身强/身弱), `enrichment.调候用神` (climate useful god).
- Derive per person (fixed lookup tables, no LLM):
  - **喜用神 element(s)** — from 旺衰 + 调候用神 (weak self → likes 印/比; strong self → likes 财/官/食伤; plus climate god). Store as a set of favourable elements.
  - **桃花 branch (咸池桃花)** — the engine only marks 沐浴 phase, so **build a small fixed lookup** off the day-branch (or year-branch) trine: 申子辰→酉, 寅午戌→卯, 巳酉丑→午, 亥卯未→子. Trivial table, unit-test it.
  - **communication/opening stars** — read directly from `shiShen` (per pillar) + `cangGan[*].shiShen` (hidden stems): 食神/伤官 = self-expression/softening; 正官/七杀 = attention/commitment. Already fully exposed by the engine — filter for these labels, no new detector.

### 3.3 Daily + hourly scoring rubric (0–100)

For a candidate day D (and hour H), score = weighted sum of deterministic checks:

**Target-openness (does TA feel open that day?) — 50%**
- +++ Flowing day pillar for THEIR chart: 流日 element **generates/matches their 喜用神** (相生/同类) → their mood is buoyant.
- ++ 流日 activates **their 食伤** (output/expression star) → they're more talkative/soft/receptive.
- ++ 流日 branch = **their 桃花 branch** → romance/attraction energy on.
- – Penalty if 流日 clashes their day-branch (日支相冲 六冲) → irritable/defensive; avoid.
- – Penalty if 流日 element **controls/drains their 喜用神** strongly (相克) → guarded.

**Your-poise (are YOU coming from a smooth place?) — 30%**
- ++ 流日 supports YOUR 喜用神 → you read calmer, less needy → better message.
- ++ For `ex_reconcile`/`win_over`: 流日 activates YOUR 食伤 (you express warmly) or YOUR 官/财 star appropriately.
- – Penalty if 流日 clashes YOUR day-branch → you're reactive; hold off.

**Pair-harmony bonus — 20%**
- + 流日 stem/branch forms 合 (六合/三合/天干五合) with either chart's day pillar → "bridge" day.
- – 流日 sits on a mutual 冲/刑 between the two charts → friction.

**Hour (时辰) refinement:** within a qualifying day, rank the 12 时辰 by 流时 pillar using the same 喜用神 / 食伤 / 桃花 / 冲 checks, lighter weight. Pick the top 1–2 时辰 blocks and express as clock ranges (e.g. 戌时 → "7–9pm"). If birth hour unknown for a person, drop that person's hour-level 冲 penalties (day-level still applies).

**Window selection:**
- Compute score for all 30 days. Threshold: `best` ≥ 75, `good` 60–74, hide < 60.
- Return top ~5–6, spread out (no two `best` within 3 days if avoidable, so the calendar looks useful).
- Every returned window MUST carry the concrete deterministic reasons (which star, which element) → those facts feed the sentence generator.

### 3.4 Sentence generation (why + tone) — templated, LLM optional

`why` and `tone` are built from a **fixed template bank keyed by the winning reason(s)** + relationship scenario. Example:
- reason=`target_shishang_active` + scenario=`ex_reconcile` → why: "Their guard is naturally lower today — they're in a more open, expressive frame." tone: "Warm and light. A short, low-pressure check-in — no heavy talk yet."

LLM (DeepSeek, cheap) may *polish* the sentence for fluency but is **fed the fixed facts and forbidden from changing the date/hour/verdict**. If LLM is off, templates ship as-is. This keeps cost ≈ engine-only and removes hallucinated dates entirely.

---

## 4. API contract

`POST /api/best-timing`
```jsonc
// request
{
  "you":    { "year":1994, "month":3, "day":18, "hour":10, "gender":"female" },   // hour null if unknown
  "them":   { "year":1992, "month":8, "day":2,  "hour":null, "gender":"male" },
  "scenario":"ex_reconcile",     // crush | ex_reconcile | win_over | cold_contact
  "rangeDays":30,
  "lang":"en",
  "token":"<jwt|guest>"
}
// response
{
  "tier":"free",                 // free -> only windows[0] populated, rest count-only
  "locked": true,
  "windowCount": 5,
  "windows": [
    { "date":"2026-10-12","weekday":"Sun","label":"best","score":82,
      "shichen":"戌 Dog Hour","hourStart":19,"hourEnd":21,
      "why":"Their expressive star is lit and your energy runs smooth — words land softly.",
      "tone":"Warm and light. A short, low-pressure hello — no big talk yet.",
      "reasons":["target_shishang_active","you_favourable_element","pair_liuhe"] },
    // ... free tier: remaining objects return {date:null, label:"good", locked:true}
  ],
  "disclaimer":"Timing guidance, not a promise."
}
```
- **Cost:** pure local engine — no paid API for the core calc (≈ $0). Per request = 2 `computeBaziChart` (the two natal charts, cached) + 30 `getDayGanZhi` + a bounded `getHourGanZhi` set. `getDayGanZhi` is a trivial Julian-day mod (no jieqi lookup) so 流日 is nearly free; the year's 365 day-pillars can be precomputed/memoized globally since they're identical for all users. Optional DeepSeek polish is a few tenths of a cent.
- Mount alongside `/api/bazi` in `server/routes/divination.js` (reuse its auth/token + WeChat/Alipay `order_no` middleware). Natal calc via `computeBaziChart` from `server/lib/bazi-engine`.

---

## 5. Compliance framing (efficacy red line — same as the report)

- Frame strictly as **"timing / 择时 guidance for entertainment & self-reflection."**
- Standard footer: `AI-generated content (AIGC) · For entertainment and self-reflection only` + `Timing guidance, not a promise.` + `18+`.
- **Banned copy (hard):** "guaranteed they'll reply", "you WILL get back together", "this window makes them love you", any certainty about another person's behaviour. Anti-fatalism: "A good window improves your odds and your own poise — it doesn't control anyone. You still choose the words."
- Consent gate on the OTHER person's birth data: reuse the existing consent line ("Encrypted. Never sold. Delete anytime.") + note that this is a reflection tool about *your* timing, not surveillance.
- AIGC label visible on the result and on any share card.

---

## 6. Free vs paid gate

- **Free:** the single **next** golden window (date + 时辰 + one why line + one tone line) → real aha, screenshottable, drives the viral loop. Remaining windows shown as **blurred/locked count** ("+4 more windows in the next 30 days").
- **Paid ($19.90 one-off, or included in membership):** full 30-day calendar, all windows with why + tone, per-scenario tone scripts, and a "what NOT to do" avoid-days list. Same price ladder / Stripe + 微信/支付宝 as report ($19 tier). Paid content must NOT be present in the DOM before unlock (anti-scrape, same discipline as report paywall).

---

## 7. Virality / share

- Result renders a **share card**: "My golden windows to reach out ✦" with the top window highlighted, jade/cream brand, Runae mark, AIGC label. Screenshot or Web-Share.
- Hook copy for share: "Runae told me the exact day + hour to text him 👀". Card hides the other person's identity (no name shown) — only the windows.
- Ties into existing invite/referral surface (`pages/invite.html`).

---

## 8. Result shape (what the user sees)

1. **Verdict strip** — "Your next golden window: **Sun Oct 12, 7–9pm** ⭐".
2. **30-day calendar row** — days rendered as dots/cells; `best` = gold star, `good` = jade dot, muted = low. Tapping a highlighted day expands → why + tone + 时辰.
3. **Per-window card** — date · 时辰 clock range · one-line why · tone suggestion.
4. **Avoid days** (paid) — 1–2 clash days flagged "give it a beat".
5. Footer: AIGC + "Timing guidance, not a promise" + 18+.

---

## 9. Risks / traps (be honest)

- **桃花/合冲 tables must be correct** — use the same fixed classical tables; unit-test against a couple of known charts. A wrong 冲 table would silently mis-rank days.
- **Unknown birth hour** for TA is common → design already degrades to day-pillar scoring; must not error or fake an hour. Show "based on their day energy (birth time unknown)" honestly.
- **Timezone**: candidate future dates use the *user's* local timezone for the clock ranges, but the ganzhi 流日/流时 must be computed on the correct solar time (engine defaults 东八区 `timeZone:8`); pass the user's tz through so "7–9pm" matches their clock. Don't ship without this — it's the #1 way the feature feels wrong.
- **Over-promising is the big trap** — the whole thing is one lawsuit-flavoured sentence away from "we said he'd reply." Keep the banned-copy list enforced in the template bank, not just the footer.
- **Day-pillar memoization**: the 流日 pillar is identical for all users on a given date — precompute the year's day pillars once (365 engine calls) and cache; per-request cost then ≈ 2 natal charts + hour lookups.
- Not a real trap but note: this reuses report pricing/paywall infra, so no new billing work beyond a new SKU/price ID.
