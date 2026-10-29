#!/usr/bin/env python3
"""Render intro sinematik "Secret Mail" jadi video (MP4 + GIF).

Cara kerja:
  1. server statis kecil (folder proyek ini) dinyalakan,
  2. Chrome headless dibuka ke tools/capture.html — halaman yang memuat
     js/cinematic.js TANPA game loop,
  3. tiap frame: jalankan Cinematic.frame(t) untuk t = i/fps lalu
     Page.captureScreenshot (jadi animasi persis, tidak tergantung lag),
  4. frame PNG disatukan ffmpeg -> assets/video/intro.mp4 + intro.gif.

Contoh:
    python3 tools/render_intro.py                    # 30 fps, 1280x720, + GIF
    python3 tools/render_intro.py --fps 24 --scale 3
    python3 tools/render_intro.py --preview 3.4,6.2,9.6   # hanya beberapa PNG
    python3 tools/render_intro.py --no-gif
"""
import argparse
import base64
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

import websocket  # websocket-client

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
VW, VH = 640, 360          # resolusi internal game (rasio & kanvas asli)


# --------------------------------------------------------------------------- #
# CDP minimal
# --------------------------------------------------------------------------- #
class CDP:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=30, suppress_origin=True)
        self.seq = 0
        self.events = []          # pesan tanpa "id" (event CDP) dikumpulkan di sini

    def call(self, method, **params):
        self.seq += 1
        mid = self.seq
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})
            if "method" in msg:
                self.events.append(msg)

    def js(self, expr):
        r = self.call("Runtime.evaluate", expression=expr, returnByValue=True, awaitPromise=True)
        return r.get("result", {}).get("value")

    def close(self):
        try:
            self.ws.close()
        except Exception:
            pass


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def wait_port(port, timeout=15):
    end = time.time() + timeout
    while time.time() < end:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                return True
        except OSError:
            time.sleep(0.15)
    return False


def start_server(port):
    return subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def start_chrome(port, profile):
    flags = [
        CHROME, "--headless=new", f"--remote-debugging-port={port}",
        "--remote-allow-origins=*", f"--user-data-dir={profile}",
        f"--window-size={VW},{VH}", "--force-device-scale-factor=1",
        "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
        "--disable-extensions", "--mute-audio",
        "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
        "about:blank",
    ]
    return subprocess.Popen(flags, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def page_ws(port, timeout=20):
    end = time.time() + timeout
    while time.time() < end:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=2) as r:
                for t in json.load(r):
                    if t.get("type") == "page" and t.get("webSocketDebuggerUrl"):
                        return t["webSocketDebuggerUrl"]
        except Exception:
            pass
        time.sleep(0.25)
    raise RuntimeError("tidak bisa menemukan target halaman Chrome (CDP)")


def shot(cdp, path):
    res = cdp.call("Page.captureScreenshot", format="png",
                   clip={"x": 0, "y": 0, "width": VW, "height": VH, "scale": 1},
                   captureBeyondViewport=False)
    with open(path, "wb") as f:
        f.write(base64.b64decode(res["data"]))


def run_ffmpeg(args):
    p = subprocess.run(args, capture_output=True, text=True)
    if p.returncode != 0:
        sys.stderr.write(p.stdout[-2000:] + p.stderr[-2000:])
        raise RuntimeError("ffmpeg gagal: " + " ".join(args[:4]) + " ...")


# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--scale", type=int, default=2, help="perbesaran piksel utuh (1 = 640x360)")
    ap.add_argument("--gif-fps", type=int, default=20)
    ap.add_argument("--no-gif", action="store_true")
    ap.add_argument("--no-mp4", action="store_true")
    ap.add_argument("--no-audio", action="store_true",
                    help="MP4 tanpa suara (bawaan: suara dirender dari SFX & musik game)")
    ap.add_argument("--preview", default="", help="daftar detik, mis. 3.4,6.2 -> PNG pratinjau saja")
    ap.add_argument("--out-dir", default=os.path.join(ROOT, "assets", "video"))
    args = ap.parse_args()

    out_dir = args.out_dir
    os.makedirs(out_dir, exist_ok=True)
    work = tempfile.mkdtemp(prefix="secretmail_intro_")
    frames = os.path.join(work, "frames")
    os.makedirs(frames)

    srv_port, cdp_port = free_port(), free_port()
    server = start_server(srv_port)
    chrome = start_chrome(cdp_port, os.path.join(work, "chrome"))
    cdp = None
    try:
        if not wait_port(srv_port):
            raise RuntimeError("server statis gagal start")
        ws_url = page_ws(cdp_port)
        cdp = CDP(ws_url)
        cdp.call("Page.enable")
        cdp.call("Runtime.enable")
        cdp.call("Emulation.setDeviceMetricsOverride", width=VW, height=VH,
                 deviceScaleFactor=1, mobile=False)
        cdp.call("Page.navigate", url=f"http://127.0.0.1:{srv_port}/tools/capture.html")
        dur = None
        ready = False
        end = time.time() + 30
        while time.time() < end:
            ready = cdp.js("window.assetsReady === true && typeof window.drawFrame === 'function'")
            if ready:
                dur = cdp.js("window.CINEMA_DUR")
                break
            time.sleep(0.2)
        if not ready:
            raise RuntimeError("halaman capture tidak siap (font/skrip gagal dimuat?)")
        err = cdp.js("window.__err || null")
        if err:
            raise RuntimeError("error di halaman capture: " + str(err))
        print(f"intro siap: durasi {dur:.2f}s  (viewport {VW}x{VH})")

        # ---- mode pratinjau: beberapa PNG saja ----
        if args.preview:
            for t in [float(x) for x in args.preview.split(",") if x.strip()]:
                cdp.js(f"window.drawFrame({t})")
                p = os.path.join(out_dir, f"preview_{t:05.2f}s.png")
                shot(cdp, p)
                print("preview ->", p)
            return

        # ---- rekam semua frame ----
        total = int(round(dur * args.fps))
        for i in range(total):
            t = i / args.fps
            cdp.js(f"window.drawFrame({t})")
            shot(cdp, os.path.join(frames, f"frame_{i:05d}.png"))
            if i % 30 == 0:
                print(f"  frame {i}/{total}", flush=True)
        print(f"selesai {total} frame")

        size = f"{VW * args.scale}:{VH * args.scale}"
        if not args.no_mp4:
            mp4 = os.path.join(out_dir, "intro.mp4")
            silent = os.path.join(work, "video-mute.mp4")
            run_ffmpeg(["ffmpeg", "-y", "-framerate", str(args.fps),
                        "-i", os.path.join(frames, "frame_%05d.png"),
                        "-vf", f"scale={size}:flags=neighbor",
                        "-c:v", "libx264", "-preset", "slow", "-crf", "16",
                        "-pix_fmt", "yuv420p", "-movflags", "+faststart", silent])
            if args.no_audio:
                shutil.copyfile(silent, mp4)
            else:
                # audio dirender di halaman (OfflineAudioContext) memakai SFX & musik game
                b64 = cdp.js("window.renderAudio()")
                if not b64:
                    raise RuntimeError("render audio gagal: renderAudio() tidak mengembalikan data")
                wav = os.path.join(work, "intro.wav")
                with open(wav, "wb") as fh:
                    fh.write(base64.b64decode(b64))
                wav_sec = (os.path.getsize(wav) - 44) / (44100 * 2 * 2)
                run_ffmpeg(["ffmpeg", "-y", "-i", silent, "-i", wav,
                            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                            "-shortest", mp4])
                print(f"audio: {wav_sec:.1f} dtk stereo 44,1 kHz (SFX + musik dari game)")
            print("mp4  ->", mp4, f"({os.path.getsize(mp4) / 1e6:.1f} MB)")
        if not args.no_gif:
            gif = os.path.join(out_dir, "intro.gif")
            pal = os.path.join(work, "pal.png")
            vf_in = f"fps={args.gif_fps},scale={size}:flags=neighbor"
            run_ffmpeg(["ffmpeg", "-y", "-framerate", str(args.fps),
                        "-i", os.path.join(frames, "frame_%05d.png"),
                        "-vf", vf_in + ",palettegen=max_colors=192:stats_mode=diff", pal])
            run_ffmpeg(["ffmpeg", "-y", "-framerate", str(args.fps),
                        "-i", os.path.join(frames, "frame_%05d.png"),
                        "-i", pal, "-lavfi", vf_in + " [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=3",
                        "-loop", "0", gif])
            print("gif  ->", gif, f"({os.path.getsize(gif) / 1e6:.1f} MB)")
        # poster (untuk thumbnail / README)
        poster_t = min(dur - 1.0, 9.4)
        cdp.js(f"window.drawFrame({poster_t})")
        poster = os.path.join(out_dir, "intro_poster.png")
        shot(cdp, poster)
        print("poster ->", poster)
    finally:
        if cdp:
            cdp.close()
        chrome.terminate()
        server.terminate()
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
