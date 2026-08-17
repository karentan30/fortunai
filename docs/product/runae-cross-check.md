# Runae · Cross-Check (多体系交叉验证) — PRD v1

> **Flagship trust feature.** One birth chart → multiple divination systems run **independently** → the same life dimensions compared side-by-side → **agreement = high confidence (⭐), conflict = flagged for you to weigh (⚠️)**.
> Solves the core anxiety: *"BaZi says start a company, Zi Wei says stay salaried — who do I listen to?"*
> This is Runae's answer to *"the most complete AND actually accurate"* — the differentiator no single-system competitor can copy.

---

## 1. Problem & positioning

Every fortune app gives you **one** system's answer. The moment a user cross-references (BaZi elsewhere vs. their Western sign vs. a tarot pull), the answers conflict — and trust collapses. Runae turns that conflict from a bug into the **hero feature**: we run several ancient systems on the *same* chart, independently, and honestly show where they converge and where they diverge.

- **Convergence** is a strong signal worth acting on.
- **Divergence** isn't an error — it's two valid frameworks weighing different factors, surfaced transparently instead of hidden.

Positioning: this is the **premium / master-tier / high-ticket** experience. See cost redline (§6) — it is **never free**.

---

## 2. Scope

**Phase 1 (this PRD):** BaZi (八字) + Zi Wei Dou Shu (紫微斗数). Both排盘 from the **real** `server/lib/bazi-engine` (`computeBaziChart({..., includeZiwei:true})` returns both charts from one call — no second engine needed, no LLM self-calculation).

**Later (engines ready → add to `SYSTEMS[]`):** Vedic astrology, Tarot. The route and UI are built so a new system is a single array entry (`{id, name, buildBlock(chart)}`) with zero rework.

Redline: **real-engine排盘 only. The LLM interprets pre-computed chart data; it must never compute pillars/palaces/stars itself.**

---

## 3. Cross-check logic (how it judges agree / diverge / consensus)

### 3.1 Align on fixed dimensions
All systems must answer the **same** dimensions so results are comparable:

| key | label |
|-----|-------|
| `career` | Career |
| `wealth` | Wealth |
| `love` | Love & Relationships |
| `health` | Health & Vitality |

### 3.2 Pipeline (per request)
1. **排盘 once** — `computeBaziChart(birth)` → one chart object holding both `bazi` and `ziwei`.
2. **Each system reads independently** (parallel LLM calls). Each system sees *only its own* pre-computed chart block (`buildBlock`), never another system's answer. Output per dimension: `{ verdict (short comparable label), confidence 0-100, reason (1 sentence tied to chart data) }`.
   - Comparable verdict vocabulary keeps labels short so they can be diffed: e.g. `entrepreneurial` / `steady-salaried`, `abundant` / `volatile`, `committed` / `independent`, `resilient` / `needs-care`.
3. **Cross-compare** (one more LLM call, arbiter role). For each dimension it emits:
   - `status`: **`consensus`** (verdicts point the same way) · **`divergence`** (conflict) · **`partial`** (leaning but mixed).
   - `consensusScore` 0-100 (how aligned the systems are on that dimension).
   - `summary`: 1 honest sentence. Consensus → the shared signal. Divergence → what each system says + "weigh it yourself" (often a both-true synthesis, e.g. *build independently but under a structured umbrella*).
   - Plus `overallConsensus` 0-100 across all dimensions.

### 3.3 Consensus scoring model
- **Per-dimension** consensusScore is driven by (a) whether verdicts point the same direction and (b) how confident each system is. Agreeing high-confidence verdicts → high score; direct conflict → low score; one leaning/uncertain → `partial`.
- **Overall consensus** = aggregate across the 4 dimensions (roughly the mean of per-dimension scores). Surfaced as the big gauge on the result page.
- The arbiter is instructed to be **strictly honest**: it must never inflate consensus, and must explicitly note that *agreement ≠ the prediction is true* (see §7).

> Note: v1 uses the LLM arbiter to judge alignment (fast to ship, handles fuzzy verdict wording). A future v2 can add a deterministic rule layer (verdict → polarity map) for cheaper, more reproducible scoring on the common cases, with the LLM only writing the human summary.

---

## 4. What the user sees (result page — `pages/cross-check.html`)

