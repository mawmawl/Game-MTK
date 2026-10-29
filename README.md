# Secret Mail

**Game matematika dengan konsep enkripsi** — petualangan pixel art 2D bertema *enkripsi end-to-end*.
Vanilla JS + Canvas, tanpa library, tanpa aset eksternal (semua sprite digambar dengan kode, semua SFX disintesis Web Audio) — bisa jalan 100% offline.

Pemain jadi kurir rahasia: temukan **pesan rahasia** dan **catatan fungsi** `f(x) = ax + b` yang disembunyikan di objek ruangan, enkripsi pesan di mesin, lalu ketik sandinya ke kurir. Pesan, fungsi, dan lokasi sembunyi **selalu berubah** setiap kali level dimainkan.

## Menjalankan

```bash
python3 serve.py          # http://127.0.0.1:8123
python3 serve.py 9000     # port lain
```

Bisa juga dibuka langsung lewat `file://index.html`, tapi server lokal lebih aman untuk klipboard & font.

## Kontrol

| Aksi | Keyboard / mouse | Sentuh (HP/tablet) |
|---|---|---|
| Gerak | WASD / panah | joystick kiri-bawah |
| Periksa objek / bicara | `E` atau `Spasi` | gelembung yang muncul saat mendekati benda → ketuk |
| Jurnal | `TAB` | ikon tas di atas-tengah layar |
| Jeda / menu | `ESC` | ikon pause di atas-tengah layar |
| Isi angka & huruf | papan ketik | keypad angka (mesin) & papan huruf (kurir) di layar |
| Suara | `M` | menu Jeda → SUARA |

Mode sentuh dideteksi otomatis; paksa dengan `?touch=1`. Di layar tegak (potret) muncul pengingat memutar layar yang bisa dilewati dengan satu ketukan.

## Alur satu level

1. Periksa objek (`search:true`) → temukan **PESAN RAHASIA** dan **CATATAN FUNGSI**.
2. Buka **MESIN ENKRIPSI** → masukkan nilai `a` dan `b` sesuai catatan → mesin mengeluarkan **teks terenkripsi** (tersimpan di jurnal).
3. Datangi **KURIR** di dekat pintu → ketik sandi **persis** (besar/kecil huruf berarti) → kurir berangkat, muncul bintang & skor.

Level 2 & 3 dijaga mata-mata/drone: kerucut pandang bisa dihindari dengan bersembunyi di balik perabot. Tertangkap = kembali ke titik awal, barang yang sudah ditemukan tetap tersimpan.

## Skema sandi (di balik layar)

- Huruf kapital `A=1 … Z=26`, huruf kecil `a=-1 … z=-26`, spasi `=0`
- Setiap huruf dihitung `f(x) = a·x + b`, hasilnya dipetakan kembali ke rentang −26…+26 (mod 53)
- 53 prima → setiap nilai `a` menghasilkan sandi yang selalu bisa dibalik

| Level | Tempat | Pesan | Nilai `a` | Nilai `b` | Kombinasi pesan × fungsi | Objek sembunyi | Total konfigurasi |
|---|---|---|---|---|---|---|---|
| 1 | Kamar | 10 | 1 (tetap) | 25 | 250 | 5 → 20 pasangan | 5.000 |
| 2 | Sekolah | 10 | 8 | 30 | 2.400 | 13 → 156 pasangan | 374.400 |
| 3 | Lab Rusak | 10 | 11 | 40 | 4.400 | 9 → 72 pasangan | 316.800 |

## Struktur

```
Game_MTK/
├── index.html          # kanvas ganda: #game (dunia) + #ui (teks tajam)
├── serve.py            # server statis anti-cache
├── css/style.css
├── js/
│   ├── engine.js       # kanvas, input (keyboard + sentuh), kamera, collision, partikel, audio, teks
│   ├── crypto.js       # skema mod 53, pool pesan, pengacakan teka-teki
│   ├── sprites.js      # seluruh pixel art: aktor, ~40 objek, tileset 3 tema
│   ├── levels.js       # 3 level: peta, objek, musuh, tema, target waktu
│   ├── enemies.js      # AI patroli/waspada/kejar + kerucut pandang
│   ├── ui.js           # HUD, jurnal, panel mesin, panel kurir, keypad sentuh
│   ├── scenes.js       # buildLevel + semua scene (title, intro, game, hasil, ending)
│   └── main.js         # boot, save/load, loop 60fps
└── docs/
    ├── IDEA.md         # brief awal
    └── RANCANGAN.md    # rancangan lengkap
```

Urutan `<script>` di `index.html` penting (engine lebih dulu, main terakhir). Semua tautan aset memakai `?v=N` — naikkan angkanya setiap kali mengubah `css`/`js` supaya browser tidak memakai cache lama.

## Parameter URL untuk uji coba

| Parameter | Fungsi |
|---|---|
| `?seed=1` | teka-teki deterministik per build (tiap ulang tetap beda) |
| `?seed=1&run=1` | teka-teki **persis sama** tiap build — untuk reproduksi bug |
| `?debug=1` | tampilkan kotak collision (merah) & penghalang pandang (biru) |
| `?touch=1` | paksa mode sentuh di desktop |
| `?mute=0` | paksa suara nyala |

Kemajuan pemain (level terbuka, bintang, skor terbaik, setelan suara) disimpan di `localStorage` dengan kunci `secretMailV1` (kunci lama `kurirSandiV1` masih dibaca untuk migrasi).

## Aset gambar

Semua aset dibuat lokal oleh kode — tidak ada unduhan, tidak ada CDN, tetap 100% offline:

```
assets/tex/velvet.png     256x256  tekstur beludru gelap (mulus, diulang 1:1)
assets/tex/golddust.png   64x64    satu bulatan debu emas lembut (RGBA)
assets/emblem.png         320x72   ornamen art-deco emas (RGBA)
tools/make_assets.py               pembuat ketiga aset di atas (zlib + struct, tanpa dependensi)
```

Buat ulang aset: `python3 tools/make_assets.py`

Pemuatan aset ada di `js/main.js` (`IMG` + `loadAssets`), dengan batas waktu 2,5 detik: kalau
sebuah aset gagal dimuat, lapisan itu dilewati (garis ornamen digambar prosedural) dan game
tetap jalan. Lapisan latar judul yang statis (gradasi + pendar + tekstur) di-cache sekali per
ukuran layar agar tidak dihitung tiap frame.
