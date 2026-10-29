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
│   ├── cinematic.js    # intro sinematik — murni fungsi waktu (dipakai juga untuk render video)
│   ├── scenes.js       # buildLevel + semua scene (cinema, title, intro, game, hasil, ending)
│   └── main.js         # boot, save/load, loop 60fps
├── assets/video/       # hasil render intro (intro.mp4, intro.gif, poster)
└── docs/
    ├── IDEA.md         # brief awal
    └── RANCANGAN.md    # rancangan lengkap
```

## Intro sinematik (grafik gerak)

Saat pertama dibuka, game menjalankan intro 12,8 detik: kota malam berhujan → amplop terbang masuk →
segel lilin dicap → berkas rahasia dengan teks sandi yang terurai → logo **SECRET MAIL** tersusun huruf demi huruf.
Gaya: piksel + pendar emas + scanline CRT. Bisa dilewati dengan tombol/ketukan apa pun.

Seluruh animasinya satu fungsi waktu — `Cinematic.frame(t)` di `js/cinematic.js` — tanpa `Math.random()`,
sehingga frame yang sama persis bisa dirender jadi berkas video:

```bash
python3 tools/render_intro.py                 # intro.mp4 (1280x720, BERSUARA) + intro.gif + poster
python3 tools/render_intro.py --fps 24 --scale 3
python3 tools/render_intro.py --preview 3.5,6.5,9.0   # beberapa PNG pratinjau saja
python3 tools/render_intro.py --no-gif        # MP4 saja
python3 tools/render_intro.py --no-audio      # MP4 tanpa suara
```

Suara video dirender **offline** di halaman (`OfflineAudioContext`) memakai SFX dan pola musik
yang sama dengan game, lalu digabung ffmpeg — jadi tidak ada perekaman real-time dan hasilnya
selalu sama. Pemeriksaan otomatis: `python3 tools/check_intro.py` (piksel per babak),
`python3 tools/check_game_intro.py` (integrasi intro di game sungguhan), dan
`python3 tools/check_motion.py` (audit: tiap layar wajib bergerak).

## Efek gerak di gameplay

| Momen | Efek |
|---|---|
| Ganti scene (mulai/ulangi/keluar level) | tirai piksel 16px naik bertahap dari bawah + garis emas di ujungnya (`Fade`) |
| Tertangkap musuh | hentakan 0,16 dtk (dunia beku, partikel & kamera tetap jalan) + denyut merah di tepi layar + kilat merah |
| Pesan berhasil diantar | hentakan 0,14 dtk + kilat emas + denyut emas di tepi layar |
| Layar hasil | kilat emas saat panel muncul + kilau melintas di permukaan panel + bintang meletup satu per satu |
| Jurnal dibuka | panel meluncur masuk (`L.journalA`) |
| Panel dialog | kotak meluncur naik saat muncul + huruf diketik |
| Mesin enkripsi | bilah progres + sandi **dicetak huruf demi huruf** dengan kursor blok berkedip (tik mesin tik) |
| Pilih level | kartu naik satu per satu, kartu terpilih mengambang + garis emas tumbuh dari tengah |
| Cara main | halaman meluncur masuk dari kanan + penanda halaman |
| Brief level | bar letterbox masuk, amplop turun + miring, judul naik, kalimat meluncur tiap ganti baris |
| Ending | judul turun huruf demi huruf, sembilan bintang meletup berurutan, paragraf memudar masuk |

Diuji otomatis: `python3 tools/check_fx.py` (tirai transisi, efek tangkapan, kemenangan, layar hasil)
dan `python3 tools/check_motion.py` (audit gerak semua layar — termasuk membuktikan sandi mesin
benar-benar bertambah tercetak, bukan muncul sekaligus).

Urutan `<script>` di `index.html` penting (engine lebih dulu, main terakhir). Semua tautan aset memakai `?v=N` — naikkan angkanya setiap kali mengubah `css`/`js` supaya browser tidak memakai cache lama.

## Parameter URL untuk uji coba

| Parameter | Fungsi |
|---|---|
| `?seed=1` | teka-teki deterministik per build (tiap ulang tetap beda) |
| `?seed=1&run=1` | teka-teki **persis sama** tiap build — untuk reproduksi bug |
| `?debug=1` | tampilkan kotak collision (merah) & penghalang pandang (biru) |
| `?touch=1` | paksa mode sentuh di desktop |
| `?mute=0` | paksa suara nyala |
| `?intro=1` | paksa putar ulang intro sinematik |
| `?intro=0` | lewati intro (langsung menu utama) |

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
