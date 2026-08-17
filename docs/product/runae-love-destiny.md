# Runae · Love Destiny / 姻缘（月老） — PRD v1

**One-liner:** A single-person love reading. You put in your own birth data; Rún reads your Four Pillars and tells you your **soulmate portrait, peach-blossom charm, love pattern, and the seasons it's easiest to meet.** This is *you asking about yourself* — distinct from Compatibility (two people).

**Positioning vs. existing features**
- **Compatibility / 合婚 (hehun):** needs two birth charts → "do we fit?"
- **Love Destiny (this):** needs one birth chart → "what is my love life shaped like, and when does love flow?" Lower friction (no partner needed), stronger solo emotional hook, screenshot-native.

---

## 1. User flow

1. Land on `pages/love-destiny.html` (jade-green Runae, English, mobile).
2. Enter own birth: year / month / day (required), birth hour (optional, 12 shichen dropdown), gender.
3. 18+ / entertainment consent checkbox.
4. Tap **Read my love destiny** → `POST /api/love-destiny`.
5. Backend casts the **real** chart (engine, not LLM), extracts the love facts, feeds Rún.
6. Result: a screenshot-shareable verdict card + a Markdown reading. Free users see the **soulmate portrait** in full + teasers; members see everything.

---

## 2. 命理 logic (rule-based — the engine computes, the LLM only interprets)

All facts come from `computeBaziChart()` (`server/lib/bazi-engine`). **The LLM is forbidden to cast or alter the chart** — same guardrail as `prompt-block.js`. Backend `buildLoveFacts()` derives:

| Dimension | Rule | Source field |
|---|---|---|
| **Spouse Palace / 夫妻宫** | = the **day branch (日支)** + its hidden-stem ten-gods (藏干十神). This is the core of a person's marriage picture. | `siZhu.day.zhi`, `cangGan.day` |
| **Spouse Palace state** | 刑冲合害 touching the day pillar → the emotional theme (a clash = "you protect your edge", a combination = "you merge fast", etc.) | `enrichment.地支关系` filtered to pillar `日` |
| **Partner star / 正缘星** | Female chart → **Officer stars 官杀** (正官/七杀). Male chart → **Wealth stars 财** (正财/偏财). Where it shows across the four pillars + hidden stems = how visible/available partnership energy is. | `shiShen`, `cangGan.*`, `五行统计.shiShenGroups` |
| **Peach blossom / 桃花** | Classic 咸池 rule keyed off day/year branch: 寅午戌→卯 · 申子辰→酉 · 巳酉丑→午 · 亥卯未→子. The peach branch = the charm signal. | `PEACH_MAP[dayZhi]`, `PEACH_MAP[yearZhi]` |
| **Love pattern** | Combine day-pillar 刑冲合害 + 旺衰 (strong/weak day master) + 格局 → the repeating relational habit (giving in / rushing in / hiding in busyness). | `旺衰`, `格局`, `地支关系` |
| **Seasons to meet / 遇缘窗口** | Scan current + future **大运** (10-yr luck cycles); flag cycles whose branch/stem ten-god = the partner star, **or** whose branch = the peach branch. Framed strictly as *tendency seasons*, never a dated promise. | `dayun[].{ganZhi, zhiShiShen, ganShiShen, startYear, startAge}` |

Peach-blossom mapping and partner-star mapping were verified against engine output for a sample chart (1990-06-15 10:00 female → day branch 亥, peach 子; partner star = 官杀, present as 年/月 pillar Officer + hidden-stem, matching engine `shiShen`).

**Reading structure (5 sections):**
1. Your Soulmate Portrait (dayZhi + partner star → who you're drawn to + what you need)
2. Your Peach Blossom (charm signal + one way to amplify)
3. Your Love Patterns (the repeating habit + a freer way — "your pattern, not a fixed fate")
4. Your Seasons to Meet (tendency windows, never "you will")
5. The Matchmaker's Whisper (screenshottable closer; fixed last line: *"This isn't fate — what you do next is yours."*)

Localized ZH / EN / KO prompts in the route (`lang` param). KO nickname 루니, ZH/EN Rún.

---

## 3. Free vs. Paid gate

- **Free / guest:** LLM writes **Section 1 (Soulmate Portrait) in full**, then one-line teasers for the rest and stops (`maxTokens` capped ~1400). Frontend shows an unlock panel.
- **Member (monthly) or full-access (`love_destiny` / `bazi_full` / `bazi_vip` unlock):** full 5-section reading (`maxTokens` ~4096).
- Gate reuses `memberTier(req)` + `hasFullAccess(req, [...])` from `lib/store` — same mechanism as other readings. Free teaser is generated server-side (LLM told to stop), so the locked content never reaches the DOM = no free-scrape.

---

## 4. Virality / referral hook

- **Screenshot card:** jade/cream verdict card ("Your Love Destiny 💗" + first-section headline + `RUNAE · AIGC · your patterns, not a fixed fate`). `navigator.share` on mobile; graceful alert fallback.
- Card **never shows anyone else's name** — it's purely about the user's own chart, which keeps it safe to post and emotionally magnetic ("my soulmate portrait…").
- Natural feed into Compatibility ("now check if you two fit") and Chat with Rún.

---

## 5. Compliance / red lines (all enforced in prompt + UI)

- **Zero fabrication:** chart cast by real engine; LLM may not invent or recompute pillars, peach blossom, or luck cycles.
- **Eastern, not "Chinese":** copy says "an ancient Eastern system / Four Pillars / Five Elements." No "Chinese" label.
- **AI identity:** Rún openly states she's an AI reading an ancient system. AIGC badge on page + card.
- **Entertainment / reference disclaimer:** footer + card — "For entertainment & reflection only · 18+ · Not relationship, medical, legal, financial or psychological advice."
- **Anti-fatalism:** "Your patterns, not a fixed fate." Every window framed as a *season*, and each reading closes handing the wheel back.
- **Banned:** no "you will marry in year X" / "you'll meet your soulmate in X" — prompt hard-forbids dated promises; windows are only "easier to meet / a better time to open up."
- **18+ consent** checkbox required before submit. Birth data encrypted, never sold, deletable (privacy link).

---

## 6. Files

- `pages/love-destiny.html` — frontend (jade-green, EN, mobile, inline markdown renderer, share card).
- `server/routes/love-destiny.js` — `POST /api/love-destiny`; real-engine facts + Rún LLM; ZH/EN/KO; free/full gate.
- `docs/product/runae-love-destiny.md` — this PRD.

**⚠️ Route not mounted.** `love-destiny.js` is built but **not wired into `server/index.js`** (per handoff — Karen/lead mounts it). Suggested line, alongside the other `app.use('/api', ...)` readings:
```js
app.use('/api', require('./routes/love-destiny'));
```
Frontend calls `POST /api/love-destiny` (relative), so it works the moment the route is mounted.

---

## 7. Open items / next

- Mount the route (above). Until then the page will 404 on submit.
- Optional: add a `love_destiny` SKU to `UNLOCK_BY_CATEGORY` / products if selling this reading standalone (currently unlocked by monthly membership or existing bazi_full/vip).
- Optional: dedicated share-card image render (currently uses the on-page verdict card + native share).
- Consider adding a home-en.html entry tile linking to `/pages/love-destiny.html`.
