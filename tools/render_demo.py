#!/usr/bin/env python3
"""Render TRAILER demo "Secret Mail" (60-90 detik): gameplay asli + motion graphic.

Alur:
  1. gameplay — driver tools/demo_gameplay.html: rAF & performance.now diganti,
     jadi loop game dimajukan tangan (stepFrames) dan tiap frame dipotret.
     Hasil: 30 fps deterministik (?seed=1&run=1 / ?intro=0 = content tetap).
  2. overlay  — tools/demo_overlay.html: motion graphic 1280x720 PNG ber-alpha,
     murni fungsi waktu Overlay.frame(t); data timeline dari skrip ini.
  3. audio    — dirender offline (OfflineAudioContext) dari pola musik & SFX game,
     ditata sesuai cue timeline (impact/whoosh/chime/tick/star/fanfare/...).
  4. compose  — ffmpeg: gameplay di-skala 2x (neighbor) + overlay + audio -> demo.mp4

Contoh:
    python3 tools/render_demo.py                  # semua tahap
    python3 tools/render_demo.py --stage gameplay # hanya rekam gameplay
    python3 tools/render_demo.py --check          # periksa hasil + sinkron cue
    python3 tools/render_demo.py --dry-run        # cetak timeline saja
"""
import argparse
import base64
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_intro as ri  # noqa: E402

ROOT = ri.ROOT
FPS = 30
DT_MS = 1000.0 / FPS
GW, GH = 640, 360            # kanvas game
OW, OH = 1280, 720           # kanvas overlay / video akhir
OUT_DIR = os.path.join(ROOT, "assets", "video")

# =========================================================================== #
# 1. SKENARIO GAMEPLAY
#    Tiap babak = daftar fase (jumlah frame, JS yang dijalankan sebelum fase itu).
#    Semua lewat jalur input game yang sama dengan pemain (setKey/tap/teleport).
# =========================================================================== #
SHOTS = {
    "hook": [
        (6, "window.resetStage(1)"),
        (10, "const L=window.game.level; const o=L.objects.find(o=>o.search); window.game.tp(o.x, o.y+1);"),
        (24, "window.setKey('d', true)"),
        (26, "const L=window.game.level; const e=L.enemies[0]; e.x=L.player.x+70; e.y=L.player.y; e.state='chase'; e.susT=0;"),
        (30, "window.setKey('d', false)"),
        (48, ""),
        (1, "const L=window.game.level; const e=L.enemies[0]; L.immunity=0; e.x=L.player.x+6; e.y=L.player.y+2;"),
        (46, ""),
    ],
    "title": [
        (6, "Scenes.go('title')"),
        (126, ""),
    ],
    "search": [
        (6, "window.resetStage(0)"),
        (12, "const L=window.game.level; const o=L.objects.find(o=>o.has==='message')||L.objects.find(o=>o.search);"
             " window.game.tp(o.x, o.y+1);"),
        (10, ""),
        (1, "window.interactNow()"),
        (104, ""),                                  # dialog pesan rahasia sedang diketik
        (1, "window.dialogNext()"),
        (10, ""),
        (12, "const L=window.game.level; const o=L.objects.find(o=>o.has==='note')||L.objects.filter(o=>o.search)[1];"
             " window.game.tp(o.x, o.y+1);"),
        (10, ""),
        (1, "window.interactNow()"),                # periksa catatan fungsi
        (72, ""),
    ],
    "machine": [
        (6, "window.resetStage(0)"),
        (10, "const L=window.game.level; L.found.message=true; L.found.note=true; const m=L.objects.find(o=>o.type==='machine');"
             " window.game.tp(m.x-1, m.y+2);"),   # 1 petak dari mesin supaya radius interaksi kena
        (10, ""),
        (1, "window.interactNow()"),                # buka mesin enkripsi
        (22, "const L=window.game.level; L.machine.fa=String(L.a); L.machine.fb=String(L.b);"),
        (1, "window.tap('Enter')"),                 # jalankan
        (52, ""),                                   # fase kerja 1,6 dtk
        (74, ""),                                   # sandi dicetak huruf demi huruf
        (1, "window.tap('Escape')"),                # tutup mesin
        (8, ""),
        (1, "window.tap('Tab')"),                   # jurnal agen
        (70, ""),
        (1, "window.tap('Tab')"),
        (30, "window.setKey('a', true)"),
        (22, "window.setKey('a', false)"),
    ],
    "courier": [
        (6, "window.resetStage(0)"),
        (10, "const L=window.game.level; L.found.message=true; L.found.note=true; L.encrypted='KXQZABXQUMAA'; L.found.enc=true;"
             " window.game.tp(L.def.courier.x, L.def.courier.y+1);"),
        (10, ""),
        (1, "window.interactNow()"),                # bicara dengan kurir
        (54, ""),                                   # dialog kurir diketik
        (1, "window.dialogNext()"),                 # lanjut -> panel ketik terbuka
        (14, ""),
        (5, "const L=window.game.level; L.courierUI.value += 'KXQZ';"),
        (5, "const L=window.game.level; L.courierUI.value += 'ABXQ';"),
        (5, "const L=window.game.level; L.courierUI.value += 'UMAA';"),
        (14, ""),
        (1, "window.tap('Enter')"),                 # kirim -> pesan terkirim
        (54, ""),                                   # kilat emas + kurir berangkat
    ],
    "stealth": [
        (6, "window.resetStage(2)"),
        (10, "const L=window.game.level; const e=L.enemies[0]; L.player.x=e.x-40; L.player.y=e.y+90; L.immunity=0;"),
        (54, "window.setKey('w', true)"),
        (24, "window.setKey('w', false)"),
        (56, ""),
        (28, "window.setKey('a', true)"),
        (28, "window.setKey('a', false)"),
        (1, "const L=window.game.level; const e=L.enemies[0]; L.immunity=0; e.x=L.player.x+6; e.y=L.player.y+2;"),
        (42, ""),
        (54, "window.setKey('d', true)"),
        (28, "window.setKey('d', false)"),
        (24, ""),
    ],
    "results": [
        (6, "window.resetStage(2)"),
        (8, "const L=window.game.level; L.timer=68; L.catches=0;"
            " Scenes.go('results', { level: 2, stars: 3, score: 1480, time: 68, catches: 0,"
            " best: { stars: 3, score: 1480 }, newBest: true, playedStars: 0, rT: 0, sel: 0 });"),
        (166, ""),
    ],
    "end": [
        (6, "window.resetStage(1)"),
        (24, "const L=window.game.level; const o=L.objects.find(o=>o.type==='window')||L.objects[0]; window.game.tp(o.x, o.y+2);"),
        (24, "window.setKey('d', true)"),
        (26, "window.setKey('d', false)"),
        (244, ""),
    ],
}

