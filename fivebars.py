#!/usr/bin/env python3
"""Fivebars - know your connection.

A local dashboard for your internet connection on macOS and Windows. It works on any
network (home router, phone hotspot, office Wi-Fi) using this computer's own measurements,
and adds full router details on supported 4G routers (ZTE "goform" firmware, used by
many MTN, Airtel and other carriers' home routers).

Everything runs on this computer: it samples the network every 2 seconds into a local
SQLite database, detects outages and other events, and serves the dashboard at
http://localhost:8555 (only reachable from this computer).

    python3 fivebars.py            # macOS
    py fivebars.py                 # Windows

Settings (router password, OpenCellID key, country) are entered in the app and stored in
your user data folder, never in this source tree. Nothing is uploaded anywhere: the only
outside traffic is a 1-packet ping to 1.1.1.1 every 2 s, map tiles, and speed tests /
balance checks / tower downloads when you ask for them.
"""
import base64
import collections
import http.cookiejar
import json
import os
import re
import socket
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import netprobe

__version__ = "0.1.0"
APP = "Fivebars"
PORT = int(os.environ.get("FIVEBARS_PORT", "8555"))
PING_HOST = "1.1.1.1"
INTERVAL = 2.0
KEEP_DAYS = 14

HERE = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))  # PyInstaller unpacks here
WEB = HERE / "web"


def default_data_dir():
    if os.environ.get("FIVEBARS_DATA"):
        return Path(os.environ["FIVEBARS_DATA"])
    home = Path.home()
    if netprobe.IS_WINDOWS:
        return Path(os.environ.get("APPDATA", home)) / APP
    if netprobe.IS_MAC:
        return home / "Library" / "Application Support" / APP
    return home / ".local" / "share" / "fivebars"


DATA = default_data_dir()
DATA.mkdir(parents=True, exist_ok=True)
CONFIG_FILE = DATA / "config.json"
_cfg_lock = threading.Lock()


def load_config():
    try:
        return json.loads(CONFIG_FILE.read_text())
    except Exception:
        return {}


def cfg(key, default=None):
    env = {"router_password": "FIVEBARS_ROUTER_PASSWORD", "opencellid_key": "FIVEBARS_OPENCELLID_KEY"}.get(key)
    if env and os.environ.get(env):
        return os.environ[env]
    return load_config().get(key, default)


def save_config(updates):
    with _cfg_lock:
        c = load_config()
        for k, v in updates.items():
            if v in (None, ""):
                c.pop(k, None)
            else:
                c[k] = v
        CONFIG_FILE.write_text(json.dumps(c, indent=2))
        try:
            os.chmod(CONFIG_FILE, 0o600)  # secrets: readable by this user only
        except OSError:
            pass


def router_password():
    return cfg("router_password", "admin")  # "admin" is the factory default on most of these routers


# Mobile networks by MCC+MNC (short names). Unknown codes fall back to "Network <code>".
OPERATORS = {
    "62001": "MTN", "62002": "Telecel", "62003": "AirtelTigo", "62006": "AirtelTigo", "62007": "Glo",
    "62120": "Airtel", "62130": "MTN", "62150": "Glo", "62160": "9mobile",
    "63902": "Safaricom", "63903": "Airtel", "63907": "Telkom",
    "64002": "Yas", "64004": "Vodacom", "64005": "Airtel", "64101": "Airtel", "64110": "MTN", "64114": "Lycamobile",
    "65501": "Vodacom", "65502": "Telkom", "65507": "Cell C", "65510": "MTN",
    "60801": "Orange", "60802": "Free", "61202": "Moov", "61203": "Orange", "61205": "MTN",
    "62401": "MTN", "62402": "Orange", "63601": "Ethio Telecom",
    "23410": "O2", "23415": "Vodafone", "23420": "Three", "23430": "EE", "23433": "EE",
    "310260": "T-Mobile", "310410": "AT&T", "311480": "Verizon",
}
COUNTRIES = {
    "620": "Ghana", "621": "Nigeria", "639": "Kenya", "640": "Tanzania", "641": "Uganda", "655": "South Africa",
    "608": "Senegal", "612": "Côte d'Ivoire", "624": "Cameroon", "636": "Ethiopia", "234": "United Kingdom",
    "310": "United States", "302": "Canada", "404": "India", "262": "Germany", "208": "France",
}
# Balance-check shortcuts per operator (only shown when the router's SIM is on that network).
USSD_SHORTCUTS = {
    "62001": [["*323*4#", "Data balance", "Remaining bundle data"], ["*663#", "Detailed balance", "All bundles and expiry dates"],
              ["*310#", "Airtime", "Credit on the SIM"]],
}


def operator_name(mccmnc):
    if not mccmnc:
        return None
    return OPERATORS.get(mccmnc) or f"Network {mccmnc}"


# The router crashes on very long field lists - keep each request under ~25 fields.
LIVE_FIELDS = (
    "signalbar,network_type,sub_network_type,ppp_status,lte_rsrp,rssi,"
    "realtime_tx_bytes,realtime_rx_bytes,realtime_time,realtime_tx_thrpt,realtime_rx_thrpt,"
    "monthly_rx_bytes,monthly_tx_bytes,monthly_time,sta_count,wan_ipaddr,network_provider,"
    "simcard_roam,modem_main_state,pin_status,cell_id,lac,sms_unread_num"
)
DETAIL_FIELDS = [
    "imei,sim_imsi,ziccid,cr_version,hw_version,SSID1,AuthMode,EncrypType,Channel,"
    "wifi_coverage,MAX_Access_num,HideSSID,dhcpStart,dhcpEnd,dhcpLease_hour,"
    "lan_ipaddr,wan_apn,apn_mode,dial_mode,fota_new_version_state,sim_lock_status",
    "data_volume_limit_switch,data_volume_limit_size,data_volume_alert_percent,"
    "roam_setting_option,user_ip_addr,wifi_cur_state,m_ssid_enable,wifi_band,"
    "sntp_process_result,sms_unread_num",
]

USSD_ERRORS = {
    "1": "No network service for USSD right now.",
    "2": "The network ended the session.",
    "3": "Timed out waiting for the network.", "4": "Timed out waiting for the network.",
    "unknown": "Timed out waiting for the network.",
    "10": "Router busy - try again in a few seconds.",
    "41": "Operation not supported.", "99": "USSD not supported.",
}


def rate_signal(rsrp):
    if rsrp is None:
        return "Unknown"
    return "Excellent" if rsrp >= -80 else "Good" if rsrp >= -90 else "Fair" if rsrp >= -100 else "Poor"


# --------------------------------------------------------------------------- router

