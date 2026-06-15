// sistem.js — real-time dashboard for nalarjati.dev /sistem
// Polls /api/system every 3s, renders OS / CPU / RAM / disk / load / services.

const POLL_MS = 3000;
const HISTORY_LEN = 30;
let cpuHistory = [];
let nextPollAt = 0;
let pollTimer = null;
let countdownTimer = null;

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);
const fmt = (n, d = 1) => (n == null || isNaN(n) ? '—' : Number(n).toFixed(d));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s);

function setStatus(level, label, detail) {
  const banner = $('status-banner');
  banner.classList.remove('status-operational', 'status-warning', 'status-degraded', 'status-error');
  banner.classList.add(`status-${level}`);
  $('status-label').textContent = label;
  $('status-detail').textContent = detail;
}

function setLive(state) {
  // state: 'live' | 'warn' | 'err' | 'connecting'
  const dot = $('live-dot');
  const label = $('live-label');
  dot.classList.remove('live', 'warn', 'err');
  if (state === 'live') { dot.classList.add('live'); label.textContent = 'LIVE · real-time'; }
  else if (state === 'warn') { dot.classList.add('warn'); label.textContent = 'DEGRADED'; }
  else if (state === 'err') { dot.classList.add('err'); label.textContent = 'OFFLINE'; }
  else { label.textContent = 'Connecting…'; }
}

function barWidthPct(pct) { return Math.max(0, Math.min(100, Number(pct) || 0)) + '%'; }
function barColor(pct) {
  if (pct > 90) return 'linear-gradient(90deg, #ef4444, #f43f5e)';
  if (pct > 75) return 'linear-gradient(90deg, #f59e0b, #ef4444)';
  return null;
}

// ---------- renderers ----------

function renderOS(d) {
  $('os-name').textContent   = d.os.name || '—';
  $('os-kernel').textContent = d.os.kernel || '—';
  $('os-arch').textContent   = d.os.arch || '—';
  $('os-host').textContent   = d.hostname || '—';
  $('os-ip').textContent     = d.ip || '—';
  $('os-uptime').textContent = d.uptime.human || '—';
}

function renderCPU(cpu) {
  $('cpu-pct').textContent   = fmt(cpu.usage_percent, 1);
  const bar = $('cpu-bar');
  bar.style.width = barWidthPct(cpu.usage_percent);
  const oc = barColor(cpu.usage_percent);
  if (oc) bar.style.background = oc;
  else bar.style.background = '';

  $('cpu-model').textContent = truncate(cpu.model || '—', 36);
  $('cpu-cores').textContent = `${cpu.physical_cores || '?'} phys · ${cpu.logical_cores || '?'} log`;
  $('cpu-speed').textContent = (cpu.current_speed_mhz ? `${cpu.current_speed_mhz} MHz` : '—') +
                               (cpu.max_speed_mhz && cpu.max_speed_mhz !== cpu.current_speed_mhz ? ` (max ${cpu.max_speed_mhz})` : '');

  // Per-core grid
  const grid = $('cpu-cores-grid');
  const cores = cpu.per_core_percent || [];
  if (!cores.length) {
    grid.innerHTML = '<div class="proc-empty" style="grid-column: 1 / -1;">—</div>';
  } else {
    grid.innerHTML = cores.map((p) => `
      <div class="cpu-core">
        <div class="cpu-core-bar"><div class="cpu-core-fill" style="height:${barWidthPct(p)}"></div></div>
        <div class="cpu-core-val">${fmt(p, 0)}%</div>
      </div>`).join('');
  }

  // Sparkline
  cpuHistory.push(Number(cpu.usage_percent) || 0);
  if (cpuHistory.length > HISTORY_LEN) cpuHistory = cpuHistory.slice(-HISTORY_LEN);
  renderSpark(cpuHistory);
}

function renderSpark(values) {
  const svg = $('cpu-spark');
  const w = 300, h = 60, pad = 2;
  const max = 100;
  const stepX = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (h - pad * 2) * (1 - v / max);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePath = points.length ? `<polyline points="${points.join(' ')}" />` : '';
  const fillPath = points.length
    ? `<polygon class="spark-fill" points="${pad},${h - pad} ${points.join(' ')} ${(pad + (values.length - 1) * stepX).toFixed(1)},${h - pad}" />`
    : '';
  // Grid lines
  const grid = [25, 50, 75].map((g) => {
    const y = pad + (h - pad * 2) * (1 - g / 100);
    return `<line class="spark-grid" x1="${pad}" y1="${y.toFixed(1)}" x2="${w - pad}" y2="${y.toFixed(1)}" />`;
  }).join('');
  svg.innerHTML = grid + fillPath + linePath;
}

function renderRAM(ram, swap) {
  $('ram-pct').textContent = fmt(ram.percent, 1);
  const bar = $('ram-bar');
  bar.style.width = barWidthPct(ram.percent);
  const oc = barColor(ram.percent);
  if (oc) bar.style.background = oc;
  else bar.style.background = '';

  $('ram-total').textContent = ram.total_human;
  $('ram-used').textContent  = `${ram.used_human} (${fmt(ram.percent, 1)}%)`;
  $('ram-avail').textContent = ram.available_human;

  $('swap-info').textContent = swap.total_bytes
    ? `${swap.used_human} / ${swap.total_human} (${fmt(swap.percent, 1)}%)`
    : '— (no swap)';
  const sbar = $('swap-bar');
  sbar.style.width = barWidthPct(swap.percent);
}