# penanda (marker) overlay: posisi diambil dari state game DI TENGAH babak
# (indeks fase di SHOTS — dipilih saat objeknya ada di layar dan pemain diam)
MARKER_AT = {"machine": 6, "courier": 8}
MARKER_QUERY = {
    "machine": ("const L=window.game.level; const m=L.objects.find(o=>o.type==='machine');"
                " return { x: (m.x+m.w/2)*TILE - Camera.x, y: (m.y+0.4)*TILE - Camera.y,"
                " lx: (m.x+m.w/2)*TILE - Camera.x, ly: m.y*TILE - Camera.y - 26 };"),
    "courier": ("const L=window.game.level; return { x: L.courier.x - Camera.x, y: L.courier.y - 16 - Camera.y,"
                " lx: L.courier.x - Camera.x, ly: L.courier.y - 42 - Camera.y };"),
}
MARKER_LABEL = {"machine": "MESIN ENKRIPSI", "courier": "KURIR SURAT"}
MARKER_COLOR = {"machine": "#7ae68a", "courier": "#e8a44a"}

# =========================================================================== #
# 2. TIMELINE TRAILER (durasi tiap babak = jumlah frame shot / 30)
# =========================================================================== #
SEGMENTS = [
    dict(name="hook", shot="hook", kind="hook", accent="#c8503e",
         lines=["PESAN RAHASIA", "HARUS DIKUNCI"], music="lab",
         cues=[(0.10, "impact"), (0.60, "impact", {"v": .8}), (1.10, "whoosh"), (2.35, "whoosh"),
               (2.40, "alert"), (3.60, "whoosh")]),

    dict(name="title", shot="title", kind="title", music="title",
         cues=[(0.15, "riser"), (0.70, "chime"), (1.60, "sparkle"), (2.60, "whoosh")]),

    dict(name="s1", shot="search", kind="shot", accent="#ffe9a8",
         num="01", head="TEMUKAN BUKTI",
         sub="Pesan rahasia dan catatan fungsi disembunyikan di dalam ruangan",
         panel=dict(head="CATATAN FUNGSI", t=3.4, until=6.4, cps=0.05,
                    lines=["f(x) = a·x + b", "a = 1    b = 25"]), music="bedroom",
         cues=[(0.2, "paper"), (0.8, "whoosh"), (1.4, "tick"), (3.5, "type"), (4.4, "sparkle"),
               (5.6, "paper"), (7.4, "whoosh")]),

    dict(name="s2", shot="machine", kind="shot", accent="#7ae68a",
         num="02", head="MESIN ENKRIPSI",
         sub="Masukkan a dan b — sandi dihitung otomatis, kamu tidak perlu berhitung manual",
         panel=dict(head="HASIL SANDI (mod 53)", t=3.0, until=6.2, cps=0.045, ink=True,
                    lines=["y = a·x + b", "KXQZABXQUMAA"]), music="lab",
         cues=[(0.2, "whoosh"), (0.9, "machine"), (2.6, "chime"), (3.1, "type"), (5.2, "sparkle"),
               (6.0, "paper"), (6.9, "whoosh"), (8.0, "tick")]),

    dict(name="s3", shot="courier", kind="shot", accent="#e8a44a",
         num="03", head="ANTAR KE KURIR",
         sub="Harus persis sama — huruf besar dan kecil punya arti berbeda",
         music="school",
         cues=[(0.2, "whoosh"), (0.8, "paper"), (2.0, "tick"), (3.2, "type"), (5.0, "door"),
               (5.3, "fanfare"), (6.4, "whoosh")]),

    dict(name="s4", shot="stealth", kind="shot", accent="#ff8a7a",
         num="04", head="HINDARI MATA-MATA",
         sub="Kerucut pandang bisa dihindari di balik perabot — tertangkap berarti ulang dari awal",
         music="lab",
         cues=[(0.4, "whoosh"), (2.2, "alert"), (3.0, "alert", {"v": .7}), (4.6, "whoosh"),
               (8.0, "impact", {"v": .7}), (9.4, "whoosh")]),

    dict(name="s5", shot="results", kind="shot", accent="#7ae68a",
         num="05", head="BINTANG & SKOR",
         sub="Tanpa tertangkap dan cepat — tiga bintang menantimu",
         music="title", min_bright=0.05,          # layar hasil memang meredupkan level
         cues=[(0.3, "whoosh"), (0.8, "star", {"i": 0}), (1.15, "star", {"i": 1}), (1.5, "star", {"i": 2}),
               (2.4, "chime"), (4.0, "whoosh")]),

    dict(name="end", shot="end", kind="endcard", music="title",
         bullets=["3 LEVEL — KAMAR, SEKOLAH, LAB RUSAK",
                  "PESAN, FUNGSI, DAN LOKASI SELALU BERUBAH",
                  "100% OFFLINE • VANILLA JS • DESKTOP + LAYAR SENTUH"],
         cta="COBA SEKARANG", url="github.com/mawmawl/Game-MTK",
         cues=[(0.2, "whoosh"), (0.5, "riser"), (1.2, "fanfare"), (2.6, "chime"),
               (3.4, "sparkle"), (4.6, "sparkle"), (6.4, "chime"), (8.4, "whoosh")]),
]


