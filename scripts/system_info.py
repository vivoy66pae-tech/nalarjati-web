#!/usr/bin/env python3
"""
system_info.py — VPS real-time snapshot for nalarjati.dev /sistem dashboard

Outputs a single JSON object to stdout with: os, kernel, hostname, ip, cpu
(model/cores/speed/usage/per-core), ram, swap, disks (each mount), load
average, uptime, network counters, top processes, service states, and
overall status.

Run:    /usr/bin/python3 system_info.py
Test:   /usr/bin/python3 system_info.py | python3 -m json.tool | head
"""
import json
import os
import platform
import socket
import subprocess
import sys
import time
from pathlib import Path

import psutil


# ---------- helpers ----------

def read_os_release():
    info = {}
    p = Path("/etc/os-release")
    if p.exists():
        for line in p.read_text(errors="ignore").splitlines():
            if "=" in line:
                k, v = line.split("=", 1)
                info[k.strip()] = v.strip().strip('"')
    return info


def humanize(n):
    n = float(n)
    for unit in ("B", "KB", "MB", "GB", "TB", "PB"):
        if abs(n) < 1024.0:
            return f"{n:.1f} {unit}"
        n /= 1024.0
    return f"{n:.1f} EB"


def humanize_duration(seconds):
    s = int(seconds)
    days, rem = divmod(s, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, _ = divmod(rem, 60)
    parts = []
    if days: parts.append(f"{days}d")
    if hours: parts.append(f"{hours}h")
    if minutes: parts.append(f"{minutes}m")
    return " ".join(parts) or f"{s}s"


# ---------- collectors ----------

def get_cpu():
    info = {
        "model": platform.processor() or "Unknown",
        "physical_cores": psutil.cpu_count(logical=False) or 0,
        "logical_cores": psutil.cpu_count(logical=True) or 0,
        "current_speed_mhz": None,
        "max_speed_mhz": None,
        "usage_percent": 0.0,
        "per_core_percent": [],
    }
    cpuinfo = Path("/proc/cpuinfo")
    if cpuinfo.exists():
        for line in cpuinfo.read_text(errors="ignore").splitlines():
            if line.lower().startswith("model name"):
                info["model"] = line.split(":", 1)[1].strip()
                break
    try:
        freqs = psutil.cpu_freq(percpu=False)
        if freqs:
            info["current_speed_mhz"] = round(freqs.current, 1)
            info["max_speed_mhz"] = round(freqs.max, 1) if freqs.max else round(freqs.current, 1)
    except Exception:
        pass
    try:
        # Block ~400ms for a stable reading on a small interval
        info["usage_percent"] = round(psutil.cpu_percent(interval=0.4), 1)
        per = psutil.cpu_percent(interval=None, percpu=True)
        info["per_core_percent"] = [round(float(x), 1) for x in per]
    except Exception:
        pass
    return info


def get_ram():
    vm = psutil.virtual_memory()
    return {
        "total_bytes": vm.total,
        "used_bytes": vm.used,
        "available_bytes": vm.available,
        "percent": vm.percent,
        "total_human": humanize(vm.total),
        "used_human": humanize(vm.used),
        "available_human": humanize(vm.available),
    }


def get_swap():
    sm = psutil.swap_memory()
    return {
        "total_bytes": sm.total,
        "used_bytes": sm.used,
        "percent": sm.percent,
        "total_human": humanize(sm.total) if sm.total else "0 B",
        "used_human": humanize(sm.used) if sm.total else "0 B",
    }


def get_disks():
    out = []
    seen = set()
    for part in psutil.disk_partitions(all=False):
        if part.fstype in ("squashfs", "tmpfs", "devtmpfs", "overlay"):
            continue
        if part.mountpoint in seen:
            continue
        seen.add(part.mountpoint)
        try:
            u = psutil.disk_usage(part.mountpoint)
        except (PermissionError, OSError):
            continue
        out.append({
            "mount": part.mountpoint,
            "device": part.device,
            "fstype": part.fstype,
            "total_bytes": u.total,
            "used_bytes": u.used,
            "free_bytes": u.free,
            "percent": u.percent,
            "total_human": humanize(u.total),
            "used_human": humanize(u.used),
            "free_human": humanize(u.free),
        })
    return out


def get_load():
    try:
        with open("/proc/loadavg") as f:
            parts = f.read().split()
        return {"1m": float(parts[0]), "5m": float(parts[1]), "15m": float(parts[2])}
    except Exception:
        return {"1m": 0.0, "5m": 0.0, "15m": 0.0}


def get_uptime():
    try:
        with open("/proc/uptime") as f:
            seconds = float(f.read().split()[0])
        return {"seconds": int(seconds), "human": humanize_duration(seconds)}
    except Exception:
        return {"seconds": 0, "human": "unknown"}


def get_network():
    try:
        c = psutil.net_io_counters(pernic=False)
        return {
            "bytes_sent": c.bytes_sent,
            "bytes_recv": c.bytes_recv,
            "packets_sent": c.packets_sent,
            "packets_recv": c.packets_recv,
            "sent_human": humanize(c.bytes_sent),
            "recv_human": humanize(c.bytes_recv),
        }
    except Exception:
        return {}


def get_top_processes(n=5):
    procs = []
    for p in psutil.process_iter(["pid", "name", "username", "cpu_percent", "memory_percent"]):
        try:
            info = p.info
            procs.append({
                "pid": info.get("pid"),
                "name": (info.get("name") or "")[:40],
                "user": info.get("username") or "",
                "cpu_percent": round(float(info.get("cpu_percent") or 0), 1),
                "mem_percent": round(float(info.get("memory_percent") or 0), 1),
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    procs.sort(key=lambda x: x["cpu_percent"], reverse=True)
    return procs[:n]


def get_services():
    """Check state of a curated set of services. Unknown state if systemctl missing."""
    services = ["nalarjati", "nginx", "ssh", "docker", "cron", "systemd-resolved", "adguardhome"]
    out = []
    for svc in services:
        try:
            r = subprocess.run(
                ["systemctl", "is-active", f"{svc}.service"],
                capture_output=True, text=True, timeout=2,
            )
            state = (r.stdout or "").strip() or "unknown"
        except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
            state = "unknown"
        out.append({"name": svc, "state": state})
    return out


def get_status(cpu, ram, disks, load, services):
    issues = []
    if ram["percent"] > 90:
        issues.append(f"RAM {ram['percent']}%")
    for d in disks:
        if d["percent"] > 92:
            issues.append(f"Disk {d['mount']} {d['percent']}%")
    cores = cpu["logical_cores"] or 1
    if load["1m"] > cores * 1.5:
        issues.append(f"Load {load['1m']} (cores={cores})")
    if any(s["state"] == "failed" for s in services):
        issues.append("a service is in failed state")
    if not issues:
        return {"level": "operational", "label": "All systems operational", "issues": []}
    if any("Disk" in i or "RAM" in i for i in issues):
        return {"level": "degraded", "label": "Degraded", "issues": issues}
    return {"level": "warning", "label": "Warning", "issues": issues}


def get_ip():
    """Best-effort primary non-loopback IPv4."""
    try:
        for _iface, addrs in psutil.net_if_addrs().items():
            for addr in addrs:
                if addr.family == socket.AF_INET and not addr.address.startswith("127."):
                    return addr.address
    except Exception:
        pass
    return None


# ---------- entrypoint ----------

def main():
    os_release = read_os_release()
    cpu = get_cpu()
    ram = get_ram()
    swap = get_swap()
    disks = get_disks()
    load = get_load()
    uptime = get_uptime()
    network = get_network()
    services = get_services()
    status = get_status(cpu, ram, disks, load, services)

    data = {
        "ok": True,
        "timestamp": int(time.time()),
        "timestamp_iso": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + "Z",
        "os": {
            "name": os_release.get("PRETTY_NAME") or f"{platform.system()} {platform.release()}",
            "id": os_release.get("ID", ""),
            "version": os_release.get("VERSION", ""),
            "kernel": platform.release(),
            "arch": platform.machine(),
        },
        "hostname": socket.gethostname(),
        "ip": get_ip(),
        "cpu": cpu,
        "ram": ram,
        "swap": swap,
        "disks": disks,
        "load": load,
        "uptime": uptime,
        "network": network,
        "services": services,
        "top_processes": get_top_processes(5),
        "status": status,
    }

    json.dump(data, sys.stdout, separators=(",", ":"))
    sys.stdout.write("\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        sys.stdout.write(json.dumps({"ok": False, "error": str(e)}) + "\n")
        sys.exit(1)
