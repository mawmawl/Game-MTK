#!/usr/bin/env python3
"""Audit gerak layar: pastikan SETIAP layar punya animasi (tidak ada layar mati).

Caranya: potret piksel kanvas game dua kali dengan jeda pendek, hitung berapa
persen piksel yang berubah. Layar yang seharusnya beranimasi wajib melewati
ambang minimum; layar diam (menu jeda) memang boleh ~0.

Jalankan: python3 tools/check_motion.py
"""
import json
import os
import shutil
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_intro as ri  # noqa: E402

SHOT_DIR = os.path.join(ri.ROOT, "assets", "video")

# simpan frame sebelumnya di halaman, kembalikan fraksi piksel yang berubah.
# PENTING: diukur di KEDUA kanvas — dunia (ctx) dan UI (uictx, teks tajam).
# Animasi teks/panel terjadi di kanvas UI, jadi mengukur satu kanvas saja
# akan salah melaporkan "layar diam".
DIFF = r"""
(() => {
  const cvs = [document.getElementById('game'), document.getElementById('ui')];
  let diff = 0, tot = 0;
  cvs.forEach((cv, ci) => {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    const key = '__prev' + ci;
    const prev = window[key];
    if (prev && prev.length === d.length) {
      for (let i = 0; i < d.length; i += 16) {
        tot++;
        if (Math.abs(d[i] - prev[i]) > 8 ||
            Math.abs(d[i + 1] - prev[i + 1]) > 8 ||
            Math.abs(d[i + 2] - prev[i + 2]) > 8) diff++;
      }
    }
    window[key] = new Uint8ClampedArray(d);
  });
  return tot ? diff / tot : -1;
})()
"""

# jumlah piksel hijau (warna sandi mesin) di kanvas UI — untuk membuktikan
# teks sandi benar-benar bertambah tercetak huruf demi huruf
GREEN = r"""
(() => {
  const cv = document.getElementById('ui');
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (g > 150 && g - r > 40 && g - b > 20) n++;
  }
  return n;
})()
"""

# (label, kode JS penyiap scene, ambang minimum, tunggu awal, jeda ukur)
TESTS = [
    ("menu utama (judul)", "Scenes.go('title')", 0.002, 1.2, 0.3),
    ("pilih level", "Scenes.go('select', { idx: 0 })", 0.005, 0.05, 0.22),
    ("cara main", "Scenes.go('how', { page: 0 })", 0.005, 0.06, 0.3),
    ("brief level", "Scenes.go('intro', { level: 0 })", 0.005, 0.15, 0.25),
    ("gameplay (pemain jalan)",
     "(() => { window.game.goto('game', { level: 1 }); setTimeout(() => { Input.down['d'] = true; }, 500); })()",
     0.005, 1.0, 0.4),
    ("gameplay (diam, ambient)", "Input.down['d'] = false;", 0.0005, 0.4, 0.3),
    ("jurnal terbuka", "window.game.level.journal = true; window.game.level.journalA = 0;", 0.004, 0.05, 0.2),
    ("mesin enkripsi (cetak sandi)",
     "(() => { const L = window.game.level; L.journal = false; L.machine.open = true;"
     " L.machine.phase = 'result'; L.machine.resultText = L.encrypted || 'KXQZ ABXQ UMAA';"
     " L.machine.revT = 0; })()", 0.0008, 0.06, 0.8),
    ("layar hasil", "(() => { const L = window.game.level; L.machine.open = false;"
                    " Scenes.go('results', { level: 0, stars: 3, score: 1200, time: 42, catches: 0,"
                    " best: { stars: 3, score: 1200 }, newBest: true, playedStars: 0, rT: 0, sel: 0 }); })()",
     0.003, 0.1, 0.3),
    ("ending", "Scenes.go('ending')", 0.004, 0.2, 0.35),
    ("menu jeda (memang diam)", "window.game.goto('game', { level: 0 }); "
                                "setTimeout(() => { window.game.level.pause = { idx: 0 }; }, 600)", -1, 1.4, 0.3),
]


def main():
    work = tempfile.mkdtemp(prefix="secretmail_motion_")
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
        cdp.call("Page.navigate", url=f"http://127.0.0.1:{srv}/index.html?intro=0")
        time.sleep(2.0)
        print("layar                          gerak    ambang   hasil")
        print("-" * 62)
        for i, (label, code, need, wait0, gap) in enumerate(TESTS):
            cdp.js(code)
            time.sleep(wait0)
            cdp.js(DIFF)              # buang frame pertama (jadi acuan)
            time.sleep(gap)
            raw = cdp.js(DIFF)
            d = json.loads(raw) if isinstance(raw, str) else raw
            if need < 0:
                ok, need_txt = True, "bebas"
            else:
                ok, need_txt = d >= need, f"{need * 100:.1f}%"
            print(f"{label:30s} {d * 100:6.2f}%  {need_txt:>7s}   {'OK' if ok else 'GAGAL'}")
            ri.shot(cdp, os.path.join(SHOT_DIR, f"screen_{i:02d}.png"))
            if not ok:
                fails.append(label)
                ri.shot(cdp, os.path.join(SHOT_DIR, "motion_gagal.png"))
        # cek khusus: huruf sandi yang tercetak harus BERTAMBAH (bukan satu frame jadi)
        cdp.js("(() => { const L = window.game.level; L.journal = false; L.machine.open = true;"
               " L.machine.phase = 'result'; L.machine.resultText = 'KXQZABXQUMAA'; L.machine.revT = 0; })()")
        time.sleep(0.08)
        g1 = cdp.js(GREEN)
        time.sleep(0.5)
        g2 = cdp.js(GREEN)
        g1, g2 = int(g1), int(g2)
        print(f"cetak sandi (piksel hijau): {g1} -> {g2}  (bertambah {g2 - g1})")
        if g2 - g1 <= 150:
            fails.append("teks sandi tidak bertambah tercetak")

        errs = [e for e in cdp.events
                if e.get("method") == "Runtime.exceptionThrown"
                or (e.get("method") == "Runtime.consoleAPICalled" and e["params"]["type"] == "error")]
        print("-" * 62)
        print("error konsol:", len(errs))
        for e in errs[:3]:
            print("   ", e["params"]["exceptionDetails"].get("text"))
        if errs:
            fails.append("error konsol")
    finally:
        if cdp:
            cdp.close()
        chrome.terminate()
        server.terminate()
        shutil.rmtree(work, ignore_errors=True)

    print("\nHASIL:", "SEMUA LAYAR BERGERAK" if not fails else "GAGAL -> " + "; ".join(fails))
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())
