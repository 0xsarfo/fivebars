#!/bin/bash
# macOS: double-click to start Fivebars from source (needs Python 3.9+, preinstalled on most Macs).
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  osascript -e 'display dialog "Fivebars needs Python 3. Install it from python.org, then open Fivebars again." buttons {"OK"}'
  exit 1
fi
exec python3 fivebars.py
