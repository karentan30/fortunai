'use strict';
// Presentation only: tags rendered cards with data-element (wood/fire/earth/metal/water)
// from the 日主 character already on screen, so CSS can tint them. Reads no data, sends nothing.
(() => {
  const map = {甲:'wood',乙:'wood',丙:'fire',丁:'fire',戊:'earth',己:'earth',庚:'metal',辛:'metal',壬:'water',癸:'water'};
  const pairs = [['.person-card', '.person-stem'], ['.reading-card', '.day-master']];
  function tag(root) {
    for (const [card, stem] of pairs) {
      for (const el of root.querySelectorAll(card)) {
        const ch = (el.querySelector(stem)?.textContent || '').trim().charAt(0);
        const element = map[ch];
        if (element && el.dataset.element !== element) el.dataset.element = element;
        else if (!element && el.dataset.element) delete el.dataset.element;
      }
    }
  }
  function start() {
    tag(document);
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; tag(document); });
    }).observe(document.body, {childList: true, subtree: true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
