#!/usr/bin/env python3
"""
cpu_realtime.py — Demo logika real-time CPU VPS → Web (Server-Sent Events)

ARSITEKTUR (beda dari /sistem yang polling):

  ┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
  │ sampler     │ every   │ in-memory state  │  push   │ Browser     │
  │ thread      ├────────▶│ (queue per       ├────────▶│ EventSource │
  │ (psutil)    │  1.0s   │  connected       │  (SSE)  │ auto-update │
  └─────────────┘         │  client)         │         └─────────────┘
                          └──────────────────┘

Kenapa SSE bukan polling?
  - Polling: frontend nanya tiap X detik → ada delay & request sia2a kalau
    data belum berubah.
  - SSE: server PUSH begitu data baru siap. Latency = 0 (cuma network RTT).
  - 1 sambungan TCP panjang, gak ada overhead HTTP request/response.

Yang bikin "halus" di web:
  1. psutil.cpu_percent(interval=None) → baca delta dari sample sebelumnya.
     WAJIB dipanggil 2x dengan jeda (kita jeda 1 detik di thread).
  2. History deque(60) → rolling buffer 1 menit untuk sparkline.
  3. Queue per client → push ke semua browser yg lagi connect, gak blocking.
  4. Heartbeat ": hb\n\n" tiap 15 detik → cegah proxy/NAT drop idle conn.

JALANKAN:
    /usr/bin/python3 /opt/nalarjati/scripts/cpu_realtime.py
    # buka http://<server-ip>:8766/  di browser
    # (override port: CPU_REALTIME_PORT=9999 python3 cpu_realtime.py)
    # atau SSH tunnel:  ssh -L 8766:127.0.0.1:8766 user@server

STRESS TEST dari CLI:
    curl http://127.0.0.1:8766/stress?duration=10
    # spawn yes > /dev/null selama 10 detik di semua core
"""
import http.server
import json
import os
import queue
import socketserver
import subprocess
import sys
import threading
import time
from collections import deque

import psutil

# --- Config ---
PORT = int(os.environ.get("CPU_REALTIME_PORT", "8766"))
SAMPLE_INTERVAL = 1.0    # detik antara sample CPU
HISTORY_LEN = 60         # 60 sample = 1 menit history
HEARTBEAT_SECS = 15      # anti-idle-drop heartbeat
CPU_CORES = psutil.cpu_count() or 1

# --- Shared state (protected by lock) ---
state_lock = threading.Lock()
state = {
    "ts": 0.0,
    "cpu_total": 0.0,
    "per_core": [0.0] * CPU_CORES,
    "load": (0.0, 0.0, 0.0),
    "history": deque(maxlen=HISTORY_LEN),
    "clients": [],  # list[queue.Queue]
}


# ===================== Background sampler =====================

def sampler_loop():
    """
    Thread terpisah yang:
      - baca CPU tiap SAMPLE_INTERVAL detik
      - update state
      - push JSON ke semua client yg connect
    """
    # Prime: panggilan pertama psutil cuma nge-set baseline internal,
    # return value di-call ke-2 dst yg meaningful.
    psutil.cpu_percent(interval=None, percpu=True)

    while True:
        time.sleep(SAMPLE_INTERVAL)
        per = psutil.cpu_percent(interval=None, percpu=True) or [0.0] * CPU_CORES
        total = sum(per) / len(per) if per else 0.0
        try:
            load = os.getloadavg()
        except OSError:
            load = (0.0, 0.0, 0.0)
        ts = time.time()

        with state_lock:
            state["ts"] = ts
            state["cpu_total"] = round(total, 1)
            state["per_core"] = [round(float(p), 1) for p in per]
            state["load"] = load
            state["history"].append(round(total, 1))

            payload = json.dumps({
                "ts": ts,
                "total": state["cpu_total"],
                "per_core": state["per_core"],
                "load_1": round(load[0], 2),
                "load_5": round(load[1], 2),
                "load_15": round(load[2], 2),
                "history": list(state["history"]),
            })
            # Push ke semua client. Kalau queue penuh, drop pesan (client
            # ketinggalan 1 frame gak masalah, akan ke-overwrite di next push).
            dead = []
            for q in state["clients"]:
                try:
                    q.put_nowait(payload)
                except queue.Full:
                    pass
                except Exception:
                    dead.append(q)
            for q in dead:
                try:
                    state["clients"].remove(q)
                except ValueError:
                    pass