def shot_frames(name):
    return sum(f for f, _ in SHOTS[name])


def build_timeline(markers):
    """Bangun timeline (JSON untuk halaman overlay) + daftar cue audio absolut."""
    segs, cues, music, boundaries = [], [], [], []
    t = 0.0
    for s in SEGMENTS:
        dur = shot_frames(s["shot"]) / FPS
        boundaries.append(round(t, 3))
        data = {"name": s["name"], "kind": s["kind"], "t0": round(t, 3), "dur": round(dur, 3)}
        for k in ("accent", "num", "head", "sub", "lines", "bullets", "cta", "url", "panel", "min_bright"):
            if k in s:
                data[k] = s[k]
        if s["shot"] in markers:
            data["marker"] = markers[s["shot"]]
        segs.append(data)
        for c in s.get("cues", []):
            off, kind = c[0], c[1]
            extra = c[2] if len(c) > 2 else {}
            cues.append(dict(t=round(t + off, 3), k=kind, **extra))
        music.append({"t0": round(t, 3), "dur": round(dur, 3), "pat": s.get("music", "title")})
        t += dur
    return {"dur": round(t, 3), "segments": segs, "boundaries": boundaries,
            "cues": cues, "music": music, "fps": FPS}


# =========================================================================== #
# 3. TAHAP-TAHAP RENDER
# =========================================================================== #
def shot_dir(work, name):
    d = os.path.join(work, "play", name)
    os.makedirs(d, exist_ok=True)
    return d


