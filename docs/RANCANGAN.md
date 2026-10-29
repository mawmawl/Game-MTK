# RANCANGAN GAME — "SECRET MAIL"

Game petualangan 2D **pixel art premium** bertema **enkripsi end-to-end**, berjalan di browser (HTML5 Canvas + vanilla JS, tanpa library). Dibangun dari nol di `/Users/rdws./Documents/Game_MTK`.

## 1. Konsep & Cerita

Player adalah **agen kurir rahasia**. Di kota Pixelia, jaringan komunikasi disadap mata-mata — pesan hanya aman jika **dienkripsi sebelum dikirim**, dan hanya penerima pemegang fungsi pembalik yang bisa membacanya (pesan berubah-ubah, kunci tidak pernah lewat jaringan = spirit end-to-end).

## 2. Alur Inti per Level

1. **Eksplorasi ruangan** (hindari mata-mata di Level 2 & 3) → interaksi objek (E/Space) → temukan **PESAN RAHASIA**
2. Cari **CATATAN FUNGSI** f(x) = ax + b yang tersembunyi di objek lain
3. Datangi **MESIN ENKRIPSI** → masukkan nilai **a** dan **b** (diketik sesuai catatan)
   - Salah → mesin menolak ("Parameter tidak cocok!"), boleh ulang
   - Benar → animasi mesin bekerja → keluar **TEKS TERENKRIPSI** (semua perhitungan di belakang layar), tersimpan ke **Jurnal**
4. Datangi **KURIR** (NPC dekat pintu) → dialog → **ketik teks terenkripsi** persis
   - Benar → kurir berangkat → layar HASIL (bintang & skor)
   - Salah → "Teks tidak cocok, periksa jurnalmu (TAB)"

## 3. Skema Enkripsi (di belakang layar) — sesuai koreksi Anda

Pemetaan karakter → angka:
- **Huruf kapital: A=1, B=2, …, Z=26**
- **Huruf kecil: a=-1, b=-2, …, z=-26**
- **Spasi = 0**

Setiap karakter dihitung dengan `f(x) = a·x + b`, hasil dipetakan balik ke rentang −26…+26 (mod 53), lalu dikembalikan ke karakter (positif → kapital, negatif → kecil, 0 → spasi). Karena 53 prima, setiap nilai a menghasilkan sandi yang selalu bisa dibalik — cocok untuk cerita dekripsi.

Contoh f(x) = 2x + 3: 'K'(11) → 25 → 'Y'; 'a'(−1) → 1 → 'A'; ' '(0) → 3 → 'C'.

- **Level 1:** a = 1 → f(x) = x + b (geser sederhana), pesan pendek (2–3 kata)
- **Level 2:** a acak (2–9), pesan 3–4 kata
- **Level 3:** a (2–12) & b (−20…20) acak penuh, pesan 4–6 kata

Karena besar/kecil huruf membawa informasi dalam sandi, validasi ketikan kurir **case-sensitive** (Jurnal menampilkan teks persis untuk disalin).

## 4. Randomisasi Anti-Hafalan (inti permintaan)

Setiap kali level dimulai **atau diulang**, berikut diacak:
- **Isi pesan** — dari pool 10 variasi pesan berbeda per level, bertema levelnya (kapitalisasi alami)
- **Fungsi** — nilai a dan b selalu baru
- **Lokasi penemuan** — pesan & catatan fungsi muncul di salah satu dari 3–4 objek kandidat

Yang tetap sama hanya **tema ruangan**, layout, posisi mesin, dan kurir.

## 5. Tiga Level (Tema & Musuh)

| Level | Tempat | Suasana & Objek Khas | Musuh |
|---|---|---|---|
| 1 | **Kamar** | Hangat senja: tempat tidur dengan bantal & selimut, meja belajar dengan lampu nyala, laci, lemari, poster, jendela bercahaya senja | — (aman, untuk belajar) |
| 2 | **Sekolah** | Cerah: bangku siswa berjajar, papan tulis bertulisan kapur, locker, rak buku, globe, jendela biru langit | 1 mata-mata patroli lambat |
| 3 | **Lab Rusak** | Gelap elegan: komputer layar retak berkedip, tabung pecah menetes, kotak listrik neon, uap & percikan | 1 drone keamanan rusak, lebih cepat |

## 6. Tantangan: Mata-Mata Patroli + Bintang & Skor

**Mata-mata / drone patroli:**
- Berjalan bolak-balik/melingkar lewat jalur tetap; arah pandang mengikuti arah jalan, dengan **kerucut penglihatan** (±4 tile) yang tergambar samar — player bisa menyelinap dari belakang
- Jika player masuk kerucut → musuh waspada (tanda seru) dan mengejar sebentar; jika tersentuh → **TERTANGKAP**: kilat layar, player kembali ke titik awal level, penanda "tertangkap" +1 (barang yang sudah ditemukan **tetap** tersimpan — tidak menghukul keras)
- Furniture menghalangi garis pandang (bisa sembunyi di balik meja/lemari)

