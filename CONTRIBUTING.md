# Contributing to Fivebars

Thanks for helping! The most valuable contributions are **support for more routers**, **fixes for your OS or language**, and **bug reports with details**.

## Project layout

| Path | What |
|---|---|
| `fivebars.py` | The local server: sampling loop, event detection, storage (SQLite), HTTP API, router drivers |
| `netprobe.py` | Per-OS measurements (macOS, Windows): gateway, Wi-Fi, traffic counters, ping. Parsers are pure functions |
| `web/` | The dashboard (plain HTML/CSS/JS, no build step) |
| `tests/` | `test_netprobe.py` (parser unit tests), `smoke.py` (end-to-end) |
| `packaging/fivebars.spec` | PyInstaller build for `Fivebars.app` / `Fivebars.exe` |

There are no third-party Python dependencies. Please keep it that way, so "download and run" stays simple.

## Running and testing

```bash
python3 fivebars.py                              # http://localhost:8555
FIVEBARS_DATA=/tmp/fb FIVEBARS_NO_BROWSER=1 python3 fivebars.py   # throwaway data, no window
python tests/test_netprobe.py
python tests/smoke.py
```

Environment variables:
- `FIVEBARS_PORT`: default `8555`.
- `FIVEBARS_DATA`: data folder.
- `FIVEBARS_NO_BROWSER`: don't open a window.
- `FIVEBARS_ROUTER_PASSWORD` and `FIVEBARS_OPENCELLID_KEY`: override the settings file.

## Adding a router

Router drivers live in `fivebars.py`; `ZteRouter` is the reference. A driver needs:

1. **`probe(gateway)`:** a cheap, unauthenticated request that returns a driver instance if the gateway speaks this API, or `None`. It must never change anything on the router.
2. **`get(...)`:** read the fields the monitor uses: signal (RSRP), network type, traffic counters, connected devices and so on.
3. **(Optional)** `login()` / `ensure_login()` using `router_password()`, and `ussd()` if the router supports it.

Then hook it into `Monitor._switch` next to `ZteRouter.probe`.

**When opening an issue for a new router,** include:
- the router model;
- the operator;
- the web-UI address;
- a few sample API responses, with **serial numbers, IMEI, ICCID, phone numbers and MAC addresses removed**.

## Rules that keep users safe

- **Read-only by default.** Never change router settings without an explicit user action in the UI.
- **No secrets in the repo, logs or API responses.** The settings API only ever reports whether a password or key is *set*.
- **Local only.** The server binds to `127.0.0.1`. Don't add telemetry or uploads.
- **New measurements need parser tests** with real sample output (anonymised).

## Pull requests

- Keep changes focused and match the surrounding style.
- Run both test scripts before pushing. CI runs them on macOS and Windows with Python 3.9 and 3.12.
- For UI changes, include a screenshot. Check both themes, and narrow windows.