def capture_shot(cdp, name, out, markers):
    """Jalankan fase-fase satu babak, potret tiap frame (30 fps).

    PENTING: tiap fase dibungkus IIFE. Tanpa itu, `const L` yang dideklarasikan
    ulang di fase berikutnya melempar SyntaxError di Runtime.evaluate dan seluruh
    aksi fase itu tidak pernah berjalan (bug yang pernah membuat mesin enkripsi
    dan kurir tidak jalan di trailer)."""
    idx = 0
    for pi, (frames, code) in enumerate(SHOTS[name]):
        if code:
            cdp.js_checked(f"(() => {{ {code} }})()")
        for _ in range(frames):
            cdp.js_checked(f"window.stepFrames(1, {DT_MS})")
            ri.shot(cdp, os.path.join(out, f"f{idx:05d}.png"))
            idx += 1
        if name in MARKER_QUERY and pi == MARKER_AT.get(name, -1):
            m = cdp.js_checked(f"(() => {{ {MARKER_QUERY[name]} }})()")
            m = json.loads(m) if isinstance(m, str) else m
            if m:
                # koordinat dibiarkan dalam ruang game (640x360); overlay mengalikannya.
                # penanda di luar bingkai dibuang supaya tidak menggantung di tepi video
                if 20 <= m["x"] <= GW - 20 and 20 <= m["y"] <= GH - 24:
                    m = {k: round(v, 1) for k, v in m.items()}
                    m["label"] = MARKER_LABEL.get(name, "")
                    m["c"] = MARKER_COLOR.get(name, "#e8d08a")
                    m["t"] = round(idx / FPS - 0.5, 2)
                    m["until"] = round(idx / FPS + 2.6, 2)
                    markers[name] = m
                    print(f"    penanda {name}: x={m['x']} y={m['y']} (t={m['t']}s)")
                else:
                    print(f"    penanda {name}: di luar bingkai (x={m['x']:.0f} y={m['y']:.0f}) -> dilewati")
    # pastikan aksi babak benar-benar terjadi di dalam game
    check = SHOT_ASSERT.get(name)
    if check:
        ok = cdp.js_checked(check)
        ok = json.loads(ok) if isinstance(ok, str) else ok
        print(f"    keadaan akhir {name}: {ok}")
        for k, v in ok.items():
            if not v:
                raise RuntimeError(f"babak {name}: aksi '{k}' tidak terjadi di game")
    return idx


# keadaan yang HARUS benar di akhir tiap babak (bukti aksi fase benar-benar jalan)
SHOT_ASSERT = {
    "hook": "(() => { const L=window.game.level; return { tertangkap: L.catches > 0 }; })()",
    "search": "(() => { const L=window.game.level; return { pesan: L.found.message, catatan: L.found.note }; })()",
    "machine": "(() => { const L=window.game.level; return { terkunci: L.found.enc, sandi: !!L.encrypted && L.encrypted.length > 3 }; })()",
    "courier": "(() => { const L=window.game.level; return { terkirim: L.delivered, kurirBerangkat: !!L.courierLeaving }; })()",
    "stealth": "(() => { const L=window.game.level; return { tertangkap: L.catches > 0 }; })()",
    "results": "(() => { const d = Scenes.data; return { bintang: d.playedStars === 3 }; })()",
    "title": "(() => ({ judul: Scenes.cur === 'title' }))()",
    "end": "(() => { const L = window.game.level; return { level: !!(L && L.objects.length > 0) }; })()",
}


def stage_smoke(cdp):
    """Cek cepat: jalankan semua fase shot TANPA memotret frame, lalu uji keadaan akhir.
    Berguna untuk memastikan skenario benar sebelum render 10 menit."""
    cdp.call("Emulation.setDeviceMetricsOverride", width=GW, height=GH, deviceScaleFactor=1, mobile=False)
    cdp.call("Page.navigate", url=f"{BASE_URL}/tools/demo_gameplay.html?intro=0&seed=1&run=1")
    for _ in range(150):
        if cdp.js("window.assetsReady === true"):
            break
        time.sleep(0.2)
    for s in SEGMENTS:
        name = s["shot"]
        for frames, code in SHOTS[name]:
            if code:
                cdp.js_checked(f"(() => {{ {code} }})()")
            cdp.js_checked(f"window.stepFrames({frames}, {DT_MS})")
        ok = cdp.js_checked(SHOT_ASSERT.get(name, "(() => ({ ada: true }))()"))
        ok = json.loads(ok) if isinstance(ok, str) else ok
        bad = [k for k, v in ok.items() if not v]
        print(f"  {name:8s} {shot_frames(name):4d} frame  {ok}  {'OK' if not bad else 'GAGAL: ' + ', '.join(bad)}")
    return 0


