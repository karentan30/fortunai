# Runae PWA — Install & Wiring Guide

PWA base for **Runae** (runae.app) so users can "Add to Home Screen" and use it like an app.
All files live at the repo root and are served from `/`.

## Files in this PWA base

| File | Serves at | Purpose |
|------|-----------|---------|
| `manifest.json` | `/manifest.json` | App metadata (name, theme, start_url, icons) |
| `sw.js` | `/sw.js` | Service worker — offline cache + push scaffold. **Scope `/` (whole site)** |
| `offline.html` | `/offline.html` | Offline fallback page (jade/gold, English) |
| `icon.svg` | `/icon.svg` | Vector app icon — jade `#5bbfa0` base, gold `#c9a84c` 缘 |
| `icon-192.png` | `/icon-192.png` | 192×192 raster icon (rasterized from `icon.svg`) |
| `icon-512.png` | `/icon-512.png` | 512×512 raster icon |
| `apple-touch-icon.png` | `/apple-touch-icon.png` | 180×180 opaque icon for iOS home screen |

Key manifest fields: `name` "Runae — Eastern Astrology & Self-Discovery" · `short_name` "Runae" ·
`display` standalone · `orientation` portrait · `theme_color` `#5bbfa0` · `background_color` `#faf8f5` ·
`start_url` `/pages/home-en.html`.

---

## How to wire it into a page (homepage owner: add these)

The homepage (`/pages/home-en.html`) needs three things in `<head>`, plus a registration snippet.

**1. Manifest + theme + iOS meta:**
```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#5bbfa0">
<!-- iOS: standalone + status bar + home-screen icon (must be PNG) -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Runae">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

**2. Register the service worker** (before `</body>`):
```html
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .catch(function (e) { console.warn('SW registration failed:', e); });
    });
  }
</script>
```
`/sw.js` sits at the root, so its scope is `/` and it controls the whole site — register it once (homepage is fine).

---

## Caching strategy (what `sw.js` does)

- **Static assets** (css/js/img/svg/fonts) → **cache-first**, lazily populated. Fast + works offline.
- **`/api/*`** → **NETWORK-ONLY, never cached.** Enforced by an early `if (isApiRequest(url))` branch that
  returns `fetch(req)` before any cache logic runs — so dynamic BaZi/fortune results and **paid content are
  never served stale**.
- **Navigations (HTML)** → network-first → cached copy → `/offline.html` if both fail.
- **activate** clears any cache whose name ≠ current version.
- **Cache bust:** bump `CACHE_VERSION` in `sw.js` (`runae-v1` → `runae-v2`) and the old cache is deleted on next activate.

---

## Icons — current state & re-export

`icon-192.png`, `icon-512.png`, and `apple-touch-icon.png` were **rasterized from `icon.svg`** via ImageMagick
and are production-usable now. `icon.svg` is the source of truth — if you restyle it, re-export:

```bash
FONT="/System/Library/Fonts/Supplemental/Songti.ttc"   # any CJK font

# 512 + 192 (transparent rounded-square, gold 缘)
magick -size 512x512 xc:none \
  \( -size 512x512 xc:none -fill "#5bbfa0" -draw "roundrectangle 0,0 511,511 112,112" \) -composite \
  -font "$FONT" -pointsize 297 -fill "#c9a84c" -gravity center -annotate +0+0 "缘" icon-512.png
magick -size 192x192 xc:none \
  \( -size 192x192 xc:none -fill "#5bbfa0" -draw "roundrectangle 0,0 191,191 42,42" \) -composite \
  -font "$FONT" -pointsize 111 -fill "#c9a84c" -gravity center -annotate +0+0 "缘" icon-192.png

# apple-touch: OPAQUE jade square, no transparency (iOS rounds corners itself, dislikes alpha)
magick -size 180x180 xc:"#5bbfa0" \
  -font "$FONT" -pointsize 104 -fill "#c9a84c" -gravity center -annotate +0+0 "缘" apple-touch-icon.png
```
(If you have `rsvg-convert`/`cairosvg`/Inkscape with the CJK font installed, you can instead render straight from
`icon.svg`. Plain `magick icon.svg …` fails on this machine because IM can't resolve the SVG's CJK `<text>` font —
that's why the commands above draw the glyph directly with `-annotate`.)

**Why apple-touch-icon must be PNG:** iOS Safari ignores SVG for home-screen icons. Keep a real PNG at
`/apple-touch-icon.png` (already present).

---

## iOS PWA limitations (know before QA)

- **No `beforeinstallprompt`.** iOS has no auto install prompt — users add manually: **Share → Add to Home Screen**.
  Consider a small in-page hint on iOS Safari.
- **Home-screen icon must be PNG** (`apple-touch-icon.png`) — SVG is ignored.
- Push notifications on iOS require **iOS 16.4+** and only work **after** the site is installed to the Home Screen.
- iOS gives a PWA limited storage and may evict the SW cache after periods of non-use.
- `theme_color` styling of the status bar is partial on iOS; use the `apple-mobile-web-app-status-bar-style` meta.

---

## Future: daily-fortune push notifications

`sw.js` already ships **`push` + `notificationclick` handlers** (render + focus/open the target URL). It's inert —
no push service is wired. To turn it on later:
1. Generate **VAPID** keys; expose the public key to the client.
2. Client: `registration.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:<vapidPublicKey> })`,
   then POST the subscription to the backend.
3. Backend: send Web Push payloads `{ title, body, url, icon }`; the SW renders them and routes clicks.

---

## How to test (Chrome DevTools)

1. Serve the repo root over http(s) (SW needs a secure context; `localhost` counts).
   e.g. `npx serve .` or `python3 -m http.server`.
2. Open **DevTools → Application**:
   - **Manifest** — verify name, theme `#5bbfa0`, `start_url` `/pages/home-en.html`, icons load, no errors.
   - **Service Workers** — confirm `sw.js` is *activated and running*; use **Update on reload** while developing.
   - **Cache Storage** — after a load you should see `runae-static-runae-v1`.
3. **Offline test:** Application → Service Workers → check **Offline**, then reload → should show `/offline.html`.
4. **/api not cached:** with **Offline** on, hit any `/api/*` route → it should **fail** (never served from cache). ✔
5. **Installability:** address-bar install icon appears; Lighthouse → PWA category to audit.

---

## ⚠️ Migration note (was 善缘 / ShenYuan)

`manifest.json` and `sw.js` previously held the old dark-theme **善缘** config and have been replaced with
the Runae versions above. Two existing pages still `<link>` the manifest and will now pick up Runae branding:
- `pages/daily-en.html`
- `pages/daily.html`

No SW was registered anywhere on the old site, so activating `/sw.js` on Runae's homepage is the first SW to go live
(clean start — the new `activate` handler also clears any stale `shenyuan-v2` cache from earlier experiments).
Old icons remain untouched at `assets/icons/`.
