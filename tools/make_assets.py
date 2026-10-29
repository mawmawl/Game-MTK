#!/usr/bin/env python3
"""Pembuat aset PNG untuk "Secret Mail" — tanpa dependensi (zlib + struct saja).

Menghasilkan:
  assets/tex/velvet.png    256x256  tekstur beludru gelap (mulus / tileable)
  assets/tex/golddust.png  64x64    serpihan debu emas lembut (RGBA transparan)
  assets/emblem.png        320x72   ornamen art-deco emas (RGBA transparan)

Jalankan dari akar proyek:  python3 tools/make_assets.py
"""
import math, os, struct, sys, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def write_png(path, w, h, rows):
    """rows: list berisi bytes per baris (RGBA, 4 byte/piksel)."""
    raw = b''.join(b'\x00' + r for r in rows)

    def chunk(tag, data):
        body = struct.pack('>I', len(data)) + tag + data
        return body + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    png = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
           + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(png)
    return len(png)


# ---------------------------------------------------------------- tekstur
def velvet(size=256):
    """Beludru gelap: derau periodik (mulus saat diulang) + bintik emas langka."""
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            n = (0.50 * math.sin(2 * math.pi * (1 * x + 2 * y) / size)
                 + 0.30 * math.sin(2 * math.pi * (3 * x - 1 * y) / size + 1.1)
                 + 0.20 * math.sin(2 * math.pi * (5 * x + 4 * y) / size + 2.3)
                 + 0.14 * math.sin(2 * math.pi * (9 * x - 7 * y) / size + 0.7)
                 + 0.10 * math.sin(2 * math.pi * (15 * x + 11 * y) / size + 3.1))
            v = 7 + int(6 * (n / 1.24 * 0.5 + 0.5))          # 7..13
            r, g, b, a = v + 1, v, v + 4, 255                 # semburat ungu tipis
            if ((x * 7919) ^ (y * 104729)) % 613 == 0:        # bintik emas halus
                r, g, b = 52, 40, 14
            elif ((x * 3571) ^ (y * 69827)) % 1543 == 0:
                r, g, b = 26, 22, 40
            row += bytes((r, g, b, a))
        rows.append(bytes(row))
    return size, size, rows


def golddust(size=64, r=24.0):
    """Satu bulatan debu lembut di tengah (RGBA), dipakai berulang dengan skala berbeda."""
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            d = math.hypot(x - size / 2.0 + 0.5, y - size / 2.0 + 0.5) / r
            if d >= 1.0:
                row += b'\x00\x00\x00\x00'
                continue
            v = (1.0 - d) ** 2.6
            a = int(255 * min(1.0, v * 1.25))
            row += bytes((255, 240, 208, a))
        rows.append(bytes(row))
    return size, size, rows


# ----------------------------------------------------------------- emblem
def emblem(w=320, h=72):
    """Ornamen art-deco emas: berlian tengah, sayap garis mengecil, titik mutiara."""
    px = [[(0, 0, 0, 0) for _ in range(w)] for _ in range(h)]

    def put(x, y, col, a=255):
        if 0 <= x < w and 0 <= y < h:
            r, g, b = col
            px[y][x] = (r, g, b, a)

    def hline(x0, x1, y, col, a=255):
        for x in range(x0, x1 + 1):
            put(x, y, col, a)

    def diamond(cx, cy, r, col, a=255):
        for dy in range(-r, r + 1):
            span = r - abs(dy)
            for dx in range(-span, span + 1):
                put(cx + dx, cy + dy, col, a)

    GOLD = (232, 192, 74)
    GOLD_HI = (255, 238, 190)
    DIM = (150, 116, 34)

    cy = h // 2
    cx = w // 2
    # sayap: garis mengecil ke luar, dua tingkat
    for yy, x0, x1, a in ((cy - 5, 12, w - 13, 120), (cy + 5, 12, w - 13, 120)):
        hline(x0, x1, yy, GOLD, a)
    # garis utama
    hline(10, w - 11, cy, GOLD, 235)
    # mutiara ujung
    diamond(10, cy, 1, GOLD_HI, 235)
    diamond(w - 11, cy, 1, GOLD_HI, 235)
    # berlian kecil di sepanjang garis
    for dx in (34, 58, w - 35, w - 59):
        diamond(dx, cy, 2, GOLD_HI, 220)
    for dx in (76, w - 77):
        diamond(dx, cy, 1, DIM, 200)
    # berlian tengah berlapis
    diamond(cx, cy, 9, DIM, 255)
    diamond(cx, cy, 7, GOLD, 255)
    diamond(cx, cy, 4, GOLD_HI, 255)
    # garis pendek di atas & bawah berlian tengah (aksen)
    hline(cx - 26, cx - 12, cy - 10, GOLD, 90)
    hline(cx + 12, cx + 26, cy - 10, GOLD, 90)
    hline(cx - 26, cx - 12, cy + 10, GOLD, 90)
    hline(cx + 12, cx + 26, cy + 10, GOLD, 90)
    return w, h, [bytes(v for p in row for v in p) for row in px]


# ------------------------------------------------------------------- main
def stats(rows):
    """rata-rata & maksimum kecerahan piksel tak-transparan (untuk kalibrasi alpha)."""
    tot = n = 0
    mx = 0
    for row in rows:
        for i in range(0, len(row), 4):
            r, g, b, a = row[i], row[i + 1], row[i + 2], row[i + 3]
            if a == 0:
                continue
            lum = (r * 299 + g * 587 + b * 114) // 1000
            tot += lum
            n += 1
            mx = max(mx, lum)
    return (tot / n if n else 0), mx, n


def main():
    made = []
    for name, gen in (('assets/tex/velvet.png', velvet),
                      ('assets/tex/golddust.png', golddust),
                      ('assets/emblem.png', emblem)):
        w, h, rows = gen()
        size = write_png(os.path.join(ROOT, name), w, h, rows)
        mean, mx, npx = stats(rows)
        made.append((name, w, h, size, round(mean, 1), mx, npx))
    print('aset dibuat:')
    for name, w, h, size, mean, mx, npx in made:
        print('  %-24s %3dx%-4d %6d byte  rata2=%5.1f maks=%3d piksel=%d'
              % (name, w, h, size, mean, mx, npx))
    return 0


if __name__ == '__main__':
    sys.exit(main())
