/* =============================================================================
   PIALA DUNIA 2026 — App logic
   ============================================================================= */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// ============================================================================
// STATE
// ============================================================================
const state = {
  currentTab: 'today',
  currentStage: 'group',
  currentGroupFilter: 'all',
  searchQuery: '',
  modalMatch: null
};

// ============================================================================
// COUNTDOWN to FINAL
// ============================================================================
const COUNTDOWN_TARGET = new Date('2026-07-20T02:00:00+07:00');

function updateCountdown() {
  const now = new Date();
  const diff = COUNTDOWN_TARGET - now;
  if (diff <= 0) {
    $$('.countdown-num').forEach(el => el.textContent = '00');
    return;
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  $('[data-unit="days"]').textContent = String(days).padStart(2, '0');
  $('[data-unit="hours"]').textContent = String(hours).padStart(2, '0');
  $('[data-unit="minutes"]').textContent = String(minutes).padStart(2, '0');
  $('[data-unit="seconds"]').textContent = String(seconds).padStart(2, '0');
}

// Next match countdown (in next match card & modal)
function updateNextMatchCountdown() {
  const next = getNextMatch();
  if (!next) return;
  const wib = matchToWIB(next);
  const diff = wib - new Date();
  if (diff <= 0) return;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  const text = days > 0
    ? `${days}h ${hours}j ${minutes}m`
    : `${hours}j ${minutes}m ${seconds}d`;

  $$('.next-match-countdown-time').forEach(el => el.textContent = text);
  $$('.modal-countdown-time').forEach(el => el.textContent = text);
}

// ============================================================================
// TEAM RENDERING HELPERS
// ============================================================================
function teamName(code) {
  if (TEAMS[code]) return TEAMS[code].name;
  if (/^1[A-L]$/.test(code)) return `Juara ${code[1]}`;
  if (/^2[A-L]$/.test(code)) return `Runner-up ${code[1]}`;
  if (/^3/.test(code)) return `3rd Terbaik (${code.slice(1).split('').join('/')})`;
  if (/^W\d+$/.test(code)) return `Pemenang M${code.slice(1)}`;
  if (/^L\d+$/.test(code)) return `Kalah M${code.slice(1)}`;
  return code;
}
function teamFlag(code) {
  if (TEAMS[code]) return TEAMS[code].flag;
  if (/^1[A-L]$/.test(code)) return '🏆';
  if (/^2[A-L]$/.test(code)) return '🥈';
  if (/^3/.test(code)) return '🎟️';
  if (/^W\d+$/.test(code)) return '✅';
  if (/^L\d+$/.test(code)) return '❌';
  return '⚽';
}
function teamConf(code) {
  return TEAMS[code]?.conf || 'TBD';
}
function teamsInGroup(group) {
  return Object.entries(TEAMS)
    .filter(([_, t]) => t.group === group)
    .map(([code, t]) => ({ code, ...t }));
}
function groupLabel(letter) {
  return { A: 'Mexico', B: 'Canada', C: 'Brazil', D: 'USA', E: 'Germany',
           F: 'Netherlands', G: 'Belgium', H: 'Spain', I: 'France',
           J: 'Argentina', K: 'Portugal', L: 'England' }[letter] || '';
}
function formatTime12(time) {
  const [hh, mm] = time.split(':').map(Number);
  const period = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${String(mm).padStart(2, '0')} ${period}`;
}

// ============================================================================
// RENDER: TOURNAMENT STATUS
// ============================================================================
function renderTournamentStatus() {
  const today = todayInWIB();
  const startDate = '2026-06-11';
  const endDate = '2026-07-19';
  const todayMatches = getMatchesOnDate(today);
  const dayNum = Math.floor((new Date(today) - new Date(startDate)) / 86400000) + 1;
  const totalDays = Math.floor((new Date(endDate) - new Date(startDate)) / 86400000) + 1;

  let statusText, statusMeta;
  if (today < startDate) {
    statusText = 'Tournament belum mulai';
    statusMeta = `Dimulai dalam ${Math.floor((new Date(startDate) - new Date(today)) / 86400000)} hari`;
  } else if (today > endDate) {
    statusText = 'Tournament selesai';
    statusMeta = 'Juara sudah diumumkan!';
  } else {
    statusText = `Day ${dayNum} of ${totalDays} · Sedang Berlangsung`;
    statusMeta = `${todayMatches.length} pertandingan hari ini`;
  }

  $('#tournamentStatus').innerHTML = `
    <div class="tournament-status-left">
      <span class="live-dot"></span>
      <span class="live-label">${today >= startDate && today <= endDate ? 'LIVE' : 'INFO'}</span>
    </div>
    <div>
      <div class="tournament-status-title">${statusText}</div>
      <div class="tournament-status-meta">${statusMeta}</div>
    </div>
  `;
}

// ============================================================================
// RENDER: NEXT MATCH CARD
// ============================================================================
function renderNextMatch() {
  const m = getNextMatch();
  if (!m) {
    $('#nextMatchCard').innerHTML = '';
    return;
  }
  const venue = VENUES[m.venue];
  const wib = toWIBTime(m.date, m.time, m.venue);
  const home = TEAMS[m.home];
  const away = TEAMS[m.away];

  $('#nextMatchCard').innerHTML = `
    <div class="next-match-head">
      <span class="next-match-label">⚡ Match Berikutnya</span>
      <span class="next-match-countdown">
        Dimulai dalam <span class="next-match-countdown-time">--</span>
      </span>
    </div>
    <div class="next-match-body">
      <div class="next-team home">
        <div class="next-team-info">
          <div class="next-team-name">${home?.name || teamName(m.home)}</div>
          <div class="next-team-conf">${home?.conf || ''}</div>
        </div>
        <span class="next-team-flag">${home?.flag || teamFlag(m.home)}</span>
      </div>
      <div class="next-vs">VS</div>
      <div class="next-team away">
        <span class="next-team-flag">${away?.flag || teamFlag(m.away)}</span>
        <div class="next-team-info">
          <div class="next-team-name">${away?.name || teamName(m.away)}</div>
          <div class="next-team-conf">${away?.conf || ''}</div>
        </div>
      </div>
    </div>
    <div class="next-match-footer">
      <span class="next-match-venue">📍 <strong>${venue.name}</strong>, ${venue.city} ${venue.flag}</span>
      <span class="next-match-time">${wib.time} WIB · ${formatTime12(m.time)} lokal</span>
    </div>
  `;
}

// ============================================================================
// RENDER: MATCH CARD (compact, clickable)
// ============================================================================
function renderMatchCard(m, options = {}) {
  const venue = VENUES[m.venue];
  const wib = toWIBTime(m.date, m.time, m.venue);
  const homeName = TEAMS[m.home]?.name || teamName(m.home);
  const awayName = TEAMS[m.away]?.name || teamName(m.away);
  const homeFlag = TEAMS[m.home]?.flag || teamFlag(m.home);
  const awayFlag = TEAMS[m.away]?.flag || teamFlag(m.away);
  const isGroup = m.group;
  const isToday = m.date === todayInWIB();
  const dateLabel = isToday ? 'HARI INI' : '';

  if (options.featured) {
    return `
      <button class="featured-match" data-match-id="${m.id}">
        <span class="featured-match-badge">${isGroup ? `⭐ Grup ${m.group}` : '🏆 ' + STAGE_LABELS[m.stage]}</span>
        <div class="featured-match-teams">
          <div class="featured-team">
            <span class="team-flag">${homeFlag}</span>
            <span>${homeName}</span>
          </div>
          <div class="featured-team">
            <span class="team-flag">${awayFlag}</span>
            <span>${awayName}</span>
          </div>
        </div>
        <div class="featured-match-meta">
          <span>${dateLabel || formatDateID(m.date).day + ' ' + formatDateID(m.date).month} · ${wib.time} WIB</span>
          <span>${venue.flag} ${venue.city}</span>
        </div>
      </button>
    `;
  }

  return `
    <button class="match-card" data-match-id="${m.id}" style="--group-color: ${isGroup ? `var(--group-${m.group.toLowerCase()})` : 'var(--gold)'}">
      <div class="match-card-head">
        <span class="match-card-time">${wib.time} WIB</span>
        <span class="match-card-group">${isGroup ? m.group : 'K/O'}</span>
      </div>
      <div class="match-card-body">
        <div class="match-card-team">
          <span class="team-flag">${homeFlag}</span>
          <span>${homeName}</span>
        </div>
        <div class="match-card-team">
          <span class="team-flag">${awayFlag}</span>
          <span>${awayName}</span>
        </div>
      </div>
      <div class="match-card-foot">
        <span class="match-card-venue"><span class="match-card-venue-flag">${venue.flag}</span>${venue.city}</span>
        <span>${isToday ? '🔴 Hari ini' : formatDateID(m.date).weekday + ', ' + formatDateID(m.date).day + ' ' + formatDateID(m.date).month}</span>
      </div>
    </button>
  `;
}

// ============================================================================
// RENDER: HARI INI TAB
// ============================================================================
function renderTodayTab() {
  renderTournamentStatus();
  renderNextMatch();

  const today = todayInWIB();
  const tomorrow = tomorrowInWIB();
  const todayMatches = getMatchesOnDate(today);
  const tomorrowMatches = getMatchesOnDate(tomorrow);
  const featured = getFeaturedMatches();

  $('#todayCount').textContent = todayMatches.length + ' match';
  $('#tomorrowCount').textContent = tomorrowMatches.length + ' match';

  $('#todayMatches').innerHTML = todayMatches.length
    ? todayMatches.map(m => renderMatchCard(m)).join('')
    : `<div class="match-empty">Tidak ada pertandingan hari ini. Lihat tab "Jadwal" untuk hari lain.</div>`;

  $('#tomorrowMatches').innerHTML = tomorrowMatches.length
    ? tomorrowMatches.map(m => renderMatchCard(m)).join('')
    : `<div class="match-empty">Tidak ada pertandingan besok.</div>`;

  $('#featuredMatches').innerHTML = featured.map(m => renderMatchCard(m, { featured: true })).join('');

  // Wire click handlers
  $$('[data-match-id]').forEach(el => {
    el.addEventListener('click', () => openMatchModal(parseInt(el.dataset.matchId)));
  });
}

// ============================================================================
// RENDER: GROUPS
// ============================================================================
function renderGroups() {
  const grid = $('#groupsGrid');
  grid.innerHTML = '';
  const letters = 'ABCDEFGHIJKL'.split('');
  letters.forEach(letter => {
    const teams = teamsInGroup(letter);
    const card = document.createElement('button');
    card.className = 'group-card';
    card.style.setProperty('--group-color', `var(--group-${letter.toLowerCase()})`);
    card.dataset.group = letter;
    card.innerHTML = `
      <span class="group-card-arrow">→</span>
      <div class="group-header">
        <div class="group-badge">${letter}</div>
        <div>
          <div class="group-title">Grup ${letter}</div>
          <div class="group-subtitle">⚽ ${groupLabel(letter)}</div>
        </div>
      </div>
      <div class="team-list">
        ${teams.map(t => `
          <div class="team-row">
            <span class="team-flag">${t.flag}</span>
            <span class="team-name">${t.name}</span>
            <span class="team-conf">${t.conf}</span>
          </div>
        `).join('')}
      </div>
    `;
    card.addEventListener('click', () => {
      switchTab('schedule');
      state.currentGroupFilter = letter;
      $$('#groupFilter .filter-chip').forEach(c => c.classList.toggle('active', c.dataset.group === letter));
      state.currentStage = 'group';
      $$('#stageTabs .stage-tab').forEach(s => s.classList.toggle('active', s.dataset.stage === 'group'));
      renderSchedule();
      // scroll schedule into view
      setTimeout(() => $('#schedule').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    });
    grid.appendChild(card);
  });
}

// ============================================================================
// RENDER: SCHEDULE
// ============================================================================
function renderSchedule() {
  const list = $('#scheduleList');
  let matches = MATCHES.filter(m => m.stage === state.currentStage);
  if (state.currentStage === 'group' && state.currentGroupFilter !== 'all') {
    matches = matches.filter(m => m.group === state.currentGroupFilter);
  }
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    matches = matches.filter(m => {
      const home = TEAMS[m.home]?.name?.toLowerCase() || '';
      const away = TEAMS[m.away]?.name?.toLowerCase() || '';
      const venue = VENUES[m.venue]?.name?.toLowerCase() || '';
      const city = VENUES[m.venue]?.city?.toLowerCase() || '';
      return home.includes(q) || away.includes(q) || venue.includes(q) || city.includes(q);
    });
  }

  // Meta info
  const metaParts = [];
  if (state.searchQuery) {
    metaParts.push(`<strong>${matches.length}</strong> hasil untuk "<strong>${state.searchQuery}</strong>"`);
  } else {
    metaParts.push(`<strong>${matches.length}</strong> pertandingan`);
  }
  if (state.currentStage === 'group' && state.currentGroupFilter !== 'all') {
    metaParts.push(`Grup <strong>${state.currentGroupFilter}</strong>`);
  }
  metaParts.push(`<strong>${STAGE_LABELS[state.currentStage]}</strong>`);
  $('#scheduleMeta').innerHTML = metaParts.join(' · ');

  if (matches.length === 0) {
    list.innerHTML = `<div class="match-empty">Tidak ada pertandingan${state.searchQuery ? ' yang cocok dengan "' + state.searchQuery + '"' : ''}.</div>`;
    return;
  }

  // Group by date
  const byDate = matches.reduce((acc, m) => {
    (acc[m.date] = acc[m.date] || []).push(m);
    return acc;
  }, {});
  const sortedDates = Object.keys(byDate).sort();

  list.innerHTML = sortedDates.map(date => {
    const dayMatches = byDate[date].sort((a, b) => a.time.localeCompare(b.time));
    const { day, month, weekday } = formatDateID(date);
    return `
      <div class="schedule-day">
        <div class="day-header">
          <div class="day-date">
            <div class="day-date-num">${day}</div>
            <div class="day-date-month">${month}</div>
          </div>
          <div>
            <div class="day-weekday">${weekday}, ${day} ${month} 2026</div>
          </div>
          <div class="day-count">${dayMatches.length} pertandingan</div>
        </div>
        <div class="day-matches">
          ${dayMatches.map(renderMatchRow).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Wire modal clicks
  $$('#scheduleList [data-match-id]').forEach(el => {
    el.addEventListener('click', () => openMatchModal(parseInt(el.dataset.matchId)));
  });
}

function renderMatchRow(m) {
  const venue = VENUES[m.venue];
  const wib = toWIBTime(m.date, m.time, m.venue);
  const groupBadge = m.group ? `<span class="match-row-group" style="--group-color: var(--group-${m.group.toLowerCase()})">${m.group}</span>` : '';
  const stageLabel = !m.group ? `${STAGE_LABELS[m.stage]}` : '';

  return `
    <div class="match-row" data-match-id="${m.id}">
      <div class="match-row-time">
        ${wib.time}<small>WIB</small>
      </div>
      <div class="match-row-team home">
        <span class="team-name">${teamName(m.home)}</span>
        <span class="team-flag">${teamFlag(m.home)}</span>
      </div>
      <div class="match-row-vs">VS</div>
      <div class="match-row-team away">
        <span class="team-flag">${teamFlag(m.away)}</span>
        <span class="team-name">${teamName(m.away)}</span>
      </div>
      <div class="match-row-meta">
        <div class="match-row-meta-stadium">${venue.flag} ${venue.name}</div>
        <div class="match-row-meta-city">${groupBadge}${stageLabel} · ${venue.city}</div>
      </div>
    </div>
  `;
}

// ============================================================================
// RENDER: BRACKET
// ============================================================================
function renderBracket() {
  const rounds = [
    { stage: 'r32', title: '32 Besar', matches: MATCHES.filter(m => m.stage === 'r32') },
    { stage: 'r16', title: '16 Besar',  matches: MATCHES.filter(m => m.stage === 'r16') },
    { stage: 'qf',  title: 'Perempat Final', matches: MATCHES.filter(m => m.stage === 'qf') },
    { stage: 'sf',  title: 'Semi Final',     matches: MATCHES.filter(m => m.stage === 'sf') },
    { stage: '3rd', title: 'Perebutan 3rd',  matches: MATCHES.filter(m => m.stage === '3rd') },
    { stage: 'final', title: '⚡ FINAL',     matches: MATCHES.filter(m => m.stage === 'final') }
  ];

  $('#bracketWrapper').innerHTML = `
    <div class="bracket">
      ${rounds.map(r => `
        <div class="bracket-round">
          <div class="bracket-round-title">${r.title}</div>
          ${r.matches.map(m => `
            <div class="bracket-match ${m.stage === 'final' ? 'bracket-final' : ''}">
              <span class="bracket-match-id">M${m.id}</span>
              <div class="bracket-team placeholder">
                <span class="team-flag">${teamFlag(m.home)}</span>
                <span>${teamName(m.home)}</span>
              </div>
              <div class="bracket-team placeholder">
                <span class="team-flag">${teamFlag(m.away)}</span>
                <span>${teamName(m.away)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================================================
// RENDER: VENUES
// ============================================================================
function renderVenues() {
  const grid = $('#venuesGrid');
  const usedVenues = new Set(MATCHES.map(m => m.venue));
  grid.innerHTML = '';
  Object.entries(VENUES)
    .filter(([code]) => usedVenues.has(code))
    .forEach(([code, v]) => {
      const tag = code === 'MEX' ? '⭐ OPENING MATCH' :
                  code === 'NYC' ? '🏆 FINAL VENUE' : '';
      const card = document.createElement('div');
      card.className = `venue-card country-${v.country.toLowerCase()}`;
      card.innerHTML = `
        <div class="venue-top">
          <span class="venue-country">${v.flag}</span>
          <div class="venue-capacity">Kapasitas<strong>${v.capacity.toLocaleString()}</strong></div>
        </div>
        <div class="venue-stadium">${v.name}</div>
        <div class="venue-city">${v.city}</div>
        ${tag ? `<span class="venue-tag">${tag}</span>` : ''}
      `;
      grid.appendChild(card);
    });
}

// ============================================================================
// TAB SWITCHING
// ============================================================================
function switchTab(tabName) {
  if (state.currentTab === tabName) return;
  state.currentTab = tabName;

  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  $$('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tabName));

  // Refresh dynamic content
  if (tabName === 'today') renderTodayTab();
  if (tabName === 'groups') {/* static, no refresh needed */}
  if (tabName === 'schedule') renderSchedule();
  if (tabName === 'bracket') {/* static, no refresh needed */}
  if (tabName === 'stadiums') {/* static, no refresh needed */}
}

function initTabs() {
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  $$('[data-tab-jump]').forEach(el => {
    el.addEventListener('click', () => switchTab(el.dataset.tabJump));
  });

  $$('#stageTabs .stage-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('#stageTabs .stage-tab').forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      state.currentStage = tab.dataset.stage;
      renderSchedule();
    });
  });

  $$('#groupFilter .filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('#groupFilter .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.currentGroupFilter = chip.dataset.group;
      renderSchedule();
    });
  });

  // Brand click → today tab
  $('#brandHome').addEventListener('click', e => {
    e.preventDefault();
    switchTab('today');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ============================================================================
// SEARCH
// ============================================================================
function initSearch() {
  const overlay = $('#searchOverlay');
  const input = $('#searchOverlayInput');
  const results = $('#searchOverlayResults');
  const clearBtn = $('#searchClear');
  const scheduleSearch = $('#searchInput');

  function openSearch() {
    overlay.classList.add('open');
    setTimeout(() => input.focus(), 50);
  }
  function closeSearch() {
    overlay.classList.remove('open');
    input.value = '';
    renderSearchResults('');
  }

  $('#searchToggle').addEventListener('click', openSearch);
  $('#searchOverlayBg').addEventListener('click', closeSearch);
  $('#searchOverlayClose').addEventListener('click', closeSearch);

  // Global keyboard shortcut
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openSearch();
    }
    if (e.key === 'Escape' && overlay.classList.contains('open')) {
      closeSearch();
    }
  });

  // Search input
  let searchDebounce;
  input.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => renderSearchResults(input.value), 100);
  });

  // Hint chips
  $$('.chip[data-search]').forEach(c => {
    c.addEventListener('click', () => {
      input.value = c.dataset.search;
      renderSearchResults(c.dataset.search);
      input.focus();
    });
  });

  function renderSearchResults(q) {
    if (!q.trim()) {
      results.innerHTML = `
        <div class="search-hint">
          <div class="search-hint-title">💡 Coba cari:</div>
          <div class="search-hint-chips">
            <button class="chip" data-search="brazil">Brazil</button>
            <button class="chip" data-search="argentina">Argentina</button>
            <button class="chip" data-search="usa">USA</button>
            <button class="chip" data-search="japan">Japan</button>
            <button class="chip" data-search="france">France</button>
            <button class="chip" data-search="germany">Germany</button>
          </div>
        </div>
      `;
      $$('.chip[data-search]').forEach(c => {
        c.addEventListener('click', () => {
          input.value = c.dataset.search;
          renderSearchResults(c.dataset.search);
          input.focus();
        });
      });
      return;
    }

    const teams = searchTeams(q);
    if (teams.length === 0) {
      results.innerHTML = `<div class="search-empty">Tidak ada tim cocok dengan "<strong>${q}</strong>"</div>`;
      return;
    }
    results.innerHTML = teams.slice(0, 20).map(t => `
      <div class="search-result" data-team="${t.code}">
        <span class="search-result-flag">${t.flag}</span>
        <div class="search-result-info">
          <div class="search-result-name">${t.name}</div>
          <div class="search-result-meta">${t.conf} · ${teamsInGroup(t.group).length} tim di grup</div>
        </div>
        <span class="search-result-group" style="--group-color: var(--group-${t.group.toLowerCase()})">${t.group}</span>
      </div>
    `).join('');

    // Click to filter schedule
    $$('.search-result').forEach(el => {
      el.addEventListener('click', () => {
        const team = el.dataset.team;
        closeSearch();
        switchTab('schedule');
        state.searchQuery = TEAMS[team].name;
        scheduleSearch.value = TEAMS[team].name;
        clearBtn.classList.add('visible');
        renderSchedule();
      });
    });
  }

  // Schedule in-tab search
  scheduleSearch.addEventListener('input', () => {
    state.searchQuery = scheduleSearch.value;
    clearBtn.classList.toggle('visible', !!state.searchQuery);
    renderSchedule();
  });
  clearBtn.addEventListener('click', () => {
    scheduleSearch.value = '';
    state.searchQuery = '';
    clearBtn.classList.remove('visible');
    renderSchedule();
    scheduleSearch.focus();
  });
}

// ============================================================================
// MODAL
// ============================================================================
function openMatchModal(matchId) {
  const m = MATCHES.find(x => x.id === matchId);
  if (!m) return;
  state.modalMatch = m;
  renderMatchModal(m);
  $('#matchModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeMatchModal() {
  $('#matchModal').classList.remove('open');
  document.body.style.overflow = '';
  state.modalMatch = null;
}
function renderMatchModal(m) {
  const venue = VENUES[m.venue];
  const wib = toWIBTime(m.date, m.time, m.venue);
  const home = TEAMS[m.home];
  const away = TEAMS[m.away];
  const stageLabel = STAGE_LABELS[m.stage] || 'Match';
  const groupLabel = m.group ? `Grup ${m.group}` : '';
  const { day, month, weekday } = formatDateID(m.date);

  // Countdown if future
  const wibTime = matchToWIB(m);
  const isFuture = wibTime > new Date();
  const isPast = wibTime < new Date();

  let countdownHtml = '';
  if (isFuture && state.currentTab !== 'today') {
    countdownHtml = `
      <div class="modal-countdown">
        <span class="modal-countdown-label">⏱️ Dimulai dalam</span>
        <span class="modal-countdown-time">--</span>
      </div>
    `;
  } else if (isPast) {
    countdownHtml = `<div class="modal-countdown" style="background: rgba(107, 107, 117, 0.1); color: var(--text-mute); border-color: var(--border);">✓ Sudah lewat</div>`;
  }

  $('#modalBody').innerHTML = `
    <div class="modal-stage">${groupLabel ? `<span style="background: var(--group-${m.group.toLowerCase()}); color: var(--bg); padding: 2px 8px; border-radius: 4px; margin-right: 8px;">Grup ${m.group}</span>` : ''}${stageLabel} · Match ${m.id}</div>
    <h2 class="modal-title">${home?.name || teamName(m.home)} vs ${away?.name || teamName(m.away)}</h2>
    <div class="modal-teams">
      <div class="modal-team">
        <span class="modal-team-flag">${home?.flag || teamFlag(m.home)}</span>
        <div class="modal-team-name">${home?.name || teamName(m.home)}</div>
        <div class="modal-team-conf">${home?.conf || ''}</div>
      </div>
      <div class="modal-vs">VS</div>
      <div class="modal-team">
        <span class="modal-team-flag">${away?.flag || teamFlag(m.away)}</span>
        <div class="modal-team-name">${away?.name || teamName(m.away)}</div>
        <div class="modal-team-conf">${away?.conf || ''}</div>
      </div>
    </div>
    <div class="modal-info">
      <div class="modal-info-row">
        <span class="modal-info-label">📅 Tanggal</span>
        <span class="modal-info-value">${weekday}, ${day} ${month} 2026</span>
      </div>
      <div class="modal-info-row">
        <span class="modal-info-label">🕐 Waktu</span>
        <span class="modal-info-value time">${wib.time} WIB · ${formatTime12(m.time)} ${venue.tz <= -4 ? 'EDT' : venue.tz <= -5 ? 'CDT' : venue.tz <= -6 ? 'CST' : 'PDT'}</span>
      </div>
      <div class="modal-info-row">
        <span class="modal-info-label">🏟️ Stadion</span>
        <span class="modal-info-value">${venue.name}</span>
      </div>
      <div class="modal-info-row">
        <span class="modal-info-label">📍 Kota</span>
        <span class="modal-info-value">${venue.flag} ${venue.city}</span>
      </div>
      <div class="modal-info-row">
        <span class="modal-info-label">👥 Kapasitas</span>
        <span class="modal-info-value">${venue.capacity.toLocaleString()}</span>
      </div>
    </div>
    ${countdownHtml}
  `;
}
function initModal() {
  $('#modalClose').addEventListener('click', closeMatchModal);
  $('#modalBg').addEventListener('click', closeMatchModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('#matchModal').classList.contains('open')) {
      closeMatchModal();
    }
  });
}

// ============================================================================
// BACK TO TOP
// ============================================================================
function initBackToTop() {
  const btn = $('#backToTop');
  const onScroll = () => {
    btn.classList.toggle('visible', window.scrollY > 600);
    $('#nav').classList.toggle('scrolled', window.scrollY > 30);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ============================================================================
// INIT
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  renderTodayTab();
  renderGroups();
  renderSchedule();
  renderBracket();
  renderVenues();
  initTabs();
  initSearch();
  initModal();
  initBackToTop();
  updateCountdown();
  updateNextMatchCountdown();
  setInterval(updateCountdown, 1000);
  setInterval(updateNextMatchCountdown, 1000);
});