function renderDisks(disks) {
  const grid = $('disks-grid');
  if (!disks.length) {
    grid.innerHTML = '<div class="card" style="grid-column: 1 / -1;"><div class="proc-empty">Tidak ada mount point yang terdeteksi.</div></div>';
    return;
  }
  grid.innerHTML = disks.map((d) => {
    const danger = d.percent > 90;
    return `
      <div class="disk-card">
        <div class="disk-head">
          <span class="disk-mount">${esc(d.mount)}</span>
          <span class="disk-fstype">${esc(d.fstype)}</span>
        </div>
        <div class="bar" style="margin: 4px 0 10px;"><div class="disk-bar-fill ${danger ? 'danger' : ''}" style="width:${barWidthPct(d.percent)}"></div></div>
        <div class="disk-meta">
          <span><strong>${d.percent}%</strong> used</span>
          <span>${esc(d.used_human)} / ${esc(d.total_human)}</span>
          <span>${esc(d.free_human)} free</span>
        </div>
        <div class="hint" style="margin-top: 8px;">device: <code>${esc(d.device)}</code></div>
      </div>`;
  }).join('');
}

function renderLoad(load) {
  $('load-1').textContent  = fmt(load['1m'], 2);
  $('load-5').textContent  = fmt(load['5m'], 2);
  $('load-15').textContent = fmt(load['15m'], 2);
}

function renderNetwork(net) {
  $('net-sent').textContent  = net.sent_human || '—';
  $('net-recv').textContent  = net.recv_human || '—';
  $('net-pkts').textContent  = (net.packets_sent  || 0).toLocaleString('id-ID');
  $('net-pktr').textContent  = (net.packets_recv  || 0).toLocaleString('id-ID');
}

function renderProcs(procs) {
  const el = $('proc-list');
  if (!procs || !procs.length) { el.innerHTML = '<div class="proc-empty">Tidak ada data proses.</div>'; return; }
  el.innerHTML = procs.map((p) => `
    <div class="proc-row">
      <span class="proc-name" title="${esc(p.name)} (pid ${p.pid}, ${esc(p.user)})">${esc(p.name)} <span class="proc-pid">· pid ${p.pid}</span></span>
      <span class="proc-cpu">${fmt(p.cpu_percent, 1)}% cpu</span>
      <span class="proc-mem">${fmt(p.mem_percent, 1)}% mem</span>
    </div>`).join('');
}

function renderServices(services) {
  const el = $('svc-list');
  if (!services || !services.length) { el.innerHTML = '<div class="proc-empty">Tidak ada data service.</div>'; return; }
  el.innerHTML = services.map((s) => {
    const state = s.state || 'unknown';
    return `<div class="svc-row">
      <span class="svc-name">${esc(s.name)}</span>
      <span class="svc-badge ${state}">${esc(state)}</span>
    </div>`;
  }).join('');
}

function renderStatus(status) {
  const level = status.level || 'operational';
  let cssLevel = level;
  if (level === 'warning') cssLevel = 'warning';
  if (level === 'degraded') cssLevel = 'degraded';
  setStatus(cssLevel, status.label || 'OK', status.issues && status.issues.length
    ? 'Issues: ' + status.issues.join(', ')
    : 'Semua service aktif, resource di bawah ambang batas.');
}

// ---------- polling ----------

async function tick() {
  const t0 = performance.now();
  try {
    const r = await fetch('/api/system', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'unknown error');
    const dt = Math.round(performance.now() - t0);

    renderOS(data);
    renderCPU(data.cpu);
    renderRAM(data.ram, data.swap);
    renderDisks(data.disks);
    renderLoad(data.load);
    renderNetwork(data.network);
    renderProcs(data.top_processes);
    renderServices(data.services);
    renderStatus(data.status);

    const ts = new Date(data.timestamp * 1000);
    $('last-update').textContent  = ts.toLocaleTimeString('id-ID', { hour12: false });
    $('api-latency').textContent   = dt + ' ms' + (data.cached ? ' (cache)' : '');

    setLive('live');
    setStatus(data.status.level === 'operational' ? 'operational' :
              data.status.level === 'warning' ? 'warning' : 'degraded',
              data.status.label,
              data.status.issues.length ? 'Issues: ' + data.status.issues.join(', ')
                                        : `${data.disks.length} mount · ${data.services.filter(s => s.state === 'active').length}/${data.services.length} service aktif`);
  } catch (err) {
    setLive('err');
    setStatus('error', 'Tidak bisa menghubungi /api/system', esc(err.message));
    $('last-update').textContent = '—';
  }
  nextPollAt = Date.now() + POLL_MS;
}

function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    const ms = Math.max(0, nextPollAt - Date.now());
    $('next-refresh').textContent = (ms / 1000).toFixed(1) + 's';
  }, 100);
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  tick();
  pollTimer = setInterval(tick, POLL_MS);
}

// ---------- fade-in on scroll (reuse main.css pattern) ----------
document.querySelectorAll('.fade-in').forEach((el) => {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  obs.observe(el);
});

// Pause when tab is hidden, resume on visible
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  } else if (!pollTimer) {
    startPolling();
  }
});

startPolling();
startCountdown();
