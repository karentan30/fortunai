# Runae · Face Reading & Palm Reading (Vision Feature) — PRD v1

**Status:** Draft for review · Design mockups shipped (`pages/face-reading.html`, `pages/palm-reading.html`)
**Owner:** Product · **Date:** 2026-08-17
**Positioning:** "Ancient Eastern face & palm reading" — self-discovery + entertainment, Western market. Rides the huge TikTok/social wave around face/palm reading.

> ⚠️ **This is a vision (image-analysis) feature. Reading every photo costs money.** See §6 Cost. **Do not turn on the real vision pipeline in production until a budget is written up and the boss approves it.** Mockups are static/demo only — they call no model and cost nothing.

---

## 1. Why this feature

- Face reading + palm reading are **exploding on TikTok/IG** — high shareability, low friction ("just take a photo"), instantly viral card format.
- Perfect **top-of-funnel** for Runae: a curious selfie-taker becomes a BaZi / full-report buyer. Cheaper hook than the birth-chart flow (no data entry — just a photo).
- Western framing: **"ancient Eastern art of self-discovery"** — mysterious, aspirational, non-clinical. Never "Chinese fortune-telling."

## 2. Scope

**In scope (v1):**
1. Face Reading — upload selfie → AI reads three zones + twelve palaces → free preview card + paid full reading.
2. Palm Reading — upload palm photo → AI reads major lines + mounts → free preview card + paid full reading.
3. Shareable result card (screenshot-friendly, branded `runae.app`).
4. Free tier (1 zone / partial preview) → paywall for full reading.

**Out of scope (v1):** video/live reading, couple/compatibility palm reading, storing photos in an album, historical re-reads. Backend, payment wiring, and real model integration are **separate work** — the two mockups touch none of it.

## 3. User flow

```
Entry (home tile / social link)
  → Intro + upload screen (camera or gallery)
      · quality guidance (good light, front-facing / open palm)
      · AI badge + entertainment disclaimer up front
      · privacy strip: "photo never stored, deleted after reading"
  → [User adds photo]
  → Quality gate (client + server): is a face / palm actually detectable?
      · if not → friendly retry ("we couldn't find a clear face, try again")
  → Analyzing state (spinner + step list, ~3–8s)
  → Free preview result card (3 highlight traits) + Share button
  → Paywall: "Unlock full reading — $9 one-time"
  → [Paid] Full reading (all zones/palaces or all lines/mounts)
```

Mockups implement Intro → Analyzing → Result with a demo state switch (`startDemo()`), no real upload.

## 4. Vision technology (how we actually read a face / palm)

Two-layer approach — a cheap detector gate, then a vision-LLM reader:

**Layer A — Detection / quality gate (cheap, runs first):**
- Confirm the image contains a usable **face** (or **open palm**) before spending on the expensive read.
- Face: an on-device / lightweight face-landmark check (e.g. MediaPipe FaceMesh or a face-detection API) — is there one clear, front-facing face, adequate lighting, no heavy occlusion?
- Palm: a hand/palm-landmark check (e.g. MediaPipe Hands) — is an open palm visible with lines discernible?
- This gate is near-free and stops us paying to "read" a blurry wall or a group photo. Reject → retry, **no paid call made.**

**Layer B — Interpretation (the paid step) — recommended: a multimodal vision LLM.**
- Send the image + a structured prompt to a **vision-capable LLM** and get back structured JSON (per zone / per line: descriptor + interpretation), which our copy layer renders.
- Candidate models (pick per cost/quality/region at build time — **prices change, verify before launch**):
  - **Qwen-VL (通义千问 VL, DashScope)** — cheapest well-supported option, already used elsewhere in Karen's stack (Slim/Lumee vision on Qwen). Strong default for margin.
  - **GLM-4V / other domestic VL** — cost-competitive alternative.
  - **GPT-4o-mini vision / Claude Haiku vision** — higher quality, higher cost; reserve for the paid full reading if quality demands it.
- **Two-tier by funnel stage to protect margin:**
  - Free preview → cheapest VL (Qwen-VL), short output.
  - Paid full reading → same cheap VL with a longer prompt, OR a step up to a premium model only if it measurably improves the paid experience.

**Prompt design note:** the vision LLM is instructed to describe **observable features** (e.g. "broad forehead," "long, unbroken heart line") and map them to **traditional face/palm-reading meanings** — framed as tradition/entertainment, never as fact. Hard guardrails in the system prompt: **no health, no lifespan, no disease, no death, no medical/psychiatric claims** (see §8).

## 5. Interpretation logic (rules + AI)

Hybrid, so output stays consistent and on-brand:
1. **Vision LLM extracts features** → structured descriptors (zones/palaces for face; lines/mounts for palm).
2. **Rule/template layer** maps descriptors → a curated library of Runae-voiced interpretation snippets (warm, affirming, "for reflection"). This keeps tone controlled and blocks the model from free-styling into forbidden territory.
3. **AI polish layer** stitches snippets into a natural, personal-feeling reading.
4. **Result "archetype" title** (e.g. "The Steady Gaze," "The Deep Heart Line") for the shareable card — memorable, screenshot-worthy.

Keeping interpretation partly template-driven also **caps token cost** and guarantees the disclaimer/positioning is always present.

## 6. Cost (⚠️ money red line)

**Every reading = at least one paid vision-model call.** Rough per-reading estimate (verify at build — model prices drift):

