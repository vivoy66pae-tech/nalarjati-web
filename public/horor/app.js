/* Cerita Horor — App Logic (with daily rotation) */
(function() {
  'use strict';

  const STORIES = window.STORIES || [];
  const DAILY_PICKS_COUNT = 15;

  // ===== Date helpers =====
  function getDailySeed() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  function getTodayLabel() {
    const d = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  // ===== Seeded PRNG (mulberry32) =====
  function mulberry32(seed) {
    let t = seed >>> 0;
    return function() {
      t = (t + 0x6D2B79F5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), t | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ===== Daily rotation =====
  function getShuffleOffset() {
    const key = 'horor.shuffle.' + getDailySeed();
    try {
      const v = parseInt(localStorage.getItem(key) || '0', 10);
      return isNaN(v) ? 0 : v;
    } catch (e) { return 0; }
  }

  function setShuffleOffset(v) {
    const key = 'horor.shuffle.' + getDailySeed();
    try { localStorage.setItem(key, String(v)); } catch (e) {}
  }

  function pickDailyStories() {
    const seed = getDailySeed() + getShuffleOffset() * 7919;
    const rng = mulberry32(seed);
    // Fisher-Yates with seeded RNG for proper distribution
    const arr = STORIES.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, Math.min(DAILY_PICKS_COUNT, arr.length));
  }

  function rerollToday() {
    const cur = getShuffleOffset();
    setShuffleOffset(cur + 1);
    return pickDailyStories();
  }

  // ===== Categories =====
  const CATEGORIES = [
    { id: 'all', label: 'Semua', icon: '📚' },
    { id: 'legenda', label: 'Legenda', icon: '🏛️' },
    { id: 'urban', label: 'Urban', icon: '🌃' },
    { id: 'pengalaman', label: 'Pengalaman', icon: '👁️' },
    { id: 'bookmarks', label: 'Bookmark', icon: '🔖' }
  ];

  // ===== State =====
  const state = {
    view: 'today', // 'today' | 'all'
    category: 'all',
    query: '',
    currentStoryId: null,
    fontStep: 0,
    lightMode: false,
    dropcap: true
  };

  // ===== Storage =====
  const STORAGE_KEYS = {
    bookmarks: 'horor.bookmarks',
    fontStep: 'horor.fontStep',
    lightMode: 'horor.lightMode',
    dropcap: 'horor.dropcap',
    view: 'horor.view'
  };

  const store = {
    getBookmarks() {
      try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.bookmarks) || '[]')); }
      catch (e) { return new Set(); }
    },
    saveBookmarks(set) {
      localStorage.setItem(STORAGE_KEYS.bookmarks, JSON.stringify([...set]));
    },
    getFontStep() { const v = parseInt(localStorage.getItem(STORAGE_KEYS.fontStep) || '0', 10); return isNaN(v) ? 0 : v; },
    saveFontStep(v) { localStorage.setItem(STORAGE_KEYS.fontStep, String(v)); },
    getLightMode() { return localStorage.getItem(STORAGE_KEYS.lightMode) === '1'; },
    saveLightMode(v) { localStorage.setItem(STORAGE_KEYS.lightMode, v ? '1' : '0'); },
    getDropcap() { return localStorage.getItem(STORAGE_KEYS.dropcap) !== '0'; },
    saveDropcap(v) { localStorage.setItem(STORAGE_KEYS.dropcap, v ? '1' : '0'); },
    getView() { return localStorage.getItem(STORAGE_KEYS.view) === 'all' ? 'all' : 'today'; },
    saveView(v) { localStorage.setItem(STORAGE_KEYS.view, v); }
  };

  // ===== DOM helpers =====
  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => Array.from((p || document).querySelectorAll(s));

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // ===== Pool & filtering =====
  function getActivePool() {
    if (state.view === 'all') return STORIES;
    // 'today' view
    if (state.category === 'bookmarks') return STORIES; // bookmarks can find anything
    return pickDailyStories();
  }

  function getFilteredStories() {
    let list = getActivePool();
    if (state.category === 'bookmarks') {
      const bm = store.getBookmarks();
      list = STORIES.filter(s => bm.has(s.id));
    } else if (state.category !== 'all') {
      list = list.filter(s => s.category === state.category);
    }
    if (state.query.trim()) {
      const q = state.query.trim().toLowerCase();
      list = list.filter(s => {
        return s.title.toLowerCase().includes(q) ||
          s.excerpt.toLowerCase().includes(q) ||
          s.content.join(' ').toLowerCase().includes(q) ||
          s.region.toLowerCase().includes(q) ||
          s.categoryLabel.toLowerCase().includes(q);
      });
    }
    return list;
  }

  // ===== Render: View toggle bar (date, reroll, view-all) =====
  function renderViewBar() {
    let bar = $('#viewBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'viewBar';
      bar.className = 'view-bar';
      $('#main').insertBefore(bar, $('#filterBar'));
    }
    const bm = store.getBookmarks();
    const totalCount = STORIES.length;
    const dailyCount = Math.min(DAILY_PICKS_COUNT, totalCount);
    const offset = getShuffleOffset();

    const inToday = state.view === 'today';
    const subtitleText = inToday
      ? `<strong>${dailyCount}</strong> cerita pilihan hari ini · ${getTodayLabel()}${offset > 0 ? ' · 🔄 acak #' + (offset + 1) : ''}`
      : `<strong>${totalCount}</strong> cerita lengkap di perpustakaan`;

    bar.innerHTML = `
      <div class="view-bar-inner">
        <div class="view-info">📅 ${subtitleText}</div>
        <div class="view-actions">
          ${inToday
            ? `<button class="vb-btn" id="rerollBtn" title="Ganti 15 cerita pilihan hari ini">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                Acak ulang
              </button>
              <button class="vb-btn" id="viewAllBtn" title="Lihat semua cerita">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                Lihat semua (${totalCount})
              </button>`
            : `<button class="vb-btn" id="viewTodayBtn" title="Kembali ke pilihan hari ini">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Kembali ke pilihan hari ini
              </button>`
          }
        </div>
      </div>
    `;
    const reroll = $('#rerollBtn');
    if (reroll) reroll.addEventListener('click', () => {
      rerollToday();
      showToast('🔄 Cerita pilihan hari ini sudah diacak ulang');
      renderViewBar();
      renderFilterBar();
      renderGrid();
    });
    const viewAll = $('#viewAllBtn');
    if (viewAll) viewAll.addEventListener('click', () => {
      state.view = 'all';
      store.saveView('all');
      renderViewBar();
      renderFilterBar();
      renderGrid();
    });
    const viewToday = $('#viewTodayBtn');
    if (viewToday) viewToday.addEventListener('click', () => {
      state.view = 'today';
      store.saveView('today');
      renderViewBar();
      renderFilterBar();
      renderGrid();
    });
  }

  // ===== Render: Filter Bar =====
  function renderFilterBar() {
    const bar = $('#filterBar');
    if (!bar) return;
    const pool = getActivePool();
    const bm = store.getBookmarks();
    const counts = {
      all: pool.length,
      legenda: pool.filter(s => s.category === 'legenda').length,
      urban: pool.filter(s => s.category === 'urban').length,
      pengalaman: pool.filter(s => s.category === 'pengalaman').length,
      bookmarks: bm.size
    };
    bar.innerHTML = CATEGORIES.map(c => {
      const count = counts[c.id] || 0;
      const active = state.category === c.id ? 'active' : '';
      return `<button class="filter-btn ${active}" data-cat="${c.id}">
        <span>${c.icon}</span>
        <span>${c.label}</span>
        <span class="count">${count}</span>
      </button>`;
    }).join('');
    $$('.filter-btn', bar).forEach(btn => {
      btn.addEventListener('click', () => {
        state.category = btn.dataset.cat;
        if (state.category === 'bookmarks' && counts.bookmarks === 0) {
          showToast('Belum ada cerita yang di-bookmark. Ketuk ikon 🔖 di pojok kanan atas cerita untuk menyimpan.');
        }
        renderFilterBar();
        renderGrid();
        updateHash();
      });
    });
  }

  // ===== Render: Story Grid =====
  function renderGrid() {
    const grid = $('#storyGrid');
    if (!grid) return;
    const list = getFilteredStories();
    const bm = store.getBookmarks();
    const totalAvailable = state.view === 'today'
      ? pickDailyStories().length
      : STORIES.length;

    if (list.length === 0) {
      const isBookmark = state.category === 'bookmarks';
      const isFiltered = state.category !== 'all' || state.query;
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1">
          <div class="icon">${isBookmark ? '🔖' : isFiltered ? '🔍' : '🕯️'}</div>
          <h3>${
            isBookmark ? 'Belum ada bookmark' :
            isFiltered ? 'Tidak ditemukan di pilihan hari ini' :
            'Belum ada cerita'
          }</h3>
          <p>${
            isBookmark ? 'Belum ada cerita yang kamu simpan. Buka cerita dan ketuk ikon bookmark untuk menambahkannya.' :
            isFiltered && state.view === 'today' ? `Coba kata kunci lain, atau klik "Lihat semua (${STORIES.length})" untuk mencari dari ${STORIES.length} cerita lengkap.` :
            'Coba kata kunci lain atau pilih kategori yang berbeda.'
          }</p>
        </div>`;
      return;
    }
    grid.innerHTML = list.map(s => {
      const isBookmarked = bm.has(s.id);
      return `
        <article class="story-card" data-id="${escapeHtml(s.id)}" tabindex="0">
          <div class="icon">${s.icon}</div>
          <h3>${escapeHtml(s.title)}</h3>
          <div class="meta">
            <span class="cat">${escapeHtml(s.categoryLabel)}</span>
            <span>·</span>
            <span>${escapeHtml(s.region)}</span>
            <span>·</span>
            <span>${s.readTime} mnt</span>
            ${isBookmarked ? '<span>· 🔖</span>' : ''}
          </div>
          <p class="excerpt">${escapeHtml(s.excerpt)}</p>
          <span class="read-more">Baca ceritanya →
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </span>
        </article>`;
    }).join('');
    $$('.story-card', grid).forEach(card => {
      card.addEventListener('click', () => openReader(card.dataset.id));
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openReader(card.dataset.id); }
      });
    });
  }

  // ===== Reader =====
  function openReader(id) {
    const story = STORIES.find(s => s.id === id);
    if (!story) return;
    state.currentStoryId = id;
    const overlay = $('#readerOverlay');
    const list = getFilteredStories();
    const idx = list.findIndex(s => s.id === id);

    $('#readerTitleMini').textContent = story.title;
    $('#readerIcon').textContent = story.icon;
    $('#readerTitle').textContent = story.title;
    $('#readerByline').textContent = `${story.author} · ${story.region} · ${story.readTime} menit`;
    $('#readerMeta').innerHTML = `
      <span class="cat">${escapeHtml(story.categoryLabel)}</span>
      <span>· ${escapeHtml(story.region)}</span>
      <span>· ${story.readTime} menit baca</span>
    `;
    $('#readerContent').innerHTML = story.content.map(p => `<p>${escapeHtml(p)}</p>`).join('');
    applyReaderSettings();

    $('#prevBtn').disabled = idx <= 0;
    $('#nextBtn').disabled = idx >= list.length - 1;
    $('#prevBtn').style.opacity = $('#prevBtn').disabled ? '0.4' : '1';
    $('#nextBtn').style.opacity = $('#nextBtn').disabled ? '0.4' : '1';

    const bm = store.getBookmarks();
    $('#bookmarkBtn').classList.toggle('active', bm.has(id));

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    updateHash();
  }

  function closeReader() {
    $('#readerOverlay').classList.remove('open');
    document.body.style.overflow = '';
    state.currentStoryId = null;
    updateHash();
  }

  function applyReaderSettings() {
    const content = $('#readerContent');
    const sizes = ['17px', '18px', '20px', '22px'];
    content.style.fontSize = sizes[state.fontStep + 1] || '18px';
    content.classList.toggle('dropcap-enabled', state.dropcap);
    content.classList.toggle('dropcap-disabled', !state.dropcap);
    $('#readerPanel').classList.toggle('light-mode', state.lightMode);
  }

  function toggleBookmark() {
    if (!state.currentStoryId) return;
    const bm = store.getBookmarks();
    const id = state.currentStoryId;
    const story = STORIES.find(s => s.id === id);
    if (bm.has(id)) {
      bm.delete(id);
      showToast(`Bookmark dihapus: ${story.title}`);
    } else {
      bm.add(id);
      showToast(`Disimpan: ${story.title}`);
    }
    store.saveBookmarks(bm);
    $('#bookmarkBtn').classList.toggle('active', bm.has(id));
    renderViewBar();
    renderFilterBar();
    renderGrid();
  }

  // ===== Toast =====
  let toastTimer;
  function showToast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  // ===== Hash routing =====
  function updateHash() {
    let h = '';
    if (state.currentStoryId) {
      h = state.currentStoryId;
    } else if (state.view === 'all') {
      h = 'all';
    } else if (state.category !== 'all') {
      h = state.category;
    }
    history.replaceState(null, '', h ? `/horor/#${h}` : '/horor/');
  }

  function handleHash() {
    const h = (location.hash || '').replace('#', '').trim();
    $('#navLinks').classList.remove('open');
    if (!h) {
      // no hash
    } else if (h === 'all') {
      state.view = 'all';
      store.saveView('all');
      state.category = 'all';
    } else if (h === 'today') {
      state.view = 'today';
      store.saveView('today');
    } else if (CATEGORIES.find(c => c.id === h)) {
      state.view = 'today';
      store.saveView('today');
      state.category = h;
    } else if (STORIES.find(s => s.id === h)) {
      setTimeout(() => openReader(h), 50);
    }
  }

  // ===== Init =====
  function init() {
    state.fontStep = store.getFontStep();
    state.lightMode = store.getLightMode();
    state.dropcap = store.getDropcap();
    state.view = store.getView();

    if (!STORIES.length) {
      $('#storyGrid').innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="icon">💀</div><h3>Gagal memuat cerita</h3><p>Silakan refresh halaman.</p></div>';
      return;
    }

    renderViewBar();
    renderFilterBar();
    renderGrid();

    // Search
    let searchTimer;
    $('#searchInput').addEventListener('input', e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.query = e.target.value;
        renderGrid();
      }, 120);
    });

    // Hamburger
    $('#hamburger').addEventListener('click', () => {
      $('#navLinks').classList.toggle('open');
    });

    // Reader controls
    $('#closeReader').addEventListener('click', closeReader);
    $('#closeReader2').addEventListener('click', closeReader);
    $('#readerOverlay').addEventListener('click', e => {
      if (e.target.id === 'readerOverlay') closeReader();
    });
    $('#bookmarkBtn').addEventListener('click', toggleBookmark);
    $('#fontSizeBtn').addEventListener('click', () => {
      state.fontStep = state.fontStep >= 2 ? -1 : state.fontStep + 1;
      store.saveFontStep(state.fontStep);
      applyReaderSettings();
    });
    $('#themeBtn').addEventListener('click', () => {
      state.lightMode = !state.lightMode;
      store.saveLightMode(state.lightMode);
      applyReaderSettings();
    });
    $('#prevBtn').addEventListener('click', () => {
      if (!state.currentStoryId) return;
      const list = getFilteredStories();
      const idx = list.findIndex(s => s.id === state.currentStoryId);
      if (idx > 0) openReader(list[idx - 1].id);
    });
    $('#nextBtn').addEventListener('click', () => {
      if (!state.currentStoryId) return;
      const list = getFilteredStories();
      const idx = list.findIndex(s => s.id === state.currentStoryId);
      if (idx < list.length - 1) openReader(list[idx + 1].id);
    });

    // Keyboard
    document.addEventListener('keydown', e => {
      if ($('#readerOverlay').classList.contains('open')) {
        if (e.key === 'Escape') closeReader();
        if (e.key === 'ArrowLeft') $('#prevBtn').click();
        if (e.key === 'ArrowRight') $('#nextBtn').click();
        if (e.key === 'b' || e.key === 'B') toggleBookmark();
      }
    });

    // Hash routing
    window.addEventListener('hashchange', () => {
      handleHash();
      renderViewBar();
      renderFilterBar();
      renderGrid();
    });
    handleHash();
    renderViewBar();
    renderFilterBar();
    renderGrid();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
