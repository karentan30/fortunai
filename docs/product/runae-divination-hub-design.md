# Runae — The Everything-Oracle Hub (`explore.html`) — Design Doc

**Positioning (locked by owner):** Runae's moat = *the everything-oracle* — the **most complete** divination platform, where **every system is genuinely accurate (real engines, not an LLM guessing a chart)**. Hobbyists love trying new, exotic things; more variety = they play longer and spend more.

**Visual:** Reuses `home-en.html` design tokens exactly — jade `#5bbfa0` + cream `#faf8f5` + gold CTA `#c9a84c`, Playfair Display + Inter, jade orb (`.clasp`), 440px mobile shell. Brand: **Runae**. Language: **English only, zero "Chinese/China" labels** (Western-facing repackaging).

---

## 1. Page structure (top → bottom)

1. **Hero** — jade orb + "The everything-oracle" badge. H1: *"Every oracle worth asking. All in one place."* Sub sells the two moats: **most complete** + **real engines, not guesswork**.
2. **AI + accuracy note** — 🤖 AI-assisted interpretation, but *charts are computed by precise engines*, not invented.
3. **Two intent zones** (the core IA — splits "everything" so it never feels like clutter):
   - **Zone A — Ask a matter** (you have a specific question → draw + interpret, LLM-only, no chart-casting)
   - **Zone B — Understand yourself** (who am I / my whole life → requires precise chart-casting = real engine)
4. **Why every reading is real** — the engineering guardrail explained to the user (real-engine badge legend).
5. **Ritual teaser** — the shake/toss interactions (shareable moment).
6. **Compliance footer** — AI label, entertainment/reflection-only disclaimer, anti-fatalism.

### Why two zones (not one giant grid)
Users arrive in one of two mindsets: *"I have a question right now"* vs *"tell me who I am."* Sorting by **intent** keeps 11 systems legible — "complete" reads as *rich*, not *chaotic*. Each zone has its own subtitle and its own engine-badge meaning.

---

## 2. Card structure (identical template across all systems)

Every system = one card:
- **Icon** (emoji glyph, jade/gold palette)
- **Name** — Western-repackaged, no Chinese label. e.g. "Fortune Sticks" not "求签", "Moon Blocks" not "掷筊", "Four Pillars" not "八字/BaZi-as-Chinese".
- **One-line "what this is"** — reframed for a Western seeker (what it *does for you*, not its ethnic origin)
- **"What you'd ask" chip / prompt** — a sample question or the input the system takes
- **Engine badge** — either **`Real engine`** (gold, precise chart) or **`AI reading`** (jade, interpretation-only)
- **CTA** — "Ask →" (Zone A) or "Chart me →" (Zone B)

---

## 3. The 11 systems + engine classification

### Zone A — Ask a matter  → **`AI reading`** (LLM interpretation of a random draw; NO chart-casting engine needed)
| System (Runae name) | What it is (Western framing) | Ask | Engine |
|---|---|---|---|
| **Tarot** | Pull cards, read the story of your situation | any open question | AI reading |
| **I-Ching (Book of Changes)** | Six-line oracle for change & timing | a yes/no or "what should I do" | AI reading |
| **Fortune Sticks** | Shake a bamboo cylinder until one stick falls — draw a numbered omen verse | one worry, one answer | AI reading + **shake ritual** |
| **Moon Blocks** | Toss two crescent blocks — yes / no / laughing (ask again) | a clean yes/no | AI reading + **toss ritual** |
| **Qi Men (Time & Direction)** | Best *timing & direction* to act on a decision | when/where to make a move | AI reading |
| **Da Liu Ren** | Ask one precise question, get one precise reading | one specific question | AI reading |

> **Guardrail:** these are inherently draw-based / interpretive. An LLM reading a random draw is *authentic to how the method works* — no fabricated precision, so `AI reading` is honest here.