# ===================== HTTP layer =====================

# HTML di-embed biar single-file. Server parse sendiri dengan cara:
# 1. Ganti {{CPU_CORES}} dengan jumlah core aktual.
HTML = r"""<!doctype html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>CPU Realtime — nalarjati</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { --bg:#0a0a0f; --surface:#111118; --border:rgba(255,255,255,.08);
          --text:#e8e8f0; --text-2:#a0a0b0; --text-3:#6a6a7a;
          --accent:#8b5cf6; --accent-2:#06b6d4; --success:#10b981; --error:#f43f5e; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
         padding: 60px 24px; min-height: 100vh; }
  .container { max-width: 760px; margin: 0 auto; }
  .live { display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px;
          border-radius: 999px; background: var(--surface); border: 1px solid var(--border);
          font-family: ui-monospace, monospace; font-size: 12.5px; color: var(--text-2); }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-3); }
  .live-dot.on  { background: var(--success); box-shadow: 0 0 10px rgba(16,185,129,.6); animation: p 1.6s infinite; }
  .live-dot.off { background: var(--error); }
  @keyframes p { 0%,100%{opacity:1} 50%{opacity:.4} }
  h1 { font-size: 32px; font-weight: 700; letter-spacing: -.02em; margin: 12px 0 6px; }
  .sub { color: var(--text-2); font-size: 14.5px; margin-bottom: 28px; }
  .big { font-family: ui-monospace, monospace; font-size: 88px; font-weight: 700;
         letter-spacing: -.04em; line-height: 1; margin: 12px 0 4px; }
  .big small { font-size: 28px; color: var(--text-3); font-weight: 500; }
  .meta { display: flex; gap: 24px; font-family: ui-monospace, monospace; font-size: 12.5px;
          color: var(--text-3); margin-bottom: 28px; flex-wrap: wrap; }
  .meta b { color: var(--text); font-weight: 500; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
          padding: 20px; margin-bottom: 16px; }
  .card h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em;
             color: var(--text-3); margin-bottom: 14px; font-weight: 600; }
  .cores { display: flex; flex-direction: column; gap: 6px; }
  .core-row { display: grid; grid-template-columns: 50px 1fr 60px; align-items: center; gap: 12px;
              font-family: ui-monospace, monospace; font-size: 12px; }
  .core-bar { height: 8px; background: var(--bg); border-radius: 999px; overflow: hidden; }
  .core-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-2));
               transition: width .4s; }
  .core-fill.hot { background: linear-gradient(90deg, #f59e0b, var(--error)); }
  .core-val { color: var(--text-2); text-align: right; }
  .spark { width: 100%; height: 80px; display: block; }
  .spark polyline { fill: none; stroke: var(--accent); stroke-width: 1.5; }
  .spark .fill { fill: rgba(139,92,246,.15); stroke: none; }
  .spark .grid { stroke: var(--border); stroke-dasharray: 2 3; stroke-width: .5; }
  button { background: var(--surface); color: var(--text); border: 1px solid var(--border-strong);
           border-radius: 8px; padding: 10px 18px; font: inherit; font-size: 14px; cursor: pointer;
           transition: all .2s; }
  button:hover { background: var(--text); color: var(--bg); }
  button:disabled { opacity: .5; cursor: wait; }
  .actions { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
  code { font-family: ui-monospace, monospace; font-size: 12.5px; background: var(--surface);
         padding: 1px 5px; border-radius: 4px; border: 1px solid var(--border); }
  a { color: var(--accent-2); }
</style>
</head>
<body>
<div class="container">
  <div class="live"><span class="live-dot" id="dot"></span><span id="conn">connecting…</span></div>
  <h1>CPU Realtime</h1>
  <p class="sub">Server-Sent Events push dari <code>psutil.cpu_percent</code> tiap 1 detik.</p>

  <div class="big"><span id="cpu">—</span><small>%</small></div>
  <div class="meta">
    <span>latency <b id="lat">—</b></span>
    <span>last <b id="ts">—</b></span>
    <span>uptime <b id="up">—</b></span>
    <span>samples <b id="n">0</b></span>
  </div>

  <div class="card">
    <h2>Per-core usage</h2>
    <div class="cores" id="cores"></div>
  </div>

  <div class="card">
    <h2>History (last 60 s)</h2>
    <svg class="spark" id="spark" viewBox="0 0 600 80" preserveAspectRatio="none"></svg>
  </div>

  <div class="card">
    <h2>Actions</h2>
    <p style="color:var(--text-2); font-size:13.5px;">Stress test biar keliatan CPU naik. Default 10 detik, max 60.</p>
    <div class="actions">
      <button onclick="stress(5)">Stress 5s</button>
      <button onclick="stress(10)">Stress 10s</button>
      <button onclick="stress(30)">Stress 30s</button>
    </div>
  </div>

  <p style="color:var(--text-3); font-size:12.5px; margin-top:24px;">
    Raw stream: <a href="/events" target="_blank">/events</a>
  </p>
</div>

<script>
const CORES = __CPU_CORES__;
const HISTORY_LEN = __HISTORY_LEN__;
const dot   = document.getElementById('dot');
const conn  = document.getElementById('conn');
const cpuEl = document.getElementById('cpu');
const latEl = document.getElementById('lat');
const tsEl  = document.getElementById('ts');
const upEl  = document.getElementById('up');
const nEl   = document.getElementById('n');
const spark = document.getElementById('spark');
const coresEl = document.getElementById('cores');

// Build per-core rows once
coresEl.innerHTML = Array.from({length: CORES}, (_, i) =>
  `<div class="core-row">
     <span style="color:var(--text-3)">core ${i}</span>
     <div class="core-bar"><div class="core-fill" id="cf${i}" style="width:0%"></div></div>
     <span class="core-val" id="cv${i}">0%</span>
   </div>`).join('');

let last = 0, count = 0, start = Date.now();
let history = [];

function drawSpark() {
  const w = 600, h = 80, pad = 4;
  const max = 100;
  if (history.length < 2) return;
  const stepX = (w - pad*2) / (HISTORY_LEN - 1);
  const pts = history.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (h - pad*2) * (1 - v/max);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const fillPts = `${pad},${h-pad} ${pts.join(' ')} ${pad + (history.length-1)*stepX},${h-pad}`;
  const grid = [25, 50, 75].map(g => {
    const y = pad + (h-pad*2) * (1 - g/100);
    return `<line class="grid" x1="${pad}" y1="${y.toFixed(1)}" x2="${w-pad}" y2="${y.toFixed(1)}" />`;
  }).join('');
  spark.innerHTML = grid + `<polygon class="fill" points="${fillPts}" /><polyline points="${pts.join(' ')}" />`;
}

function applyData(d) {
  count++;
  const now = Date.now();
  const rtt = last ? (now - last) : 0;
  last = now;
  cpuEl.textContent = d.total.toFixed(1);
  latEl.textContent = rtt ? rtt + 'ms' : '—';
  tsEl.textContent  = new Date(d.ts*1000).toLocaleTimeString('id-ID', {hour12:false});
  nEl.textContent   = count;
  const mins = Math.floor((Date.now()-start)/60000);
  const secs = Math.floor(((Date.now()-start)%60000)/1000);
  upEl.textContent  = `${mins}m ${secs}s`;
  d.per_core.forEach((v, i) => {
    const f = document.getElementById('cf' + i);
    const t = document.getElementById('cv' + i);
    if (!f) return;
    f.style.width = Math.max(0, Math.min(100, v)) + '%';
    f.className = 'core-fill' + (v > 80 ? ' hot' : '');
    t.textContent = v.toFixed(0) + '%';
  });
  history = d.history || [];
  drawSpark();
}

const es = new EventSource('/events');
es.onopen  = () => { dot.className = 'live-dot on'; conn.textContent = 'connected · streaming'; };
es.onerror = () => { dot.className = 'live-dot off'; conn.textContent = 'disconnected · retrying…'; };
es.onmessage = (e) => { try { applyData(JSON.parse(e.data)); } catch (_) {} };

async function stress(secs) {
  const buttons = document.querySelectorAll('button');
  buttons.forEach(b => b.disabled = true);
  try {
    await fetch('/stress?duration=' + secs);
    conn.textContent = `🔥 stressing ${secs}s…`;
  } finally {
    setTimeout(() => buttons.forEach(b => b.disabled = false), secs * 1000);
  }
}
</script>
</body>
</html>"""


