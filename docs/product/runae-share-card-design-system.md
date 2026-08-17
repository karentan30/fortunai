# Runae Share-Card Design System v1.0

Premium, reusable share cards for user-generated results (chart archetype, MBTI × day master, life K-line, compatibility). Goal: **too good-looking not to screenshot** → sharing = the growth engine.

Two families from one CSS system. Live showcase: **`pages/share-cards.html`**.

| Family | Use | Aesthetic | Base |
|---|---|---|---|
| **A · Luxury Rarity** | virality / group-chat flex | dark-gold, foil, UR/SSR/SR badge, magazine spec rows | near-black + gold |
| **B · Jade Brand** | brand-consistent moments (in-app, home) | off-white, jade, calm | matches `home-en.html` |

Both are **pure CSS** (free, instant). No image needed. ComfyUI backgrounds are an optional upgrade — see §8.

---

## 1. Design tokens (locked to brand-tokens.css)

```
Gold      #c9a84c   light #e8d08a   deep #8a6420   foil-hi #f6e6a8
Jade      #5bbfa0   deep  #3d9e82   light #8dd9bf
Brand bg  #faf8f5   card #ffffff    ink #1a1a18
Luxury bg #0d0b08 → #181310 → #241a12  (espresso→charcoal→near-black)
```

Do not introduce new hues. Rarity badge colors are the **only** exception (they signal tier, gacha convention).

## 2. Typography

- **Display / hero (西文):** Playfair Display (700–900), italic for subtitles
- **Serif quotes:** Cormorant Garamond italic
- **CJK hero:** Noto Serif SC 700
- **Body / labels / UI:** Inter (400–700), uppercase + wide letter-spacing for meta labels
- Scale (at 1080px master; showcase renders ~0.34×): hero CN 52px · hero EN 22px · spec 11.5px · meta labels 9–10px

## 3. Spacing / sizes

- Master render sizes: **9:16 = 1080×1920** (story/screenshot), **1:1 = 1080×1080** (feed). Classes `.rc-9x16` / `.rc-1x1`.
- Outer padding 34/30px. Inner ornamental border inset 12px (lux) / 10px (jade).
- Spec rows are a 2-col grid `56px 1fr` — label right-aligned gold, value left.

## 4. Rarity badge (gacha convention)

Top-right, `.rc-badge` + a grade class on the card root:

| Class | Tier | Color | When |
|---|---|---|---|
| `grade-UR` | Ultra Rare | pink `#ff5db1` | ~<1% occurrence |
| `grade-SSR` | Super Rare | gold `#e8d08a` | ~1–5% |
| `grade-SR` | Rare | blue `#9db8ff` | ~5–20% |
| `grade-R` | Rare/common | jade `#a8d8c0` | rest |

Badge = grade letter + tier caption, glowing border/shadow tinted to the grade var. **Occurrence % must come from real engine distribution data — never invent it.** Map real percentile → tier by the thresholds above.

## 5. Foil text effect (pure CSS, the money detail)

`background-clip:text` over a multi-stop gold gradient with a white blowout at ~50%, `background-size:250%`, animated `background-position` sweep (`@keyframes foilSweep`, 5.5s linear). Class `.foil` on any hero text. That moving highlight reads as metallic foil — no image, no cost.

## 6. Luxury texture & border (no image)

- **Micro-weave:** two `repeating-linear-gradient` at ±45° (thin light + thin dark lines, 6px pitch) on `::before`, `mix-blend-mode:overlay`, opacity .5. Reads as fine paper/foil grain.
- **Corner glow:** `radial-gradient` gold at top & bottom on the base background.
- **Double border:** `::after` inset 12px, gold hairline + `inset box-shadow` (dark + faint gold bloom) = engraved luxury frame.

## 7. Card templates (fill data → card)

All are filled examples in `share-cards.html`; copy the block, swap text.

