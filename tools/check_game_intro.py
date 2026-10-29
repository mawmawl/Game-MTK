#!/usr/bin/env python3
"""Uji integrasi intro sinematik di dalam GAME SUNGGUHAN (bukan halaman capture).

Diperiksa:
  1. index.html?intro=1  -> scene 'cinema' berjalan, tanpa error di konsol
  2. tombol apa pun  -> intro dilewati, masuk scene 'title'
  3. index.html?intro=0  -> langsung 'title' (tidak ada intro)
  4. localStorage menyimpan tanda 'intro sudah dilihat'
  5. gameplay tetap normal setelah intro (level bisa dibangun)

Jalankan: python3 tools/check_game_intro.py
"""
import base64
import json
import os
import shutil
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_intro as ri  # noqa: E402

SHOT_DIR = os.path.join(ri.ROOT, "assets", "video")


def shot(cdp, name):
    p = os.path.join(SHOT_DIR, name)
    ri.shot(cdp, p)
    return p


def errors(cdp):
    out = []
    for e in cdp.events:
        m = e.get("method")
        if m == "Runtime.exceptionThrown":
            d = e["params"]["exceptionDetails"]
            out.append(d.get("text", "") + " " + json.dumps(d.get("exception", {}).get("description", ""))[:200])
        elif m == "Runtime.consoleAPICalled" and e["params"]["type"] == "error":
            out.append("console.error: " + json.dumps([a.get("value") for a in e["params"]["args"]])[:200])
    return out


def key(cdp, k):
    for t in ("keyDown", "keyUp"):
        cdp.call("Input.dispatchKeyEvent", type=t, key=k, code=k, windowsVirtualKeyCode=13 if k == "Enter" else 0)


def main():
    work = tempfile.mkdtemp(prefix="secretmail_game_")
    srv, port = ri.free_port(), ri.free_port()
    server = ri.start_server(srv)
    chrome = ri.start_chrome(port, os.path.join(work, "chrome"))
    cdp = None
    fails = []
    try:
        ri.wait_port(srv)
        cdp = ri.CDP(ri.page_ws(port))
        cdp.call("Page.enable")
        cdp.call("Runtime.enable")
        cdp.call("Emulation.setDeviceMetricsOverride", width=ri.VW, height=ri.VH,
                 deviceScaleFactor=1, mobile=False)

        # --- 1. intro dipaksa ---
        cdp.call("Page.navigate", url=f"http://127.0.0.1:{srv}/index.html?intro=1")
        time.sleep(2.5)
        cur = cdp.js("window.game && Scenes.cur")
        print("1) scene pada t≈2,5s :", cur, "->", "OK" if cur == "cinema" else "GAGAL")
        if cur != "cinema":
            fails.append("scene awal bukan cinema")
        print("   screenshot        :", shot(cdp, "game_intro_2s.png"))

        # --- 2. tombol melewati intro ---
        key(cdp, "Enter")
        time.sleep(1.4)
        cur = cdp.js("Scenes.cur")
        saved = cdp.js("JSON.parse(localStorage.getItem('secretMailV1') || '{}').intro")
        print("2) setelah Enter      :", cur, "->", "OK" if cur == "title" else "GAGAL")
        print("   tanda tersimpan   :", saved, "->", "OK" if saved == 1 else "GAGAL")
        if cur != "title":
            fails.append("intro tidak dilewati")
        if saved != 1:
            fails.append("tanda intro tidak tersimpan")

        # --- 3. intro dimatikan ---
        cdp.call("Page.navigate", url=f"http://127.0.0.1:{srv}/index.html?intro=0")
        time.sleep(1.6)
        cur = cdp.js("Scenes.cur")
        print("3) ?intro=0           :", cur, "->", "OK" if cur == "title" else "GAGAL")
        if cur != "title":
            fails.append("?intro=0 tidak langsung ke title")

        # --- 4. gameplay tetap jalan ---
        cdp.js("window.game.goto('game', { level: 0 })")
        time.sleep(1.5)
        st = cdp.js("(() => { const L = window.game.level; return L ? {w: L.roomW, h: L.roomH, objs: L.objects.length, enemies: L.enemies.length} : null; })()")
        print("4) level 1 terbangun  :", st, "->", "OK" if st and st["objs"] > 0 else "GAGAL")
        if not st or st["objs"] <= 0:
            fails.append("level tidak terbangun setelah intro")
        shot(cdp, "game_level1.png")

        errs = errors(cdp)
        print("5) error konsol       :", len(errs), "->", "OK" if not errs else "GAGAL")
        for e in errs[:5]:
            print("     ", e)
        if errs:
            fails.append(f"{len(errs)} error konsol")
    finally:
        if cdp:
            cdp.close()
        chrome.terminate()
        server.terminate()
        shutil.rmtree(work, ignore_errors=True)

    print("\nHASIL:", "SEMUA OK" if not fails else "GAGAL -> " + "; ".join(fails))
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())