def stage_gameplay(cdp, work, markers):
    cdp.call("Emulation.setDeviceMetricsOverride", width=GW, height=GH, deviceScaleFactor=1, mobile=False)
    cdp.call("Page.navigate", url=f"{BASE_URL}/tools/demo_gameplay.html?intro=0&seed=1&run=1")
    for _ in range(150):
        if cdp.js("window.assetsReady === true"):
            break
        time.sleep(0.2)
    if cdp.js("window.__err"):
        raise RuntimeError("error di driver gameplay: " + str(cdp.js("window.__err")))
    total = 0
    for s in SEGMENTS:
        n = capture_shot(cdp, s["shot"], shot_dir(work, s["name"]), markers)
        want = shot_frames(s["shot"])
        print(f"  gameplay {s['name']:8s} {n:4d} frame ({n / FPS:5.2f} dtk)"
              + ("" if n == want else f"  <-- beda dari skenario ({want})"))
        total += n
    # rangkai jadi satu urutan frame gameplay_%05d.png
    seq = os.path.join(work, "gameplay")
    os.makedirs(seq, exist_ok=True)
    i = 0
    for s in SEGMENTS:
        d = shot_dir(work, s["name"])
        for f in sorted(os.listdir(d)):
            shutil.copyfile(os.path.join(d, f), os.path.join(seq, f"g{i:05d}.png"))
            i += 1
    print(f"  total gameplay: {i} frame = {i / FPS:.2f} dtk")
    return i


def open_overlay(cdp, tl):
    """Buka halaman overlay + pasang timeline (dipakai tahap overlay & audio)."""
    cdp.call("Emulation.setDeviceMetricsOverride", width=OW, height=OH, deviceScaleFactor=1, mobile=False)
    # latar halaman dibuat BENAR-BENAR transparan, supaya PNG overlay punya alpha
    cdp.call("Emulation.setDefaultBackgroundColorOverride", color={"r": 0, "g": 0, "b": 0, "a": 0})
    cdp.call("Page.navigate", url=f"{BASE_URL}/tools/demo_overlay.html")
    for _ in range(200):
        if cdp.js("window.assetsReady === true && typeof window.Overlay === 'object'"):
            break
        time.sleep(0.2)
    if cdp.js("window.__err"):
        raise RuntimeError("error di halaman overlay: " + str(cdp.js("window.__err")))
    cdp.js(f"window.setTimeline({json.dumps(tl)})")
    print("  halaman overlay siap; timeline terpasang")


def stage_overlay(cdp, tl, work):
    ov = os.path.join(work, "overlay")
    os.makedirs(ov, exist_ok=True)
    total = int(round(tl["dur"] * FPS))
    for i in range(total):
        cdp.js(f"window.Overlay.frame({i / FPS})")
        res = cdp.call("Page.captureScreenshot", format="png",
                       clip={"x": 0, "y": 0, "width": OW, "height": OH, "scale": 1},
                       captureBeyondViewport=False)
        with open(os.path.join(ov, f"o{i:05d}.png"), "wb") as fh:
            fh.write(base64.b64decode(res["data"]))
        if i % 120 == 0:
            print(f"  overlay {i}/{total}", flush=True)
    print(f"  overlay: {total} frame")
    return total


def stage_audio(cdp, tl, work):
    b64 = cdp.js("window.renderAudio()")
    if not b64:
        raise RuntimeError("render audio gagal")
    wav = os.path.join(work, "demo.wav")
    with open(wav, "wb") as fh:
        fh.write(base64.b64decode(b64))
    sec = (os.path.getsize(wav) - 44) / (44100 * 2 * 2)
    print(f"  audio: {sec:.2f} dtk stereo 44,1 kHz")
    return wav