1. **Chart Archetype (magazine spec):** hero name (foil) + rows — 典籍原文 (classic quote) / 核心条件 / 加分 / 破格 / 人话翻译 / 出现率 bar. The signature viral layout.
2. **MBTI × Day Master:** symbol glyph (甲木🌳 / 丙火☀️ / 辛金💎 …) + stem + MBTI + keyword chips + symbol line + love style. `.rc-symbol` / `.rc-kw` / `.rc-love`.
3. **Life K-line:** inline SVG fortune curve over a grid, peak marker, decade tags, one 人话 row. `.kline-wrap`. **Feed the real luck-cycle values into the SVG path.**
4. **Compatibility:** two stems ✦ linked, big score, jade metric bars. `.compat-*`.

Day-master → symbol reference: 甲木 tree 🌳 · 乙木 vine 🌿 · 丙火 sun ☀️ · 丁火 flame 🔥 · 戊土 mountain ⛰️ · 己土 field 🌾 · 庚金 blade ⚔️ · 辛金 jewel 💎 · 壬水 ocean 🌊 · 癸水 rain 🌧️.

## 8. ComfyUI background prompts (optional · generate once, reuse forever · zero per-card cost)

Generate 1080×1920 (or 1080×1080) PNGs on the local ComfyUI (RealVisXL / any SDXL). Set as `background-image` behind `.rc-lux > *` (keep CSS text on top). **One generation covers all cards of that tier — cost per card = ¥0.**

**A · Luxury UR/SSR background**
```
luxury dark background, deep espresso black to warm charcoal gradient, subtle
gold foil filigree in corners, fine paper grain texture, faint art-deco
ornamental border, ultra-premium tarot / gacha ultra-rare card backdrop,
soft central vignette, elegant, no text, no characters, no logo,
1080x1920, 9:16 vertical
Negative: text, watermark, people, faces, bright colors, clutter, low-res, jpeg artifacts
```

**A · Luxury SR (cooler)**
```
dark luxury card background, near-black with deep sapphire-brown undertone,
faint cool-gold constellation dust, thin engraved frame, matte texture,
premium collectible card backdrop, centered soft glow, no text, no characters,
1080x1920 vertical
Negative: text, watermark, people, logos, saturated, busy, low-res
```

**B · Jade brand background**
```
soft off-white cream paper background (#faf8f5), very subtle jade-green misty
glow at top center, faint gold hairline flourish, minimal elegant east-asian
stationery texture, calm premium wellness brand, lots of empty space,
no text, no characters, no logo, 1080x1920 vertical
Negative: text, watermark, people, dark, heavy pattern, saturated, low-res
```

**Symbol-art (per day master, optional hero glyph replacing emoji)**
```
single elegant gold line-art illustration of a {ancient pine tree / rising sun /
polished jade / mountain}, minimal, centered, on transparent, thin gold strokes,
luxury tarot symbol, no text, 800x800
Negative: text, color fill, background, people, clutter
```

Workflow: generate → put PNGs in `/assets/share-bg/` → reference per tier. Guard the generation (no unauth `/api/generate-bg` endpoint — known spend leak).

## 9. Compliance (non-negotiable, must not break visuals)

- **Zero fabricated copy.** Every value (archetype name, 典籍 quote, occurrence %, K-line points, compat score) = real engine output. If the engine can't produce it, omit the row — don't invent.
- **AI label** small in footer on every card: `AI-generated · for self-reflection`. Present but never dominant.
- **Entertainment / self-reflection framing**, not prediction. No medical/financial/absolute claims.
- Occurrence % → tier mapping uses real distribution (§4), never chosen for hype.

## 10. Pitfalls

- `background-clip:text` needs `-webkit-` prefix + `color:transparent` (or `-webkit-text-fill-color`) or the fill shows solid. Included.
- **Screenshot fidelity:** foil animation is decorative — a still screenshot still looks metallic because of the gradient, so no dependence on motion.
- CJK glyphs need Noto Serif SC loaded before capture; wait for `document.fonts.ready` if auto-rendering to image (html2canvas / Satori).
- Emoji glyphs render differently per OS — for production hero symbols prefer the ComfyUI gold line-art (§8) over emoji to stay on-brand and consistent.
- Rarity badge colors are the *only* off-palette hues allowed; don't let them leak into body text.
- Keep text as real DOM (not baked into bg image) so it stays crisp and localizable (EN/KR/CN).
