/**
 * SPA Query Router
 * - Works on GitHub Pages (single HTML file) using query parameter (?page=...)
 * - Progressive enhancement: auto-discovers <section data-route="..."> as pages
 * - History API + back/forward support
 * - Link interception: <a data-page="...">, internal links with ?page=..., or hash variants #/page
 * - Dynamic document.title and meta descriptions (meta[name="description"], og:description, og:url)
 * - Scroll position restore per page + focus management for accessibility
 * - Simple content loader: fetches same-origin sources from data-source and optionally renders markdown
 *
 * Usage:
 *  - Add sections:
 *      <section data-route="mods" id="mods-page">...</section>
 *      <section data-route="license" id="license-page" hidden data-title="Условия распространения" data-description="Правила распространения переводов">...</section>
 *
 *  - Links:
 *      <a href="/?page=license" data-page="license">Условия</a>
 *      <a href="/" data-page="mods">Каталог</a>
 *
 *  - Initialize after DOM is ready:
 *      window.router = new SPAQueryRouter({ defaultPage: 'mods' });
 *
 *  - Optional: register page meta/config programmatically:
 *      router.registerPage('license', { title: 'Условия распространения', description: '...' });
 */

(function () {
  'use strict';

  const DEFAULTS = {
    paramName: 'page',
    defaultPage: 'mods',
    activeLinkClass: 'is-active',
    pageAttr: 'data-route',
    pageIdAttr: 'id',
    pageTitleAttr: 'data-title',
    pageDescriptionAttr: 'data-description',
    hideAttr: 'hidden',
    focusSelector: 'h1, [role="heading"], h2, main, [tabindex="-1"]',
    autoDiscoverSelector: 'section[data-route], main[data-route], div[data-route]',
    scrollStorageKey: 'spa-router:scroll:',
    meta: {
      titleSuffix: '',
      descriptionSelector: 'meta[name="description"]',
      ogDescriptionSelector: 'meta[property="og:description"]',
      ogUrlSelector: 'meta[property="og:url"]',
    },
    content: {
      // Supports same-origin fetch to embed content into page element.
      // Example: <section data-route="license" data-source="/DISTRIBUTION-TERMS.md" data-format="markdown"></section>
      enableLoader: true,
      sourceAttr: 'data-source',
      formatAttr: 'data-format', // 'markdown' | 'text' | 'html'
      cache: true,
    },
    analytics: {
      // Optional hook to integrate page view tracking
      onNavigate: null, // (pageId, url) => {}
    },
  };

  // Utility: parse query string preserving other params
  function getQueryParams() {
    return new URLSearchParams(window.location.search);
  }

  function setQueryParam(params, key, value) {
    if (value == null || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    return params;
  }

  function buildUrlWithParams(params) {
    const base = window.location.pathname + (window.location.hash ? '' : '');
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  function sameOrigin(href) {
    try {
      const u = new URL(href, window.location.href);
      return u.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // Minimal markdown renderer (very small subset). If window.marked exists, prefer it.
  function renderMarkdown(md) {
    if (typeof window !== 'undefined' && window.marked && typeof window.marked.parse === 'function') {
      return window.marked.parse(md);
    }
    // Tiny fallback: headings, bold/italic, links, lists, paragraphs, code blocks (fenced)
    let html = md;
    // Escape HTML
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Code blocks ```
    html = html.replace(/```([\s\S]*?)```/g, (m, code) => `<pre><code>${code.replace(/&lt;/g, '<').replace(/&gt;/g, '>')}</code></pre>`);

    // Headings
    html = html.replace(/^######\s?(.*)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s?(.*)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s?(.*)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s?(.*)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s?(.*)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s?(.*)$/gm, '<h1>$1</h1>');

    // Bold/Italic
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Unordered lists
    html = html.replace(/^(?:\s*)[-*]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>[\s\S]*?<\/li>)(?!(?:\s*<li>))/g, '<ul>$1</ul>');

    // Paragraphs: wrap lines that are not already HTML blocks
    html = html.split(/\n{2,}/).map(block => {
      if (/^\s*<(h\d|ul|pre|blockquote|p|table|img|hr)/i.test(block.trim())) return block;
      if (block.trim().startsWith('<') && block.trim().endsWith('>')) return block;
      const lines = block.split('\n').filter(Boolean);
      if (!lines.length) return '';
      return `<p>${lines.join('<br>')}</p>`;
    }).join('\n');

    return html;
  }

  class SPAQueryRouter {
    /**
     * @param {Partial<typeof DEFAULTS>} options
     */
    constructor(options = {}) {
      this.opts = deepMerge({}, DEFAULTS, options);
      this.pages = new Map(); // pageId -> config {el, title, description, meta, source, loaded}
      this.currentPage = null;
      this._isNavigating = false;
      this._initialTitle = document.title;
      this._initialDescription = readMeta(this.opts.meta.descriptionSelector);
      this._initialOgDescription = readMeta(this.opts.meta.ogDescriptionSelector);
      this._cleanup = [];

      this._discoverPages();
      this._bindEvents();
      this.navigate(this._getRequestedPage(), { replace: true }).catch(console.error);
    }

    // Public API

    registerPage(pageId, config = {}) {
      const el = this.pages.get(pageId)?.el || document.querySelector(`[${this.opts.pageAttr}="${pageId}"]`);
      const meta = {
        title: config.title ?? (el?.getAttribute(this.opts.pageTitleAttr) || null),
        description: config.description ?? (el?.getAttribute(this.opts.pageDescriptionAttr) || null),
      };
      const source = {
        url: config.source?.url ?? (el?.getAttribute(this.opts.content.sourceAttr) || null),
        format: config.source?.format ?? (el?.getAttribute(this.opts.content.formatAttr) || null),
      };
      this.pages.set(pageId, {
        el: el || null,
        id: pageId,
        meta,
        source,
        loaded: false,
      });
    }

    async navigate(pageId, { replace = false } = {}) {
      if (!pageId) pageId = this.opts.defaultPage;
      if (!this.pages.has(pageId)) {
        // Fallback to default
        pageId = this.opts.defaultPage;
      }

      if (this._isNavigating || this.currentPage === pageId) {
        // noop but still ensure active link state
        this._highlightActiveLinks(pageId);
        return this.currentPage;
      }

      this._isNavigating = true;

      const fromPage = this.currentPage;
      const toPage = pageId;

      // Save scroll for current page
      if (fromPage) this._saveScroll(fromPage);

      // Update URL
      const params = getQueryParams();
      setQueryParam(params, this.opts.paramName, toPage === this.opts.defaultPage ? '' : toPage);
      const url = buildUrlWithParams(params);
      const state = { page: toPage };
      if (replace) {
        window.history.replaceState(state, '', url);
      } else {
        window.history.pushState(state, '', url);
      }

      // Hide previous / show next
      this._togglePages(fromPage, toPage);

      // Load external content if configured
      await this._loadContentFor(toPage);

      // Update title and meta
      this._updateMeta(toPage);

      // Restore scroll and focus
      this._restoreScroll(toPage);
      this._focusPage(toPage);

      // Notify listeners
      this._dispatch('router:navigate', { from: fromPage, to: toPage, url });
      if (typeof this.opts.analytics.onNavigate === 'function') {
        try {
          this.opts.analytics.onNavigate(toPage, url);
        } catch (e) {
          console.warn('router onNavigate error', e);
        }
      }

      this._highlightActiveLinks(toPage);
      this.currentPage = toPage;
      this._isNavigating = false;
      return toPage;
    }

    destroy() {
      this._cleanup.forEach(off => off());
      this._cleanup = [];
    }

    // Private helpers

    _getRequestedPage() {
      // Priority: ?page= -> hash "#/page" or "#page=..." -> default
      const params = getQueryParams();
      const p = params.get(this.opts.paramName);
      if (p) return p;

      const hash = window.location.hash || '';
      // supported formats: #/license or #page=license
      if (hash.startsWith('#/')) {
        return decodeURIComponent(hash.slice(2));
      }
      if (hash.startsWith('#')) {
        const sp = new URLSearchParams(hash.slice(1));
        const hp = sp.get(this.opts.paramName);
        if (hp) return hp;
      }
      return this.opts.defaultPage;
    }

    _discoverPages() {
      const els = $all(this.opts.autoDiscoverSelector);
      els.forEach(el => {
        const id = el.getAttribute(this.opts.pageAttr);
        if (!id) return;
        const meta = {
          title: el.getAttribute(this.opts.pageTitleAttr),
          description: el.getAttribute(this.opts.pageDescriptionAttr),
        };
        const source = {
          url: el.getAttribute(this.opts.content.sourceAttr),
          format: el.getAttribute(this.opts.content.formatAttr),
        };
        this.pages.set(id, { el, id, meta, source, loaded: false });
      });
    }

    _bindEvents() {
      // Popstate (back/forward)
      const onPop = () => {
        const page = this._getRequestedPage();
        this.navigate(page, { replace: true }).catch(console.error);
      };
      window.addEventListener('popstate', onPop);
      this._cleanup.push(() => window.removeEventListener('popstate', onPop));

      // Link interception
      const onClick = (e) => {
        const a = e.target.closest('a');
        if (!a) return;

        // data-page has the highest priority
        const dp = a.getAttribute('data-page');
        if (dp) {
          e.preventDefault();
          this.navigate(dp).catch(console.error);
          return;
        }

        const href = a.getAttribute('href');
        if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;

        if (!sameOrigin(a.href)) return;

        // if href contains ?page=...
        const url = new URL(a.href);
        const qp = url.searchParams.get(this.opts.paramName);
        if (qp && this.pages.has(qp)) {
          e.preventDefault();
          this.navigate(qp).catch(console.error);
          return;
        }

        // hash "#/license"
        if (url.hash && url.hash.startsWith('#/')) {
          e.preventDefault();
          this.navigate(decodeURIComponent(url.hash.slice(2))).catch(console.error);
          return;
        }
      };
      document.addEventListener('click', onClick);
      this._cleanup.push(() => document.removeEventListener('click', onClick));

      // Save scroll positions periodically
      const onScroll = debounce(() => {
        if (this.currentPage) this._saveScroll(this.currentPage);
      }, 200);
      window.addEventListener('scroll', onScroll, { passive: true });
      this._cleanup.push(() => window.removeEventListener('scroll', onScroll));
    }

    _togglePages(fromPage, toPage) {
      this.pages.forEach((cfg, id) => {
        if (!cfg.el) return;
        const isTarget = id === toPage;
        if (isTarget) {
          cfg.el.removeAttribute(this.opts.hideAttr);
          this._dispatch('router:page-show', { id, element: cfg.el });
        } else {
          if (!cfg.el.hasAttribute(this.opts.hideAttr)) {
            cfg.el.setAttribute(this.opts.hideAttr, '');
            if (id === fromPage) this._dispatch('router:page-hide', { id, element: cfg.el });
          }
        }
      });
    }

    async _loadContentFor(pageId) {
      if (!this.opts.content.enableLoader) return;
      const cfg = this.pages.get(pageId);
      if (!cfg || !cfg.el) return;
      if (!cfg.source?.url) return;

      if (cfg.loaded && this.opts.content.cache) return;

      try {
        const res = await fetch(cfg.source.url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`Failed to load content: ${res.status}`);
        const format = (cfg.source.format || 'text').toLowerCase();
        let content = await res.text();
        let html = '';

        switch (format) {
          case 'markdown':
          case 'md':
            html = renderMarkdown(content);
            break;
          case 'html':
            html = content;
            break;
          case 'text':
          default:
            html = `<pre>${escapeHtml(content)}</pre>`;
            break;
        }
        cfg.el.innerHTML = html;
        cfg.loaded = true;
      } catch (err) {
        console.warn(`[router] content load failed for ${pageId}:`, err);
        const fallback = document.createElement('pre');
        fallback.textContent = `Unable to load content.\n\n${err.message}`;
        cfg.el.innerHTML = '';
        cfg.el.appendChild(fallback);
      }
    }

    _updateMeta(pageId) {
      const cfg = this.pages.get(pageId);
      const suffix = this.opts.meta.titleSuffix ? ` ${this.opts.meta.titleSuffix}` : '';

      // Title
      const title = (cfg?.meta?.title || this._initialTitle);
      document.title = title + suffix;

      // Description
      const description = (cfg?.meta?.description || this._initialDescription || this._initialOgDescription || '');
      writeMeta(this.opts.meta.descriptionSelector, description);
      writeMeta(this.opts.meta.ogDescriptionSelector, description);

      // og:url
      const params = getQueryParams();
      setQueryParam(params, this.opts.paramName, pageId === this.opts.defaultPage ? '' : pageId);
      const fullUrl = window.location.origin + buildUrlWithParams(params);
      writeMeta(this.opts.meta.ogUrlSelector, fullUrl);
    }

    _highlightActiveLinks(pageId) {
      const anchors = $all('a[data-page]');
      anchors.forEach(a => {
        const dp = a.getAttribute('data-page');
        if (!dp) return;
        if (dp === pageId) {
          a.classList.add(this.opts.activeLinkClass);
          a.setAttribute('aria-current', 'page');
        } else {
          a.classList.remove(this.opts.activeLinkClass);
          a.removeAttribute('aria-current');
        }
      });
    }

    _saveScroll(pageId) {
      try {
        const key = this.opts.scrollStorageKey + pageId;
        const pos = { x: window.scrollX, y: window.scrollY };
        sessionStorage.setItem(key, JSON.stringify(pos));
      } catch {}
    }

    _restoreScroll(pageId) {
      try {
        const key = this.opts.scrollStorageKey + pageId;
        const raw = sessionStorage.getItem(key);
        if (!raw) {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          return;
        }
        const pos = JSON.parse(raw);
        window.scrollTo({ top: pos.y || 0, left: pos.x || 0, behavior: 'instant' });
      } catch {
        window.scrollTo(0, 0);
      }
    }

    _focusPage(pageId) {
      const cfg = this.pages.get(pageId);
      if (!cfg?.el) return;
      const target = cfg.el.querySelector(this.opts.focusSelector) || cfg.el;
      // Make focusable if needed
      const prevTabIndex = target.getAttribute('tabindex');
      if (prevTabIndex === null) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      // keep tabindex if it existed, else remove to avoid trapping
      if (prevTabIndex === null) target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
    }

    _dispatch(name, detail) {
      document.dispatchEvent(new CustomEvent(name, { detail }));
    }
  }

  // Helpers

  function deepMerge(target, ...sources) {
    for (const src of sources) {
      if (!src || typeof src !== 'object') continue;
      for (const [k, v] of Object.entries(src)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          if (!target[k] || typeof target[k] !== 'object') target[k] = {};
          deepMerge(target[k], v);
        } else {
          target[k] = v;
        }
      }
    }
    return target;
  }

  function readMeta(selector) {
    const el = $(selector);
    return el ? el.getAttribute('content') || '' : '';
  }

  function writeMeta(selector, value) {
    if (!selector) return;
    let el = $(selector);
    if (!el) {
      // Try to infer property or name
      const isOg = selector.includes('property=');
      el = document.createElement('meta');
      if (isOg) el.setAttribute('property', selector.match(/property="([^"]+)"/)?.[1] || 'og:description');
      else el.setAttribute('name', selector.match(/name="([^"]+)"/)?.[1] || 'description');
      document.head.appendChild(el);
    }
    el.setAttribute('content', value ?? '');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Expose globally
  window.SPAQueryRouter = SPAQueryRouter;

  // Auto-init if attribute present on <html> or <body>
  function autoInit() {
    const html = document.documentElement;
    const body = document.body;
    const enabled = html.hasAttribute('data-enable-router') || body.hasAttribute('data-enable-router');
    if (!enabled) return;
    const defaultPage = html.getAttribute('data-router-default') || body.getAttribute('data-router-default') || DEFAULTS.defaultPage;
    const titleSuffix = html.getAttribute('data-router-title-suffix') || body.getAttribute('data-router-title-suffix') || '';
    window.router = new SPAQueryRouter({
      defaultPage,
      meta: { titleSuffix }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})();