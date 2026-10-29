#!/usr/bin/env python3
"""Cek piksel intro: pastikan tiap elemen benar-benar tergambar di tempatnya.

Dipanggil tanpa argumen. Memakai harness tools/render_intro.py (CDP + capture.html)
lalu menjalankan probe getImageData per waktu tertentu.
"""
import json
import os
import re
import shutil
import sys
import tempfile
import time

sys.path.insert(0, "/Users/rdws./Documents/Game_MTK/tools")
import render_intro as ri  # noqa: E402

PROBE = r"""
(() => {
  const VW = __W__, VH = 360;
  const gcv = document.getElementById('game'), ucv = document.getElementById('ui');
  const data = cv => cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const box = (d, W, x0, y0, x1, y1, test) => {
    let n = 0, minx = 1e9, maxx = -1, miny = 1e9, maxy = -1;
    for (let y = Math.max(0, y0 | 0); y < Math.min(360, y1 | 0); y++) {
      for (let x = Math.max(0, x0 | 0); x < Math.min(W, x1 | 0); x++) {
        const i = (y * W + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
        if (test(r, g, b)) { n++; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
      }
    }
    return { n, minx, maxx, miny, maxy };
  };
  const cream = (r, g, b) => r + g + b > 560 && Math.abs(r - g) < 60 && r > 180;
  const ink = (r, g, b) => r + g + b < 260;
  const gold = (r, g, b) => r > 180 && g > 140 && b < 200 && r - b > 60;
  const lit = (r, g, b) => r + g + b > 90;
  const gd = data(gcv), ud = data(ucv);
  const W = gcv.width, UW = ucv.width;
  return {
    canvas: [W, gcv.height, UW, ucv.height],
    gameLit: box(gd, W, 0, 0, VW, VH, lit),
    uiLit: box(ud, UW, 0, 0, VW, VH, lit),
    envCream: box(gd, W, 280, 200, 360, 300, cream),        // badan amplop (pusat)
    cardCream: box(gd, W, 55, 100, 585, 205, cream),          // kartu berkas
    cardInk: box(gd, W, 86, 132, 554, 198, ink),              // tinta teks sandi (di dalam kartu)
    sealRed: box(gd, W, 280, 210, 360, 300, (r, g, b) => r > 120 && r - g > 55 && r - b > 55),
    logoGold: box(ud, UW, 0, 120, VW, 195, gold),             // logo + garis emas
    ctaGold: box(ud, UW, 0, 290, VW, VH, gold),               // ajakan mulai
    moonGold: box(gd, W, 480, 20, 560, 110, (r, g, b) => r > 200 && g > 190 && b > 150)
  };
})()
"""


def main():
    work = tempfile.mkdtemp(prefix="secretmail_check_")
    srv, cdp_port = ri.free_port(), ri.free_port()
    server = ri.start_server(srv)
    chrome = ri.start_chrome(cdp_port, os.path.join(work, "chrome"))
    cdp = None
    try:
        ri.wait_port(srv)
        cdp = ri.CDP(ri.page_ws(cdp_port))
        cdp.call("Page.enable")
        cdp.call("Runtime.enable")
        cdp.call("Emulation.setDeviceMetricsOverride", width=ri.VW, height=ri.VH,
                 deviceScaleFactor=1, mobile=False)
        cdp.call("Page.navigate", url=f"http://127.0.0.1:{srv}/tools/capture.html")
        for _ in range(150):
            if cdp.js("window.assetsReady === true"):
                break
            time.sleep(0.2)
        tests = [
            ("0.40  masuk", 0.40, {"gameLit": ">1000", "logoGold": "==0"}),
            ("1.60  amplop masuk", 1.60, {"gameLit": ">5000"}),
            ("2.95  amplop tiba", 2.95, {"envCream": ">1200"}),
            ("3.50  segel", 3.50, {"sealRed": ">120"}),
            ("5.20  sandi mulai", 5.20, {"cardCream": ">20000"}),
            ("6.50  sandi penuh", 6.50, {"cardInk": ">1800", "cardCream": ">20000"}),
            ("7.10  kartu redup", 7.10, {"cardCream": "<5000"}),
            ("7.45  kartu hilang", 7.45, {"cardCream": "==0", "logoGold": "==0"}),
            ("9.00  logo", 9.00, {"logoGold": ">800"}),
            ("11.40 ajakan", 11.40, {"logoGold": ">800", "ctaGold": ">150"}),
            ("12.79 akhir", 12.79, {"gameLit": "<2000"}),
        ]
        for name, t, expect in tests:
            cdp.js(f"window.drawFrame({t})")
            st = cdp.js(PROBE.replace("__W__", str(ri.VW)))
            st = json.loads(st) if isinstance(st, str) else st
            print(f"t={name}")
            for k, v in st.items():
                if k == "canvas":
                    print(f"    kanvas game={v[0]}x{v[1]} ui={v[2]}x{v[3]}")
                    continue
                b = v
                warn = ""
                if b["n"]:
                    if b["minx"] <= 0 or b["maxx"] >= ri.VW - 1:
                        warn = "  <-- menyentuh tepi kiri/kanan"
                    if b["miny"] <= 0 or b["maxy"] >= ri.VH - 1:
                        warn += "  <-- menyentuh tepi atas/bawah"
                print(f"    {k:10s} n={b['n']:6d}  x[{b['minx']:4d}..{b['maxx']:4d}] y[{b['miny']:3d}..{b['maxy']:3d}]{warn}")
            for k, want in expect.items():
                m = re.match(r"^\s*(>=|<=|>|<|==)\s*(\d+)$", want)
                op, val = m.group(1), int(m.group(2))
                n = st[k]["n"]
                ok = {">": n > val, "<": n < val, ">=": n >= val, "<=": n <= val, "==": n == val}[op]
                print(f"    HARAP {k} {want}: {'OK' if ok else 'GAGAL'} (n={n})")
        # --- layar lebar: VW adaptif game (maks 1200) ---
        cdp.call("Emulation.setDeviceMetricsOverride", width=1200, height=360,
                 deviceScaleFactor=1, mobile=False)
        time.sleep(0.8)                        # resize -> fitView() dihitung ulang
        vw = cdp.js("VW")
        print(f"\nt=lebar layar: VW internal = {vw}")
        side_ok = None
        for t, label in ((2.95, "hujan+kota sisi kanan"), (9.5, "logo tengah")):
            cdp.js(f"window.drawFrame({t})")
            w = cdp.js("VW")
            raw = cdp.js(PROBE.replace("__W__", str(w)))
            st = json.loads(raw) if isinstance(raw, str) else raw
            if t == 2.95:
                right = st["gameLit"]           # seluruh isi kanvas
                print(f"    kanvas {w}px, isi lit={right['n']} x[{right['minx']}..{right['maxx']}] -> "
                      + ("OK" if right["maxx"] > w - 20 else "GAGAL (sisi kanan kosong)"))
                side_ok = right["maxx"] > w - 20
            else:
                g = st["logoGold"]
                ctr = (g["minx"] + g["maxx"]) / 2
                print(f"    logo emas x[{g['minx']}..{g['maxx']}] tengah={ctr:.0f} (harus ≈{w/2:.0f}) -> "
                      + ("OK" if abs(ctr - w / 2) < 40 and g["maxx"] < w - 20 else "GAGAL"))
                side_ok = side_ok and abs(ctr - w / 2) < 40 and g["maxx"] < w - 20
        if not side_ok:
            print("    HARAP tampilan layar lebar: GAGAL")
    finally:
        if cdp:
            cdp.close()
        chrome.terminate()
        server.terminate()
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
