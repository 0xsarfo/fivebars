"""End-to-end smoke test: start Fivebars, wait for it, call every read-only endpoint, stop it.

    python tests/smoke.py                     # run from source
    python tests/smoke.py dist/Fivebars.exe   # run a packaged build
Uses a throwaway data folder and port; never opens a browser.
"""
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = "8599"
BASE = f"http://127.0.0.1:{PORT}"
ENDPOINTS = ["ping", "config", "live", "history?range=900", "status", "usage?period=24h", "devices", "info",
             "map?km=3", "map?km=all", "signal?range=900", "latency?range=900", "events", "speedtest"]


def get(path, timeout=20):
    with urllib.request.urlopen(f"{BASE}/api/{path}", timeout=timeout) as r:
        return json.loads(r.read())


def main():
    cmd = [str(Path(sys.argv[1]).resolve())] if len(sys.argv) > 1 else [sys.executable, str(ROOT / "fivebars.py")]
    data = tempfile.mkdtemp(prefix="fivebars-smoke-")
    env = {**os.environ, "FIVEBARS_PORT": PORT, "FIVEBARS_DATA": data, "FIVEBARS_NO_BROWSER": "1"}
    proc = subprocess.Popen(cmd, env=env, cwd=str(ROOT))
    try:
        for _ in range(60):
            try:
                if get("ping", 2).get("app") == "Fivebars":
                    break
            except Exception:
                time.sleep(1)
        else:
            raise SystemExit("Fivebars didn't start within 60 s")
        time.sleep(8)  # let a few samples come in
        failed = []
        for ep in ENDPOINTS:
            try:
                body = get(ep)
                if isinstance(body, dict) and body.get("error") and ep != "live":
                    failed.append(f"{ep}: {body['error']}")
            except Exception as e:
                failed.append(f"{ep}: {e}")
        live = get("live")
        n = live["network"]
        print(f"network: {n.get('name')} | {n.get('label')} | driver={n.get('driver')} | gateway={n.get('gateway')}")
        print(f"latency={live.get('lat')} ms  down={live.get('down')}  signal={live.get('rsrp')} ({live.get('signal_kind')})")
        print(f"samples recorded: {get('info')['samples']}")
        assert get("info")["samples"] > 0, "no samples recorded"
        if failed:
            raise SystemExit("endpoint failures:\n  " + "\n  ".join(failed))
        print("smoke test passed")
    finally:
        proc.terminate()
        try:
            proc.wait(10)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main()
