'use strict';
/* ============================================================
   KURIR SANDI — crypto.js
   Skema enkripsi f(x) = ax + b (mod 53) di belakang layar:
     - Huruf KAPITAL : A=1, B=2, ... Z=26
     - Huruf kecil   : a=-1, b=-2, ... z=-26
     - Spasi         : 0
   Hasil dipetakan balik ke rentang -26..+26:
     positif -> KAPITAL, negatif -> kecil, 0 -> spasi
   53 prima => setiap a yang bulat menghasilkan sandi yang bisa dibalik.
   ============================================================ */

const Crypto = {
  UP: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  LO: 'abcdefghijklmnopqrstuvwxyz',

  charToVal(c) {
    if (c === ' ') return 0;
    const u = this.UP.indexOf(c);
    if (u >= 0) return u + 1;
    const l = this.LO.indexOf(c);
    if (l >= 0) return -(l + 1);
    return null; // karakter tak didukung (dipakai apa adanya)
  },

  valToChar(v) {
    if (v === 0) return ' ';
    return v > 0 ? this.UP[v - 1] : this.LO[-v - 1];
  },

  // petakan bilangan bulat ke rentang -26..+26 melalui mod 53
  modMap(y) {
    const r = ((y % 53) + 53) % 53; // 0..52
    return r <= 26 ? r : r - 53;    // 27..52 -> -26..-1
  },

  encrypt(msg, a, b) {
    let out = '';
    for (const c of msg) {
      const x = this.charToVal(c);
      if (x === null) { out += c; continue; }
      out += this.valToChar(this.modMap(a * x + b));
    }
    return out;
  },

  fmtFn(a, b) {
    if (b === 0) return 'f(x) = ' + a + 'x';
    return 'f(x) = ' + a + 'x ' + (b < 0 ? '-' : '+') + ' ' + Math.abs(b);
  },

  /* Pool pesan per level — hanya huruf & spasi, kapitalisasi alami */
  pools: {
    1: [
      'Rapikan kasur', 'Kunci jendela', 'Ambil senter', 'Baca buku itu',
      'Matikan lampu', 'Cek laci rahasia', 'Simpan kunci', 'Tidur nyenyak',
      'Sembunyikan diary', 'Panggil Rafi'
    ],
    2: [
      'Temui guru fisika', 'Ruang lab ditutup', 'Bawa buku catatan',
      'Ujian dimulai besok', 'Kunci lorong belakang', 'Cari locker nomor tujuh',
      'Rapat siswa sore ini', 'Ambil kunci laboratorium',
      'Tulis sandi di papan', 'Panggil kepala sekolah'
    ],
    3: [
      'Reaktor utama tidak stabil malam ini', 'Hancurkan semua catatan eksperimen rahasia',
      'Drone keamanan sedang diperbaiki', 'Pintu darurat terbuka tengah malam',
      'Formula baru disembunyikan di vault', 'Jangan percaya siapa pun',
      'Evakuasi lab sebelum listrik padam', 'Kunci ruang server ada di vault',
      'Sinyal musuh terdeteksi dekat pintu belakang', 'Bawa dokumen biru ke markas utama'
    ]
  },

  /* Acak teka-teki per level: pesan, a, dan b selalu berbeda-beda */
  randomPuzzle(level, rnd) {
    const saveRng = rng;
    if (rnd) rng = rnd;
    const message = spick(this.pools[level]);
    let a, b;
    if (level === 1) {
      a = 1;                 // geser sederhana: f(x) = x + b
      b = sri(1, 25);
    } else if (level === 2) {
      a = sri(2, 9);
      b = sri(1, 30);
    } else {
      a = sri(2, 12);
      b = sri(-20, 20);
      if (b === 0) b = 7;
    }
    rng = saveRng;
    return { message, a, b, encrypted: this.encrypt(message, a, b) };
  }
};