### Zone B — Understand yourself  → **`Real engine`** (must cast an exact chart from birth data; LLM guessing = "chart翻车" red-line)
| System (Runae name) | What it is (Western framing) | Input | Engine |
|---|---|---|---|
| **Four Pillars** *(flagship)* | Your birth-moment blueprint: character, love, career, life cycles | exact birth date/time/place | **Real engine — required** |
| **Purple Star (Ziwei)** | A 12-palace star map of your life's domains | exact birth date/time/place | **Real engine — required** |
| **Vedic (Indian) astrology** | Sidereal birth chart from the Indian tradition | exact birth date/time/place | **Real engine — required** |
| **Maya calendar** | Your day-sign & galactic signature from the Mayan count | birth date | **Real engine — required** |
| **Tibetan astrology** | Element + animal + Mewa from the Tibetan calendar | birth date | **Real engine — required** |

> **Guardrail:** any "who am I / my whole life" chart **must be computed by a real ephemeris/calendar engine**. Letting an LLM invent pillars, star placements, or a Vedic chart is the *chart翻车* failure the badge exists to prevent. These cards are visibly badged **Real engine** and (in real build) must be gated behind an actual calculator before any interpretation runs.

---

## 4. Ritual interactions (the shareable / TikTok moment)

Two custom micro-interactions live in Zone A, designed to be filmed:

**Fortune Sticks — "Shake"**
- Tap opens a full-screen bamboo **cylinder**. User physically **shakes the phone** (devicemotion) *or* taps/holds "Shake" — sticks rattle (CSS shake + tick sound cue).
- Tension builds, then **one stick slides out** and reveals a **numbered omen verse**. AI reads the verse against the user's question.
- Shareable: the slow reveal of "Stick No. 27" is a natural clip. Screenshot card generated with the verse.

**Moon Blocks — "Toss"**
- Two crescent blocks on screen. User **flicks up** / taps "Toss" → blocks tumble (rotate + arc) and land:
  - both round-up = *Laughing* (ask again) · both flat = *No / Angry* · one-one = **Yes / Sacred**.
- Three outcomes, real 3-state logic (not fake 50/50) — the *ask-again* result is what makes it feel alive and re-playable.

Both are `pointer`/`devicemotion` friendly and degrade to a button tap on desktop. In the mockup these are demonstrated with a lightweight animated preview + labelled state legend (no backend).

---

## 5. Real-engine badge = the accuracy moat, made visible

A small legend teaches the user two tiers:
- 🟡 **Real engine** — "Your chart is computed by a precise engine, to the exact minute. No guessing."
- 🟢 **AI reading** — "An AI interprets your draw — the way a reader would."

This turns the internal engineering guardrail into a **trust feature**: the user sees *which* readings are mathematically cast vs interpreted, which directly sells "every one is real / accurate."

---

## 6. Compliance (all present in mockup)
- **AI label** — 🤖 in the accuracy note + footer, on every AI-reading badge.
- **Entertainment/reflection disclaimer** — footer: "for self-reflection & entertainment only. Not medical, legal, or financial advice."
- **Anti-fatalism** — dedicated line: *"This isn't fate. A reading shows tendencies and timing — you still choose."*
- **No Chinese/China labels** — every system renamed to Western-facing terms; origins described by *function*, not ethnicity. Vedic explicitly "(Indian)" and Maya/Tibetan named as-is since those are the Western-recognized names.

## 7. Red-line check
- ✅ No "Chinese/China" ethnic labels anywhere (Four Pillars, Purple Star, Fortune Sticks, Moon Blocks — all functional Western names).
- ✅ No fabricated testimonials / user counters / fake accuracy stats.
- ✅ Real-engine systems explicitly badged + doc-flagged as "must not be LLM-guessed."
- ✅ AI-reading systems honestly badged (draw-based → interpretation is authentic, not fake precision).
- ✅ Anti-fatalism + AI + entertainment disclaimers present.

## 8. Files
- Design doc: `/Users/karen/projects/shenyuan/docs/product/runae-divination-hub-design.md`
- Mockup: `/Users/karen/projects/shenyuan/pages/explore.html`
