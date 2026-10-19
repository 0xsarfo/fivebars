"""Platform-specific network measurements for Fivebars (macOS and Windows).

Everything here answers "what does this computer see?": the default gateway, the
gateway's hardware address (used as a stable network id), Wi-Fi link details,
this computer's traffic counters and ping times. Command output is parsed by small
pure functions (parse_*) so they can be unit-tested on any OS.
"""
import platform
import re
import subprocess

SYSTEM = platform.system()  # "Darwin", "Windows", ...
IS_MAC = SYSTEM == "Darwin"
IS_WINDOWS = SYSTEM == "Windows"

_NO_WINDOW = 0x08000000 if IS_WINDOWS else 0  # CREATE_NO_WINDOW: don't flash console windows on Windows


def run(cmd, timeout=5):
    try:
        out = subprocess.run(cmd, capture_output=True, timeout=timeout, creationflags=_NO_WINDOW)
        return out.stdout.decode("utf-8", "replace") if isinstance(out.stdout, bytes) else out.stdout
    except Exception:
        return ""


def _mac(addr):
    parts = re.split(r"[:-]", addr)
    return ":".join(p.zfill(2) for p in parts).upper() if len(parts) == 6 else None


def _int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


# --------------------------------------------------------------------------- parsers (pure, testable)

def parse_mac_route(out):
    gw = re.search(r"gateway:\s*(\S+)", out)
    iface = re.search(r"interface:\s*(\S+)", out)
    return (gw.group(1), iface.group(1)) if gw and iface else None


def parse_arp(out):
    """Hardware address from `arp -n <ip>` (macOS) or `arp -a <ip>` (Windows)."""
    m = re.search(r"\b([0-9a-fA-F]{1,2}(?:[:-][0-9a-fA-F]{1,2}){5})\b", out)
    return _mac(m.group(1)) if m else None


def parse_route_print(out):
    """Default route from Windows `route print -4 0.0.0.0`: (gateway, interface_ip) with the lowest metric."""
    best = None
    for line in out.splitlines():
        f = line.split()
        if len(f) >= 5 and f[0] == "0.0.0.0" and f[1] == "0.0.0.0" and re.match(r"\d+\.\d+\.\d+\.\d+$", f[2]):
            metric = _int(f[4]) or 9999
            if best is None or metric < best[2]:
                best = (f[2], f[3], metric)
    return (best[0], best[1]) if best else None


def parse_netstat_e(out):
    """Total bytes (received, sent) from Windows `netstat -e` - the first row with two numbers."""
    for line in out.splitlines():
        nums = re.findall(r"\b\d+\b", line)
        if len(nums) == 2 and not re.match(r"^\s*\d", line):
            return int(nums[0]), int(nums[1])
    return None


def parse_netstat_ibn(out):
    """Cumulative bytes (in, out) from macOS `netstat -ibn -I <iface>`."""
    for line in out.splitlines():
        f = line.split()
        if len(f) >= 11 and f[2].startswith("<Link"):
            return int(f[6]), int(f[9])
    return None


def _band_from_channel(ch):
    c = _int(ch)
    return None if c is None else "2.4 GHz" if c <= 14 else "5 GHz"


def parse_netsh_wlan(out):
    """Wi-Fi link from Windows `netsh wlan show interfaces` (English labels; others fall back gracefully)."""
    kv = {}
    for line in out.splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            kv.setdefault(k.strip().lower(), v.strip())
    # Only a connected adapter lists an SSID ("disconnected" contains "connected", and labels are localized).
    if "ssid" not in kv:
        return None
    pct = _int((kv.get("signal") or "").rstrip("%"))
    rssi = _int(kv.get("rssi")) if kv.get("rssi") else (round(pct / 2 - 100) if pct is not None else None)
    chan = kv.get("channel")
    band = kv.get("band") or _band_from_channel(chan)
    return {
        "ssid": kv.get("ssid") or None, "rssi": rssi, "noise": None, "signal_pct": pct,
        "phy": kv.get("radio type"), "channel": chan, "band": band, "width": None,
        "security": kv.get("authentication"),
        "tx_rate": _int(float(kv["transmit rate (mbps)"])) if kv.get("transmit rate (mbps)", "").replace(".", "").isdigit() else None,
        "rx_rate": _int(float(kv["receive rate (mbps)"])) if kv.get("receive rate (mbps)", "").replace(".", "").isdigit() else None,
        "mcs": None, "country": None,
    }