class ZteRouter:
    """ZTE 'goform' web API, used by many carrier-branded 4G home routers (e.g. MTN Broadband 4G CPE GL738).
    Only used when the gateway speaks it."""
    driver = "zte"

    def __init__(self, base):
        self.base = base
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.lock = threading.Lock()  # the router copes badly with parallel requests

    def _req(self, path, data=None, timeout=6):
        body = urllib.parse.urlencode(data).encode() if data is not None else None
        req = urllib.request.Request(self.base + path, data=body, headers={"Referer": self.base + "/index.html"})
        with self.opener.open(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8", "replace") or "{}")

    @classmethod
    def probe(cls, gateway):
        """True if the gateway answers the ZTE API (cheap, unauthenticated)."""
        r = cls(f"http://{gateway}")
        try:
            return "loginfo" in r.get("loginfo,network_provider", timeout=3) and r
        except Exception:
            return None

    def get(self, cmd, multi=True, timeout=6):
        q = {"isTest": "false", "cmd": cmd, "_": str(int(time.time() * 1000))}
        if multi:
            q["multi_data"] = "1"
        with self.lock:
            return self._req("/goform/goform_get_cmd_process?" + urllib.parse.urlencode(q), timeout=timeout)

    def set(self, goform_id, **params):
        with self.lock:
            return self._req("/goform/goform_set_cmd_process",
                             {"isTest": "false", "goformId": goform_id, **params})

    def login(self):
        res = self.set("LOGIN", password=base64.b64encode(router_password().encode()).decode())
        if res.get("result") not in ("0", "4"):
            raise RuntimeError({"2": "Another user is logged in to the router",
                                "3": "Wrong router password"}.get(res.get("result"), "Router login failed"))

    def ensure_login(self):
        if self.get("loginfo").get("loginfo") != "ok":
            self.login()

    def ussd(self, code, reply=False):
        self.ensure_login()
        if reply:
            res = self.set("USSD_PROCESS", USSD_operator="ussd_reply", USSD_reply_number=code)
        else:
            res = self.set("USSD_PROCESS", USSD_operator="ussd_send", USSD_send_number=code)
        if res.get("result") != "success":
            return {"ok": False, "error": "Router refused the request."}
        deadline = time.time() + 45
        while time.time() < deadline:
            flag = self.get("ussd_write_flag", multi=False).get("ussd_write_flag", "")
            if flag == "16":
                info = self.get("ussd_data_info", multi=False)
                return {"ok": True, "text": decode_ucs2(info.get("ussd_data", "")),
                        "needs_reply": info.get("ussd_action") == "1"}
            if flag == "15":
                time.sleep(1)
                continue
            return {"ok": False, "error": USSD_ERRORS.get(flag, f"USSD failed (code {flag}).")}
        return {"ok": False, "error": "Timed out waiting for the network."}


def decode_ucs2(s):
    """The router returns USSD text as UCS-2 hex in 4-character groups."""
    s = s.strip()
    if not s or len(s) % 4 or any(c not in "0123456789abcdefABCDEF" for c in s):
        return s
    return "".join(chr(int(s[i:i + 4], 16)) for i in range(0, len(s), 4)
                   if s[i:i + 4] not in ("0000", "0009"))


# --------------------------------------------------------------------------- naming networks

def default_name(net, wifi):
    gw = net["gateway"]
    if gw == "172.20.10.1":
        return "iPhone Hotspot", "iPhone Personal Hotspot"
    if gw in ("192.168.43.1", "192.168.49.1"):
        return "Phone Hotspot", "Android hotspot"
    if wifi is not None:
        return "Wi-Fi network", f"Wi-Fi · router {gw}"
    return "Wired network", f"Ethernet · router {gw}"


# --------------------------------------------------------------------------- storage

class DB:
    def __init__(self, path):
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.lock = threading.Lock()
        self.conn.executescript("""
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS samples (
                ts REAL PRIMARY KEY, ok INT, ppp INT, down REAL, up REAL,
                rx INT, tx INT, rsrp INT, bars INT, lat REAL, cell TEXT, sta INT);
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY, ts REAL, kind TEXT, level TEXT, title TEXT,
                detail TEXT, duration REAL, open INT DEFAULT 0);
            CREATE TABLE IF NOT EXISTS devices (
                mac TEXT PRIMARY KEY, name TEXT, first_seen REAL, last_seen REAL,
                last_ip TEXT, hostname TEXT, kind TEXT);
            CREATE TABLE IF NOT EXISTS speedtests (
                ts REAL PRIMARY KEY, down REAL, up REAL, lat REAL, jitter REAL, loss REAL, mb REAL);
            CREATE TABLE IF NOT EXISTS networks (
                id TEXT PRIMARY KEY, name TEXT, custom_name TEXT, label TEXT, driver TEXT,
                gateway TEXT, first_seen REAL, last_seen REAL);
            CREATE INDEX IF NOT EXISTS events_ts ON events(ts);
        """)
        # migrations: tag everything with the network it belongs to
        for table, cols in (("samples", ["net TEXT", "skind TEXT"]), ("events", ["net TEXT"]),
                            ("devices", ["net TEXT"]), ("speedtests", ["net TEXT"])):
            have = {r[1] for r in self.conn.execute(f"PRAGMA table_info({table})")}
            for c in cols:
                if c.split()[0] not in have:
                    self.conn.execute(f"ALTER TABLE {table} ADD COLUMN {c}")
                    if c.startswith("net "):
                        self.conn.execute(f"UPDATE {table} SET net='legacy'")
                    if c.startswith("skind"):
                        self.conn.execute("UPDATE samples SET skind='lte' WHERE rsrp IS NOT NULL")
        usage_cols = {r[1] for r in self.conn.execute("PRAGMA table_info(usage)")}
        if not usage_cols:  # fresh install
            self.conn.execute("CREATE TABLE usage (hour INT, net TEXT, rx INT, tx INT, n INT, PRIMARY KEY (hour, net))")
        elif "net" not in usage_cols:  # upgrade from the single-network version
            self.conn.executescript("""
                CREATE TABLE usage2 (hour INT, net TEXT, rx INT, tx INT, n INT, PRIMARY KEY (hour, net));
                INSERT INTO usage2 SELECT hour, 'legacy', rx, tx, n FROM usage WHERE EXISTS (SELECT 1 FROM usage);
                DROP TABLE IF EXISTS usage;
                ALTER TABLE usage2 RENAME TO usage;
            """)
        self.conn.execute("CREATE INDEX IF NOT EXISTS samples_net ON samples(net, ts)")
        self.conn.commit()

    def q(self, sql, args=()):
        with self.lock:
            return [dict(r) for r in self.conn.execute(sql, args).fetchall()]

    def x(self, sql, args=()):
        with self.lock:
            cur = self.conn.execute(sql, args)
            self.conn.commit()
            return cur.lastrowid


db = DB(DATA / "history.db")


def rate_signal(v, kind="lte"):
    if v is None:
        return "Unknown"
    t = (-50, -60, -70) if kind == "wifi" else (-80, -90, -100)
    return "Excellent" if v >= t[0] else "Good" if v >= t[1] else "Fair" if v >= t[2] else "Poor"


# --------------------------------------------------------------------------- monitor

class Monitor:
    """Samples the current network every 2 s, records history and detects events.

    Works on any network using the Mac's own measurements (latency, traffic counters, Wi-Fi link).
    When the gateway is a supported router (ZTE goform firmware) it adds the router's view: 4G signal, mast,
    SIM, connected devices and USSD.
    """

    def __init__(self):
        self.net = None            # current network: id, gateway, iface, name, label, driver
        self.router = None         # ZteRouter when supported
        self.wifi = None           # latest Wi-Fi link info (Wi-Fi interfaces only)
        self.reset_state()
        self.recent = collections.deque(maxlen=900)
        self.open = {}
        self.ping_fail_streak = 0
        self.slow_since = None
        self.dns_ok = None
        self.gateway_ok = None
        self.last_error = ""
        last = db.q("SELECT MAX(ts) AS t FROM samples")[0]["t"]
        for e in db.q("SELECT id, ts FROM events WHERE open=1"):
            db.x("UPDATE events SET open=0, duration=? WHERE id=?", (max(0, (last or e["ts"]) - e["ts"]), e["id"]))
        self.event("monitor", "info", "Monitoring started", "The dashboard began recording. Gaps before this are times it wasn't running.")

    def reset_state(self):
        self.live, self.details, self.band, self.devices = {}, {}, "", []
        self.router_ok = None
        self.prev = None
        self.prev_mac = None
        self.poor_since = None
        self.known_macs = None
        self._last_live = None
        self.details_due = False
        self.joined = time.time()

    @property
    def operator(self):
        return operator_name(self.live.get("network_provider")) if self.router else None

    @property
    def net_id(self):
        return self.net["id"] if self.net else None

    # ---- events
    def event(self, kind, level, title, detail="", ongoing=False):
        eid = db.x("INSERT INTO events (ts, kind, level, title, detail, open, net) VALUES (?,?,?,?,?,?,?)",
                   (time.time(), kind, level, title, detail, 1 if ongoing else 0, self.net_id if hasattr(self, "net") else None))
        if ongoing:
            self.open[kind] = eid
        return eid

    def start_outage(self, kind, level, title, detail=""):
        if kind not in self.open:
            self.event(kind, level, title, detail, ongoing=True)

    def end_outage(self, kind):
        eid = self.open.pop(kind, None)
        if eid:
            row = db.q("SELECT ts FROM events WHERE id=?", (eid,))
            if row:
                db.x("UPDATE events SET open=0, duration=? WHERE id=?", (time.time() - row[0]["ts"], eid))

    # ---- network changes
    def _switch(self, found):
        prev_name = self.net["name"] if self.net else None
        for kind in list(self.open):
            if kind != "no_network":
                self.end_outage(kind)
        self.reset_state()
        self.recent.clear()
        if not found:
            self.net, self.router, self.wifi = None, None, None
            self.start_outage("no_network", "critical", "No network connection",
                              "This Mac isn't connected to any network." + (f" Was on {prev_name}." if prev_name else ""))
            return
        self.end_outage("no_network")
        self.router = ZteRouter.probe(found["gateway"]) or None
        self.wifi = netprobe.wifi_info(found["iface"]) if netprobe.is_wifi(found["iface"]) else None
        if self.router:
            # read the router's Wi-Fi name right away so the network isn't announced under a generic name,
            # and have the slow loop fetch the full details on its next pass rather than within a minute
            try:
                first = self.router.get("SSID1,network_provider", timeout=3)
                self.details = {"SSID1": first.get("SSID1") or ""}
                self.live = {"network_provider": first.get("network_provider") or ""}
            except Exception:
                pass
            self.details_due = True
        known = db.q("SELECT * FROM networks WHERE id=?", (found["id"],))
        name, label = default_name(found, self.wifi)
        if self.router:
            label = f"{self.operator or 'ZTE'} 4G router"
            # first time we meet a supported router: it owns the history recorded before networks were tracked
            if not db.q("SELECT 1 FROM networks WHERE driver='zte' LIMIT 1"):
                for t in ("samples", "events", "devices", "usage", "speedtests"):
                    db.x(f"UPDATE {t} SET net=? WHERE net='legacy'", (found["id"],))
        name = (self.wifi or {}).get("ssid") or (known[0]["name"] if known else None) or name
        now = time.time()
        if known:
            db.x("UPDATE networks SET name=?, label=?, driver=?, gateway=?, last_seen=? WHERE id=?",
                 (name, label, self.router.driver if self.router else "generic", found["gateway"], now, found["id"]))
        else:
            db.x("INSERT INTO networks VALUES (?,?,?,?,?,?,?,?)",
                 (found["id"], name, None, label, self.router.driver if self.router else "generic", found["gateway"], now, now))
        self.net = {**found, "label": label, "driver": self.router.driver if self.router else "generic"}
        self.refresh_name()
        self.event("network", "info", f"Connected to {self.net['name']}",
                   f"{label} · gateway {found['gateway']}" + (" · full router details available" if self.router else
                                                               " · measuring from this Mac (router details not available)"))

    def refresh_name(self):
        """Display name: your custom name > router's Wi-Fi name > macOS Wi-Fi name > remembered/default."""
        if not self.net:
            return
        row = db.q("SELECT name, custom_name FROM networks WHERE id=?", (self.net["id"],))
        ssid = self.details.get("SSID1") or (self.wifi or {}).get("ssid")
        if ssid and row and row[0]["name"] != ssid:
            db.x("UPDATE networks SET name=? WHERE id=?", (ssid, self.net["id"]))
        custom = row[0]["custom_name"] if row else None
        self.net["name"] = custom or ssid or (row[0]["name"] if row else None) or default_name(self.net, self.wifi)[0]
        self.net["named_by"] = "you" if custom else "router" if self.details.get("SSID1") else "macOS" if (self.wifi or {}).get("ssid") else "default"

    # ---- loops
    def run(self):
        threading.Thread(target=self._slow_loop, daemon=True).start()
        while True:
            t0 = time.time()
            try:
                self._tick()
            except Exception as e:  # never let the sampler die
                self.last_error = str(e)
            time.sleep(max(0.2, INTERVAL - (time.time() - t0)))

    def _ping(self):
        return netprobe.ping_start(PING_HOST)

    def _tick(self):
        now = time.time()
        found = netprobe.detect_network()
        if (found and found["id"]) != self.net_id or (found is None and self.net is not None) or (found is None and "no_network" not in self.open):
            if not (found is None and self.net is None and "no_network" in self.open):
                self._switch(found)
        p = self._ping()
        live, ok = {}, None
        if self.router:
            try:
                live = self.router.get(LIVE_FIELDS)
                ok = True
            except Exception as e:
                ok = False
                self.last_error = str(e)
        lat = netprobe.ping_result(p)

        if self.router and ok != self.router_ok:
            if not ok:
                self.start_outage("router_down", "critical", "Router isn't answering",
                                  f"This Mac couldn't reach the router at {self.net['gateway']}.")
            elif self.router_ok is False:
                self.end_outage("router_down")
            self.router_ok = ok

        down = up = rx = tx = sig = bars = None
        ppp, skind = None, None
        if self.router and ok:
            self.live = live
            ppp = 1 if live.get("ppp_status") == "ppp_connected" else 0
            sig, skind = _int(live.get("lte_rsrp")) or _int(live.get("rssi")), "lte"
            bars = _int(live.get("signalbar"))
            # The router sometimes returns empty counters (e.g. just after a login); never treat that as 0,
            # or the next real reading would count the whole session as 2 seconds of traffic.
            cur_rx, cur_tx = _int(live.get("realtime_rx_bytes")), _int(live.get("realtime_tx_bytes"))
            rx, tx, down, up = self._delta(self.prev, cur_rx, cur_tx, now, 40e6)
            if self.prev is None and cur_rx is not None:
                down, up = float(live.get("realtime_rx_thrpt") or 0), float(live.get("realtime_tx_thrpt") or 0)
            self._detect(live, ppp, sig, now)
            if cur_rx is not None and cur_tx is not None:
                self.prev = {"ts": now, "rx": cur_rx, "tx": cur_tx}
        elif self.net:
            # no router API: measure this Mac's own traffic and Wi-Fi signal
            c = netprobe.iface_counters(self.net["iface"])
            if c:
                rx, tx, down, up = self._delta(self.prev_mac, c[0], c[1], now, 250e6)
                self.prev_mac = {"ts": now, "rx": c[0], "tx": c[1]}
            if self.wifi and self.wifi.get("rssi") is not None:
                sig, skind = self.wifi["rssi"], "wifi"
                self._weak_signal(sig, "wifi", now)

        # internet reachability
        self.ping_fail_streak = 0 if lat is not None else self.ping_fail_streak + 1
        connected = self.net and (ppp if self.router else True)
        if connected and self.ping_fail_streak >= 3:
            self.start_outage("no_internet", "critical", "Internet isn't responding",
                              f"Connected to {self.operator or 'the mobile network'} but pings to the internet are failing. Often means the data bundle ran out."
                              if self.router else f"Connected to {self.net['name']} but pings to the internet are failing.")
        elif self.ping_fail_streak == 0:
            self.end_outage("no_internet")

        lats = [s["lat"] for s in list(self.recent)[-15:] if s["lat"] is not None]
        if lats and sum(lats) / len(lats) > 400:
            self.slow_since = self.slow_since or now
            if now - self.slow_since > 30:
                self.start_outage("high_latency", "warning", "High latency",
                                  f"Average {sum(lats) / len(lats):.0f} ms over the last 30 s. Pages and calls will feel sluggish.")
        else:
            self.slow_since = None
            self.end_outage("high_latency")

        sample = {"ts": now, "ok": int(bool(self.net) and ok is not False), "ppp": ppp, "down": down, "up": up,
                  "rx": rx, "tx": tx, "rsrp": sig, "bars": bars, "lat": lat,
                  "cell": live.get("cell_id") if ok else None, "sta": _int(live.get("sta_count")) if ok else None,
                  "net": self.net_id, "skind": skind}
        self.recent.append(sample)
        db.x("""INSERT OR REPLACE INTO samples (ts, ok, ppp, down, up, rx, tx, rsrp, bars, lat, cell, sta, net, skind)
                VALUES (:ts,:ok,:ppp,:down,:up,:rx,:tx,:rsrp,:bars,:lat,:cell,:sta,:net,:skind)""", sample)
        if self.net:
            db.x("""INSERT INTO usage VALUES (?,?,?,?,1) ON CONFLICT(hour, net)
                    DO UPDATE SET rx=rx+excluded.rx, tx=tx+excluded.tx, n=n+1""",
                 (int(now // 3600 * 3600), self.net_id, rx or 0, tx or 0))

    @staticmethod
    def _delta(prev, cur_rx, cur_tx, now, max_rate):
        if cur_rx is None or cur_tx is None:
            return None, None, None, None
        if not prev:
            return 0, 0, None, None
        dt = max(0.5, now - prev["ts"])
        rx = cur_rx - prev["rx"] if cur_rx >= prev["rx"] else cur_rx  # smaller = counter reset
        tx = cur_tx - prev["tx"] if cur_tx >= prev["tx"] else cur_tx
        if (rx + tx) / dt > max_rate:  # impossible rate: a counter glitch, not traffic
            rx = tx = 0
        return rx, tx, rx / dt, tx / dt

    def _weak_signal(self, sig, kind, now):
        if sig is not None and rate_signal(sig, kind) == "Poor":
            self.poor_since = self.poor_since or now
            if now - self.poor_since > 30:
                self.start_outage("weak_signal", "warning", "Weak signal" if kind == "lte" else "Weak Wi-Fi signal",
                                  f"Signal at {sig} dBm for over 30 s. " + ("Expect slow speeds and drop-outs." if kind == "lte"
                                                                            else "Move closer to the router or hotspot."))
        else:
            self.poor_since = None
            self.end_outage("weak_signal")

    def _detect(self, live, ppp, rsrp, now):
        # Right after a login the router can answer with blank fields; comparing those against the
        # previous reading would invent events (fake roaming, network changes), so skip such readings.
        if not live.get("network_provider") or not live.get("simcard_roam"):
            return
        prev = self._last_live
        self._last_live = live
        if not ppp:
            self.start_outage("offline", "critical", f"Lost connection to {self.operator or 'the mobile network'}", "The router dropped its mobile data connection.")
        else:
            self.end_outage("offline")
        self._weak_signal(rsrp, "lte", now)
        if not prev:
            return
        if prev.get("cell_id") and live.get("cell_id") and prev["cell_id"] != live["cell_id"]:
            self.event("cell", "info", "Switched to a different mast",
                       f"Cell {prev['cell_id']} → {live['cell_id']}. Normal, but frequent switching means the router sits between two masts.")
        if prev.get("network_type") and prev["network_type"] != live.get("network_type"):
            lvl = "warning" if live.get("network_type") not in ("LTE", "LTE-A", "ENDC") else "info"
            self.event("nettype", lvl, f"Network changed to {live.get('network_type') or 'none'}",
                       f"Was {prev['network_type']}. 3G/2G is much slower than 4G.")
        if prev.get("wan_ipaddr") and live.get("wan_ipaddr") and prev["wan_ipaddr"] != live["wan_ipaddr"]:
            self.event("wan_ip", "info", "Public IP address changed",
                       f"{prev['wan_ipaddr']} → {live['wan_ipaddr']}. The network assigned a new address (usually after a reconnect).")
        if _int(live.get("realtime_time")) is not None and _int(prev.get("realtime_time")) is not None \
                and _int(live["realtime_time"]) + 10 < _int(prev["realtime_time"]):
            self.event("session", "warning", "Data session restarted", "The router reconnected to the mobile network (a restart or a dropped connection).")
        if prev.get("simcard_roam") == "Home" and live.get("simcard_roam") not in ("Home", None, ""):
            self.event("roaming", "warning", "Roaming", "The SIM is on a roaming network - charges may differ.")

    def _slow_loop(self):
        n = 0
        while True:
            try:
                net, rt = self.net, self.router
                if net and not rt and net["gateway"]:
                    self.gateway_ok = bool(netprobe.ping_times(net["gateway"], 1))
                if net and netprobe.is_wifi(net["iface"]) and n % 2 == 0:  # every ~20 s
                    w = netprobe.wifi_info(net["iface"])
                    if self.net is net:
                        self.wifi = w
                        self.refresh_name()
                if rt:
                    rt.ensure_login()
                    self._poll_devices()
                    if n % 6 == 0 or self.details_due:  # every ~60 s, or straight after joining
                        self.details_due = False
                        d = {}
                        for g in DETAIL_FIELDS:
                            d.update(rt.get(g))
                        band = rt.get("GET_RESIDE_BAND", multi=False).get("result", "")
                        if self.band and band and band != self.band:
                            self.event("band", "info", f"Band changed to {band.replace('LTE ', '')}", f"Was {self.band.replace('LTE ', '')}.")
                        if self.router is rt:
                            self.band = band or self.band
                            self.details = d
                            self.refresh_name()
                if n % 6 == 0:
                    try:
                        socket.getaddrinfo("google.com", 443)
                        self.dns_ok = True
                    except Exception:
                        self.dns_ok = False
                if n % 180 == 0:  # hourly
                    db.x("DELETE FROM samples WHERE ts < ?", (time.time() - KEEP_DAYS * 86400,))
            except Exception as e:
                self.last_error = str(e)
            n += 1
            time.sleep(10)

    def _poll_devices(self):
        rt, net = self.router, self.net_id
        wifi = rt.get("station_list", multi=False).get("station_list", []) or []
        lan = rt.get("lan_station_list", multi=False).get("lan_station_list", []) or []
        now = time.time()
        devs = wifi + lan
        macs = {d["mac_addr"].upper() for d in devs}
        names = {r["mac"]: r for r in db.q("SELECT * FROM devices WHERE net=?", (net,))}
        for d in devs:
            mac = d["mac_addr"].upper()
            if mac in names:
                db.x("UPDATE devices SET last_seen=?, last_ip=?, hostname=?, kind=? WHERE mac=?",
                     (now, d.get("ip_addr"), d.get("hostname"), d.get("dev_type"), mac))
            else:
                db.x("INSERT OR REPLACE INTO devices (mac, name, first_seen, last_seen, last_ip, hostname, kind, net) VALUES (?,?,?,?,?,?,?,?)",
                     (mac, None, now, now, d.get("ip_addr"), d.get("hostname"), d.get("dev_type"), net))
        if self.known_macs is not None:
            label = lambda m: (names.get(m) or {}).get("name") or next(
                (d.get("hostname") for d in devs if d["mac_addr"].upper() == m and d.get("hostname") not in (None, "", "--")),
                None) or f"Device {m[-5:]}"
            for m in macs - self.known_macs:
                self.event("device_join", "info", f"{label(m)} joined the Wi-Fi",
                           ("A device that has never connected before. " if m not in names else "") + f"MAC {m}")
            for m in self.known_macs - macs:
                self.event("device_leave", "info", f"{label(m)} left the Wi-Fi", f"MAC {m}")
        self.known_macs = macs
        self.devices = devs


def _int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


monitor = Monitor()


# --------------------------------------------------------------------------- API builders

def net_info():
    m = monitor
    if not m.net:
        if not m.recent:  # first measurement hasn't finished yet
            return {"connected": None, "name": "Starting…", "label": "Checking your connection", "driver": None}
        return {"connected": False, "name": "Not connected", "label": "No network", "driver": None}
    w = m.wifi or {}
    return {"connected": True, "id": m.net["id"], "name": m.net["name"], "label": m.net["label"],
            "named_by": m.net.get("named_by"), "driver": m.net["driver"], "gateway": m.net["gateway"],
            "iface": m.net["iface"], "mac": m.net["mac"], "wifi": w or None, "joined": m.joined}


def caps():
    zte = bool(monitor.router)
    return {"router": zte, "cellular": zte, "devices": zte, "ussd": zte, "sim": zte, "wifi": bool(monitor.wifi)}


def api_live():
    m = monitor
    l, d = m.live, m.details
    rec = list(m.recent)
    last = rec[-1] if rec else {}
    minute = [s for s in rec if s["ts"] > time.time() - 60]
    pings = [s["lat"] for s in minute]
    ok_p = [p for p in pings if p is not None]
    spark = rec[-60:]
    day0 = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
    today = db.q("SELECT COALESCE(SUM(rx),0) rx, COALESCE(SUM(tx),0) tx FROM usage WHERE hour >= ? AND net=?", (day0, m.net_id))[0]
    month0 = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0).timestamp()
    month = db.q("SELECT COALESCE(SUM(rx),0) rx, COALESCE(SUM(tx),0) tx FROM usage WHERE hour >= ? AND net=?", (month0, m.net_id))[0]
    checks = status_checks()
    skind = last.get("skind") or ("lte" if m.router else "wifi" if m.wifi else None)
    zte = bool(m.router)
    return {
        "ts": last.get("ts"), "network": net_info(), "caps": caps(),
        "router_ok": m.router_ok if zte else m.gateway_ok, "error": m.last_error if zte and not m.router_ok else "",
        "online": bool(m.net) and (bool(last.get("ppp")) if zte else True) and m.ping_fail_streak < 3,
        "traffic_scope": "network" if zte else "mac",
        "down": last.get("down"), "up": last.get("up"), "lat": last.get("lat"),
        "lat_avg": sum(ok_p) / len(ok_p) if ok_p else None,
        "ping_success": 100 * len(ok_p) / len(pings) if pings else None,
        "rsrp": last.get("rsrp"), "signal_kind": skind, "rating": rate_signal(last.get("rsrp"), skind or "lte"), "bars": last.get("bars"),
        "spark": {k: [s[k] for s in spark] for k in ("down", "up", "lat", "rsrp")},
        "network_type": l.get("network_type"), "sub_network_type": l.get("sub_network_type"),
        "operator": operator_name(l.get("network_provider")),
        "ussd_shortcuts": USSD_SHORTCUTS.get(l.get("network_provider") or "", []) if zte else [],
        "mccmnc": l.get("network_provider"), "band": m.band, "cell_id": l.get("cell_id"),
        "session_time": _int(l.get("realtime_time")) if zte else time.time() - m.joined,
        "month_time": _int(l.get("monthly_time")),
        "session_rx": _int(l.get("realtime_rx_bytes")), "session_tx": _int(l.get("realtime_tx_bytes")),
        "month_rx": _int(l.get("monthly_rx_bytes")) if zte else month["rx"],
        "month_tx": _int(l.get("monthly_tx_bytes")) if zte else month["tx"],
        "today_rx": today["rx"], "today_tx": today["tx"],
        "devices": _int(l.get("sta_count")), "max_devices": _int(d.get("MAX_Access_num")),
        "wan_ip": l.get("wan_ipaddr"), "roaming": l.get("simcard_roam") not in ("Home", None, ""),
        "ssid": m.net["name"] if m.net else None, "sms_unread": _int(l.get("sms_unread_num")),
        "alerts": sum(1 for c in checks if not c["ok"] and c.get("alert")),
        "default_password": zte and router_password() == "admin",
    }


def status_checks():
    m, l, d = monitor, monitor.live, monitor.details
    rec = list(monitor.recent)[-30:]
    lats = [s["lat"] for s in rec if s["lat"] is not None]
    loss = 100 * sum(1 for s in rec if s["lat"] is None) / len(rec) if rec else 0
    sig = rec[-1]["rsrp"] if rec else None
    C = lambda group, label, ok, detail, alert=True, level="critical": {
        "group": group, "label": label, "ok": bool(ok), "detail": detail, "alert": alert, "level": level}
    if not m.net:
        return [C("Network", "Connected to a network", False, "This Mac has no network connection")]
    internet = [
        C("Internet", "Internet reachable", m.ping_fail_streak < 3, f"Pinging {PING_HOST}"),
        C("Internet", "Latency normal", not lats or sum(lats) / len(lats) < 300,
          f"{sum(lats) / len(lats):.0f} ms average (last minute)" if lats else "No data", level="warning"),
        C("Internet", "Packet loss low", loss < 10, f"{loss:.0f}% lost (last minute)", level="warning"),
        C("Internet", "DNS working", m.dns_ok is not False, "Website names resolve"),
    ]
    if not m.router:
        w = m.wifi or {}
        out = [C("Network", "Gateway answering", m.gateway_ok is not False, f"{m.net['gateway']} responds" if m.gateway_ok else f"{m.net['gateway']}")]
        if m.wifi:
            out += [C("Network", "Wi-Fi signal healthy", sig is None or rate_signal(sig, "wifi") != "Poor",
                      f"{sig} dBm · {rate_signal(sig, 'wifi')}" if sig is not None else "No reading", level="warning"),
                    C("Network", "Wi-Fi encrypted", (w.get("security") or "WPA").lower() not in ("none", "open"), w.get("security") or "–")]
        out.append(C("Network", "Router details", False, "This router's API isn't supported; measuring from this Mac", alert=False, level="info"))
        return out + internet
    sessions = db.q("SELECT COUNT(*) n FROM events WHERE kind='session' AND ts > ? AND net=?", (time.time() - 3600, m.net_id))[0]["n"]
    sta, mx = _int(l.get("sta_count")) or 0, _int(d.get("MAX_Access_num")) or 32
    return [
        C("Router", "Router answering", m.router_ok, f"{m.net['gateway']} responds" if m.router_ok else m.last_error),
        C("Router", "Wi-Fi radio on", d.get("wifi_cur_state", "1") == "1", "Broadcasting " + (d.get("SSID1") or "")),
        C("Router", "Device slots available", sta < mx, f"{sta} of {mx} in use", level="warning"),
        C("Router", "Firmware up to date", d.get("fota_new_version_state", "no_new_version") == "no_new_version",
          d.get("cr_version", ""), alert=False, level="warning"),
        C("Router", "Clock synced", d.get("sntp_process_result", "success") == "success", "Network time", alert=False, level="warning"),
        C("Mobile network", "SIM ready", l.get("modem_main_state") == "modem_init_complete" and l.get("pin_status") in ("0", None),
          "SIM detected and unlocked"),
        C("Mobile network", f"Connected to {m.operator or 'mobile network'}", l.get("ppp_status") == "ppp_connected",
          f"{m.operator or ''} data session"),
        C("Mobile network", "On 4G", l.get("network_type") in ("LTE", "LTE-A", "ENDC"), l.get("network_type") or "No service", level="warning"),
        C("Mobile network", "Signal healthy", sig is not None and sig >= -100, f"{sig} dBm · {rate_signal(sig)}", level="warning"),
        C("Mobile network", "Not roaming", l.get("simcard_roam") in ("Home", None, ""), "Home network", level="warning"),
        C("Mobile network", "Data session stable", sessions <= 2, f"{sessions} reconnect(s) in the last hour", level="warning"),
        *internet,
        C("Security", "Admin password changed", router_password() != "admin",
          "Still the factory default 'admin'" if router_password() == "admin" else "Custom password", alert=False, level="warning"),
        C("Security", "Wi-Fi encrypted", d.get("AuthMode", "WPA2PSK") not in ("OPEN", "SHARED"),
          d.get("AuthMode", "") + " " + d.get("EncrypType", "")),
    ]


def api_history(rng):
    rng = max(60, min(int(rng), KEEP_DAYS * 86400))
    b = max(INTERVAL, rng / 450)
    since = time.time() - rng
    rows = db.q("""SELECT CAST(ts / ? AS INT) * ? AS t, AVG(down) down, MAX(down) down_max, AVG(up) up,
                          AVG(lat) lat, AVG(CASE WHEN lat IS NULL THEN 1.0 ELSE 0 END) loss,
                          AVG(rsrp) rsrp, MIN(ok) ok, MIN(ppp) ppp, COUNT(*) n
                   FROM samples WHERE ts >= ? AND net IS ? GROUP BY t ORDER BY t""", (b, b, since, monitor.net_id))
    events = db.q("""SELECT ts, duration, kind, open FROM events
                     WHERE kind IN ('offline','no_internet','router_down','no_network') AND net IS ?
                       AND (ts + COALESCE(duration, 0) >= ? OR open=1)""", (monitor.net_id, since))
    outages = [{"start": e["ts"], "end": time.time() if e["open"] else e["ts"] + (e["duration"] or 0), "kind": e["kind"]}
               for e in events]
    skind = "lte" if monitor.router else "wifi" if monitor.wifi else None
    return {"bucket": b, "range": rng, "now": time.time(), "points": rows, "outages": outages, "signal_kind": skind}


def api_latency(rng):
    since = time.time() - int(rng)
    rows = db.q("SELECT lat FROM samples WHERE ts >= ? AND net IS ?", (since, monitor.net_id))
    vals = sorted(r["lat"] for r in rows if r["lat"] is not None)
    lost = sum(1 for r in rows if r["lat"] is None)
    bins = [0] * 30  # 0-600 ms in 20 ms bins; last bin is 580+
    for v in vals:
        bins[min(29, int(v // 20))] += 1
    pct = lambda p: vals[min(len(vals) - 1, int(p * len(vals)))] if vals else None
    return {"bins": bins, "bin_ms": 20, "count": len(vals), "lost": lost,
            "avg": sum(vals) / len(vals) if vals else None, "p50": pct(.5), "p95": pct(.95),
            "min": vals[0] if vals else None, "max": vals[-1] if vals else None}


def api_signal(rng):
    since = time.time() - int(rng)
    kind = "lte" if monitor.router else "wifi"
    rows = db.q("SELECT rsrp FROM samples WHERE ts >= ? AND rsrp IS NOT NULL AND net IS ? AND skind IS ?", (since, monitor.net_id, kind))
    buckets = collections.Counter(rate_signal(r["rsrp"], kind) for r in rows)
    vals = [r["rsrp"] for r in rows]
    return {"kind": kind, "share": {k: buckets.get(k, 0) for k in ("Excellent", "Good", "Fair", "Poor")}, "count": len(vals),
            "avg": sum(vals) / len(vals) if vals else None, "min": min(vals) if vals else None,
            "max": max(vals) if vals else None,
            "cells": db.q("SELECT cell, COUNT(*) n FROM samples WHERE ts >= ? AND cell IS NOT NULL AND net IS ? GROUP BY cell ORDER BY n DESC",
                          (since, monitor.net_id))}


def api_usage(period, net=None):
    net = net or monitor.net_id
    now = datetime.now()
    if period == "24h":
        start, step = time.time() - 23 * 3600, 3600
    elif period == "7d":
        start, step = now.replace(hour=0, minute=0, second=0, microsecond=0).timestamp() - 6 * 86400, 86400
    elif period == "month":
        start, step = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).timestamp(), 86400
    else:  # 30d
        start, step = now.replace(hour=0, minute=0, second=0, microsecond=0).timestamp() - 29 * 86400, 86400
    start = int(start // 3600 * 3600)
    rows = db.q("SELECT hour, rx, tx, n FROM usage WHERE hour >= ? AND net IS ?", (start, net))
    bars = {}
    for r in rows:
        k = r["hour"] if step == 3600 else int(datetime.fromtimestamp(r["hour"]).replace(hour=0).timestamp())
        b = bars.setdefault(k, {"t": k, "rx": 0, "tx": 0, "n": 0})
        b["rx"] += r["rx"]; b["tx"] += r["tx"]; b["n"] += r["n"]
    keys, t = [], start if step == 3600 else int(datetime.fromtimestamp(start).replace(hour=0).timestamp())
    while t <= time.time():
        keys.append(t)
        t = t + step if step == 3600 else int((datetime.fromtimestamp(t + 86400 + 7200)).replace(hour=0).timestamp())
    out = [bars.get(k, {"t": k, "rx": 0, "tx": 0, "n": 0}) for k in keys]
    span = time.time() - keys[0] if keys else 1
    covered = sum(b["n"] for b in out) * INTERVAL
    nets = db.q("""SELECT n.id, COALESCE(n.custom_name, n.name) name, n.label, n.driver, COALESCE(SUM(u.rx + u.tx), 0) total
                   FROM networks n LEFT JOIN usage u ON u.net = n.id AND u.hour >= ? GROUP BY n.id ORDER BY total DESC""", (start,))
    return {"step": step, "bars": out, "rx": sum(b["rx"] for b in out), "tx": sum(b["tx"] for b in out),
            "coverage": min(1, covered / span) if span else 0, "net": net, "networks": nets,
            "scope": "network" if (db.q("SELECT driver FROM networks WHERE id=?", (net,)) or [{}])[0].get("driver") == "zte" else "mac"}


def api_devices():
    known = {r["mac"]: r for r in db.q("SELECT * FROM devices WHERE net IS ?", (monitor.net_id,))}
    me = monitor.details.get("user_ip_addr")
    online = []
    for d in monitor.devices:
        mac = d["mac_addr"].upper()
        k = known.get(mac, {})
        online.append({"mac": mac, "ip": d.get("ip_addr"), "kind": d.get("dev_type"),
                       "hostname": None if d.get("hostname") in ("--", "") else d.get("hostname"),
                       "name": k.get("name"), "connect_time": d.get("connect_time"),
                       "first_seen": k.get("first_seen"), "me": d.get("ip_addr") == me,
                       "private": bool(int(mac[:2], 16) & 2)})
    on = {d["mac"] for d in online}
    offline = [{"mac": r["mac"], "ip": r["last_ip"], "kind": r["kind"], "name": r["name"],
                "hostname": None if r["hostname"] in ("--", "", None) else r["hostname"],
                "first_seen": r["first_seen"], "last_seen": r["last_seen"],
                "private": bool(int(r["mac"][:2], 16) & 2)}
               for r in known.values() if r["mac"] not in on]
    offline.sort(key=lambda r: -r["last_seen"])
    return {"online": online, "offline": offline, "supported": bool(monitor.router)}


def api_info():
    d, l = monitor.details, monitor.live
    return {**d, "band": monitor.band, "wan_ip": l.get("wan_ipaddr"), "operator": operator_name(l.get("network_provider")),
            "mccmnc": l.get("network_provider"), "default_password": bool(monitor.router) and router_password() == "admin",
            "version": __version__, "data_dir": str(DATA), "platform": netprobe.SYSTEM,
            "network": net_info(), "caps": caps(),
            "networks": db.q("SELECT id, COALESCE(custom_name, name) name, label, driver, gateway, first_seen, last_seen FROM networks ORDER BY last_seen DESC"),
            "db_size": (DATA / "history.db").stat().st_size, "since": db.q("SELECT MIN(ts) t FROM samples")[0]["t"],
            "samples": db.q("SELECT COUNT(*) n FROM samples")[0]["n"]}


def rename_network(data):
    if not monitor.net:
        raise RuntimeError("Not connected to a network")
    name = str(data.get("name", "")).strip()[:40] or None
    db.x("UPDATE networks SET custom_name=? WHERE id=?", (name, monitor.net_id))
    monitor.refresh_name()
    return net_info()

def api_diagnose():
    """Check each link in the chain: Mac -> router -> internet -> DNS -> web."""
    def ping(host):
        times = netprobe.ping_times(host, 3)
        return 100.0 * (3 - len(times)) / 3, (sum(times) / len(times) if times else None)

    checks = []
    loss, ms = ping(monitor.net["gateway"]) if monitor.net else (100.0, None)
    checks.append({"name": "Mac to router", "ok": loss < 100, "short": f"{ms:.0f} ms" if ms else "",
                   "detail": f"{ms:.0f} ms, {loss:.0f}% loss" if ms else ("Router not reachable" if monitor.net else "Not connected to a network")})
    loss, ms = ping(PING_HOST)
    checks.append({"name": "Router to internet", "ok": loss < 100, "short": f"{ms:.0f} ms" if ms else "",
                   "detail": f"{ms:.0f} ms, {loss:.0f}% loss" if ms else "No reply from the internet"})
    try:
        t = time.time()
        socket.getaddrinfo("google.com", 443)
        ms = (time.time() - t) * 1000
        checks.append({"name": "Website names (DNS)", "ok": True, "short": f"{ms:.0f} ms", "detail": f"google.com resolved in {ms:.0f} ms"})
    except Exception as e:
        checks.append({"name": "Website names (DNS)", "ok": False, "short": "", "detail": str(e)})
    try:
        t = time.time()
        with urllib.request.urlopen("http://captive.apple.com/hotspot-detect.html", timeout=8) as r:
            ok = b"Success" in r.read()
        ms = (time.time() - t) * 1000
        checks.append({"name": "Web pages load", "ok": ok, "short": f"{ms:.0f} ms",
                       "detail": f"Test page loaded in {ms:.0f} ms" if ok else "Redirected - a login page or blocked data"})
    except Exception as e:
        checks.append({"name": "Web pages load", "ok": False, "short": "", "detail": str(e)})
    return {"checks": checks}


# --------------------------------------------------------------------------- speed test

class SpeedTest:
    DOWN_URL = "https://speed.cloudflare.com/__down?bytes=25000000"
    UP_URL = "https://speed.cloudflare.com/__up"
    UA = {"User-Agent": "Mozilla/5.0 router-dashboard"}

    def __init__(self):
        self.state = {"phase": "idle"}
        self.lock = threading.Lock()

    def start(self):
        with self.lock:
            if self.state.get("phase") in ("latency", "download", "upload"):
                return self.state
            self.state = {"phase": "latency", "started": time.time(), "live": 0, "down": None, "up": None,
                          "lat": None, "jitter": None, "loss": None, "bytes": 0, "series": []}
        threading.Thread(target=self._run, daemon=True).start()
        return self.state

    def _run(self):
        s = self.state
        try:
            count = 5 if netprobe.IS_WINDOWS else 10  # Windows ping can't go faster than 1/s
            times = netprobe.ping_times(PING_HOST, count)
            s["loss"] = 100 * (count - len(times)) / count
            if times:
                s["lat"] = sorted(times)[len(times) // 2]
                s["jitter"] = sum(abs(a - b) for a, b in zip(times, times[1:])) / max(1, len(times) - 1)
            s["phase"] = "download"
            s["down"] = self._measure(self._down_worker, threads=4, seconds=10, cap=120e6)
            s["phase"] = "upload"
            s["live"] = 0
            s["up"] = self._measure(self._up_worker, threads=3, seconds=8, cap=40e6)
            s["phase"] = "done"
            # saving is best-effort: a storage problem must never hide a finished result
            try:
                db.x("INSERT INTO speedtests (ts, down, up, lat, jitter, loss, mb, net) VALUES (?,?,?,?,?,?,?,?)",
                     (time.time(), s["down"], s["up"], s["lat"], s["jitter"], s["loss"], s["bytes"] / 1e6, monitor.net_id))
                where = f" on {monitor.net['name']}" if monitor.net else ""
                monitor.event("speedtest", "info", f"Speed test{where}: {s['down']:.1f} down / {s['up']:.1f} up Mbps",
                              f"Latency {s['lat'] or 0:.0f} ms · used {s['bytes'] / 1e6:.0f} MB of data")
            except Exception as e:
                s["save_error"] = str(e)
        except Exception as e:
            s["phase"] = "error"
            s["error"] = str(e)

    def _measure(self, worker, threads, seconds, cap):
        s = self.state
        counter = {"n": 0, "stop": False}
        lock = threading.Lock()

        def add(n):
            with lock:
                counter["n"] += n
                s["bytes"] += n
                if counter["n"] >= cap:
                    counter["stop"] = True

        ts = [threading.Thread(target=worker, args=(counter, add), daemon=True) for _ in range(threads)]
        t0 = time.time()
        for t in ts:
            t.start()
        last_n, last_t, peak_window = 0, t0, []
        while time.time() - t0 < seconds and not counter["stop"]:
            time.sleep(0.25)
            now = time.time()
            mbps = (counter["n"] - last_n) * 8 / (now - last_t) / 1e6
            last_n, last_t = counter["n"], now
            peak_window.append(mbps)
            s["live"] = sum(peak_window[-4:]) / len(peak_window[-4:])
            s["series"].append({"phase": s["phase"], "t": now - s["started"], "mbps": s["live"]})
        counter["stop"] = True
        elapsed = time.time() - t0
        # ignore the first second (TCP ramp-up), like most speed tests
        steady = peak_window[4:] or peak_window
        return sum(steady) / len(steady) if steady else counter["n"] * 8 / elapsed / 1e6

    def _down_worker(self, counter, add):
        while not counter["stop"]:
            try:
                with urllib.request.urlopen(urllib.request.Request(self.DOWN_URL, headers=self.UA), timeout=10) as r:
                    while not counter["stop"]:
                        chunk = r.read(65536)
                        if not chunk:
                            break
                        add(len(chunk))
            except Exception:
                time.sleep(0.2)

    def _up_worker(self, counter, add):
        block = os.urandom(65536)

        class Body:
            def __init__(self):
                self.sent = 0

            def read(self, n=-1):
                if counter["stop"] or self.sent >= 8_000_000:
                    return b""
                self.sent += len(block)
                add(len(block))
                return block

        while not counter["stop"]:
            try:
                req = urllib.request.Request(self.UP_URL, data=Body(), method="POST",
                                             headers={**self.UA, "Content-Type": "application/octet-stream",
                                                      "Content-Length": "8000000"})
                urllib.request.urlopen(req, timeout=15).read()
            except Exception:
                time.sleep(0.2)


speedtest = SpeedTest()

# --------------------------------------------------------------------------- towers & coverage map

import gzip
import math

def provider_name(mcc, mnc):
    try:
        n = int(mnc)
    except ValueError:
        return f"Network {mnc}"
    return OPERATORS.get(f"{mcc}{n:02d}") or OPERATORS.get(f"{mcc}{n:03d}") or f"Network {mcc}-{n:02d}"


# Map colours: brand-like slots for the big carriers, then by size; validated as a set (see web/style.css).
BRAND_SLOT = {"MTN": 1, "Telecel": 2, "Vodafone": 2, "Vodacom": 2, "Airtel": 3, "AirtelTigo": 3, "Safaricom": 1, "Orange": 2}
RADIO = {"LTE": "4G", "NR": "5G", "UMTS": "3G", "GSM": "2G", "CDMA": "2G"}
BAND_MHZ = {1: 2100, 3: 1800, 7: 2600, 8: 900, 20: 800, 28: 700, 38: 2600, 40: 2300, 41: 2500}
TOWER_DIR = DATA / "towers"
LOCATION_FILE = DATA / "location.json"


def country_mcc():
    """Country for the tower map: your setting, else the router SIM's country."""
    c = cfg("country_mcc")
    if c:
        return str(c)
    mccmnc = monitor.live.get("network_provider") if "monitor" in globals() else None
    return mccmnc[:3] if mccmnc else None


def haversine_km(a_lat, a_lon, b_lat, b_lon):
    p = math.pi / 180
    h = (math.sin((b_lat - a_lat) * p / 2) ** 2 +
         math.cos(a_lat * p) * math.cos(b_lat * p) * math.sin((b_lon - a_lon) * p / 2) ** 2)
    return 12742 * math.asin(math.sqrt(h))


class Towers:
    """OpenCellID cells for one country (MCC), grouped into sites (masts)."""

    def __init__(self):
        self.sites, self.cells, self.updated, self.mcc, self.colors = [], {}, None, None, {}

    def file(self, mcc):
        return TOWER_DIR / f"{mcc}.csv.gz"

    def ensure(self, mcc):
        if mcc and mcc != self.mcc:
            self.load(mcc)

    def load(self, mcc):
        self.mcc, self.sites, self.cells, self.updated, self.colors = mcc, [], {}, None, {}
        tower_file = self.file(mcc)
        if not tower_file.exists():
            return
        groups = {}
        cells = {}
        with gzip.open(tower_file, "rt") as f:
            for line in f:
                r = line.strip().split(",")
                if len(r) < 14 or r[0] == "radio":
                    continue
                radio, net, area, cell = r[0], r[2], r[3], int(r[4])
                lon, lat, rng, samples, updated = float(r[6]), float(r[7]), int(r[8]), int(r[9]), int(r[12])
                cells[(radio, net, cell)] = {"area": area, "lat": lat, "lon": lon}
                if radio == "LTE":
                    key = ("LTE", net, cell // 256)   # eNodeB = one physical mast
                else:                              # 2G/3G ids don't encode the site; merge cells within ~150 m
                    key = (radio, net, round(lat / 0.0015), round(lon / 0.0015))
                g = groups.setdefault(key, {"lat": 0.0, "lon": 0.0, "w": 0, "cells": 0, "samples": 0,
                                            "range": 0, "updated": 0, "areas": set()})
                w = max(1, samples)
                g["lat"] += lat * w; g["lon"] += lon * w; g["w"] += w
                g["cells"] += 1; g["samples"] += samples
                g["range"] = max(g["range"], rng); g["updated"] = max(g["updated"], updated)
                g["areas"].add(area)
        sites = []
        for key, g in groups.items():
            radio, net = key[0], key[1]
            sites.append({
                "id": "-".join(map(str, key)), "radio": RADIO.get(radio, radio), "net": net,
                "provider": provider_name(mcc, net), "enb": key[2] if radio == "LTE" else None,
                "lat": round(g["lat"] / g["w"], 5), "lon": round(g["lon"] / g["w"], 5),
                "cells": g["cells"], "samples": g["samples"], "range": g["range"], "updated": g["updated"],
                "areas": sorted(g["areas"]),
            })
        self.sites, self.cells = sites, cells
        self.updated = tower_file.stat().st_mtime
        # colour slots: brand-like for known carriers, remaining slots by number of masts
        sizes = collections.Counter(s["provider"] for s in sites)
        used = {}
        for name, _ in sizes.most_common():
            slot = BRAND_SLOT.get(name)
            if slot and slot not in used.values():
                used[name] = slot
        for name, _ in sizes.most_common():
            free = [x for x in (1, 2, 3) if x not in used.values()]
            if name not in used and free:
                used[name] = free[0]
        self.colors = used

    def download(self, mcc):
        key = cfg("opencellid_key", "")
        if not key:
            raise RuntimeError("Add your free OpenCellID API key in Settings first")
        if not mcc or not str(mcc).isdigit():
            raise RuntimeError("Choose your country in Settings first")
        TOWER_DIR.mkdir(exist_ok=True)
        url = f"https://opencellid.org/ocid/downloads?token={urllib.parse.quote(key)}&type=mcc&file={mcc}.csv.gz"
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                body = r.read()
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                raise RuntimeError("OpenCellID refused the download: check your API key in Settings, "
                                   "or try tomorrow if you've hit the daily download limit") from None
            raise RuntimeError(f"OpenCellID download failed (HTTP {e.code})") from None
        if body[:2] != b"\x1f\x8b":  # not gzip: an error message (e.g. daily download limit)
            raise RuntimeError(body[:200].decode("utf-8", "replace"))
        tower_file = self.file(mcc)
        tmp = tower_file.with_suffix(".tmp")
        tmp.write_bytes(body)
        tmp.replace(tower_file)
        self.load(mcc)
        return {"ok": True, "sites": len(self.sites)}


towers = Towers()


def rsrp_distance_m(rsrp, band):
    """Very rough distance to the serving mast from signal strength.

    Assumes ~30 dBm reference-signal EIRP, a log-distance urban path-loss model
    (exponent 3.5, free-space reference at 100 m) and 5-20 dB of building loss.
    Good to a factor of ~2 at best - shown on the map as a band, not a point.
    """
    if rsrp is None:
        return None
    m = re.search(r"Band\s*(\d+)", band or "", re.I)
    mhz = BAND_MHZ.get(int(m.group(1)) if m else 0, 1800)
    pl0 = 20 * math.log10(mhz) + 20 * math.log10(100) - 27.55
    total = 30 - rsrp
    d = lambda indoor: 100 * 10 ** ((total - indoor - pl0) / 35)
    return [round(max(50, d(20))), round(d(5))]


def load_location():
    try:
        return json.loads(LOCATION_FILE.read_text())
    except Exception:
        return None


def api_map(q):
    l = monitor.live
    loc = load_location()
    cell = _int(l.get("cell_id"))
    tac = l.get("lac") or ""
    mcc = country_mcc()
    towers.ensure(mcc)
    sim = l.get("network_provider") or ""
    net = (sim[3:].lstrip("0") or "0") if sim[:3] == mcc else None  # the SIM's network within this country
    enb, sector = (cell // 256, cell % 256) if cell else (None, None)
    rsrp = _int(l.get("lte_rsrp"))
    est = rsrp_distance_m(rsrp, monitor.band)

    tac_sites = [s for s in towers.sites if s["net"] == net and s["radio"] == "4G" and tac in s["areas"]]
    if loc:
        center = (loc["lat"], loc["lon"])
    elif tac_sites:
        center = (sum(s["lat"] for s in tac_sites) / len(tac_sites), sum(s["lon"] for s in tac_sites) / len(tac_sites))
    elif towers.sites:
        center = (sum(s["lat"] for s in towers.sites) / len(towers.sites), sum(s["lon"] for s in towers.sites) / len(towers.sites))
    else:
        center = (15.0, 10.0)  # nothing known yet: world view
    country = q.get("km") == "all"  # whole country: every mapped mast
    km = None if country else min(20.0, max(0.5, float(q.get("km", 3))))

    near = []
    for s in towers.sites:
        if not country and (abs(s["lat"] - center[0]) > km / 100 or abs(s["lon"] - center[1]) > km / 100):
            continue
        d = haversine_km(center[0], center[1], s["lat"], s["lon"])
        if country or d <= km:
            near.append({**s, "dist": round(d * 1000)})
    near.sort(key=lambda s: s["dist"])

    exact = next((s for s in towers.sites if s["net"] == net and s["enb"] == enb), None) if enb else None
    # masts the router has handed over to recently that ARE mapped: you must be within their range
    seen = {(_int(r["cell"]) or 0) // 256 for r in db.q(
        "SELECT DISTINCT cell FROM samples WHERE cell IS NOT NULL AND ts > ?", (time.time() - 7 * 86400,))}
    anchors = [s for s in towers.sites if s["net"] == net and s["enb"] in seen and s["enb"] != enb]
    candidates = []
    if not exact:
        for s in tac_sites:
            if s["enb"] in seen:  # masts we've seen under their own ID can't be the unmapped serving mast
                continue
            d = haversine_km(center[0], center[1], s["lat"], s["lon"]) * 1000 if loc else None
            gap = abs((s["enb"] or 0) - (enb or 0))
            # with a location: nearest masts first, nudged towards the signal-based distance estimate.
            # without one: numerically adjacent eNB ids are usually planned in the same neighbourhood.
            if loc:
                mid = sum(est) / 2 if est else 400
                score = d + 0.5 * abs(d - mid) + min(gap, 200)
            else:
                near_anchor = min((haversine_km(s["lat"], s["lon"], a["lat"], a["lon"]) for a in anchors), default=0)
                score = min(gap, 200) + 100 * near_anchor
            candidates.append({**s, "dist": round(d) if d is not None else None, "score": score, "enb_gap": gap})
        candidates.sort(key=lambda s: s["score"])
        candidates = candidates[:3]

    providers = {}
    for s in near:
        p = providers.setdefault(s["provider"], {"provider": s["provider"], "4G": 0, "3G": 0, "2G": 0, "5G": 0, "nearest": None})
        p[s["radio"]] = p.get(s["radio"], 0) + 1
        if p["nearest"] is None or s["dist"] < p["nearest"]:
            p["nearest"] = s["dist"]

    used = db.q("""SELECT cell, COUNT(*) n, MAX(ts) last FROM samples
                   WHERE cell IS NOT NULL AND ts > ? GROUP BY cell ORDER BY n DESC LIMIT 12""", (time.time() - 7 * 86400,))
    total = sum(u["n"] for u in used) or 1
    history = []
    for u in used:
        c = _int(u["cell"])
        if not c:
            continue
        site = next((s for s in towers.sites if s["net"] == net and s["enb"] == c // 256), None)
        history.append({"cell": c, "enb": c // 256, "sector": c % 256, "share": u["n"] / total, "last": u["last"],
                        "site": {"lat": site["lat"], "lon": site["lon"]} if site else None})

    return {
        "have_data": bool(towers.sites), "have_key": bool(cfg("opencellid_key")), "updated": towers.updated,
        "mcc": mcc, "country_name": COUNTRIES.get(mcc or "", f"MCC {mcc}" if mcc else None), "colors": towers.colors,
        "total_sites": len(towers.sites), "center": center, "km": km, "location": loc,
        "serving": {"cell": cell, "enb": enb, "sector": sector, "tac": tac, "net": net,
                    "provider": provider_name(mcc, net) if net else None, "rsrp": rsrp, "band": monitor.band,
                    "network_type": l.get("network_type"), "est_range_m": est,
                    "exact": exact, "candidates": candidates, "tac_sites": len(tac_sites),
                    "anchors": [{"enb": a["enb"], "lat": a["lat"], "lon": a["lon"]} for a in anchors]},
        "country": country, "sites": near if country else near[:800], "providers": sorted(providers.values(), key=lambda p: (p["nearest"] or 1e9)),
        "history": history,
    }


def save_location(data):
    lat, lon = float(data["lat"]), float(data["lon"])
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("Invalid coordinates")
    loc = {"lat": lat, "lon": lon, "accuracy": float(data.get("accuracy") or 0),
           "source": str(data.get("source", "manual"))[:20], "ts": time.time()}
    LOCATION_FILE.write_text(json.dumps(loc))
    return loc



# --------------------------------------------------------------------------- HTTP

TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
         ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png"}


def api_config():
    c = load_config()
    return {"router_password_set": bool(c.get("router_password") or os.environ.get("FIVEBARS_ROUTER_PASSWORD")),
            "opencellid_key_set": bool(cfg("opencellid_key")), "country_mcc": country_mcc(),
            "country_from": "settings" if c.get("country_mcc") else "router SIM" if country_mcc() else None,
            "countries": [{"mcc": k, "name": v} for k, v in sorted(COUNTRIES.items(), key=lambda kv: kv[1])],
            "data_dir": str(DATA), "version": __version__}


def set_config(data):
    updates = {}
    if "router_password" in data:
        pw = str(data["router_password"] or "")[:64]
        updates["router_password"] = pw or None
    if "opencellid_key" in data:
        key = str(data["opencellid_key"] or "").strip()
        if key and not re.fullmatch(r"pk\.[0-9a-fA-F]{20,64}", key):
            raise ValueError("That doesn't look like an OpenCellID key (it starts with pk.)")
        updates["opencellid_key"] = key or None
    if "country_mcc" in data:
        mcc = str(data["country_mcc"] or "").strip()
        if mcc and not re.fullmatch(r"\d{3}", mcc):
            raise ValueError("Country code must be a 3-digit MCC, e.g. 620 for Ghana")
        updates["country_mcc"] = mcc or None
    save_config(updates)
    if "router_password" in updates and monitor.router:
        monitor.router.jar.clear()  # log in again with the new password
    return api_config()


def need_router():
    if not monitor.router:
        name = monitor.net["name"] if monitor.net else "this network"
        raise RuntimeError(f"Balance checks go through a supported 4G router's SIM. {name} doesn't offer them.")
    return monitor.router


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, obj, status=200):
        body = json.dumps(obj, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _api(self, fn):
        try:
            self._json(fn())
        except Exception as e:
            self._json({"error": str(e) or type(e).__name__}, 502)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        routes = {
            "/api/live": api_live,
            "/api/history": lambda: api_history(q.get("range", 900)),
            "/api/latency": lambda: api_latency(q.get("range", 900)),
            "/api/signal": lambda: api_signal(q.get("range", 900)),
            "/api/usage": lambda: api_usage(q.get("period", "24h")),
            "/api/events": lambda: {"events": db.q("SELECT * FROM events ORDER BY ts DESC LIMIT ?", (int(q.get("limit", 300)),)),
                                    "now": time.time()},
            "/api/status": lambda: {"checks": status_checks()},
            "/api/devices": api_devices,
            "/api/info": api_info,
            "/api/diagnose": api_diagnose,
            "/api/map": lambda: api_map(q),
            "/api/config": api_config,
            "/api/ping": lambda: {"app": APP, "version": __version__},
            "/api/speedtest": lambda: {**speedtest.state, "history": db.q("SELECT * FROM speedtests ORDER BY ts DESC LIMIT 10")},
        }
        if u.path in routes:
            return self._api(routes[u.path])
        name = "index.html" if u.path in ("", "/") else u.path.lstrip("/")
        f = (WEB / name).resolve()
        if WEB in f.parents and f.is_file():
            body = f.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", TYPES.get(f.suffix, "application/octet-stream"))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_error(404)

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        length = int(self.headers.get("Content-Length") or 0)
        data = json.loads(self.rfile.read(length) or b"{}")
        if path in ("/api/ussd", "/api/ussd/reply"):
            code = str(data.get("code", "")).strip()
            if not code or len(code) > 40 or any(c not in "0123456789*#" for c in code):
                return self._json({"ok": False, "error": "Use digits, * and # only."}, 400)
            self._api(lambda: need_router().ussd(code, reply=path.endswith("reply")))
        elif path == "/api/ussd/cancel":
            self._api(lambda: need_router().set("USSD_PROCESS", USSD_operator="ussd_cancel"))
        elif path == "/api/network/rename":
            self._api(lambda: rename_network(data))
        elif path == "/api/speedtest":
            self._api(speedtest.start)
        elif path == "/api/devices/rename":
            mac, name = str(data.get("mac", "")).upper(), str(data.get("name", "")).strip()[:40] or None
            self._api(lambda: (db.x("UPDATE devices SET name=? WHERE mac=?", (name, mac)), {"ok": True})[1])
        elif path == "/api/devices/forget":
            mac = str(data.get("mac", "")).upper()
            self._api(lambda: (db.x("DELETE FROM devices WHERE mac=?", (mac,)), {"ok": True})[1])
        elif path == "/api/location":
            self._api(lambda: save_location(data))
        elif path == "/api/location/clear":
            self._api(lambda: (LOCATION_FILE.unlink(missing_ok=True), {"ok": True})[1])
        elif path == "/api/towers/update":
            self._api(lambda: towers.download(country_mcc()))
        elif path == "/api/config":
            self._api(lambda: set_config(data))
        elif path == "/api/quit":
            self._json({"ok": True})
            threading.Thread(target=SERVER.shutdown, daemon=True).start()
        elif path == "/api/events/clear":
            self._api(lambda: (db.x("DELETE FROM events WHERE open=0"), {"ok": True})[1])
        else:
            self.send_error(404)


SERVER = None


def open_app_window(url):
    """Open the dashboard in its own window (Chrome/Edge app mode) or fall back to the default browser."""
    if os.environ.get("FIVEBARS_NO_BROWSER"):
        return
    try:
        if netprobe.IS_MAC:
            for app in ("Google Chrome", "Microsoft Edge", "Brave Browser"):
                if Path(f"/Applications/{app}.app").exists():
                    subprocess.Popen(["open", "-na", app, "--args", f"--app={url}", "--window-size=1500,1000"])
                    return
        elif netprobe.IS_WINDOWS:
            roots = [os.environ.get(k, "") for k in ("ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA")]
            for rel in (r"Microsoft\Edge\Application\msedge.exe", r"Google\Chrome\Application\chrome.exe"):
                for root in roots:
                    exe = Path(root) / rel
                    if root and exe.exists():
                        subprocess.Popen([str(exe), f"--app={url}", "--window-size=1500,1000"], creationflags=0x08000000)
                        return
    except Exception:
        pass
    webbrowser.open(url)


def main():
    url = f"http://localhost:{PORT}"
    try:  # already running? just open another window
        with urllib.request.urlopen(url + "/api/ping", timeout=1) as r:
            if json.loads(r.read()).get("app") == APP:
                open_app_window(url)
                return
    except Exception:
        pass
    towers.ensure(country_mcc())
    threading.Thread(target=monitor.run, daemon=True).start()
    # Bind to localhost only so other people on the network can't use your router login.
    global SERVER
    srv = SERVER = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"{APP} {__version__} running at {url}  (data: {DATA})  - press Ctrl+C to stop")
    threading.Timer(0.8, open_app_window, args=(url,)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
