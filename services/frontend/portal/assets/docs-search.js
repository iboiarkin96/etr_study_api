"use strict";

/**
 * Docs portal search — lazy bundle.
 *
 * Loaded on-demand by docs-nav.js the first time the user interacts with the
 * search input (focus / pointerdown / keydown). Until then this code is not
 * parsed or executed, which keeps every page's first-paint cost ~30 KB lighter.
 *
 * Public surface: `window.__DOCS_SEARCH__.mount({ input, results, wrap, fromDir,
 * isPublicAudience, resultsId })`. The DOM scaffolding (input + results UL) is
 * built eagerly by docs-nav.js so layout is stable before this bundle loads —
 * this module only attaches event handlers and rendering logic.
 *
 * External globals used (provided by docs-nav.js, same global scope):
 *   - DOCS_ASSET_DIR        — resolved assets directory URL
 *   - relHref(fromDir, rel) — produce a relative URL between docs pages
 *   - docsQuickLinks(fromDir) — quick links shown in empty-state
 *   - isDocsPublicAudience()  — public vs internal audience check
 */
(function () {
  const DOCS_SEARCH_MAX_RESULTS = 10;
  const DOCS_SEARCH_DEBOUNCE_MS = 120;
  const DOCS_SEARCH_MAX_PREFIX_EXPANSIONS = 24;
  const DOCS_SEARCH_SUCCESS_WINDOW_MS = 60_000;

  let docsSearchIndexPromise = null;
  let docsSearchSessionId = null;
  let docsSearchQuerySeq = 0;

  function docsSearchTelemetryConfig() {
    const meta = document.querySelector('meta[name="docs-search-telemetry-endpoint"]');
    const endpointFromMeta = meta ? String(meta.getAttribute("content") || "").trim() : "";
    if (endpointFromMeta) {
      return { endpoint: endpointFromMeta };
    }
    const host = window.location.hostname;
    const isLocalHost = host === "127.0.0.1" || host === "localhost";
    if (isLocalHost) {
      return { endpoint: `${window.location.protocol}//${host}:8000/internal/telemetry/docs-search` };
    }
    return { endpoint: "" };
  }

  function getDocsSearchSessionId() {
    if (!docsSearchSessionId) {
      docsSearchSessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
    return docsSearchSessionId;
  }

  function makeDocsSearchQueryId() {
    docsSearchQuerySeq += 1;
    return `q_${Date.now()}_${docsSearchQuerySeq}`;
  }

  function emitDocsSearchTelemetry(eventName, payload) {
    const body = {
      event: eventName,
      emitted_at_ms: Date.now(),
      page_path: window.location.pathname,
      ...payload,
    };

    document.dispatchEvent(
      new CustomEvent("docs-search-telemetry", {
        detail: body,
      })
    );

    const { endpoint } = docsSearchTelemetryConfig();
    if (!endpoint) {
      return;
    }

    const serialized = JSON.stringify(body);
    fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: serialized,
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => { });
  }

  function docsSearchIndexUrl() {
    const fileName = isDocsPublicAudience()
      ? "search-index-public.json"
      : "search-index.json";
    return DOCS_ASSET_DIR + fileName;
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s/_-]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenizeSearchText(value) {
    const normalized = normalizeSearchText(value);
    if (!normalized) {
      return [];
    }
    return normalized.match(/[a-z0-9]+/g) || [];
  }

  async function loadDocsSearchIndex() {
    if (!docsSearchIndexPromise) {
      docsSearchIndexPromise = fetch(docsSearchIndexUrl(), {
        credentials: "same-origin",
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`search-index load failed: ${response.status}`);
          }
          return response.json();
        })
        .then((indexData) => {
          if (!indexData || typeof indexData !== "object") {
            return null;
          }
          if (!Array.isArray(indexData.docs) || typeof indexData.postings !== "object") {
            return null;
          }
          const docs = indexData.docs.map((doc) => ({
            id: Number(doc.id),
            title: String(doc.title || ""),
            url: String(doc.url || ""),
            section: String(doc.section || ""),
            preview: String(doc.preview || ""),
            contentLen: Number(doc.content_len || 1),
            titleNorm: normalizeSearchText(doc.title || ""),
            urlNorm: normalizeSearchText(doc.url || ""),
            sectionNorm: normalizeSearchText(doc.section || ""),
          }));
          const vocabulary = Object.keys(indexData.postings);
          const avgContentLen =
            Number(indexData?.meta?.avg_content_len) > 0 ? Number(indexData.meta.avg_content_len) : 1;
          return {
            docs,
            postings: indexData.postings,
            docFreq: indexData.doc_freq || {},
            docCount: docs.length,
            avgContentLen,
            vocabulary,
          };
        })
        .catch((error) => {
          docsSearchIndexPromise = null;
          throw error;
        });
    }
    return docsSearchIndexPromise;
  }

  function expandTokenCandidates(token, vocabulary, isLastToken) {
    if (!token) {
      return [];
    }
    if (!isLastToken || token.length < 3) {
      return [token];
    }
    const expanded = [token];
    for (const candidate of vocabulary) {
      if (candidate !== token && candidate.startsWith(token)) {
        expanded.push(candidate);
        if (expanded.length >= DOCS_SEARCH_MAX_PREFIX_EXPANSIONS) {
          break;
        }
      }
    }
    return expanded;
  }

  function idf(docCount, docFreq) {
    return Math.log(1 + (docCount + 1) / (docFreq + 0.5));
  }

  function tf(tfValue) {
    return Math.log(1 + tfValue);
  }

  function runDocsSearch(indexData, query) {
    if (!indexData || !Array.isArray(indexData.docs) || indexData.docs.length === 0) {
      return [];
    }
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) {
      return [];
    }
    const queryTokens = tokenizeSearchText(normalizedQuery);
    if (queryTokens.length === 0) {
      return [];
    }

    const candidates = new Map();
    queryTokens.forEach((token, tokenIndex) => {
      const tokenVariants = expandTokenCandidates(
        token,
        indexData.vocabulary,
        tokenIndex === queryTokens.length - 1
      );
      tokenVariants.forEach((variant) => {
        const postings = indexData.postings[variant];
        if (!Array.isArray(postings)) {
          return;
        }
        const tokenIdf = idf(indexData.docCount, Number(indexData.docFreq[variant] || 0));
        postings.forEach((posting) => {
          const [docId, tfTitle, tfUrl, tfSection, tfContent] = posting;
          const fieldScore =
            8.0 * tf(tfTitle || 0) +
            4.0 * tf(tfUrl || 0) +
            2.0 * tf(tfSection || 0) +
            1.4 * tf(tfContent || 0);
          if (fieldScore <= 0) {
            return;
          }
          const prev = candidates.get(docId) || 0;
          candidates.set(docId, prev + tokenIdf * fieldScore);
        });
      });
    });

    const scored = [];
    candidates.forEach((baseScore, docId) => {
      const entry = indexData.docs[docId];
      if (!entry) {
        return;
      }
      let score = baseScore;

      const allTokensInTitle = queryTokens.every((token) => entry.titleNorm.includes(token));
      const allTokensInUrl = queryTokens.every((token) => entry.urlNorm.includes(token));
      if (allTokensInTitle) {
        score += 9;
      }
      if (allTokensInUrl) {
        score += 4;
      }
      if (entry.titleNorm.includes(normalizedQuery)) {
        score += 12;
      }
      if (entry.urlNorm.includes(normalizedQuery)) {
        score += 6;
      }
      if (entry.titleNorm.startsWith(normalizedQuery)) {
        score += 5;
      }
      if (entry.sectionNorm === normalizedQuery) {
        score += 3;
      }

      const lenRatio = entry.contentLen / Math.max(indexData.avgContentLen, 1);
      const lengthNorm = 1 / (1 + 0.08 * Math.max(0, lenRatio - 1));
      score *= lengthNorm;

      if (score > 0) {
        scored.push({ entry, score, docId });
      }
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.docId !== b.docId) {
        return a.docId - b.docId;
      }
      return a.entry.title.localeCompare(b.entry.title);
    });
    return scored.slice(0, DOCS_SEARCH_MAX_RESULTS).map((item) => item.entry);
  }

  function buildSearchResultHref(fromDir, targetUrl) {
    const rel = String(targetUrl || "").replace(/^\/+/, "");
    if (!rel) {
      return "#";
    }
    return relHref(fromDir, rel);
  }

  function docsSearchResultKind(url) {
    const safeUrl = String(url || "").toLowerCase();
    if (!safeUrl) {
      return "Docs";
    }
    if (safeUrl.startsWith("internal/catalog/api/code-reference/")) {
      return "Python API";
    }
    if (safeUrl.startsWith("public/reference/api/")) {
      return "OpenAPI";
    }
    if (safeUrl.startsWith("internal/governance/adr/")) {
      return "ADR";
    }
    if (safeUrl.startsWith("runbooks/")) {
      return "Runbook";
    }
    if (safeUrl.startsWith("internal/handbook/howto/")) {
      return "How-to";
    }
    if (safeUrl.startsWith("internal/")) {
      return "Internal";
    }
    if (safeUrl.startsWith("internal/governance/audits/")) {
      return "Audit";
    }
    return "Docs";
  }

  function escapeRegex(text) {
    return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function appendSearchHighlightedText(target, text, queryText) {
    const raw = String(text || "");
    const tokens = tokenizeSearchText(queryText).filter((t) => t.length >= 2);
    if (!raw || tokens.length === 0) {
      target.textContent = raw;
      return;
    }
    const pattern = tokens.map((token) => escapeRegex(token)).join("|");
    if (!pattern) {
      target.textContent = raw;
      return;
    }
    const regex = new RegExp(`(${pattern})`, "ig");
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(raw)) !== null) {
      if (match.index > lastIndex) {
        target.appendChild(document.createTextNode(raw.slice(lastIndex, match.index)));
      }
      const mark = document.createElement("mark");
      mark.className = "docs-search__match";
      mark.textContent = match[0];
      target.appendChild(mark);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < raw.length) {
      target.appendChild(document.createTextNode(raw.slice(lastIndex)));
    }
  }

  function levenshteinDistance(a, b) {
    const aa = String(a || "");
    const bb = String(b || "");
    if (aa === bb) {
      return 0;
    }
    if (!aa) {
      return bb.length;
    }
    if (!bb) {
      return aa.length;
    }
    const prev = new Array(bb.length + 1);
    const curr = new Array(bb.length + 1);
    for (let j = 0; j <= bb.length; j++) {
      prev[j] = j;
    }
    for (let i = 1; i <= aa.length; i++) {
      curr[0] = i;
      for (let j = 1; j <= bb.length; j++) {
        const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      }
      for (let j = 0; j <= bb.length; j++) {
        prev[j] = curr[j];
      }
    }
    return prev[bb.length];
  }

  function suggestDocsSearchQuery(rawQuery, indexData) {
    const query = normalizeSearchText(rawQuery);
    const tokens = tokenizeSearchText(query);
    if (!query || tokens.length === 0 || !indexData || !Array.isArray(indexData.vocabulary)) {
      return "";
    }
    const fixed = tokens.map((token) => {
      if (indexData.vocabulary.includes(token)) {
        return token;
      }
      const first = token[0] || "";
      const candidates = indexData.vocabulary.filter((v) =>
        Math.abs(v.length - token.length) <= 2 && (!first || v[0] === first),
      );
      let best = "";
      let bestScore = Number.POSITIVE_INFINITY;
      for (const c of candidates.slice(0, 120)) {
        const d = levenshteinDistance(token, c);
        if (d < bestScore) {
          bestScore = d;
          best = c;
        }
      }
      return bestScore <= 2 ? best : token;
    });
    const suggestion = fixed.join(" ");
    return suggestion !== query ? suggestion : "";
  }

  function docsSearchRelatedQueries(queryText) {
    const q = normalizeSearchText(queryText);
    const base = isDocsPublicAudience()
      ? ["openapi", "tutorial", "how-to", "errors", "auth", "idempotency"]
      : ["openapi", "runbook", "adr", "howto", "internal", "qa checklist"];
    if (!q) {
      return base.slice(0, 4);
    }
    const out = [];
    for (const item of base) {
      if (!item.includes(q) && !q.includes(item)) {
        out.push(item);
      }
      if (out.length >= 3) {
        break;
      }
    }
    return out;
  }

  function renderDocsSearchResults(list, results, fromDir, selectedIndex, listId, queryText = "", options = {}) {
    list.replaceChildren();
    if (!results || results.length === 0) {
      const empty = document.createElement("li");
      empty.className = "docs-search__empty";
      empty.setAttribute("role", "status");
      const safeQuery = String(queryText || "").trim();

      const title = document.createElement("p");
      title.className = "docs-search__empty-title";
      title.textContent = safeQuery ? `No matches for "${safeQuery}"` : "No matches";
      empty.appendChild(title);

      const didYouMean = options.didYouMean || "";
      if (didYouMean) {
        const did = document.createElement("p");
        did.className = "docs-search__didyoumean";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "docs-search__didyoumean-action";
        btn.setAttribute("data-search-action", "didyoumean");
        btn.setAttribute("data-search-query", didYouMean);
        btn.textContent = didYouMean;
        did.appendChild(document.createTextNode("Did you mean: "));
        did.appendChild(btn);
        did.appendChild(document.createTextNode("?"));
        empty.appendChild(did);
      }

      const tips = document.createElement("ul");
      tips.className = "docs-search__empty-tips";
      const tipsCopy = isDocsPublicAudience()
        ? ["Check spelling", "Try shorter query", "Use related terms (openapi, tutorial, errors)"]
        : ["Check spelling", "Try shorter query", "Use related terms (openapi, runbook, qa)"];
      tipsCopy.forEach((tipText) => {
        const tip = document.createElement("li");
        tip.textContent = tipText;
        tips.appendChild(tip);
      });

      const actions = document.createElement("div");
      actions.className = "docs-search__empty-actions";

      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "docs-search__empty-action docs-search__empty-action--clear";
      clearBtn.setAttribute("data-search-action", "clear");
      clearBtn.textContent = "Clear query";

      const quickLinks = docsQuickLinks(fromDir);
      actions.appendChild(clearBtn);
      quickLinks.forEach((item) => {
        const link = document.createElement("a");
        link.className = "docs-search__empty-action";
        link.href = item.href;
        link.textContent = item.label;
        actions.appendChild(link);
      });

      empty.appendChild(tips);
      const related = docsSearchRelatedQueries(safeQuery);
      if (related.length > 0) {
        const relatedWrap = document.createElement("p");
        relatedWrap.className = "docs-search__related-queries";
        relatedWrap.appendChild(document.createTextNode("Try related queries: "));
        related.forEach((term, idx) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "docs-search__related-query";
          btn.setAttribute("data-search-action", "related");
          btn.setAttribute("data-search-query", term);
          btn.textContent = term;
          relatedWrap.appendChild(btn);
          if (idx < related.length - 1) {
            relatedWrap.appendChild(document.createTextNode(" "));
          }
        });
        empty.appendChild(relatedWrap);
      }
      empty.appendChild(actions);
      list.appendChild(empty);
      return;
    }

    results.forEach((item, index) => {
      const li = document.createElement("li");
      li.setAttribute("role", "presentation");
      const link = document.createElement("a");
      const optionId = `${listId}-option-${index}`;
      link.id = optionId;
      link.className = "docs-search__result-link";
      link.setAttribute("role", "option");
      link.setAttribute("aria-selected", index === selectedIndex ? "true" : "false");
      if (index === selectedIndex) {
        link.classList.add("docs-search__result-link--active");
      }
      link.href = buildSearchResultHref(fromDir, item.url);

      const title = document.createElement("span");
      title.className = "docs-search__result-title";
      appendSearchHighlightedText(title, item.title || item.url, queryText);

      const kind = document.createElement("span");
      kind.className = "docs-search__result-kind";
      kind.textContent = docsSearchResultKind(item.url);

      const meta = document.createElement("span");
      meta.className = "docs-search__result-meta";
      const section = item.section ? `${item.section} - ` : "";
      meta.textContent = `${section}${item.url}`;

      const topRow = document.createElement("span");
      topRow.className = "docs-search__result-top";
      topRow.appendChild(title);
      topRow.appendChild(kind);

      const preview = document.createElement("span");
      preview.className = "docs-search__result-preview";
      appendSearchHighlightedText(preview, item.preview || "", queryText);

      link.appendChild(topRow);
      link.appendChild(meta);
      if (item.preview) {
        link.appendChild(preview);
      }
      li.appendChild(link);
      list.appendChild(li);
    });
  }

  function mountDocsSearchHandlers(opts) {
    const { input, results, wrap, fromDir, isPublicAudience, resultsId } = opts;

    let debounceId = null;
    let activeResults = [];
    let selectedIndex = -1;
    let activeQueryCtx = null;
    let firstQueryTs = null;
    let successTracked = false;
    let activeIndexData = null;

    function hideResults() {
      results.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      results.replaceChildren();
      activeResults = [];
      selectedIndex = -1;
      activeIndexData = null;
    }

    function resetSearchSession() {
      activeQueryCtx = null;
      firstQueryTs = null;
      successTracked = false;
    }

    function showStatus(message, isError) {
      results.hidden = false;
      input.setAttribute("aria-expanded", "true");
      input.removeAttribute("aria-activedescendant");
      const item = document.createElement("li");
      item.className = isError ? "docs-search__status docs-search__status--error" : "docs-search__status";
      item.setAttribute("role", "status");
      item.textContent = message;
      results.replaceChildren(item);
    }

    function applyKindFilter(items) {
      if (!Array.isArray(items)) {
        return [];
      }
      if (!isPublicAudience) {
        return items;
      }
      return items.filter((item) => {
        const url = String((item && item.url) || "");
        if (!url) return false;
        if (url.startsWith("public/")) return true;
        if (url === "index.html") return true;
        return false;
      });
    }

    async function searchNow(query) {
      const normalized = normalizeSearchText(query);
      if (!normalized) {
        hideResults();
        resetSearchSession();
        return;
      }
      const sessionId = getDocsSearchSessionId();
      const queryId = makeDocsSearchQueryId();
      const searchStartedAt = performance.now();
      showStatus("Searching...", false);
      try {
        const indexData = await loadDocsSearchIndex();
        activeIndexData = indexData;
        const rawResults = runDocsSearch(indexData, query);
        activeResults = applyKindFilter(rawResults);
        selectedIndex = activeResults.length > 0 ? 0 : -1;
        results.hidden = false;
        input.setAttribute("aria-expanded", "true");
        if (selectedIndex >= 0) {
          input.setAttribute("aria-activedescendant", `${resultsId}-option-${selectedIndex}`);
        } else {
          input.removeAttribute("aria-activedescendant");
        }
        const didYouMean = activeResults.length === 0 ? suggestDocsSearchQuery(query, indexData) : "";
        renderDocsSearchResults(results, activeResults, fromDir, selectedIndex, resultsId, query, { didYouMean });

        const now = Date.now();
        if (!firstQueryTs) {
          firstQueryTs = now;
        }
        const topResults = activeResults.map((item, index) => ({ rank: index + 1, url: item.url }));
        activeQueryCtx = {
          queryId,
          sessionId,
          queryStartedAt: now,
          resultCount: activeResults.length,
        };
        emitDocsSearchTelemetry("search_query", {
          session_id: sessionId,
          query_id: queryId,
          query_text: normalized,
          query_len: normalized.length,
          tokens_count: tokenizeSearchText(normalized).length,
          results_count: activeResults.length,
          latency_ms: Math.max(0, Math.round(performance.now() - searchStartedAt)),
          top_results: topResults,
        });
      } catch (error) {
        const fileProtocol = window.location.protocol === "file:";
        const message = fileProtocol
          ? "Could not load search index. Open docs over HTTP(S), not file://."
          : "Could not load search index.";
        showStatus(message, true);
        emitDocsSearchTelemetry("search_query_error", {
          session_id: sessionId,
          query_id: queryId,
          query_text: normalized,
          query_len: normalized.length,
          error: "index_load_failed",
        });
      }
    }

    function trackSearchClick(hit, rank, source) {
      if (!hit || !hit.url) {
        return;
      }

      const now = Date.now();
      const sessionId = getDocsSearchSessionId();
      const queryCtx = activeQueryCtx;
      emitDocsSearchTelemetry("search_result_click", {
        session_id: sessionId,
        query_id: queryCtx ? queryCtx.queryId : null,
        result_rank: rank,
        result_url: hit.url,
        results_count: queryCtx ? queryCtx.resultCount : activeResults.length,
        source,
      });

      if (
        queryCtx &&
        !successTracked &&
        firstQueryTs &&
        now - queryCtx.queryStartedAt <= DOCS_SEARCH_SUCCESS_WINDOW_MS
      ) {
        successTracked = true;
        emitDocsSearchTelemetry("search_success", {
          session_id: sessionId,
          query_id: queryCtx.queryId,
          result_rank: rank,
          result_url: hit.url,
          time_to_success_ms: Math.max(0, now - firstQueryTs),
          time_to_click_ms: Math.max(0, now - queryCtx.queryStartedAt),
        });
      }
    }

    input.addEventListener("focus", () => {
      loadDocsSearchIndex().catch(() => { });
    });

    input.addEventListener("input", () => {
      if (debounceId) {
        clearTimeout(debounceId);
      }
      debounceId = window.setTimeout(() => {
        searchNow(input.value);
      }, DOCS_SEARCH_DEBOUNCE_MS);
    });

    input.addEventListener("keydown", (event) => {
      if (results.hidden || activeResults.length === 0) {
        if (event.key === "Escape") {
          hideResults();
        }
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        selectedIndex = (selectedIndex + 1) % activeResults.length;
        input.setAttribute("aria-activedescendant", `${resultsId}-option-${selectedIndex}`);
        const didYouMean = activeResults.length === 0 ? suggestDocsSearchQuery(input.value, activeIndexData) : "";
        renderDocsSearchResults(results, activeResults, fromDir, selectedIndex, resultsId, input.value, { didYouMean });
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        selectedIndex = (selectedIndex - 1 + activeResults.length) % activeResults.length;
        input.setAttribute("aria-activedescendant", `${resultsId}-option-${selectedIndex}`);
        const didYouMean = activeResults.length === 0 ? suggestDocsSearchQuery(input.value, activeIndexData) : "";
        renderDocsSearchResults(results, activeResults, fromDir, selectedIndex, resultsId, input.value, { didYouMean });
        return;
      }
      if (event.key === "Enter" && selectedIndex >= 0) {
        event.preventDefault();
        const hit = activeResults[selectedIndex];
        if (hit && hit.url) {
          trackSearchClick(hit, selectedIndex + 1, "keyboard_enter");
          window.location.assign(buildSearchResultHref(fromDir, hit.url));
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        hideResults();
      }
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      const clearAction =
        target && target.closest ? target.closest('.docs-search__empty-action[data-search-action="clear"]') : null;
      if (clearAction && wrap.contains(clearAction)) {
        event.preventDefault();
        input.value = "";
        hideResults();
        resetSearchSession();
        input.focus();
        return;
      }
      const queryAction =
        target && target.closest
          ? target.closest('[data-search-action="didyoumean"], [data-search-action="related"]')
          : null;
      if (queryAction && wrap.contains(queryAction)) {
        event.preventDefault();
        const query = String(queryAction.getAttribute("data-search-query") || "").trim();
        if (query) {
          input.value = query;
          searchNow(query);
          input.focus();
        }
        return;
      }
      const link = target && target.closest ? target.closest(".docs-search__result-link") : null;
      if (link && wrap.contains(link)) {
        const links = [...results.querySelectorAll(".docs-search__result-link")];
        const hitIndex = links.indexOf(link);
        if (hitIndex >= 0 && hitIndex < activeResults.length) {
          trackSearchClick(activeResults[hitIndex], hitIndex + 1, "mouse_click");
        }
        return;
      }
      if (!wrap.contains(event.target)) {
        hideResults();
      }
    });
  }

  window.__DOCS_SEARCH__ = { mount: mountDocsSearchHandlers };
  document.dispatchEvent(new Event("docs:search:ready"));
})();
