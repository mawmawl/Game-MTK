#!/usr/bin/env python3
"""Uji efek gerak di gameplay (hasil kerja tahap 3):
  A. transisi antar-scene : tirai piksel bertahap + garis emas (Fade)
  B. tertangkap           : denyut merah + hentakan (hitstop) + kilat
  C. pesan berhasil antar : kilat emas + denyut emas + hentakan
  D. layar hasil          : kilat emas saat panel muncul + kilat bintang
Jalankan: python3 tools/check_fx.py
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

# darkFrac per kolom 16px pada kanvas game (memakai piksel mentah dari halaman)
PROBE_COLS = r"""
(() => {
  const cv = document.getElementById('game');
  const W = cv.width, H = cv.height;
  const d = cv.getContext('2d').getImageData(0, 0, W, H).data;
  const CW = 16, n = Math.ceil(W / CW);
  const cols = [];
  for (let i = 0; i < n; i++) {
    let dark = 0, tot = 0;
    for (let y = 0; y < H; y += 2) {
      for (let x = i * CW; x < Math.min(W, (i + 1) * CW); x += 2) {
        const k = (y * W + x) * 4;
        tot++;
        if (d[k] + d[k + 1] + d[k + 2] < 40) dark++;
      }
    }
    cols.push(dark / tot);
  }
  let gold = 0, bright = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = (y * W + x) * 4, r = d[k], g = d[k + 1], b = d[k + 2];
    if (r > 140 && g > 110 && b < 75 && r - b > 70) gold++;
    bright += (r + g + b);
  }
  return { cols, gold, meanBright: bright / (W * H * 3), W, H };
})()
"""


def main():
    work = tempfile.mkdtemp(prefix="secretmail_fx_")
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

        def probe_cols():
            raw = cdp.js(PROBE_COLS)
            return json.loads(raw) if isinstance(raw, str) else raw

        # ---------------- A. transisi tirai piksel ----------------
        cdp.js("window.game.goto('game', { level: 0 })")
        time.sleep(1.2)
        cdp.js("Fade.start(() => {})")
        # transisi cuma ~0,77 dtk (naik 0,38 + turun 0,38): ambil sampel rapat
        part_max, gold_max, cover_max, spread_max, mid_shot = 0, 0, 0.0, 0.0, False
        for i in range(20):
            time.sleep(0.04)
            pr = probe_cols()
            part = sum(1 for c in pr["cols"] if 0.25 < c < 0.9)
            part_max = max(part_max, part)
            gold_max = max(gold_max, pr["gold"])
            # sebaran tinggi tirai dalam SATU frame (bukti bertahap, bukan rata)
            spread_max = max(spread_max, max(pr["cols"]) - min(pr["cols"]))
            cover = sum(1 for c in pr["cols"] if c > 0.9) / len(pr["cols"])
            cover_max = max(cover_max, cover)
            if part > 8 and not mid_shot:
                mid_shot = True
                ri.shot(cdp, os.path.join(SHOT_DIR, "fx_wipe.png"))
        print(f"A) transisi: kolom separuh-tertutup maks={part_max}/{len(pr['cols'])}, "
              f"sebaran tirai dalam 1 frame={spread_max:.2f}, garis emas maks={gold_max}px "
              f"({gold_max * 100 / (pr['W'] * pr['H']):.2f}% piksel), kolom penuh={cover_max * 100:.0f}%")
        # garis emas tirai ≈ 40 kolom × 16px × tinggi terlihat; jauh di bawah itu berarti
        # yang terhitung malah warna kayu/lantai, jauh di atas berarti nyaris seluruh layar emas
        ok_a1 = part_max >= 5 and 50 < gold_max < 4000 and spread_max > 0.25
        print("   tirai bertahap + garis emas ->", "OK" if ok_a1 else "GAGAL")
        if not ok_a1:
            fails.append("tirai transisi tidak bertahap/garis emas tidak ada")
        ok_a2 = cover_max > 0.95
        print(f"   layar tertutup penuh -> {'OK' if ok_a2 else 'GAGAL'}")
        if not ok_a2:
            fails.append("tirai tidak menutup penuh")
        time.sleep(0.9)                      # transisi selesai, kembali ke gameplay

        # ---------------- B. tertangkap ----------------
        cdp.js("window.game.goto('game', { level: 1 })")
        time.sleep(1.4)
        n_enemies = cdp.js("window.game.level.enemies.length")
        cdp.js("""(() => { const L = window.game.level; const e = L.enemies[0];
                  L.player.x = e.x - 8; L.player.y = e.y - 6; L.immunity = 0; })()""")
        seen = {"hitstop": 0, "pulse": 0, "flash": 0}
        caught = 0
        t0 = None
        for _ in range(40):
            st = cdp.js("""(() => { const L = window.game.level;
                return { c: L.catches, h: L.hitstop, p: !!L.pulse, f: !!L.flash, t: L.timer }; })()""")
            st = json.loads(st) if isinstance(st, str) else st
            caught = max(caught, st["c"])
            if st["h"] > 0:
                seen["hitstop"] += 1
                if t0 is None:
                    t0 = st["t"]
                    ri.shot(cdp, os.path.join(SHOT_DIR, "fx_caught.png"))
            if st["p"]:
                seen["pulse"] += 1
            if st["f"]:
                seen["flash"] += 1
            if caught and seen["hitstop"] and st["h"] <= 0:
                break
            time.sleep(0.05)
        t1 = cdp.js("window.game.level.timer")
        frozen = abs(t1 - (t0 or 0)) < 0.34       # timer berhenti selama hentakan
        print(f"B) tertangkap: musuh={n_enemies}, catches={caught}, sampel hentakan={seen['hitstop']}, "
              f"denyut={seen['pulse']}, kilat={seen['flash']}, timer beku={t0}->{t1}")
        ok_b = caught >= 1 and seen["hitstop"] > 0 and seen["pulse"] > 0 and seen["flash"] > 0 and frozen
        print("   efek tangkapan ->", "OK" if ok_b else "GAGAL")
        if not ok_b:
            fails.append("efek tertangkap tidak lengkap")

        # ---------------- C. pesan berhasil diantar ----------------
        cdp.js("""(() => { const L = window.game.level;
            L.encrypted = 'TES-SANDI'; L.courierUI.open = true; L.courierUI.value = 'TES-SANDI';
            submitCourier(L.courierUI); })()""")
        time.sleep(0.12)
        st = cdp.js("""(() => { const L = window.game.level;
            return { delivered: !!L.delivered, h: L.hitstop, f: L.flash && L.flash.c,
                     p: L.pulse && L.pulse.c, leaving: !!L.courierLeaving }; })()""")
        st = json.loads(st) if isinstance(st, str) else st
        print(f"C) pesan diantar: delivered={st['delivered']}, hitstop={st['h']:.2f}, "
              f"kilat={st['f']}, denyut={st['p']}, kurir berangkat={st['leaving']}")
        ok_c = st["delivered"] and st["h"] > 0 and st["f"] and st["p"] and st["leaving"]
        print("   kilat+h entakan kemenangan ->", "OK" if ok_c else "GAGAL")
        if not ok_c:
            fails.append("efek kemenangan tidak lengkap")
        ri.shot(cdp, os.path.join(SHOT_DIR, "fx_delivered.png"))

        # ---------------- D. layar hasil (kilat emas saat panel muncul) ----------------
        cur = None
        for _ in range(60):
            cur = cdp.js("Scenes.cur")
            if cur == "results":
                break
            time.sleep(0.1)
        time.sleep(0.06)
        bright = probe_cols()["meanBright"]
        time.sleep(0.5)
        after = probe_cols()["meanBright"]
        print(f"D) scene={cur}, terang saat panel muncul={bright:.1f} -> setelah={after:.1f}")
        ok_d = cur == "results" and bright > after
        print("   kilat emas layar hasil ->", "OK" if ok_d else "GAGAL")
        if not ok_d:
            fails.append("layar hasil tidak ada kilat/panel")
        ri.shot(cdp, os.path.join(SHOT_DIR, "fx_results.png"))

        errs = [e for e in cdp.events if e.get("method") == "Runtime.exceptionThrown"]
        print("E) error konsol:", len(errs), "->", "OK" if not errs else "GAGAL")
        for e in errs[:3]:
            print("   ", e["params"]["exceptionDetails"].get("text"))
        if errs:
            fails.append("ada error konsol")
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
