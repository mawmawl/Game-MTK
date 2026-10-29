'use strict';
/* ============================================================
   SECRET MAIL — levels.js
   Definisi 3 level: peta tile, objek, palet tema, musuh, intro.
   Kandidat penyembunyian = objek dengan search:true
   (pesan & catatan fungsi diacak ke 2 objek berbeda setiap main).
   ============================================================ */

const LEVELS = [

  /* ============ LEVEL 1 — KAMAR ============ */
  {
    name: 'Kamar', subtitle: 'Malam Pertama', themeMusic: 'bedroom', target: 90,
    w: 24, h: 14,
    map: [
      '########################',
      '########################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '########################'
    ],
    theme: {
      floorA: '#a06a4a', floorB: '#98644a', floorLine: '#7d5138',
      wallFace: '#544278', wallCap: '#3a2d55', wallDark: '#2e2445', wallLight: '#6b5496',
      wood: '#8a5a38', woodLight: '#a8744c', woodDark: '#5a3a24',
      accent: '#3f8f8a', accentLight: '#5fb0aa', accentDark: '#2a6a66',
      rug: '#8a4a5a', rugLight: '#b06a78', rugDark: '#5a2e3c',
      sky: ['#2d2a55', '#7a4a7e', '#d97b56'], sun: '#ffd98a',
      glowWindow: '255,170,110',
      ambient: 'rgba(70,40,110,0.14)', outline: '#1a1428', dust: '255,220,170'
    },
    flavor: [
      'Hanya debu dan satu kaus kaki yang hilang...',
      'Tidak ada apa pun di sini.',
      'Sebuah diary lama. Menarik, tapi bukan itu yang dicari.',
      'Garam? Siapa yang menaruh garam di sini?'
    ],
    playerStart: { x: 11, y: 9 },
    courier: { x: 17, y: 11 },
    objects: [
      { type: 'window',       x: 3,  y: 1, w: 3, h: 1, deco: 'wall' },
      { type: 'stringlights', x: 6,  y: 1, w: 4, h: 1, deco: 'wall' },
      { type: 'poster',       x: 12, y: 1, w: 1, h: 1, deco: 'wall' },
      { type: 'clock',        x: 19, y: 1, w: 1, h: 1, deco: 'wall' },
      { type: 'bed',          x: 1,  y: 2, w: 3, h: 5, solid: true, sight: true, search: true, label: 'Tempat Tidur' },
      { type: 'nightstand',   x: 5,  y: 2, w: 1, h: 1, solid: true, sight: false, deco: 'floor' },
      { type: 'floorlamp',    x: 7,  y: 2, w: 1, h: 2, solid: true, sight: false, deco: 'floor',
        col: { x: 0.32, y: 0.42, w: 0.36, h: 0.5 } },   // mengikuti tiang lampu yang tergambar
      { type: 'desk',         x: 16, y: 2, w: 4, h: 2, solid: true, sight: true, search: true, label: 'Meja Belajar' },
      { type: 'dresser',      x: 10, y: 2, w: 2, h: 1, solid: true, sight: true, search: true, label: 'Nakas' },
      { type: 'trophy',       x: 13, y: 2, w: 1, h: 2, solid: true, sight: true, deco: 'floor' },
      { type: 'machine',      x: 21, y: 4, w: 2, h: 2, solid: true, sight: true, label: 'Mesin Enkripsi' },
      { type: 'plant',        x: 1,  y: 7, w: 1, h: 1, solid: true, sight: false, deco: 'floor',
        col: { x: 0.28, y: 0.5, w: 0.44, h: 0.5 } },
      { type: 'blocks',       x: 12, y: 10, w: 1, h: 1, deco: 'floor' },
      { type: 'toycar',       x: 14, y: 10, w: 1, h: 1, deco: 'floor' },
      { type: 'rug',          x: 8,  y: 7, w: 4, h: 3, deco: 'floor' },
      { type: 'wardrobe',     x: 2,  y: 9, w: 2, h: 3, solid: true, sight: true, search: true, label: 'Lemari' },
      { type: 'laundry',      x: 6,  y: 12, w: 1, h: 1, solid: true, sight: false, deco: 'floor',
        col: { x: 0.1, y: 0.25, w: 0.8, h: 0.75 } },
      { type: 'shelf',        x: 22, y: 8, w: 1, h: 2, solid: true, sight: true, search: true, label: 'Rak Buku' },
      { type: 'exitdoor',     x: 20, y: 12, w: 2, h: 1, solid: true, label: 'Pintu' }
    ],
    enemies: [],
    intro: [
      'Malam ini, pesan pertamamu tiba...',
      'Seseorang menyembunyikan PESAN RAHASIA di suatu tempat di kamarmu.',
      'Temukan pesannya, temukan CATATAN FUNGSI, lalu enkripsi sebelum kurir berangkat!'
    ]
  },

  /* ============ LEVEL 2 — SEKOLAH ============ */
  {
    name: 'Sekolah', subtitle: 'Koridor yang Diawasi', themeMusic: 'school', target: 150,
    w: 30, h: 16,
    map: [
      '##############################',
      '##############################',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '##############################'
    ],
    theme: {
      floorA: '#d9cbb0', floorB: '#cfc0a3', floorLine: '#b8a888',
      wallFace: '#7fa8c9', wallCap: '#4c6a85', wallDark: '#3c5468', wallLight: '#a4c4de',
      wood: '#b98a5a', woodLight: '#d4a878', woodDark: '#8a6238',
      accent: '#c0563f', accentLight: '#e0765c', accentDark: '#8a3a2a',
      rug: '#7a9a6a', rugLight: '#9aba8a', rugDark: '#54744a',
      sky: ['#7ec8e8', '#a8dcf0', '#d8f2fa'], sun: '#fff2b0',
      glowWindow: '220,240,255',
      ambient: 'rgba(255,240,200,0.05)', outline: '#1a2430', dust: '255,255,230'
    },
    flavor: [
      'Hanya coretan PR matematika.',
      'Penghapus dan remah pensil. Biasa saja.',
      'Bukan di sini...',
      'Sebuah surat tanpa nama. Wah, bukan ini.'
    ],
    playerStart: { x: 3, y: 12 },
    courier: { x: 22, y: 14 },
    objects: [
      { type: 'window',     x: 3,  y: 1, w: 3, h: 1, deco: 'wall' },
      { type: 'noticeboard',x: 7,  y: 1, w: 3, h: 1, deco: 'wall' },
      { type: 'blackboard', x: 11, y: 1, w: 6, h: 1, deco: 'wall', search: true, label: 'Papan Tulis' },
      { type: 'clock',      x: 18, y: 1, w: 1, h: 1, deco: 'wall' },
      { type: 'window',     x: 21, y: 1, w: 3, h: 1, deco: 'wall' },
      { type: 'teacherdesk',x: 12, y: 3, w: 3, h: 2, solid: true, sight: true, search: true, label: 'Meja Guru' },
      { type: 'globe',      x: 24, y: 2, w: 2, h: 2, solid: true, sight: true, label: 'Globe',
        col: { x: 0.12, y: 0.56, w: 1.72, h: 1.34 } },   // hanya bola + dudukannya, sudut kosong
      { type: 'schooldesk', x: 6,  y: 6, w: 2, h: 2, solid: true, sight: true, search: true, label: 'Meja Siswa' },
      { type: 'schooldesk', x: 11, y: 6, w: 2, h: 2, solid: true, sight: true, search: true, label: 'Meja Siswa' },
      { type: 'schooldesk', x: 16, y: 6, w: 2, h: 2, solid: true, sight: true, search: true, label: 'Meja Siswa' },
      { type: 'schooldesk', x: 21, y: 6, w: 2, h: 2, solid: true, sight: true, search: true, label: 'Meja Siswa' },
      { type: 'schooldesk', x: 6,  y: 11, w: 2, h: 2, solid: true, sight: true, search: true, label: 'Meja Siswa' },
      { type: 'schooldesk', x: 11, y: 11, w: 2, h: 2, solid: true, sight: true, search: true, label: 'Meja Siswa' },
      { type: 'schooldesk', x: 16, y: 11, w: 2, h: 2, solid: true, sight: true, search: true, label: 'Meja Siswa' },
      { type: 'schooldesk', x: 21, y: 11, w: 2, h: 2, solid: true, sight: true, search: true, label: 'Meja Siswa' },
      { type: 'lockers',    x: 1,  y: 4, w: 1, h: 4, solid: true, sight: true, search: true, label: 'Loker' },
      { type: 'bin',        x: 2,  y: 8, w: 1, h: 1, solid: true, sight: false, search: true, label: 'Tempat Sampah',
        col: { x: 0.15, y: 0.18, w: 0.72, h: 0.7 } },
      { type: 'bookshelf',  x: 28, y: 8, w: 1, h: 3, solid: true, sight: true, search: true, label: 'Rak Buku' },
      { type: 'bookstack',  x: 26, y: 13, w: 1, h: 1, deco: 'floor' },
      { type: 'machine',    x: 27, y: 5, w: 2, h: 2, solid: true, sight: true, label: 'Mesin Enkripsi' },
      { type: 'plant',      x: 1,  y: 12, w: 1, h: 1, solid: true, sight: false, deco: 'floor',
        col: { x: 0.28, y: 0.5, w: 0.44, h: 0.5 } },
      { type: 'plant',      x: 28, y: 2, w: 1, h: 1, solid: true, sight: false, deco: 'floor',
        col: { x: 0.28, y: 0.5, w: 0.44, h: 0.5 } },
      { type: 'plant',      x: 28, y: 13, w: 1, h: 1, solid: true, sight: false, deco: 'floor',
        col: { x: 0.28, y: 0.5, w: 0.44, h: 0.5 } },
      { type: 'exitdoor',   x: 24, y: 14, w: 2, h: 1, solid: true, label: 'Pintu' }
    ],
    enemies: [
      { type: 'spy', speed: 42, chaseSpeed: 82, range: 132,
        path: [[5, 8], [24, 8], [24, 13], [5, 13]] }
    ],
    intro: [
      'Besok pagi, rapat rahasia siswa digelar di sekolah...',
      'Tapi mata-mata asing berkeliaran di koridor. Jangan tertangkap!',
      'Sembunyi di balik perabot, temukan pesan, dan enkripsi sebelum ketahuan.'
    ]
  },

  /* ============ LEVEL 3 — LAB RUSAK ============ */
  {
    name: 'Lab Rusak', subtitle: 'Misi Terakhir', themeMusic: 'lab', target: 210,
    w: 30, h: 16,
    map: [
      '##############################',
      '##############################',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '##############################'
    ],
    theme: {
      floorA: '#2b3440', floorB: '#2f3a48', floorLine: '#232b36',
      wallFace: '#28313f', wallCap: '#1a2028', wallDark: '#131820', wallLight: '#3a4656',
      wood: '#5a5248', woodLight: '#6e6456', woodDark: '#3a342c',
      accent: '#3ee6d8', accentLight: '#7af2e8', accentDark: '#1e9a90',
      rug: '#2a3a4a', rugLight: '#3a5060', rugDark: '#1a2836',
      sky: ['#0d1420', '#12202e', '#1a2c3c'], sun: null,
      glowWindow: '80,220,200',
      ambient: 'rgba(8,14,34,0.34)', outline: '#0c1118', dust: '160,220,230',
      neon: '#3ee6d8'
    },
    flavor: [
      'Kabel putus dan serpihan kaca. Hati-hati...',
      'Layar hanya menampilkan gambar rusak.',
      'Hanya sampel yang sudah hangus.',
      'Bukan di sini. Sesuatu bergerak di kejauhan...'
    ],
    playerStart: { x: 3, y: 13 },
    courier: { x: 22, y: 14 },
    objects: [
      { type: 'pipes',       x: 1,  y: 1, w: 28, h: 1, deco: 'wall' },
      { type: 'cables',      x: 17, y: 1, w: 6, h: 1, deco: 'wall' },
      { type: 'warningsign', x: 6,  y: 1, w: 1, h: 1, deco: 'wall' },
      { type: 'warningsign', x: 24, y: 1, w: 1, h: 1, deco: 'wall' },
      { type: 'vent',        x: 21, y: 1, w: 1, h: 1, deco: 'wall' },
      { type: 'computer',    x: 3,  y: 2, w: 2, h: 2, solid: true, sight: true, search: true, label: 'Terminal' },
      { type: 'computer',    x: 7,  y: 2, w: 2, h: 2, solid: true, sight: true, deco: 'floor' },
      { type: 'computer',    x: 11, y: 2, w: 2, h: 2, solid: true, sight: true, search: true, label: 'Terminal' },
      { type: 'computer',    x: 15, y: 2, w: 2, h: 2, solid: true, sight: true, deco: 'floor' },
      { type: 'computer',    x: 19, y: 2, w: 2, h: 2, solid: true, sight: true, deco: 'floor' },
      { type: 'tank',        x: 1,  y: 5, w: 2, h: 3, solid: true, sight: true, search: true, label: 'Tabung' },
      { type: 'tank',        x: 1,  y: 9, w: 2, h: 3, solid: true, sight: true, search: true, label: 'Tabung' },
      { type: 'tank',        x: 1,  y: 12, w: 2, h: 2, solid: true, sight: true, search: true, label: 'Tabung' },
      { type: 'electricbox', x: 28, y: 4, w: 1, h: 2, solid: true, sight: true, search: true, label: 'Panel Listrik' },
      { type: 'crate',       x: 10, y: 8, w: 2, h: 2, solid: true, sight: true, search: true, label: 'Peti' },
      { type: 'crate',       x: 14, y: 9, w: 2, h: 2, solid: true, sight: true, search: true, label: 'Peti' },
      { type: 'crate',       x: 18, y: 7, w: 2, h: 2, solid: true, sight: true, search: true, label: 'Peti' },
      { type: 'crate',       x: 22, y: 11, w: 2, h: 2, solid: true, sight: true, deco: 'floor' },
      { type: 'shards',      x: 8,  y: 5, w: 1, h: 1, deco: 'floor' },
      { type: 'shards',      x: 20, y: 12, w: 1, h: 1, deco: 'floor' },
      { type: 'barrel',      x: 25, y: 12, w: 1, h: 1, solid: true, sight: false, deco: 'floor',
        col: { x: 0.1, y: 0.1, w: 0.78, h: 0.85 } },
      { type: 'barrel',      x: 26, y: 12, w: 1, h: 1, solid: true, sight: false, deco: 'floor',
        col: { x: 0.1, y: 0.1, w: 0.78, h: 0.85 } },
      { type: 'machine',     x: 27, y: 9, w: 2, h: 2, solid: true, sight: true, label: 'Mesin Enkripsi' },
      { type: 'exitdoor',    x: 24, y: 14, w: 2, h: 1, solid: true, label: 'Pintu' }
    ],
    enemies: [
      { type: 'drone', speed: 62, chaseSpeed: 108, range: 150,
        path: [[4, 6], [24, 6], [24, 13], [4, 13]] },   // x=24: kolom 25 terhalang tabung
      { type: 'spy', look: 'guard', speed: 38, chaseSpeed: 78, range: 130,
        path: [[4, 4], [26, 4], [26, 7], [21, 7], [21, 13], [6, 13], [6, 9], [3, 9], [3, 4]] }
    ],
    intro: [
      'Lab penelitian sudah rusak dan gelap gulita...',
      'Drone keamanan melayang di lingkar luar, dan PENJAGA berrompi menyisir semua area...',
      'Ini pesan terakhirmu. Dua pasang mata mengawasi — enkripsi sempurna adalah satu-satunya jalan.'
    ]
  }
];