**Bintang & skor (muncul di layar hasil):**
- HUD menampilkan **stopwatch** (waktu berjalan naik — bukan hitung mundur, tanpa kegagalan karena waktu)
- ★★★: selesai tanpa tertangkap & waktu di bawah target level
- ★★: tertangkap ≤ 2 kali atau waktu sedikit lewat target
- ★: berhasil menyelesaikan level
- Target waktu per level (mis. 90 / 150 / 210 detik) mudah disetel di konfigurasi
- Skor akhir = angka waktu + penalti tertangkap; **rekor terbaik per level tersimpan** di localStorage dan tampil di pilihan level

## 7. Kontrol & UI

- **WASD/panah** gerak • **E/Space** interaksi • **TAB** buka Jurnal • **Enter** kirim input • **Esc** tutup panel
- **HUD**: nama level, stopwatch, checklist objektif (Pesan? Fungsi? Enkripsi? Kurir?)
- **Jurnal (Tab)**: menampilkan pesan, fungsi, dan hasil enkripsi — sumber menyalin ke kurir
- **Panel mesin**: slot input a & b + tombol ENKRIPSI bergaya pixel premium
- Scene: Title (Mulai / Cara Main) → Intro singkat → Level 1–3 → Hasil per level → Ending

## 8. Grafik Pixel Premium

- Resolusi internal **640×360**, tile **32×32**, render **60 FPS**, `image-rendering: pixelated`, skala otomatis pas layar
- **Sprite detail & proporsional sesuai bentuk aslinya**: setiap objek digambar teliti dengan shading, highlight, outline, dan animasi kecil (lampu berkedip, layar berstatik, uap bergerak); mata-mapi & drone punya animasi jalan + tanda seru saat waspada
- **Palet warna kurasi yang indah per level**: kamar hangat (peach–ungu senja), sekolah cerah (biru langit–hijau), lab misterius (teal gelap + neon cyan/magenta)
- **Smooth**: gerakan dengan akselerasi/perlambatan halus, kamera mengikuti dengan lerp, transisi scene fade mulus, animasi UI dengan easing
- **Efek atmosfer**: partikel debu & sinar cahaya, bayangan lembut, dithering gradasi, vignette lembut, percikan partikel saat menemukan barang, kilat saat tertangkap, perayaan partikel di layar bintang
- Font pixel premium (Press Start 2P / VT323), panel UI berlapis dengan border, glow, dan gradasi halus
- SFX chiptune lembut via WebAudio (langkah, penemuan, mesin, waspada, tertangkap, sukses)

## 9. Struktur File

```
Game_MTK/
├── index.html
├── css/style.css
└── js/
    ├── main.js     — boot, game loop 60fps, state global
    ├── engine.js   — canvas, input, kamera smooth, collision, render, partikel
    ├── sprites.js  — pixel art premium: player, kurir, mata-mata, drone, objek, tileset 3 tema
    ├── levels.js   — konfigurasi 3 level: map, objek interaksi, spot kandidat, jalur patroli, target waktu
    ├── crypto.js   — pool pesan, pengacakan (pesan/a/b/lokasi), skema mod-53, validasi
    ├── enemies.js  — AI patroli, kerucut penglihatan, kejaran & tertangkap
    ├── ui.js       — dialog, HUD, jurnal, panel mesin, kotak ketik kurir, layar hasil
    └── scenes.js   — title, intro, in-game, hasil, ending
```

## 10. Urutan Pengerjaan

1. Kerangka engine: canvas, loop 60fps, input, player smooth + collision + kamera lerp, tilemap Level 1
2. Interaksi objek, dialog, sistem penemuan pesan/fungsi, HUD objektif & stopwatch, jurnal
3. Mesin enkripsi (input a/b, validasi, output teks terenkripsi)
4. Kurir + kotak ketik + validasi
5. Randomisasi penuh (pool pesan, parameter acak, lokasi acak)
6. Musuh: AI patroli, kerucut pandang, kejaran, tertangkap & respawn
7. Level 2 & 3: sprite, palet, map, jalur patroli, efek lab rusak
8. Layar hasil bintang & skor + simpan rekor, polish: title, intro, ending, SFX, partikel & transisi premium

## 11. Pengujian

Dijalankan lewat server lokal (`python3 -m http.server`) dan diuji alur lengkap dengan automasi browser: gerak & interaksi, input benar/salah di mesin, ketik ke kurir, deteksi kerucut pandang musuh & respawn, perhitungan bintang, serta memastikan replay menghasilkan pesan/fungsi berbeda — plus verifikasi visual render pixel premium.