- **Systems consulted** row (BaZi, Zi Wei; Vedic/Tarot shown as "soon") + note: *each system read independently before the cross-check.*
- **Overall consensus gauge** — big number + bar (e.g. "72% · 2 of 4 dimensions align strongly").
- **Dimension comparison cards** — the core artifact. Per dimension:
  - Status tag: ⭐ Consensus · ◐ Partial · ⚠️ Divergence (+ score).
  - Per-system rows: system · verdict · confidence · one-line reason.
  - A summary band. **Career divergence** is the money shot — e.g. BaZi "Entrepreneurial 76" vs Zi Wei "Steady/salaried 71" → "build independently, but under a structured umbrella; weigh it yourself."
  - **Wealth consensus** — both "Abundant" → ⭐ high confidence.
- **Honesty box** — what Cross-Check does & doesn't prove.
- Jade + cream design matching `home-en.html`; English; Runae brand; screenshot-friendly (`Save / Screenshot` = `window.print()`); AI badge + disclaimer in footer.

Result JSON shape (route → page, 1:1 with mockup markup):
```
data: { systems[], dimensions[], perSystem{[sysId]:{name,dims:{[dim]:{verdict,confidence,reason}}}},
        comparison{ overallConsensus, dimensions:{[dim]:{status,consensusScore,summary}} }, disclaimer }
```

---

## 5. Files delivered (this PRD)

| File | Role | Mount? |
|------|------|--------|
| `docs/product/runae-cross-check.md` | this PRD | — |
| `pages/cross-check.html` | result mockup (jade, EN, screenshot-ready, static demo data mirroring the API shape) | static page |
| `server/routes/cross-check.js` | `POST /api/cross-check` — 排盘 → per-system independent LLM → cross-compare → JSON | **built but NOT mounted — Karen mounts** |

**⚠️ Trap: the route is intentionally not mounted.** Karen wires `app.use('/api/cross-check', require('./routes/cross-check'))` in the server entry, alongside wiring the real entitlement check (§6).

---

## 6. ⚠️ Cost redline & positioning (approve before launch)

Cross-Check is the **most expensive feature Runae runs.** Per request = **N system-analysis LLM calls + 1 cross-compare LLM call** (Phase 1 = 2 + 1 = **3 LLM calls**; adding Vedic/Tarot makes it 4–5).

- Rough token budget per request (comparable to deep multi-pass tools: Standard ~180k / Deep ~300k tokens): each system analysis pulls a full chart block + reasons across 4 dimensions; the arbiter re-reads all system outputs. Ballpark **~120k–250k tokens/request** on Phase-1 two systems, scaling ~linearly per added system. On Qwen-plus / DeepSeek-chat pricing this is single-digit RMB per run at most, but it **multiplies with every system added** and must be capped.
- **Positioning (non-negotiable): never free.** Gate to **annual membership / master tier / high-ticket single purchase only.** Route defaults to **deny** (`requireEntitlement()` returns `ok:false` until Karen wires real `memberTier`/`hasFullAccess`), guarded further by `CROSS_CHECK_ALLOW_UNGATED` env so it can't accidentally ship open and burn money.
- **Controls to ship with:** hard entitlement gate · per-user rate limit · `max_tokens` caps already set on each call · fail-safe (needs ≥2 systems to succeed, else 502 not a garbage result).
- **Approval gate:** finalize price point + monthly LLM budget ceiling with Karen/老板 **before** enabling the entitlement path. Do not launch ungated.

---

## 7. Compliance / redlines

- **Zero fabrication.** Real-engine排盘; LLM interprets given data only, never self-computes.
- **AI-labeled** everywhere; **entertainment / self-reflection only**; not medical, legal, or financial advice.
- **Anti-fatalism** — tendencies & probabilities, never certainties; divergence framed as "weigh it," not "obey."
- **Honesty on the core claim (baked into route `disclaimer` + page honesty box):**
  > *"Agreement across systems does NOT prove a prediction will come true — it only means multiple lenses converge on the same signal. Algorithmic verification confirms the charts are computed consistently; it cannot prove the reading is correct."*
- Disclaimer string is server-sourced so it's shown verbatim; the page also hard-codes it in the footer.

---

## 8. Open items / next steps

1. **Karen:** mount the route + wire real entitlement (`memberTier`/`hasFullAccess` from `lib/store`) replacing the placeholder deny in `requireEntitlement()`.
2. **Karen/老板:** approve price tier + monthly LLM budget ceiling (§6) before enabling.
3. Wire `pages/cross-check.html` to live `POST /api/cross-check` (static markup already mirrors the response shape — swap-in is 1:1; add a loading state, expect ~10–25s for 3 sequential-ish LLM calls).
4. Later: add Vedic & Tarot to `SYSTEMS[]` once engines exist; consider the deterministic scoring layer (§3.3 v2).
