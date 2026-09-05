/*
 * Runae · Five-Element Shop module (EN)
 * ---------------------------------------------------------------------------
 * Turns a reader's Five-Element (Wu Xing) balance into a small set of
 * "Recommended for your chart" decorative/wellness product cards, each routed
 * through a config-driven, Skimlinks-ready affiliate layer.
 *
 * Mirrors the color-dna `lib/affiliate.ts` pattern: PROVIDER defaults to
 * "direct" (real, working merchant link — but UN-monetized) until Karen's
 * Skimlinks publisher ID is approved. No other change needed to go live.
 *
 * 🔒 COMPLIANCE (hard red line): every product is framed as decorative /
 * cultural / wellness ONLY. No claim that any item changes fortune, "activates"
 * luck, protects, heals, attracts wealth, or guarantees any outcome. A light
 * disclaimer is always rendered.
 *
 * 🔴 KAREN — when Skimlinks (ShopYourLikes) is approved:
 *   1. set SKIMLINKS_PUBLISHER_ID below (or window.RUNAE_SKIMLINKS_ID before load)
 *   2. set PROVIDER = 'skimlinks' (or window.RUNAE_AFFILIATE_PROVIDER)
 *   3. replace the placeholder `merchant` URLs in WUXING_PRODUCTS with the real
 *      merchant/product pages you choose (structure is already correct).
 *   …every card's link becomes a tracked, revenue-earning link.
 */