def parse_system_profiler(out):
    """Wi-Fi link from macOS `system_profiler SPAirPortDataType` (macOS hides the SSID unless permitted)."""
    if "Current Network Information:" not in out:
        return None
    block = out.split("Current Network Information:", 1)[1].split("Other Local Wi-Fi Networks:", 1)[0]
    get = lambda k: (re.search(rf"{k}:\s*(.+)", block) or [None, None])[1]
    sig = re.search(r"Signal / Noise:\s*(-?\d+) dBm / (-?\d+) dBm", block)
    name = re.search(r"^\s{12}(\S.*):\s*$", block, re.M)
    chan = get("Channel") or ""
    return {
        "ssid": name.group(1).strip() if name and "redacted" not in name.group(1) else None,
        "rssi": int(sig.group(1)) if sig else None, "noise": int(sig.group(2)) if sig else None,
        "phy": get("PHY Mode"), "channel": chan.split(" ")[0] if chan else None,
        "band": "5 GHz" if "5GHz" in chan else "6 GHz" if "6GHz" in chan else "2.4 GHz" if "2GHz" in chan else None,
        "width": (re.search(r"(\d+MHz)", chan) or [None, None])[1], "security": get("Security"),
        "tx_rate": _int(get("Transmit Rate")), "mcs": _int(get("MCS Index")), "country": get("Country Code"),
    }


def parse_ping_time(out):
    """Round-trip time in ms from one ping reply (macOS 'time=12.3 ms', Windows 'time=12ms' / 'time<1ms', localized)."""
    if IS_WINDOWS or "TTL=" in out:  # Windows: only lines with TTL are real replies
        for line in out.splitlines():
            if "TTL=" in line.upper():
                m = re.search(r"[=<]\s*(\d+(?:[.,]\d+)?)\s*ms", line, re.I)
                if m:
                    v = float(m.group(1).replace(",", "."))
                    return 0.5 if "<" in line[: m.end()] and v <= 1 else v
        return None
    m = re.search(r"time[=<]\s*([\d.]+)\s*ms", out)
    return float(m.group(1)) if m else None


def parse_ping_times(out):
    """All reply times from a multi-ping run."""
    vals = []
    for line in out.splitlines():
        v = parse_ping_time(line) if ("TTL=" in line.upper() or "time" in line) else None
        if v is not None:
            vals.append(v)
    return vals


# --------------------------------------------------------------------------- live measurements

def detect_network():
    """Default gateway, interface and the gateway's hardware address. None when offline."""
    if IS_WINDOWS:
        r = parse_route_print(run(["route", "print", "-4", "0.0.0.0"], 5))
        if not r:
            return None
        gw, iface = r
        mac = parse_arp(run(["arp", "-a", gw], 5))
    elif IS_MAC:
        r = parse_mac_route(run(["route", "-n", "get", "default"], 3))
        if not r:
            return None
        gw, iface = r
        mac = parse_arp(run(["arp", "-n", gw], 3))
    else:
        return None
    return {"gateway": gw, "iface": iface, "mac": mac, "id": mac or f"gw-{gw}"}


_wifi_ports = {}


def is_wifi(iface):
    if IS_WINDOWS:
        return wifi_info(iface) is not None  # approximation: a connected Wi-Fi adapter exists
    if IS_MAC:
        if not _wifi_ports:
            out = run(["networksetup", "-listallhardwareports"])
            for port, dev in re.findall(r"Hardware Port: (.+)\nDevice: (\S+)", out):
                _wifi_ports[dev] = port in ("Wi-Fi", "AirPort")
        return _wifi_ports.get(iface, False)
    return False


def wifi_info(iface):
    if IS_WINDOWS:
        return parse_netsh_wlan(run(["netsh", "wlan", "show", "interfaces"], 8))
    if IS_MAC:
        info = parse_system_profiler(run(["system_profiler", "SPAirPortDataType"], 15))
        if info and not info["ssid"]:  # visible after 'sudo ipconfig setverbose 1'
            m = re.search(r"\bSSID : (.+)", run(["ipconfig", "getsummary", iface], 3))
            if m and "redacted" not in m.group(1):
                info["ssid"] = m.group(1).strip()
        return info
    return None


def iface_counters(iface):
    """This computer's cumulative bytes (in, out)."""
    if IS_WINDOWS:
        return parse_netstat_e(run(["netstat", "-e"], 5))
    if IS_MAC:
        return parse_netstat_ibn(run(["netstat", "-ibn", "-I", iface], 3))
    return None


def ping_start(host):
    """Start a single ping in the background; finish with ping_result()."""
    cmd = ["ping", "-n", "1", "-w", "2000", host] if IS_WINDOWS else ["ping", "-c", "1", "-t", "2", host]
    return subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, creationflags=_NO_WINDOW)


def ping_result(proc, timeout=3.5):
    try:
        out = proc.communicate(timeout=timeout)[0]
        return parse_ping_time(out.decode("utf-8", "replace") if isinstance(out, bytes) else out)
    except Exception:
        proc.kill()
        return None


def ping_times(host, count):
    """Reply times (ms) for `count` pings; lost pings are simply missing from the list."""
    if IS_WINDOWS:
        out = run(["ping", "-n", str(count), "-w", "2000", host], count * 2.5 + 5)
    else:
        out = run(["ping", "-c", str(count), "-i", "0.3", "-t", str(int(count * 0.3) + 4), host], count + 8)
    return parse_ping_times(out)