class Handler(http.server.BaseHTTPRequestHandler):
    # Suppress default per-request log
    def log_message(self, *a, **kw):
        pass

    def do_GET(self):
        if self.path == "/" or self.path.startswith("/?"):
            body = (HTML
                    .replace("__CPU_CORES__", str(CPU_CORES))
                    .replace("__HISTORY_LEN__", str(HISTORY_LEN))
                    ).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path.startswith("/events"):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Connection", "keep-alive")
            # Penting: disable buffering di proxy nginx/cloudflare
            self.send_header("X-Accel-Buffering", "no")
            self.end_headers()

            # Kirim state saat ini dulu biar UI gak kosong
            with state_lock:
                payload = json.dumps({
                    "ts": state["ts"],
                    "total": state["cpu_total"],
                    "per_core": state["per_core"],
                    "load_1": round(state["load"][0], 2),
                    "load_5": round(state["load"][1], 2),
                    "load_15": round(state["load"][2], 2),
                    "history": list(state["history"]),
                })
            self.wfile.write(f"data: {payload}\n\n".encode())
            self.wfile.flush()

            q = queue.Queue(maxsize=5)
            with state_lock:
                state["clients"].append(q)
            try:
                # Loop: tunggu message baru atau heartbeat timeout
                while True:
                    try:
                        msg = q.get(timeout=HEARTBEAT_SECS)
                        self.wfile.write(f"data: {msg}\n\n".encode())
                    except queue.Empty:
                        # Heartbeat: SSE comment, gak di-parse sama EventSource
                        self.wfile.write(b": hb\n\n")
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass
            finally:
                with state_lock:
                    try:
                        state["clients"].remove(q)
                    except ValueError:
                        pass
            return

        if self.path.startswith("/stress"):
            from urllib.parse import urlparse, parse_qs
            qs = parse_qs(urlparse(self.path).query)
            try:
                duration = int(qs.get("duration", ["10"])[0])
            except ValueError:
                duration = 10
            duration = max(1, min(duration, 60))

            # Spawn 1 yes > /dev/null per core. yes pure-C CPU burner.
            # Auto-bersih sendiri setelah `sleep duration`.
            cmd = (
                f"trap 'killall yes 2>/dev/null' EXIT; "
                f"for i in $(seq 1 {CPU_CORES}); do yes > /dev/null & done; "
                f"sleep {duration}; killall yes 2>/dev/null; exit 0"
            )
            subprocess.Popen(
                ["bash", "-c", cmd],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
            body = json.dumps({"ok": True, "duration": duration, "cores": CPU_CORES}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
            return

        self.send_error(404)


# ===================== main =====================

def main():
    sampler = threading.Thread(target=sampler_loop, daemon=True, name="cpu-sampler")
    sampler.start()

    socketserver.TCPServer.allow_reuse_address = True
    # Threading per connection: SSE handler nge-block di q.get(), gak boleh
    # nyumbat handler lain.
    with socketserver.ThreadingTCPServer(("0.0.0.0", PORT), Handler) as httpd:
        print(f"cpu_realtime: serving on http://0.0.0.0:{PORT}")
        print(f"  → buka http://<server-ip>:{PORT}/ di browser")
        print(f"  → stress test: curl http://<server-ip>:{PORT}/stress?duration=10")
        print(f"  → tekan Ctrl+C untuk stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nshutting down…", file=sys.stderr)


if __name__ == "__main__":
    main()