def stage_compose(work, wav, out_mp4):
    args = ["ffmpeg", "-y",
            "-framerate", str(FPS), "-i", os.path.join(work, "gameplay", "g%05d.png"),
            "-framerate", str(FPS), "-i", os.path.join(work, "overlay", "o%05d.png"),
            "-i", wav,
            "-filter_complex", f"[0:v]scale={OW}:{OH}:flags=neighbor[bg];[bg][1:v]overlay=0:0:format=auto[v]",
            "-map", "[v]", "-map", "2:a",
            "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out_mp4]
    p = subprocess.run(args, capture_output=True, text=True)
    if p.returncode != 0:
        sys.stderr.write(p.stderr[-2500:])
        raise RuntimeError("ffmpeg gagal menyusun demo.mp4")
    print(f"  demo.mp4 -> {out_mp4} ({os.path.getsize(out_mp4) / 1e6:.1f} MB)")


# =========================================================================== #
# 4. PEMERIKSAAN HASIL
# =========================================================================== #
def raw_frame(mp4, t):
    """Ambil satu frame video sebagai RGBA mentah (tanpa PIL)."""
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", mp4, "-ss", str(t), "-frames:v", "1",
                        "-f", "rawvideo", "-pix_fmt", "rgba", "-"], capture_output=True)
    return p.stdout


def px(frame, x, y, w=OW):
    i = (y * w + x) * 4
    return frame[i], frame[i + 1], frame[i + 2], frame[i + 3]


def region_count(frame, x0, y0, x1, y1, test, w=OW):
    n = 0
    for y in range(y0, y1, 2):
        for x in range(x0, x1, 2):
            r, gg, b, _ = px(frame, x, y, w)
            if test(r, gg, b):
                n += 1
    return n


def wav_rms_peaks(wav, win=0.1):
    """RMS per jendela waktu — untuk memastikan cue bunyi jatuh di waktunya."""
    with open(wav, "rb") as fh:
        data = fh.read()
    assert data[:4] == b"RIFF", "bukan WAV"
    n = (len(data) - 44) // 4
    step = int(44100 * win)
    out = []
    off = 44
    for i in range(0, n, step):
        acc = 0
        cnt = 0
        for k in range(i, min(n, i + step), 7):
            l = struct.unpack_from("<h", data, off + k * 4)[0]
            r = struct.unpack_from("<h", data, off + k * 4 + 2)[0]
            acc += (l * l + r * r) / 2
            cnt += 1
        out.append((acc / max(1, cnt)) ** 0.5)
    return out


def stage_extras(mp4, tl):
    """Poster (thumbnail) + teaser GIF 15 detik untuk media sosial."""
    poster = os.path.join(OUT_DIR, "demo_poster.png")
    t = round(tl["segments"][1]["t0"] + 2.4, 2)      # saat judul emas tampil penuh
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", mp4, "-ss", str(t),
                    "-frames:v", "1", poster], check=True)
    teaser = os.path.join(OUT_DIR, "demo_teaser.gif")
    vf = ("fps=12,scale=640:360:flags=neighbor,split[s0][s1];"
          "[s0]palettegen=max_colors=192:stats_mode=diff[p];"
          "[s1][p]paletteuse=dither=bayer:bayer_scale=3")
    p = subprocess.run(["ffmpeg", "-y", "-v", "error", "-t", "15", "-i", mp4,
                        "-vf", vf, "-loop", "0", teaser], capture_output=True, text=True)
    if p.returncode != 0:
        sys.stderr.write(p.stderr[-1200:])
    else:
        print(f"  teaser gif -> {teaser} ({os.path.getsize(teaser) / 1e6:.1f} MB, 15 dtk)")
    print(f"  poster     -> {poster}")


