/* try-it-out.js — live health probe for .try-it-out blocks.
 *
 * Every .try-it-out__card that carries a data-try-probe attribute is a URL
 * the runtime should ping periodically. If the fetch resolves with a
 * non-network error (any HTTP response counts as «alive»), the card gets
 * data-try-status="online"; on network failure it gets "offline". The
 * initial state is "unknown", so the block renders sanely even without JS
 * or before the first probe returns.
 *
 * We deliberately don't `no-cors` — Connexion's /openapi.json ships
 * `Access-Control-Allow-Origin: *`, so a plain GET succeeds and we can
 * distinguish «running» from «down» reliably. Probes are throttled to
 * once per 8 s and skipped when the tab is hidden.
 */

(function () {
  'use strict';

  const PROBE_INTERVAL_MS = 8000;
  const PROBE_TIMEOUT_MS = 2500;

  function setStatus(card, status) {
    if (card.dataset.tryStatus === status) return;
    card.dataset.tryStatus = status;
    const label = card.querySelector('.try-it-out__status');
    if (label) {
      label.textContent = status === 'online' ? 'ready' :
                          status === 'offline' ? 'not running' : 'checking…';
      label.setAttribute('aria-label',
        status === 'online' ? 'Mock is running' :
        status === 'offline' ? 'Mock is not running — start with make api-mock' :
        'Checking mock status…');
    }
  }

  async function probe(card) {
    const url = card.dataset.tryProbe;
    if (!url) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        signal: controller.signal,
      });
      setStatus(card, 'online');
    } catch (_err) {
      setStatus(card, 'offline');
    } finally {
      clearTimeout(timeout);
    }
  }

  function init() {
    const cards = Array.from(document.querySelectorAll('.try-it-out__card[data-try-probe]'));
    if (!cards.length) return;
    cards.forEach((c) => setStatus(c, 'unknown'));

    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      cards.forEach(probe);
    };
    tick();
    setInterval(tick, PROBE_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') tick();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
