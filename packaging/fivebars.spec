# PyInstaller build for Fivebars:  pyinstaller packaging/fivebars.spec
#   macOS   -> dist/Fivebars.app  (menu-bar-less background app that opens the dashboard window)
#   Windows -> dist/Fivebars.exe  (single file, no console window)
import sys
from pathlib import Path

root = Path(SPECPATH).parent  # noqa: F821 (provided by PyInstaller)
sys.path.insert(0, str(root))
from fivebars import __version__  # noqa: E402

a = Analysis(
    [str(root / "fivebars.py")],
    pathex=[str(root)],
    datas=[(str(root / "web"), "web")],
    hiddenimports=["netprobe"],
    excludes=["tkinter", "unittest", "pydoc"],
)
pyz = PYZ(a.pure)

if sys.platform == "darwin":
    exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name="Fivebars", console=False)
    coll = COLLECT(exe, a.binaries, a.datas, name="Fivebars")
    app = BUNDLE(
        coll,
        name="Fivebars.app",
        bundle_identifier="app.fivebars.Fivebars",
        info_plist={
            "CFBundleShortVersionString": __version__,
            "CFBundleVersion": __version__,
            "LSUIElement": True,  # no Dock icon: the dashboard opens in its own browser window
            "LSMinimumSystemVersion": "11.0",
        },
    )
else:
    exe = EXE(pyz, a.scripts, a.binaries, a.datas, [], name="Fivebars", console=False, upx=False)