def stage_check(mp4, wav, tl):
    print("=== periksa demo.mp4")
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "stream=codec_type,codec_name,width,height,duration", "-of", "csv=p=0", mp4],
                       capture_output=True, text=True)
    print("  stream:", p.stdout.strip().replace("\n", " | "))
    fails = []
    # tiap segmen: cek piksel khas masing-masing
    for s in tl["segments"]:
        t = s["t0"] + s["dur"] * 0.5
        fr = raw_frame(mp4, t)
        if len(fr) < OW * OH * 4:
            fails.append(f"{s['name']}: frame kosong")
            continue
        gold = region_count(fr, 0, 0, OW, OH, lambda r, g, b: r > 150 and g > 110 and b < 110 and r - b > 60)
        ivory = region_count(fr, 0, 0, OW, OH, lambda r, g, b: r > 200 and g > 195 and b > 170)
        red = region_count(fr, 0, 0, OW, OH, lambda r, g, b: r > 110 and r - g > 45 and r - b > 45)
        print(f"  {s['name']:9s} t={t:5.1f}s  emas={gold:6d}  ivory={ivory:6d}  merah={red:6d}")
        if s["name"] == "end" and ivory < 200:
            fails.append("end card tanpa teks")
        if s["name"] == "hook" and (red < 100 and ivory < 100):
            fails.append("hook tanpa aksen merah/teks")
        if s["kind"] == "title" and gold < 150:
            fails.append("judul emas tidak terlihat")
    # gameplay benar-benar ada (bukan hitam) di babak shot
    for s in tl["segments"]:
        if s["kind"] != "shot":
            continue
        fr = raw_frame(mp4, s["t0"] + s["dur"] * 0.35)
        bright = region_count(fr, 0, 0, OW, OH, lambda r, g, b: r + g + b > 150) / ((OW // 2) * (OH // 2))
        need = s.get("min_bright", 0.15)
        if bright < need:
            fails.append(f"{s['name']}: latar gameplay gelap/kosong ({bright:.2f} < {need})")
        else:
            print(f"  {s['name']:9s} latar gameplay terang {bright * 100:5.1f}% (min {need * 100:.0f}%)")
    # penanda objek harus terlihat di tempat yang dilaporkan
    for s in tl["segments"]:
        mk = s.get("marker")
        if not mk:
            continue
        fr = raw_frame(mp4, s["t0"] + mk.get("t", 1.0) + 1.0)
        col = mk.get("c", "#e8d08a")
        r0, g0, b0 = int(col[1:3], 16), int(col[3:5], 16), int(col[5:7], 16)
        mx, my = mk["x"] * 2, mk["y"] * 2
        n = region_count(fr, int(mx - 60), int(my - 60), int(mx + 60), int(my + 60),
                         lambda r, g, b: abs(r - r0) < 70 and abs(g - g0) < 70 and abs(b - b0) < 70)
        print(f"  penanda {s['name']:5s} di ({mx:.0f},{my:.0f}) piksel warna cocok={n}")
        if n < 20:
            fails.append(f"{s['name']}: penanda objek tidak terlihat ({n} px)")
    # audio: cue harus muncul sebagai puncak RMS, dan audio tidak boleh kosong
    rms = wav_rms_peaks(wav)
    loud = [(i * 0.1, round(v)) for i, v in enumerate(rms)]
    top = sorted(loud, key=lambda x: -x[1])[:6]
    print("  puncak bunyi (dtk, rms):", sorted(top))
    if max(v for _, v in loud) < 300:
        fails.append("audio terlalu pelan/kosong")
    # sinkronisasi: cue penting harus menaikkan RMS tepat di jendelanya
    rmsf = wav_rms_peaks(wav, win=0.05)
    med = sorted(rmsf)[len(rmsf) // 2] if rmsf else 0
    LOUD = {"impact", "fanfare", "machine", "chime", "star", "door", "sparkle", "alert"}
    missing = []
    n_loud = 0
    for c in tl["cues"]:
        if c["k"] not in LOUD:
            continue
        n_loud += 1
        i = int(c["t"] / 0.05)
        win = rmsf[max(0, i - 1):i + 6]
        if not win or max(win) < med * 1.05:
            missing.append((round(c["t"], 2), c["k"]))
    print(f"  cue penting yang RMS-nya tidak naik: {len(missing)}/{n_loud}", missing[:6])
    if len(missing) > 2:
        fails.append(f"{len(missing)} cue penting tidak terdengar di waktunya")
    print("  HASIL:", "OK" if not fails else "GAGAL -> " + "; ".join(fails))
    return 0 if not fails else 1


# =========================================================================== #
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", default="all",
                    choices=["all", "gameplay", "overlay", "audio", "compose", "check", "smoke"])
    ap.add_argument("--dry-run", action="store_true", help="cetak timeline lalu keluar")
    ap.add_argument("--overlay-preview", default="",
                    help="render beberapa still overlay (mis. 2.0,6.0,30.0) lalu keluar")
    ap.add_argument("--keep", action="store_true", help="jangan hapus direktori kerja (di /tmp)")
    ap.add_argument("--check", action="store_true", help="sama dengan --stage check")
    args = ap.parse_args()
    if args.check:
        args.stage = "check"

    global BASE_URL
    work = tempfile.mkdtemp(prefix="secretmail_demo_")
    out_mp4 = os.path.join(OUT_DIR, "demo.mp4")
    tl_file = os.path.join(OUT_DIR, "demo.timeline.json")
    wav_out = os.path.join(OUT_DIR, "demo_audio.wav")
    os.makedirs(OUT_DIR, exist_ok=True)

    if args.stage == "check":
        if not (os.path.exists(out_mp4) and os.path.exists(tl_file) and os.path.exists(wav_out)):
            print("belum ada hasil; jalankan tanpa --stage dulu")
            return 1
        with open(tl_file) as fh:
            tl = json.load(fh)
        return stage_check(out_mp4, wav_out, tl)

    markers = {}
    tl = build_timeline(markers)
    if args.dry_run:
        for s in tl["segments"]:
            print(f"{s['t0']:6.2f}s +{s['dur']:5.2f}s  {s['name']:9s} {s['kind']:8s}")
        print(f"total {tl['dur']:.2f} dtk, {len(tl['cues'])} cue audio, "
              f"{len(tl['boundaries'])} batas babak, {sum(shot_frames(s['shot']) for s in SEGMENTS)} frame gameplay")
        shutil.rmtree(work, ignore_errors=True)
        return 0

    srv, port = ri.free_port(), ri.free_port()
    server = ri.start_server(srv)
    BASE_URL = f"http://127.0.0.1:{srv}"
    chrome = ri.start_chrome(port, os.path.join(work, "chrome"))
    cdp = None
    if args.overlay_preview:
        # kalau hasil render sebelumnya ada, pakai timeline itu (termasuk penanda
        # objek hasil rekaman gameplay) supaya pratinjau sama dengan video jadinya
        if os.path.exists(tl_file):
            with open(tl_file) as fh:
                tl2 = json.load(fh)
            print("  timeline dari", tl_file)
        else:
            tl2 = tl
        try:
            ri.wait_port(srv)
            cdp = ri.CDP(ri.page_ws(port))
            cdp.call("Page.enable")
            cdp.call("Runtime.enable")
            open_overlay(cdp, tl2)
            for t in [float(x) for x in args.overlay_preview.split(",") if x.strip()]:
                cdp.js(f"window.Overlay.frame({t})")
                p = os.path.join(OUT_DIR, f"overlay_{t:06.2f}s.png")
                res = cdp.call("Page.captureScreenshot", format="png",
                               clip={"x": 0, "y": 0, "width": OW, "height": OH, "scale": 1},
                               captureBeyondViewport=False)
                with open(p, "wb") as fh:
                    fh.write(base64.b64decode(res["data"]))
                print("overlay still ->", p)
        finally:
            if cdp:
                cdp.close()
            chrome.terminate()
            server.terminate()
            shutil.rmtree(work, ignore_errors=True)
        return

    try:
        ri.wait_port(srv)
        cdp = ri.CDP(ri.page_ws(port))
        cdp.call("Page.enable")
        cdp.call("Runtime.enable")

        if args.stage == "smoke":
            print("== smoke: jalankan semua fase shot tanpa memotret")
            rc = stage_smoke(cdp)
            shutil.rmtree(work, ignore_errors=True)
            return rc

        if args.stage in ("all", "gameplay"):
            print("== 1. rekam gameplay")
            tf = stage_gameplay(cdp, work, markers)
            tl = build_timeline(markers)          # marker dari state game setelah direkam
            if tf != sum(shot_frames(s["shot"]) for s in SEGMENTS):
                print(f"  PERINGATAN: jumlah frame gameplay ({tf}) beda dari skenario")

        need_overlay = args.stage in ("all", "overlay", "audio", "compose")
        if need_overlay:
            open_overlay(cdp, tl)
            with open(tl_file, "w") as fh:
                json.dump(tl, fh, indent=1)
        if args.stage in ("all", "overlay"):
            print("== 2. render overlay motion-graphic")
            stage_overlay(cdp, tl, work)
        if need_overlay and not os.path.exists(os.path.join(work, "gameplay", "g00000.png")):
            raise RuntimeError("frame gameplay belum ada — jalankan tahap gameplay dulu")
        wav = os.path.join(work, "demo.wav")
        if args.stage in ("all", "audio", "compose"):
            print("== 3. render audio (musik + SFX offline)")
            wav = stage_audio(cdp, tl, work)
            shutil.copyfile(wav, wav_out)
        if args.stage in ("all", "compose"):
            print("== 4. susun video")
            stage_compose(work, wav, out_mp4)
            stage_extras(out_mp4, tl)
        if args.stage == "all":
            print("== 5. periksa")
            stage_check(out_mp4, wav_out, tl)
        print(f"\ntimeline: {tl['dur']:.2f} dtk · {sum(shot_frames(s['shot']) for s in SEGMENTS)} frame gameplay")
    finally:
        if cdp:
            cdp.close()
        chrome.terminate()
        server.terminate()
        if not args.keep:
            shutil.rmtree(work, ignore_errors=True)
        else:
            print("direktori kerja:", work)


BASE_URL = ""
if __name__ == "__main__":
    sys.exit(main() or 0)
