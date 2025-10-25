'use strict';

(function () {
  // ==================== CONSTANTS ====================
  const PLACEHOLDER_IMG = './assets/placeholder.png';
  const DATA_URL = 'data.yaml';
  const CACHE_KEY = 'ddlc_mods_cache';
  const CACHE_EXPIRY_KEY = 'ddlc_cache_expiry';
  const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
  const FILTERS_STORAGE_KEY = 'ddlc_filters';
  const THEME_STORAGE_KEY = 'ddlc_theme';

  const STATUS = {
    COMPLETED: 'Завершен',
    IN_PROGRESS: 'В процессе',
  };

  const DEFAULTS = {
    query: '',
    status: 'all',
    sort: 'date_desc',
  };

  const DISPLAY_LIMITS = Object.freeze({
    titleChars: 64,
    descChars: 220,
    ellipsis: '…',
  });

  // ==================== DOM ELEMENTS ====================
  const els = {
    search: document.getElementById('search'),
    statusFilter: document.getElementById('status-filter'),
    sortBy: document.getElementById('sort-by'),
    modsContainer: document.getElementById('mods-container'),
    loading: document.getElementById('loading'),
    emptyState: document.getElementById('empty-state'),
    errorState: document.getElementById('error-state'),
    statusRegion: document.getElementById('status-region'),
    statMods: document.getElementById('stat-mods'),
    statCompleted: document.getElementById('stat-completed'),
    statInProgress: document.getElementById('stat-in-progress'),
    lastUpdate: document.getElementById('last-update'),
  };

  // ==================== GLOBAL STATE ====================
  const state = {
    mods: [],
    query: DEFAULTS.query,
    status: DEFAULTS.status,
    sort: DEFAULTS.sort,
    stats: {
      total: 0,
      completed: 0,
      inProgress: 0,
    },
    isLoading: false,
    hasError: false,
  };

  // ==================== UTILITIES ====================

  /**
   * Set element hidden state
   */
  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = !!hidden;
  }

  /**
   * Update ARIA live region
   */
  function setStatusMessage(text) {
    if (els.statusRegion) {
      els.statusRegion.textContent = String(text || '');
    }
  }

  /**
   * Debounce function
   */
  function debounce(fn, delay = 250) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(null, args), delay);
    };
  }

  /**
   * Throttle function
   */
  function throttle(fn, delay = 250) {
    let lastCall = 0;
    return (...args) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        fn.apply(null, args);
      }
    };
  }

  /**
   * Safe string conversion
   */
  function safeToString(v, fallback = '') {
    return (typeof v === 'string' ? v : fallback).trim();
  }

  /**
   * Convert value to array
   */
  function toArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return [val];
  }

  /**
   * Parse ISO date string
   */
  function parseDateISO(str) {
    const d = new Date(str);
    const ms = d.getTime();
    return Number.isNaN(ms) ? null : ms;
  }

  /**
   * Format date in Russian locale
   */
  function formatDateRu(str) {
    const ms = parseDateISO(str);
    if (ms == null) return safeToString(str, '—');
    try {
      return new Intl.DateTimeFormat('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(ms));
    } catch {
      return safeToString(str, '—');
    }
  }

  /**
   * Get Google Drive view URL
   */
  function getDriveViewUrl(imageId) {
    return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(imageId)}`;
  }

  /**
   * Get Google Drive download URL
   */
  function getDriveDownloadUrl(fileId) {
    return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  }

  /**
   * Check if status is completed
   */
  function isCompletedStatus(status) {
    return safeToString(status).toLowerCase() === STATUS.COMPLETED.toLowerCase();
  }

  /**
   * Build search haystack
   */
  function buildSearchHaystack(mod) {
    const fields = [
      safeToString(mod.name),
      safeToString(mod.description),
      safeToString(mod.original_author),
      toArray(mod.tags).map(safeToString).join(' '),
    ].filter(Boolean);
    return fields.join(' | ').toLowerCase();
  }

  /**
   * Truncate Unicode string safely
   */
  function truncateUnicode(str, maxChars, preserveWords = true, ellipsis = DISPLAY_LIMITS.ellipsis) {
    const input = safeToString(str, '');
    if (!input) return { text: '', truncated: false };

    const codepoints = [...input];
    if (codepoints.length <= maxChars) {
      return { text: input, truncated: false };
    }

    let sliced = codepoints.slice(0, maxChars).join('');
    if (preserveWords) {
      const lastSpace = sliced.lastIndexOf(' ');
      if (lastSpace > maxChars * 0.6) {
        sliced = sliced.slice(0, lastSpace);
      }
    }

    return { text: sliced + ellipsis, truncated: true };
  }

  /**
   * Truncate title
   */
  function truncateTitle(name) {
    return truncateUnicode(safeToString(name), DISPLAY_LIMITS.titleChars, true, DISPLAY_LIMITS.ellipsis);
  }

  /**
   * Truncate description
   */
  function truncateDescription(desc) {
    return truncateUnicode(safeToString(desc), DISPLAY_LIMITS.descChars, true, DISPLAY_LIMITS.ellipsis);
  }

  // ==================== DATA NORMALIZATION ====================

  /**
   * Normalize single mod record
   */
  function normalizeMod(mod) {
    const id = safeToString(mod.id);
    const name = safeToString(mod.name);
    const description = safeToString(mod.description);
    const status = safeToString(mod.status);
    const release_date = safeToString(mod.release_date);
    const original_author = safeToString(mod.original_author);

    if (!id || !name || !description || !status || !release_date || !original_author) {
      return null;
    }

    const image = safeToString(mod.image);
    const image_id = safeToString(mod.image_id);
    const file_id = safeToString(mod.file_id);
    const drive_url = safeToString(mod.drive_url);
    const source_url = safeToString(mod.source_url);
    const mirrors = toArray(mod.mirrors).map(safeToString).filter(Boolean);

    const imageUrl = image || (image_id ? getDriveViewUrl(image_id) : '');
    const downloadUrl = drive_url || (file_id ? getDriveDownloadUrl(file_id) : '');

    const tags = toArray(mod.tags).map(safeToString).filter(Boolean);
    const warnings = toArray(mod.warnings).map(safeToString).filter(Boolean);

    let size_mb = null;
    if (typeof mod.size_mb === 'number' && Number.isFinite(mod.size_mb)) {
      size_mb = mod.size_mb;
    } else if (typeof mod.size_mb === 'string') {
      const n = Number(mod.size_mb);
      if (!Number.isNaN(n) && Number.isFinite(n)) size_mb = n;
    }

    const releaseDateMs = parseDateISO(release_date);

    const normalized = {
      id,
      name,
      description,
      status,
      release_date,
      releaseDateMs,
      original_author,
      imageUrl,
      downloadUrl,
      source_url,
      mirrors,
      tags,
      warnings,
      size_mb,
    };

    normalized._haystack = buildSearchHaystack(normalized);
    return normalized;
  }

  /**
   * Validate and normalize data
   */
  function validateAndNormalizeData(data) {
    let list = [];
    if (Array.isArray(data)) {
      list = data;
    } else if (data && Array.isArray(data.mods)) {
      list = data.mods;
    } else {
      return [];
    }

    const out = [];
    const seenIds = new Set();

    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const nm = normalizeMod(item);
      if (!nm) {
        console.warn('Skipping invalid mod record:', item);
        continue;
      }
      if (seenIds.has(nm.id)) {
        console.warn('Duplicate mod id, skipping:', nm.id);
        continue;
      }
      seenIds.add(nm.id);
      out.push(nm);
    }

    return out;
  }

  // ==================== STATISTICS ====================

  /**
   * Calculate statistics
   */
  function calculateStats(mods) {
    const stats = {
      total: mods.length,
      completed: 0,
      inProgress: 0,
    };

    for (const mod of mods) {
      if (isCompletedStatus(mod.status)) {
        stats.completed++;
      } else {
        stats.inProgress++;
      }
    }

    return stats;
  }

  /**
   * Update statistics display
   */
  function updateStatsDisplay() {
    if (els.statMods) els.statMods.textContent = state.stats.total;
    if (els.statCompleted) els.statCompleted.textContent = state.stats.completed;
    if (els.statInProgress) els.statInProgress.textContent = state.stats.inProgress;
  }

  /**
   * Update last update timestamp
   */
  function updateLastUpdateTime() {
    if (els.lastUpdate) {
      const today = new Date();
      const dateStr = new Intl.DateTimeFormat('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(today);
      els.lastUpdate.textContent = dateStr;
    }
  }

  // ==================== SORTING ====================

  const sorters = {
    date_desc: (a, b) => {
      const ams = a.releaseDateMs ?? -Infinity;
      const bms = b.releaseDateMs ?? -Infinity;
      return bms - ams;
    },
    date_asc: (a, b) => {
      const ams = a.releaseDateMs ?? Infinity;
      const bms = b.releaseDateMs ?? Infinity;
      return ams - bms;
    },
    name_asc: (a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }),
    name_desc: (a, b) => b.name.localeCompare(a.name, 'ru', { sensitivity: 'base' }),
  };

  /**
   * Apply filters and sorting
   */
  function applyFiltersAndSort() {
    const q = state.query.toLowerCase();
    const statusFilter = state.status;
    const sorter = sorters[state.sort] || sorters.date_desc;

    let result = state.mods;

    if (q) {
      result = result.filter((m) => m._haystack.includes(q));
    }

    if (statusFilter !== 'all') {
      result = result.filter((m) => safeToString(m.status) === statusFilter);
    }

    result = result.slice().sort(sorter);
    return result;
  }

  // ==================== RENDERING ====================

  /**
   * Create meta row
   */
  function createMetaRow(label, value) {
    const div = document.createElement('div');
    div.textContent = `${label}: ${value}`;
    return div;
  }

  /**
   * Create tags container
   */
  function createTags(tags) {
    const wrap = document.createElement('div');
    wrap.className = 'tags';
    wrap.setAttribute('role', 'list');

    // Определяем, нужно ли сворачивать теги на мобильных
    const isMobile = window.innerWidth <= 768;
    const maxVisibleTags = isMobile ? 3 : tags.length;

    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = tag;
      span.setAttribute('role', 'listitem');
      wrap.appendChild(span);
    }

    // Добавляем кнопку "+N" если есть скрытые теги
    if (isMobile && tags.length > maxVisibleTags) {
      wrap.classList.add('tags--collapsed');
      
      const moreBtn = document.createElement('button');
      moreBtn.className = 'tag-more';
      moreBtn.textContent = `+${tags.length - maxVisibleTags}`;
      moreBtn.setAttribute('type', 'button');
      moreBtn.setAttribute('aria-label', `Показать ещё ${tags.length - maxVisibleTags} тегов`);
      
      moreBtn.addEventListener('click', () => {
        wrap.classList.toggle('tags--collapsed');
        moreBtn.textContent = wrap.classList.contains('tags--collapsed') 
          ? `+${tags.length - maxVisibleTags}` 
          : 'Скрыть';
      });
      
      wrap.appendChild(moreBtn);
    }

    return wrap;
  }

  /**
   * Create mod card
   */
  function createModCard(mod) {
    const card = document.createElement('article');
    card.className = 'mod-card';
    card.setAttribute('tabindex', '-1');

    // Image
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = mod.name || 'Изображение мода';
    img.src = mod.imageUrl || PLACEHOLDER_IMG;
    img.addEventListener('error', () => {
      if (img.src !== location.origin + '/' + PLACEHOLDER_IMG && !img.src.endsWith(PLACEHOLDER_IMG)) {
        img.src = PLACEHOLDER_IMG;
      }
    });
    card.appendChild(img);

    // Title
    const h3 = document.createElement('h3');
    const titleTrunc = truncateTitle(mod.name || 'Без названия');
    h3.textContent = titleTrunc.text;
    if (titleTrunc.truncated) {
      h3.title = mod.name;
    }
    card.appendChild(h3);

    // Meta
    const meta = document.createElement('div');
    meta.className = 'meta';

    const badge = document.createElement('span');
    const completed = isCompletedStatus(mod.status);
    badge.className = `status-badge ${completed ? 'status-completed' : 'status-in-progress'}`;
    badge.textContent = mod.status || 'Статус неизвестен';
    meta.appendChild(badge);

    const author = createMetaRow('Автор', mod.original_author || '—');
    meta.appendChild(author);

    const dateRow = createMetaRow('Дата', formatDateRu(mod.release_date));
    meta.appendChild(dateRow);

    card.appendChild(meta);

    // Description
    const p = document.createElement('p');
    p.className = 'description';
    const descTrunc = truncateDescription(mod.description || '');
    p.textContent = descTrunc.text;
    if (descTrunc.truncated) {
      p.title = mod.description;
    }
    card.appendChild(p);

    // Tags
    if (mod.tags && mod.tags.length) {
      card.appendChild(createTags(mod.tags));
    }

    // Extra info
    const extraBits = [];
    if (typeof mod.size_mb === 'number' && Number.isFinite(mod.size_mb)) {
      extraBits.push(`${mod.size_mb} МБ`);
    }
    if (mod.source_url) {
      extraBits.push('Исходник');
    }

    if (extraBits.length) {
      const div = document.createElement('div');
      div.className = 'meta';

      if (typeof mod.size_mb === 'number' && Number.isFinite(mod.size_mb)) {
        div.appendChild(createMetaRow('Размер', `${mod.size_mb} МБ`));
      }

      if (mod.source_url) {
        const srcWrap = document.createElement('div');
        const a = document.createElement('a');
        a.href = mod.source_url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = 'Исходник';
        srcWrap.appendChild(a);
        div.appendChild(srcWrap);
      }

      card.appendChild(div);
    }

    // Download button
    const a = document.createElement('a');
    a.className = 'download-btn';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = 'Скачать';

    if (mod.downloadUrl) {
      a.href = mod.downloadUrl;
    } else {
      a.href = '#';
      a.setAttribute('aria-disabled', 'true');
      a.title = 'Ссылка для скачивания недоступна';
      a.addEventListener('click', (e) => e.preventDefault());
    }

    card.appendChild(a);
    return card;
  }

  /**
   * Clear container
   */
  function clearContainer(container) {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  }

  /**
   * Render mods
   */
  function renderMods(mods) {
    clearContainer(els.modsContainer);

    if (!mods.length) {
      setHidden(els.emptyState, false);
      return;
    }

    setHidden(els.emptyState, true);

    const frag = document.createDocumentFragment();
    for (const mod of mods) {
      const card = createModCard(mod);
      frag.appendChild(card);
    }

    els.modsContainer.appendChild(frag);
  }

  // ==================== STATE & URL SYNC ====================

  /**
   * Read state from URL
   */
  function readStateFromURL() {
    const params = new URLSearchParams(location.search);
    const query = params.get('q');
    const status = params.get('status');
    const sort = params.get('sort');

    state.query = query !== null ? query : DEFAULTS.query;
    state.status = status !== null ? status : DEFAULTS.status;
    state.sort = sort !== null ? sort : DEFAULTS.sort;
  }

  /**
   * Write state to URL
   */
  function writeStateToURL(replace = true) {
    const params = new URLSearchParams();
    params.set('q', state.query);
    params.set('status', state.status);
    params.set('sort', state.sort);

    const newUrl = `${location.pathname}?${params.toString()}${location.hash}`;
    if (replace) {
      history.replaceState(null, '', newUrl);
    } else {
      history.pushState(null, '', newUrl);
    }
  }

  /**
   * Save filters to localStorage
   */
  function saveFiltersToStorage() {
    try {
      const filters = {
        query: state.query,
        status: state.status,
        sort: state.sort,
      };
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch (e) {
      console.warn('Failed to save filters to localStorage:', e);
    }
  }

  /**
   * Load filters from localStorage
   */
  function loadFiltersFromStorage() {
    try {
      const stored = localStorage.getItem(FILTERS_STORAGE_KEY);
      if (stored) {
        const filters = JSON.parse(stored);
        return {
          query: filters.query || DEFAULTS.query,
          status: filters.status || DEFAULTS.status,
          sort: filters.sort || DEFAULTS.sort,
        };
      }
    } catch (e) {
      console.warn('Failed to load filters from localStorage:', e);
    }
    return null;
  }

  /**
   * Sync controls from state
   */
  function syncControlsFromState() {
    if (els.search) els.search.value = state.query;
    if (els.statusFilter) els.statusFilter.value = state.status;
    if (els.sortBy) els.sortBy.value = state.sort;
  }

  /**
   * Sync state from controls
   */
  function syncStateFromControls() {
    state.query = els.search ? safeToString(els.search.value) : DEFAULTS.query;
    state.status = els.statusFilter ? safeToString(els.statusFilter.value) || DEFAULTS.status : DEFAULTS.status;
    state.sort = els.sortBy ? safeToString(els.sortBy.value) || DEFAULTS.sort : DEFAULTS.sort;
  }

  /**
   * Update results
   */
  function updateResults() {
    const filtered = applyFiltersAndSort();
    renderMods(filtered);

    const suffix = state.query ? ` по запросу "${state.query}"` : '';
    const statusSuffix = state.status !== 'all' ? ` (статус: ${state.status})` : '';
    setStatusMessage(`Найдено ${filtered.length} мод(ов)${suffix}${statusSuffix}.`);

    saveFiltersToStorage();
  }

  // ==================== LOADING & ERROR HANDLING ====================

  /**
   * Show loading state
   */
  function showLoading() {
    state.isLoading = true;
    setHidden(els.loading, false);
    setHidden(els.errorState, true);
    setStatusMessage('Загрузка данных…');
  }

  /**
   * Hide loading state
   */
  function hideLoading() {
    state.isLoading = false;
    setHidden(els.loading, true);
  }

  /**
   * Show error state
   */
  function showError(message = 'Произошла ошибка при загрузке данных.') {
    state.hasError = true;
    setHidden(els.errorState, false);
    setStatusMessage(message);
  }

  /**
   * Hide error state
   */
  function hideError() {
    state.hasError = false;
    setHidden(els.errorState, true);
  }

  // ==================== CACHING ====================

  /**
   * Get cached data
   */
  function getCachedData() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);

      if (!cached || !expiry) return null;

      const expiryTime = parseInt(expiry, 10);
      if (Date.now() > expiryTime) {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(CACHE_EXPIRY_KEY);
        return null;
      }

      return JSON.parse(cached);
    } catch (e) {
      console.warn('Failed to get cached data:', e);
      return null;
    }
  }

  /**
   * Set cached data
   */
  function setCachedData(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(CACHE_EXPIRY_KEY, String(Date.now() + CACHE_DURATION));
    } catch (e) {
      console.warn('Failed to cache data:', e);
    }
  }

  // ==================== DATA LOADING ====================

  /**
   * Load data from YAML
   */
  async function loadData() {
    if (!window.jsyaml) {
      throw new Error('js-yaml is not loaded');
    }

    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to fetch data.yaml: ${res.status} ${res.statusText}`);
      }

      const text = await res.text();
      let parsed;

      try {
        parsed = window.jsyaml.load(text);
      } catch (e) {
        console.error('YAML parse error:', e);
        throw new Error('Ошибка парсинга YAML');
      }

      const mods = validateAndNormalizeData(parsed);
      setCachedData(mods);
      return mods;
    } catch (e) {
      console.error('Data loading error:', e);
      const cached = getCachedData();
      if (cached) {
        console.warn('Using cached data due to error');
        return cached;
      }
      throw e;
    }
  }

  // ==================== THEME SUPPORT ====================

  /**
   * Detect system theme preference
   */
  function getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  /**
   * Initialize theme
   */
  function initTheme() {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      const theme = stored || getSystemTheme();

      if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    } catch (e) {
      console.warn('Failed to initialize theme:', e);
    }
  }

  // ==================== EVENT HANDLERS ====================

  const onSearchInput = debounce(() => {
    syncStateFromControls();
    writeStateToURL(true);
    updateResults();
  }, 250);

  function onStatusChange() {
    syncStateFromControls();
    writeStateToURL(true);
    updateResults();
  }

  function onSortChange() {
    syncStateFromControls();
    writeStateToURL(true);
    updateResults();
  }

  /**
   * Bind event listeners
   */
  function bindEvents() {
    if (els.search) {
      els.search.addEventListener('input', onSearchInput, { passive: true });
    }
    if (els.statusFilter) {
      els.statusFilter.addEventListener('change', onStatusChange);
    }
    if (els.sortBy) {
      els.sortBy.addEventListener('change', onSortChange);
    }

    window.addEventListener('popstate', () => {
      readStateFromURL();
      syncControlsFromState();
      updateResults();
    });
  }

  // ==================== INITIALIZATION ====================

  /**
   * Initialize application
   */
  async function init() {
    try {
      initTheme();
      showLoading();
      readStateFromURL();

      const storedFilters = loadFiltersFromStorage();
      if (storedFilters && !location.search) {
        state.query = storedFilters.query;
        state.status = storedFilters.status;
        state.sort = storedFilters.sort;
      }

      syncControlsFromState();
      bindEvents();

      state.mods = await loadData();
      state.stats = calculateStats(state.mods);

      hideLoading();
      hideError();
      updateStatsDisplay();
      updateLastUpdateTime();

      if (!state.mods.length) {
        renderMods([]);
        setHidden(els.emptyState, false);
        setStatusMessage('Каталог пока пуст.');
        return;
      }

      updateResults();
    } catch (e) {
      console.error('Initialization error:', e);
      hideLoading();
      showError('Не удалось загрузить данные. Пожалуйста, попробуйте позже.');
    }
  }

  // ==================== START ====================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();