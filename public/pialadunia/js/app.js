/* =============================================================================
   PIALA DUNIA 2026 — App logic (original v1)
   ============================================================================= */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// ============================================================================
// STATE
// ============================================================================
const state = {
  currentStage: 'group',
  currentGroupFilter: 'all'
};

// ============================================================================
// COUNTDOWN to FINAL
// ============================================================================
const COUNTDOWN_TARGET = new Date('2026-07-20T02:00:00+07:00'); // 02:00 WIB 20 Jul 2026 (Final 15:00 EDT)

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

// ============================================================================
// RENDER: GROUPS
// ============================================================================
function renderGroups() {
  const grid = $('#groupsGrid');
  grid.innerHTML = '';
  const letters = 'ABCDEFGHIJKL'.split('');
  letters.forEach(letter => {
    const teams = teamsInGroup(letter);
    const card = document.createElement('div');
    card.className = 'group-card reveal';
    card.style.setProperty('--group-color', `var(--group-${letter.toLowerCase()})`);
    card.innerHTML = `
      <div class="group-header">
        <div class="group-badge">${letter}</div>
        <div>
          <div class="group-title">Grup ${letter}</div>
          <div class="group-subtitle">⚽ Dipimpin ${groupLabel(letter)}</div>
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
    grid.appendChild(card);
  });
}

// ============================================================================
// RENDER: SCHEDULE
// ============================================================================
function renderSchedule() {
  const list = $('#scheduleList');
  list.innerHTML = '';

  let matches = MATCHES.filter(m => m.stage === state.currentStage);
  if (state.currentStage === 'group' && state.currentGroupFilter !== 'all') {
    matches = matches.filter(m => m.group === state.currentGroupFilter);
  }

  if (matches.length === 0) {
    list.innerHTML = `<div style="text-align:center; padding: 60px 20px; color: var(--text-mute);">Tidak ada pertandingan.</div>`;
    return;
  }

  // Group by date
  const byDate = matches.reduce((acc, m) => {
    (acc[m.date] = acc[m.date] || []).push(m);
    return acc;
  }, {});
  const sortedDates = Object.keys(byDate).sort();

  sortedDates.forEach(date => {
    const dayMatches = byDate[date].sort((a, b) => a.time.localeCompare(b.time));
    const { day, month, weekday } = formatDateID(date);

    const dayBlock = document.createElement('div');
    dayBlock.className = 'schedule-day reveal';
    dayBlock.innerHTML = `
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
        ${dayMatches.map(m => renderMatchRow(m)).join('')}
      </div>
    `;
    list.appendChild(dayBlock);
  });
}

function renderMatchRow(m) {
  const venue = VENUES[m.venue];
  const wib = toWIBTime(m.date, m.time, m.venue);
  const localTime12 = formatTime12(m.time);
  const groupBadge = m.group ? `<span class="match-group-badge" style="background: var(--group-${m.group.toLowerCase()})">${m.group}</span>` : '';
  const stageBadge = m.stage !== 'group' ? `<span class="match-group-badge" style="background: var(--gold)">${m.stage.toUpperCase()}</span>` : '';

  return `
    <div class="match">
      <div class="match-time">
        ${wib.time} WIB
        <small>${localTime12} lokal</small>
      </div>
      <div class="match-team home">
        <span class="team-name">${renderTeamName(m.home, m)}</span>
        <span class="team-flag">${renderTeamFlag(m.home, m)}</span>
      </div>
      <div class="match-vs">VS</div>
      <div class="match-team away">
        <span class="team-flag">${renderTeamFlag(m.away, m)}</span>
        <span class="team-name">${renderTeamName(m.away, m)}</span>
      </div>
      <div class="match-venue">
        ${groupBadge}${stageBadge}
        <span class="match-venue-name">${venue.name}</span>
        <span class="match-venue-city">${venue.city} ${venue.flag}</span>
      </div>
    </div>
  `;
}

function renderTeamName(code, m) {
  // Real team code
  if (TEAMS[code]) return TEAMS[code].name;
  // Bracket placeholder like "1A", "2B", "W73", "L101"
  if (/^1[A-L]$/.test(code)) {
    return `Juara ${code[1]}`;
  }
  if (/^2[A-L]$/.test(code)) {
    return `Runner-up ${code[1]}`;
  }
  if (/^3/.test(code)) {
    const groups = code.slice(1);
    return `3rd Terbaik (${groups.split('').join('/')})`;
  }
  if (/^W\d+$/.test(code)) {
    return `Pemenang M${code.slice(1)}`;
  }
  if (/^L\d+$/.test(code)) {
    return `Kalah M${code.slice(1)}`;
  }
  return code;
}

function renderTeamFlag(code, m) {
  if (TEAMS[code]) return TEAMS[code].flag;
  if (/^1[A-L]$/.test(code)) return '🏆';
  if (/^2[A-L]$/.test(code)) return '🥈';
  if (/^3/.test(code)) return '🎟️';
  if (/^W\d+$/.test(code)) return '✅';
  if (/^L\d+$/.test(code)) return '❌';
  return '⚽';
}

function formatTime12(time) {
  const [hh, mm] = time.split(':').map(Number);
  const period = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${String(mm).padStart(2, '0')} ${period}`;
}

// ============================================================================
// RENDER: BRACKET
// ============================================================================
function renderBracket() {
  const wrapper = $('#bracketWrapper');
  const rounds = [
    { stage: 'r32', title: '32 Besar', matches: MATCHES.filter(m => m.stage === 'r32') },
    { stage: 'r16', title: '16 Besar',  matches: MATCHES.filter(m => m.stage === 'r16') },
    { stage: 'qf',  title: 'Perempat Final', matches: MATCHES.filter(m => m.stage === 'qf') },
    { stage: 'sf',  title: 'Semi Final',     matches: MATCHES.filter(m => m.stage === 'sf') },
    { stage: '3rd', title: 'Perebutan 3rd',  matches: MATCHES.filter(m => m.stage === '3rd') },
    { stage: 'final', title: '⚡ FINAL',     matches: MATCHES.filter(m => m.stage === 'final') }
  ];

  wrapper.innerHTML = `
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
      card.className = `venue-card country-${v.country.toLowerCase()} reveal`;
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
// TABS (within schedule section) & GROUP FILTER
// ============================================================================
function initTabs() {
  $$('#stageTabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('#stageTabs .tab').forEach(t => t.classList.remove('active'));
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
}

// ============================================================================
// NAV: scroll state + mobile toggle + smooth scroll
// ============================================================================
function initNav() {
  const nav = $('#nav');
  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 30);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Smooth scroll on anchor
  $$('.nav-links a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) {
        const offset = 70;
        window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
        // close mobile nav
        $('.nav-links').classList.remove('open');
      }
    });
  });

  // Mobile toggle
  $('#navToggle').addEventListener('click', () => {
    $('.nav-links').classList.toggle('open');
  });
}

// ============================================================================
// REVEAL ON SCROLL
// ============================================================================
let revealObserver;
function initReveal() {
  // Mark JS-enabled for progressive CSS enhancement
  document.documentElement.classList.add('js');

  if (revealObserver) revealObserver.disconnect();
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        revealObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' });
  $$('.reveal').forEach(el => revealObserver.observe(el));

  // Safety net: after 2s, force everything visible
  setTimeout(() => {
    $$('.reveal:not(.visible)').forEach(el => el.classList.add('visible'));
  }, 2000);
}

// ============================================================================
// BACK TO TOP
// ============================================================================
function initBackToTop() {
  const btn = $('#backToTop');
  const onScroll = () => {
    btn.classList.toggle('visible', window.scrollY > 600);
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
  renderGroups();
  renderSchedule();
  renderBracket();
  renderVenues();
  initTabs();
  initNav();
  initReveal();
  initBackToTop();
  updateCountdown();
  setInterval(updateCountdown, 1000);
});
