'use strict';
/* ============================================================
   SECRET MAIL — crypto.js
   Skema sandi f(x) = ax + b (mod 53) di belakang layar:
     - Huruf KAPITAL : A=1, B=2, ... Z=26
     - Huruf kecil   : a=-1, b=-2, ... z=-26
     - Spasi         : 0
   Hasil dipetakan balik ke rentang -26..+26:
     positif -> KAPITAL, negatif -> kecil, 0 -> spasi
   53 prima => setiap a yang bulat punya invers, jadi sandi SELALU bisa
   dibuka (deskripsi = fungsi invers f^-1).

   Fungsi per level (revisi: tiap level beda fungsi):
     1 Kamar   : f(x) = x + b            (geser)          invers: x - b
     2 Sekolah : f(x) = a x + b          (kali + geser)   invers: (x - b) / a
     4 Bunker  : (f o g)(x) = f(g(x))    (KOMPOSISI)      invers komposisi
                 g(x) = x + c,  h(y) = a y  =>  f(x) = a x + a c
   Di level 3 pemain menyusun komposisinya (masukkan a dan c), mesin yang
   menghitung, dan deskripsinya memakai invers dari fungsi gabungan itu.
   ============================================================ */

const Crypto = {
  UP: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  LO: 'abcdefghijklmnopqrstuvwxyz',
  N: 53,

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

  /* invers perkalian modulo 53 (algoritma Euclid diperluas).
     53 prima -> selalu ada selama a tidak habis dibagi 53. */
  invMod(a) {
    let t = 0, nt = 1, r = this.N, nr = ((a % this.N) + this.N) % this.N;
    while (nr !== 0) {
      const q = Math.floor(r / nr);
      [t, nt] = [nt, t - q * nt];
      [r, nr] = [nr, r - q * nr];
    }
    if (r > 1) return null;             // tidak ada invers (a kelipatan 53)
    return ((t % this.N) + this.N) % this.N;
  },

  /* ENKRIPSI: y = a x + b */
  encrypt(msg, a, b) {
    let out = '';
    for (const c of msg) {
      const x = this.charToVal(c);
      if (x === null) { out += c; continue; }
      out += this.valToChar(this.modMap(a * x + b));
    }
    return out;
  },

  /* DERET KODE: bentuk perhitungan PERSIS handout (hal. 7-8) -
     huruf -> angka (A=1..Z=26, a=-1..z=-26, spasi=0) -> f(x) = a*x + b,
     nilainya DIBIARKAN apa adanya (tanpa diputar/modulo), sama seperti buku
     yang menuliskan cipherteks sebagai deret angka: 62 -13 -37 ... */
  deretKode(msg, a, b) {
    const out = [];
    for (const c of String(msg || '')) {
      const x = this.charToVal(c);
      out.push(x === null ? c : a * x + b);
    }
    return out.join(' ');
  },

  /* DESKRIPSI: x = (y - b) . a^-1  (fungsi invers dari f(x) = a x + b) */
  decrypt(msg, a, b) {
    const ai = this.invMod(a);
    if (ai === null) return msg;        // jaring pengaman: a tidak bisa dibalik
    let out = '';
    for (const c of msg) {
      const y = this.charToVal(c);
      if (y === null) { out += c; continue; }
      out += this.valToChar(this.modMap((y - b) * ai));
    }
    return out;
  },

  /* KOMPOSISI (level 3): g(x) = x + c lalu h(y) = a y
     (f o g)(x) = f(g(x)) = a x + a c  -> disusun jadi bentuk (a, b) supaya
     enkripsi & deskripsi memakai jalur yang sama seperti level lain. */
  compose(a, c) {
    return { a: a, b: a * c, c: c };
  },

  /* tampilan rumus di catatan */
  fmtFn(a, b) {
    if (b === 0) return 'f(x) = ' + a + 'x';
    return 'f(x) = ' + a + 'x ' + (b < 0 ? '-' : '+') + ' ' + Math.abs(b);
  },
  /* Komposisi ditulis dengan notasi baku seperti di buku:
     g(x) = x + c (dalam), f(x) = a x (luar), (f o g)(x) = f(g(x)) */
  fmtKomposisi(a, c) {
    return ['g(x) = x + ' + c, 'f(x) = ' + a + 'x',
            '(f \u2218 g)(x) = f(g(x)) = ' + a + 'x + ' + (a * c)];
  },
  /* fungsi akhir level: linear biasa, atau hasil komposisi (f o g) */
  fmtFnLengkap(a, b, komposisi) {
    const badan = this.fmtFn(a, b).replace('f(x) = ', '');
    return komposisi ? '(f \u2218 g)(x) = ' + badan : 'f(x) = ' + badan;
  },

  /* Kunci dalam bahasa verbal — handout proyek: "unsur simbolik pada fungsi
     enkripsi dirubah menjadi unsur verbal". Dipakai di jurnal & kartu ACUAN. */
  fmtVerbal(a, b, c, komposisi) {
    if (komposisi) return 'tambah ' + c + ' dulu, lalu kalikan ' + a;
    if (b === 0) return 'kalikan ' + a;
    return 'kalikan ' + a + ', lalu ' + (b < 0 ? 'kurangi ' + Math.abs(b) : 'tambah ' + b);
  },

  /* Kunci deskripsi dalam bahasa verbal - handout menulisnya begini:
     "plainteks adalah cipherteks dikurangi dua kemudian dibagi tiga". */
  fmtVerbalInvers(a, b, c, komposisi) {
    if (komposisi) return 'bagi ' + a + ' dulu, lalu kurangi ' + c;
    if (b === 0) return 'bagi ' + a;
    return (b < 0 ? 'tambah ' + Math.abs(b) : 'kurangi ' + b) + ', lalu bagi ' + a;
  },

  /* Tabel kuantifikasi huruf: A=1..Z=26, a=-1..z=-26, spasi=0 */
  kuantifikasi() {
    const baris = [];
    for (let i = 0; i < 26; i++) {
      baris.push({
        besar: String.fromCharCode(65 + i), nBesar: i + 1,
        kecil: String.fromCharCode(97 + i), nKecil: -(i + 1)
      });
    }
    return baris;
  },

  /* ---- Lembar kiriman Mode Proyek Kelompok (handout hal. 10 langkah 4) ----
     Satu baris supaya mudah disalin & ditempel antar kelompok.
     Format: SANDI|a|c  dengan (f o g)(x) = f(g(x)), g(x)=x+c, f(x)=a*x  =>  b = a*c */
  buatLembar(sandi, a, c) { return sandi + '|' + a + '|' + c; },
  bacaLembar(teks) {
    const bagian = String(teks || '').trim().split('|').map(t => t.trim());
    if (bagian.length < 3) return null;
    const sandi = bagian[0].replace(/[^a-zA-Z ]/g, '');   // spasi ikut: spasi = 0
    const a = parseInt(bagian[1], 10), c = parseInt(bagian[2], 10);
    if (!sandi || !isFinite(a) || !isFinite(c) || a === 0) return null;
    return { sandi: sandi, a: a, c: c, b: a * c };
  },
  /* satu langkah proyek untuk ditampilkan sebagai indikator 1..7 */
  langkahProyek(tahap, sandiSiap, terimaSiap, hasilSiap) {
    if (tahap === 0) return sandiSiap ? [4, 'Kirim lembar ke kelompok pasangan'] : [2, 'Susun pesan + kunci ganda'];
    if (!terimaSiap) return [5, 'Terima lembar dari kelompok pasangan'];
    return hasilSiap ? [6, 'Deskripsi selesai \u2014 siap dipresentasikan'] : [6, 'Cari fungsi deskripsi lalu buka pesannya'];
  },

  /* Contoh yang sama dengan handout (hal. 8-9): "Temui Aku Di Taman" dengan
     kunci f(x) = 3x + 2. Hitungnya memakai mesin game sendiri, jadi angkanya
     pasti konsisten dengan level yang dimainkan. */
  contohBuku() {
    const p = 'Temui Aku Di Taman', a = 3, b = 2;
    return { plainteks: p, a, b, cipherteks: this.encrypt(p, a, b) };
  },

  /* Pool pesan keluar per level — hanya huruf & spasi */
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
    4: [
      'Pintu bunker dikunci dari dalam', 'Ambil peta lorong bawah tanah',
      'Generator cadangan ada di ruang dua', 'Jangan nyalakan lampu utama',
      'Kurir kedua menunggu di luar', 'Bawa kunci cadangan ke markas'
    ],
    3: [
      'Reaktor utama tidak stabil malam ini', 'Hancurkan semua catatan eksperimen rahasia',
      'Drone keamanan sedang diperbaiki', 'Pintu darurat terbuka tengah malam',
      'Formula baru disembunyikan di vault', 'Jangan percaya siapa pun',
      'Evakuasi lab sebelum listrik padam', 'Kunci ruang server ada di vault',
      'Sinyal musuh terdeteksi dekat pintu belakang', 'Bawa dokumen biru ke markas utama'
    ]
  },

  /* Pool surat MASUK (dari markas) — dipakai untuk tugas deskripsi */
  masuk: {
    1: [
      'Tunggu perintah', 'Ganti posisi', 'Jangan menyalakan lampu',
      'Awasi pintu depan', 'Lapor tiap jam', 'Simpan surat ini'
    ],
    2: [
      'Markas butuh daftar nama', 'Ambil berkas di loker', 'Jangan lewat lorong',
      'Temui kontak di kantin', 'Kelas delapan kosong', 'Kirim laporan tertulis'
    ],
    4: [
      'Bunker sudah ditemukan', 'Tahan posisi sampai pagi',
      'Kirim kunci cadangan sekarang', 'Musuh menuju lorong bawah',
      'Kode lama tidak berlaku lagi', 'Tunggu kurir berikutnya'
    ],
    3: [
      'Markas utama sudah tahu', 'Tarik semua kurir keluar', 'Rencana dibatalkan malam ini',
      'Dokumen biru palsu', 'Musuh sudah masuk lab', 'Tunggu sinyal kedua'
    ]
  },

  /* Acak teka-teki per level: pesan keluar, pesan masuk, dan fungsinya */
  randomPuzzle(level, rnd) {
    const saveRng = rng;
    if (rnd) rng = rnd;
    const message = spick(this.pools[level]);
    const masukAsli = spick(this.masuk[level]);
    let a, b, c = 0, komposisi = false;
    if (level === 1) {
      a = 1;                                  // L1 ENKRIPSI : geser f(x) = x + b
      b = sri(1, 25);
    } else if (level === 2) {
      a = sri(2, 9);                          // L2 DESKRIPSI: kali murni f(x) = a x
      b = 0;                                  // (invers: bagi dengan a)
    } else if (level === 3) {
      a = sri(2, 9);                          // L3 INVERS  : f(x) = a x + b
      b = sri(1, 20);                         // (b tidak 0 supaya inversnya terasa)
    } else {
      a = sri(2, 9);                          // komposisi: g(x)=x+c, h(y)=a y
      c = sri(2, 12);
      komposisi = true;
      b = a * c;                              // f(x) = a x + a c (b tidak pernah 0)
    }
    rng = saveRng;
    return {
      message, a, b, c, komposisi,
      encrypted: this.encrypt(message, a, b),          // untuk tugas ENKRIPSI
      masukAsli: masukAsli,
      masukSandi: this.encrypt(masukAsli, a, b)        // untuk tugas DESKRIPSI
    };
  }
};