(function (global) {
  'use strict';

  // ── Affiliate config layer (color-dna parity) ─────────────────────────────
  // Flip to 'skimlinks' once the publisher ID is filled in.
  var PROVIDER = global.RUNAE_AFFILIATE_PROVIDER || 'direct'; // 'direct' | 'skimlinks'

  // Skimlinks publisher ID (a.k.a. ShopYourLikes / "xcust" account). Empty until approved.
  var SKIMLINKS_PUBLISHER_ID = global.RUNAE_SKIMLINKS_ID || '';

  // Skimlinks redirect base. subid ('xcust') carries our attribution back.
  var SKIMLINKS_BASE = 'https://go.skimresources.com';

  // True only when links actually earn — gate any affiliate-disclosure copy on this.
  function affiliateActive() {
    return PROVIDER === 'skimlinks' && !!SKIMLINKS_PUBLISHER_ID;
  }

  /**
   * Wrap a merchant URL into a monetizable affiliate link.
   * @param {string} merchantUrl real product/merchant page
   * @param {string} [subid] attribution tag, e.g. "runae-metal-white_quartz"
   */
  function affiliateLink(merchantUrl, subid) {
    if (PROVIDER === 'skimlinks' && SKIMLINKS_PUBLISHER_ID) {
      var u = SKIMLINKS_BASE + '?id=' + encodeURIComponent(SKIMLINKS_PUBLISHER_ID) +
        '&url=' + encodeURIComponent(merchantUrl);
      if (subid) u += '&xcust=' + encodeURIComponent(subid);
      return u;
    }
    // direct (un-monetized) fallback — still a valid link so the page works today.
    return merchantUrl;
  }

  // ── Five-Element → product map ────────────────────────────────────────────
  // Keyed by the weak/lacking element. Copy is decorative/cultural/wellness only.
  // `merchant` = placeholder structure (real merchant page). `sku` feeds the subid.
  var WUXING_PRODUCTS = {
    metal: {
      title: 'Metal',
      note: 'Cool-toned pieces some people simply enjoy keeping around when their chart leans light on Metal.',
      items: [
        { sku: 'clear_quartz_point', name: 'Clear Quartz Point', desc: 'Faceted decorative crystal for a shelf or desk.', merchant: 'https://www.etsy.com/search?q=clear+quartz+point' },
        { sku: 'stainless_steel_cuff', name: 'Brushed Steel Cuff', desc: 'Minimal stainless-steel bracelet.', merchant: 'https://www.etsy.com/search?q=stainless+steel+cuff+bracelet' },
        { sku: 'sterling_silver_band', name: 'Sterling Silver Band', desc: 'Plain polished silver ring.', merchant: 'https://www.etsy.com/search?q=sterling+silver+band+ring' }
      ]
    },
    wood: {
      title: 'Wood',
      note: 'Green and wooden pieces that bring a bit of the outdoors in — chosen simply because you like them.',
      items: [
        { sku: 'green_phantom_bracelet', name: 'Green Phantom Bracelet', desc: 'Green quartz bead bracelet.', merchant: 'https://www.etsy.com/search?q=green+phantom+quartz+bracelet' },
        { sku: 'sandalwood_mala', name: 'Sandalwood Bead Mala', desc: 'Wooden 108-bead strand.', merchant: 'https://www.etsy.com/search?q=sandalwood+mala+bracelet' },
        { sku: 'aventurine_tumble', name: 'Green Aventurine Stone', desc: 'Polished green tumble stone.', merchant: 'https://www.etsy.com/search?q=green+aventurine+tumbled+stone' }
      ]
    },
    water: {
      title: 'Water',
      note: 'Deep blues and blacks — pieces some people gravitate to when their chart runs light on Water.',
      items: [
        { sku: 'obsidian_bracelet', name: 'Black Obsidian Bracelet', desc: 'Polished black bead bracelet.', merchant: 'https://www.etsy.com/search?q=black+obsidian+bracelet' },
        { sku: 'aquamarine_bracelet', name: 'Aquamarine Bracelet', desc: 'Pale-blue bead bracelet.', merchant: 'https://www.etsy.com/search?q=aquamarine+bracelet' },
        { sku: 'blue_apatite_tumble', name: 'Blue Apatite Stone', desc: 'Polished blue tumble stone.', merchant: 'https://www.etsy.com/search?q=blue+apatite+tumbled+stone' }
      ]
    },
    fire: {
      title: 'Fire',
      note: 'Warm reds — decorative pieces people enjoy when their chart leans light on Fire.',
      items: [
        { sku: 'red_agate_bracelet', name: 'Red Agate Bracelet', desc: 'Deep-red bead bracelet.', merchant: 'https://www.etsy.com/search?q=red+agate+bracelet' },
        { sku: 'garnet_bracelet', name: 'Garnet Bead Bracelet', desc: 'Dark-red garnet strand.', merchant: 'https://www.etsy.com/search?q=garnet+bracelet' },
        { sku: 'carnelian_tumble', name: 'Carnelian Stone', desc: 'Polished orange-red tumble stone.', merchant: 'https://www.etsy.com/search?q=carnelian+tumbled+stone' }
      ]
    },
    earth: {
      title: 'Earth',
      note: 'Warm ochre and amber tones — pieces some like keeping close when their chart runs light on Earth.',
      items: [
        { sku: 'citrine_cluster', name: 'Citrine Cluster', desc: 'Golden-yellow decorative crystal.', merchant: 'https://www.etsy.com/search?q=citrine+cluster' },
        { sku: 'tiger_eye_bracelet', name: "Tiger's Eye Bracelet", desc: 'Amber-brown bead bracelet.', merchant: 'https://www.etsy.com/search?q=tiger+eye+bracelet' },
        { sku: 'yellow_jasper_tumble', name: 'Yellow Jasper Stone', desc: 'Polished ochre tumble stone.', merchant: 'https://www.etsy.com/search?q=yellow+jasper+tumbled+stone' }
      ]
    }
  };

  // Map internal element keys ← the report's Chinese element keys / EN names.
  var ZH_TO_KEY = { '金': 'metal', '木': 'wood', '水': 'water', '火': 'fire', '土': 'earth' };
  var EN_TO_KEY = { Metal: 'metal', Wood: 'wood', Water: 'water', Fire: 'fire', Earth: 'earth' };

  /**
   * Derive the weakest element key(s) from whatever the report already computed.
   * Accepts:
   *   - window._baziChartData.missing  → ['金', ...]  (preferred, engine-precise)
   *   - parsed.elements                → { '木':n, '火':n, ... } percentages
   * Returns an array of internal keys (['metal', ...]); [] if undeterminable.
   */
  function deriveWeakElements(parsed) {
    // 1) Engine-provided "missing" list (Chinese keys) — most accurate.
    try {
      var cd = global._baziChartData;
      if (cd && Array.isArray(cd.missing) && cd.missing.length) {
        var fromMissing = cd.missing.map(function (m) { return ZH_TO_KEY[m] || EN_TO_KEY[m]; })
          .filter(Boolean);
        if (fromMissing.length) return dedupe(fromMissing);
      }
    } catch (e) {}

    // 2) Fall back to the percentage map the overview already built.
    if (parsed && parsed.elements && typeof parsed.elements === 'object') {
      var entries = Object.keys(parsed.elements).map(function (k) {
        return { key: ZH_TO_KEY[k] || EN_TO_KEY[k], val: Number(parsed.elements[k]) || 0 };
      }).filter(function (e) { return !!e.key; });
      if (entries.length) {
        entries.sort(function (a, b) { return a.val - b.val; });
        var lowest = entries[0].val;
        // Treat a truly absent (0%) or clearly-lowest element as the weak one.
        var weak = entries.filter(function (e) { return e.val === 0; }).map(function (e) { return e.key; });
        if (!weak.length) weak = [entries[0].key];
        return dedupe(weak);
      }
    }
    return [];
  }

  function dedupe(arr) {
    var seen = {}, out = [];
    arr.forEach(function (k) { if (k && !seen[k]) { seen[k] = 1; out.push(k); } });
    return out;
  }

  function track(name, data) {
    try {
      if (global.SY && typeof global.SY.track === 'function') { global.SY.track(name, data); return; }
      if (typeof global.posthog !== 'undefined' && global.posthog.capture) { global.posthog.capture(name, data); return; }
      if (typeof global.gtag === 'function') { global.gtag('event', name, data || {}); return; }
    } catch (e) {}
  }

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /**
   * Build the "Recommended for your chart" card block as an HTML string.
   * @param {Object} parsed    the report's parsed object (may carry .elements)
   * @param {Object} [opts]    { premium:boolean }  premium=true shows the fuller set
   * @returns {string} HTML ('' if no element can be determined — safe no-op)
   */
  function buildWuxingShop(parsed, opts) {
    opts = opts || {};
    var keys = deriveWeakElements(parsed);
    if (!keys.length) return ''; // graceful: elements empty → render nothing

    // Free layer: top weak element only, 2 cards. Premium: up to 2 elements, 3 cards each.
    var maxEls = opts.premium ? 2 : 1;
    var perEl = opts.premium ? 3 : 2;
    keys = keys.slice(0, maxEls);

    var cards = '';
    var count = 0;
    keys.forEach(function (key) {
      var group = WUXING_PRODUCTS[key];
      if (!group) return;
      cards += '<div style="font-size:12px;letter-spacing:.06em;color:var(--gold-deep);margin:14px 2px 4px">' +
        'Your chart leans light on <b>' + esc(group.title) + '</b></div>';
      cards += '<div style="font-size:12px;color:var(--sub-text);line-height:1.6;margin:0 2px 10px">' + esc(group.note) + '</div>';
      group.items.slice(0, perEl).forEach(function (it) {
        var subid = 'runae-' + key + '-' + it.sku;
        var href = affiliateLink(it.merchant, subid);
        cards += '<a href="' + esc(href) + '" target="_blank" rel="nofollow sponsored noopener" ' +
          'data-shop-sku="' + esc(it.sku) + '" data-shop-el="' + esc(key) + '" ' +
          'onclick="window.__wuxingShopClick&&window.__wuxingShopClick(this)" ' +
          'style="display:flex;align-items:center;gap:12px;text-decoration:none;background:var(--card);' +
          'border:1px solid rgba(201,168,76,0.15);border-radius:12px;padding:12px 14px;margin-bottom:8px">' +
          '<div style="width:40px;height:40px;flex-shrink:0;border-radius:9px;background:linear-gradient(135deg,rgba(201,168,76,0.14),rgba(91,191,160,0.10));' +
          'display:flex;align-items:center;justify-content:center;font-size:18px">◈</div>' +
          '<div style="flex:1;min-width:0">' +
          '<div style="font-size:14px;color:var(--ink-text);font-weight:500">' + esc(it.name) + '</div>' +
          '<div style="font-size:12px;color:var(--sub-text);line-height:1.5">' + esc(it.desc) + '</div>' +
          '</div>' +
          '<div style="font-size:12px;color:var(--gold-deep);white-space:nowrap">Shop →</div>' +
          '</a>';
        count++;
      });
    });

    if (!count) return '';

    var discl = 'For personal enjoyment; not a guarantee of outcomes. Decorative and cultural items only — not medical, spiritual, or financial advice.';
    if (affiliateActive()) {
      discl = 'Some links may earn us a small commission at no cost to you. ' + discl;
    }

    track('wuxing_shop_view', { elements: keys.join(','), premium: !!opts.premium });

    return '<div id="wuxingShop" style="padding:18px 16px 4px">' +
      '<div style="text-align:center;font-size:13px;color:var(--gold-light);letter-spacing:.06em;margin-bottom:4px">— Recommended for your chart —</div>' +
      '<div style="text-align:center;font-size:11px;color:var(--sub-text);margin-bottom:12px">Pieces people enjoy that echo your elemental palette</div>' +
      cards +
      '<div style="font-size:11px;color:var(--sub-text);line-height:1.6;text-align:center;margin-top:8px;padding:0 4px">' + esc(discl) + '</div>' +
      '</div>';
  }

  // Click handler (attribution ping). Never blocks navigation.
  global.__wuxingShopClick = function (a) {
    try {
      track('wuxing_shop_click', {
        sku: a.getAttribute('data-shop-sku'),
        element: a.getAttribute('data-shop-el'),
        monetized: affiliateActive()
      });
    } catch (e) {}
  };

  global.RunaeShop = {
    buildWuxingShop: buildWuxingShop,
    affiliateLink: affiliateLink,
    affiliateActive: affiliateActive,
    deriveWeakElements: deriveWeakElements,
    PROVIDER: PROVIDER,
    WUXING_PRODUCTS: WUXING_PRODUCTS
  };
})(typeof window !== 'undefined' ? window : this);