| Step | Model | Est. cost / reading |
|---|---|---|
| Detection gate | MediaPipe (on-device) or light face API | ~free / negligible |
| Free preview interpret | Qwen-VL, short output | ~¥0.02–0.10 (~$0.003–0.015) |
| Paid full interpret | Qwen-VL long / premium VL | ~¥0.05–0.30 (~$0.01–0.05) |

- **Free previews are the cost exposure** — everyone who uploads triggers a paid call, most won't convert. At scale this is real spend.
- **Cost controls required before launch:**
  - Detection gate **must** run first so we never pay to read junk images.
  - **Rate-limit free previews** per device/IP (e.g. 1–3/day) to block abuse/scraping.
  - Cap output tokens on the free tier.
  - No image is sent to the paid model until the cheap gate passes.
- **🚦 Launch gate:** before enabling the real pipeline, write up projected monthly spend (est. previews/day × per-call cost) and **get the boss's explicit budget approval.** Same rule as all paid-key / vision spend in this org — default is read-only, paid keys stay locked until approved.

## 7. Free / paid gating

- **Free:** 1 partial reading — 3 highlight traits on a shareable card. Enough to feel personal and drive sharing, not the full analysis.
- **Paid — $9 one-time full reading** (single body part), yours forever. (Aligns with Runae's report pricing; final price TBD with pricing owner.)
- **Membership tie-in:** face + palm readings can be bundled into the existing $9.90/mo Runae membership as "unlimited readings" — a strong retention hook.
- Free tier is deliberately generous on *shareability* (the card) but thin on *depth* (the paywall).

## 8. Compliance & safety framework

**Positioning language (hard rules):**
- ✅ "Ancient Eastern face/palm reading," "self-discovery," "entertainment," "a mirror," "traditionally associated with."
- ❌ **Zero "Chinese" label** — always "Eastern." ❌ No fabricated claims, stats, or testimonials.
- ✅ **AI badge** visible on every screen (🤖 AI-powered / AI-generated).
- ✅ **Entertainment & self-reflection disclaimer** on upload, result, and footer.

**Anti-fatalism / no fear-mongering (red line):**
- **Never predict lifespan, death, disease, or health outcomes.** The life line is explicitly framed as "energy/vitality rhythm," **not a countdown of years.** (Called out in both mockups.)
- No diagnosing mental health, no "you will fail/succeed" determinism.
- Always frame as tendencies + agency: **"you write your own future."** Anti-fatalism is a Runae red line.
- System prompt hard-blocks medical/mortality/psychiatric output; template layer contains no such snippets.

**Legal footer:** "AI-generated · for self-reflection & entertainment only. Not medical, psychological, or predictive advice."

## 9. Privacy red line (human faces = sensitive data)

Faces and palm prints are **biometric / sensitive personal data** (GDPR Art. 9, CCPA, BIPA, PIPL). Handle with the strictest posture:

- **No storage of the photo.** Analyze in-memory, in the moment, then **delete immediately** after the reading is generated. We keep the *text reading*, never the image.
- **No training.** The photo is never used to train or fine-tune any model, never retained in logs.
- **No sharing / no third-party resale.** If a third-party vision API is used, the image transits only for the single inference call; choose a provider whose terms allow **zero data retention** (verify DashScope/vendor retention settings; request no-retention mode where available).
- **No face database, no face-matching, no identity linking.** We do not build a biometric identifier or link a face across sessions.
- **Explicit, up-front notice** on the upload screen ("your photo is never stored, deleted after reading") + a **linked privacy explainer** (`privacy.html`) detailing photo handling.
- **Consent:** uploading is the explicit action; consider a checkbox / clear notice before first upload. **Minors:** block under-18 (age gate) — reading children's faces is off-limits.
- Update `privacy.html` and Terms with a **biometric/photo-handling section** before launch (legal review recommended given BIPA class-action exposure in the US).

## 10. Files delivered

| File | What it is |
|---|---|
| `pages/face-reading.html` | Face reading mockup — jade Runae style, mobile-first. Intro/upload → analyzing → result card → paywall. Static demo, no real upload. |
| `pages/palm-reading.html` | Palm reading mockup — same system, palm-line content. |
| `docs/product/runae-face-palm-reading.md` | This PRD. |

Mockups reuse the `home-en.html` jade+cream design tokens (Playfair/Inter, jade orb, gold CTA, AI note, footer disclaimer). CTAs point to existing `bazi-en.html` / `privacy.html` as placeholders — **no backend or existing page was modified.**

## 11. Risks & pitfalls

- **Cost blowout from free previews** — the #1 risk. Gate + rate-limit + budget approval before go-live. (Vision spend is a known money trap in this org.)
- **Biometric legal exposure (BIPA/PIPL)** — mishandling a face photo is far riskier than a birth date. No-retention posture is non-negotiable; get legal sign-off.
- **Vision quality variance** — bad lighting / angles → weak or wrong reads → refunds/complaints. The detection gate + clear photo guidance mitigate this.
- **Fatalism/fear creep** — model may drift into "your health line shows…" Hard prompt guardrails + template control layer required; QA the outputs adversarially before launch.
- **Model price drift / region** — verify current per-call cost and vendor data-retention terms at build time; don't trust the estimates here as final.
- **Perceived accuracy** — face/palm reading has no scientific basis; lean fully into the "entertainment & self-discovery" frame to stay honest and compliant.

## 12. Open questions (for boss / owners)

1. Approve the vision pipeline budget? (need projected previews/day to size it)
2. Final free-tier limit (1–3 previews/day per device)?
3. Price: $9 one-time confirmed, or bundle only into membership?
4. Which vision model for launch (Qwen-VL default vs. premium for paid)?
5. Legal review of biometric/photo privacy section before launch — who owns it?
