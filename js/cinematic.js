'use strict';
/* ============================================================
   SECRET MAIL — cinematic.js
   Intro sinematik (grafik gerak) untuk layar pembuka.

   PENTING — seluruh gambar adalah FUNGSI WAKTU MURNI:
   Cinematic.frame(t) menghasilkan frame ke-t tanpa bergantung
   pada kecepatan mesin. Karena itu animasi yang sama bisa
   dipakai di dalam game DAN dirender jadi video (tools/render_intro.py
   memanggil frame(t) per frame lalu ffmpeg menyatukannya).
   Tidak ada Math.random() di sini: semua keacakan lewat hash2()
   supaya hasil render 100% dapat diulang.

   Gaya visual: piksel + pendar emas + scanline CRT.
   ============================================================ */

const Cinematic = (() => {
  /* ---------- panjang & babak (detik) ---------- */
  const DUR = 12.8;
  const T = {
    wind: 0.10,      // hujan mulai terdengar
    envIn: 1.05,     // amplop terbang masuk dari kiri
    envArrive: 2.90, // amplop berhenti di tengah
    seal: 3.30,      // segel lilin dicap
    letter: 4.20,    // berkas naik dari balik amplop
    cipher: 4.80,    // teks sandi terurai huruf demi huruf
    cipherGap: 0.55, // jeda antara baris 1 dan baris 2
    reveal: 6.70,    // berkas mulai redup (menyerahkan panggung ke logo)
    logo: 7.60,      // logo tersusun huruf demi huruf
    sub: 8.85,       // subjudul
    cta: 9.90,       // ajakan mulai
    end: 12.80       // otomatis lanjut ke menu utama
  };
  /* kecepatan kunci huruf sandi: baris terpanjang (44 huruf) selesai
     pada cipher + 1,32 dtk -> masih 0,48 dtk sebelum berkas mulai redup */
  const CHAR_T = 0.030;
  const HEAD1 = 'PESAN AMAN BUKAN KARENA JALANNYA TERSEMBUNYI';
  const HEAD2 = 'TETAPI KARENA ISINYA TERKUNCI';
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@$%&*/<>+=';
  const GOLD = { hi: '#fff2cc', mid: '#ffe9a8', base: '#e8c04a', deep: '#96701a' };

  /* ---------- geometri panggung ---------- */
  const ENV_Y = 250;      // pusat amplop
  const CARD_Y = 104;     // berkas rahasia
  const CARD_W = 520, CARD_H = 96;
  const LOGO_Y = 168;

  /* ---------- data latar yang dihitung sekali ----------
     Lebar internal game adaptif (620..1200 px), jadi hujan & siluet kota
     dihitung ulang bila VW berubah. */
  let DROPS = null, SKY = null, DATA_W = 0;
  function ensureData() {
    if (DROPS && DATA_W === VW) return;
    DATA_W = VW;
    DROPS = [];
    for (let i = 0; i < 96; i++) {
      DROPS.push({
        x: hash2(i, 1) * (VW + 40) - 20,
        y0: hash2(i, 2) * 420,
        sp: 300 + hash2(i, 5) * 260,
        len: 7 + hash2(i, 9) * 11
      });
    }
    const n = Math.max(24, Math.round((VW + 60) / 26));   // jumlah gedung ikut lebar
    SKY = [];
    let x = -24;
    for (let i = 0; i < n; i++) {
      const w = 20 + Math.floor(hash2(x, 3) * 34);
      const h = 24 + Math.floor(hash2(x, 7) * 58);
      SKY.push({ x, w, h, seed: x });
      x += w + 3 + Math.floor(hash2(x, 11) * 12);
    }
  }
  function drops() { ensureData(); return DROPS; }
  function skyline() { ensureData(); return SKY; }

  /* ---------- util ---------- */
  const fade = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  function glyphAt(i, tick) {
    return GLYPHS[Math.floor(hash2(i * 17 + tick * 31, tick + 7) * GLYPHS.length)];
  }
  /* huruf ke-i terkunci saat reveal > i; sisanya masih acak (berputar cepat) */
  function scramble(full, reveal, tick) {
    let out = '';
    const lock = Math.floor(reveal);
    for (let i = 0; i < full.length; i++) {
      const c = full[i];
      out += (c === ' ' || i < lock) ? c : glyphAt(i, tick);
    }
    return out;
  }

  /* ============================================================
     LATAR: kota malam, bulan, hujan
     ============================================================ */
  function backdrop(t) {
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#0a0a1e');
    g.addColorStop(0.55, '#141034');
    g.addColorStop(1, '#07060f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);

    // bulan + halo (additif)
    const mx = VW - 112, my = 64;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(mx, my, 4, mx, my, 100);
    halo.addColorStop(0, 'rgba(255,226,168,0.26)');
    halo.addColorStop(0.32, 'rgba(208,190,255,0.09)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - 100, my - 100, 200, 200);
    ctx.restore();
    CIR(mx, my, 21, '#f2ecd8');
    CIR(mx - 7, my - 6, 4, '#d8d0b8');
    CIR(mx + 6, my + 7, 3, '#d8d0b8');
    CIR(mx + 1, my - 10, 2, '#d8d0b8');
    CIR(mx - 5, my + 9, 2, '#d8d0b8');

    // berkas cahaya bulan (additif, tipis)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const beam = ctx.createLinearGradient(mx, my, mx - 320, VH);
    beam.addColorStop(0, 'rgba(200,210,255,0.055)');
    beam.addColorStop(1, 'rgba(200,210,255,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(mx - 16, my);
    ctx.lineTo(mx + 16, my);
    ctx.lineTo(mx - 250, VH);
    ctx.lineTo(mx - 420, VH);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // siluet gedung + jendela berkedip
    for (const b of skyline()) {
      const by = VH - 58 - b.h;
      R(b.x, by, b.w, b.h + 58, '#0d0b1c');
      R(b.x, by, b.w, 2, '#1b1738');
      for (let wy = 4; wy < b.h - 4; wy += 6) {
        for (let wx = 3; wx < b.w - 3; wx += 6) {
          const hv = hash2(b.seed + wx * 3, wy * 7);
          if (hv < 0.70) continue;
          const flick = Math.sin(t * 0.9 + hv * 47) > -0.35 ? 1 : 0.25;
          ctx.globalAlpha = 0.55 * flick;
          R(b.x + wx, by + wy, 2, 2, hv > 0.93 ? '#ffd98a' : '#8fa6d8');
          ctx.globalAlpha = 1;
        }
      }
    }

    // jalan + genangan yang memantulkan bulan
    R(0, VH - 58, VW, 58, '#080711');
    R(0, VH - 58, VW, 1, '#1a1738');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const refl = ctx.createLinearGradient(0, VH - 58, 0, VH);
    refl.addColorStop(0, 'rgba(255,226,168,0.10)');
    refl.addColorStop(1, 'rgba(255,226,168,0)');
    ctx.fillStyle = refl;
    ctx.fillRect(mx - 70, VH - 58, 140, 58);
    ctx.fillStyle = 'rgba(255,226,168,0.06)';
    for (let i = 0; i < 9; i++) {
      const yy = VH - 52 + i * 6;
      const w = 40 + hash2(i, 3) * 60;
      ctx.fillRect(mx - w / 2 + Math.sin(t * 0.6 + i) * 6, yy, w, 1);
    }
    ctx.restore();

    // kabut horizontal bergerak lambat
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const y = VH - 150 + i * 34;
      const off = Math.sin(t * 0.22 + i * 1.7) * 40;
      const fg = ctx.createLinearGradient(0, y, 0, y + 30);
      fg.addColorStop(0, 'rgba(120,130,190,0)');
      fg.addColorStop(0.5, 'rgba(120,130,190,' + (0.055 - i * 0.012).toFixed(3) + ')');
      fg.addColorStop(1, 'rgba(120,130,190,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(off - 60, y, VW + 120, 30);
    }
    ctx.restore();
  }

  function rain(t, a) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = 'rgba(180,200,255,0.30)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of drops()) {
      const y = ((d.y0 + t * d.sp) % (VH + 70)) - 35;
      const x = d.x + y * 0.16;
      ctx.moveTo(x, y);
      ctx.lineTo(x + d.len * 0.16, y + d.len);
    }
    ctx.stroke();
    ctx.restore();
  }

  /* ============================================================
     AMPLOP PIKEL (badan + penutup + surat di dalamnya)
     ============================================================ */
  function envelope(cx, cy, flap, alpha) {
    const w = 76, h = 52;
    const x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
    ctx.save();
    ctx.globalAlpha = alpha;

    // bayangan kontak
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x + 5, y + h - 1, w - 6, 4);

    // penutup yang terlipat ke belakang (saat terbuka)
    if (flap > 0.02) {
      const back = Math.round(flap * h * 0.42);
      for (let i = 0; i < back; i++) {
        const inset = Math.round((w / 2) * (i / Math.max(1, back)) * 0.86);
        R(x + inset, y - 1 - i, w - inset * 2, 1, i < 2 ? '#d8c9a4' : '#cbb998');
      }
    }

    // surat yang menyembul (sebelum tertutup badan amplop)
    const lh = 34;
    const ly = y - Math.round(lh * 0.75 * clamp(flap, 0, 1));
    R(x + 6, ly, w - 12, lh, '#f6eeda');
    O(x + 6, ly, w - 12, lh, '#b8a884');
    for (let i = 0; i < 3; i++) R(x + 12, ly + 7 + i * 8, Math.round((w - 26) * (0.5 + hash2(i, 21) * 0.45)), 2, '#5a5270');

    // badan
    R(x, y, w, h, '#eadfc4');
    R(x, y, w, 2, '#f6eeda');
    O(x, y, w, h, '#a89674');
    // lipatan diagonal kanan-kiri
    for (let i = 0; i < Math.floor(h / 2); i++) {
      R(x + 2 + i, y + h - 3 - i, 1, 1, 'rgba(150,130,96,0.5)');
      R(x + w - 3 - i, y + h - 3 - i, 1, 1, 'rgba(150,130,96,0.5)');
    }
    // penutup depan (menipis saat terbuka)
    const fh = Math.round(h * 0.48 * (1 - flap));
    for (let i = 0; i < fh; i++) {
      const inset = Math.round((w / 2) * (i / (h * 0.48)));
      R(x + inset, y + i, w - inset * 2, 1, i < 2 ? '#f2e7cc' : '#e2d5b4');
    }
    ctx.restore();
  }

  /* segel lilin merah, pop = 0..1 (0 = belum dicap) */
  function waxSeal(cx, cy, pop) {
    if (pop <= 0) return;
    const r = Math.round(3 + easeOutBack(clamp(pop, 0, 1)) * 6);
    if (r <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(pop * 1.6, 0, 1);
    CIR(cx, cy, r, '#8e2a24');
    CIR(cx, cy, Math.max(1, r - 2), '#c8503e');
    CIR(cx - Math.round(r * 0.25), cy - Math.round(r * 0.3), Math.max(1, Math.round(r * 0.35)), '#e0644e');
    ctx.fillStyle = 'rgba(255,210,190,0.5)';
    ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 3, 1, 6);
    ctx.fillRect(Math.round(cx) - 3, Math.round(cy) - 1, 6, 1);
    ctx.restore();
  }

  /* cincin gelombang kejut saat segel dicap */
  function shockwave(t) {
    const p = (t - T.seal) / 0.75;
    if (p < 0 || p > 1) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (1 - p) * 0.5;
    ctx.strokeStyle = 'rgba(255,190,140,0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(VW / 2, ENV_Y - 4, 20 + p * 150, 8 + p * 44, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /* percikan debu emas di sekitar segel */
  function sealSparks(t) {
    const p = (t - T.seal) / 0.9;
    if (p < 0 || p > 1) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) {
      const a = hash2(i, 3) * Math.PI * 2;
      const sp = 40 + hash2(i, 8) * 90;
      const d = p * sp;
      const x = VW / 2 + Math.cos(a) * d;
      const y = ENV_Y - 4 + Math.sin(a) * d * 0.5 - p * 10;
      ctx.globalAlpha = Math.max(0, 1 - p) * 0.9;
      ctx.fillStyle = i % 3 ? '#ffd75e' : '#fff6d8';
      ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
    ctx.restore();
  }

  /* ============================================================
     BERKAS RAHASIA (kartu surat dengan teks sandi terurai)
     ============================================================ */
  function dossier(t) {
    const rise = easeOutCubic(fade(t, T.letter, T.letter + 0.5));
    if (rise <= 0) return;
    const out = 1 - fade(t, T.reveal, T.reveal + 0.55);   // memudar sebelum logo
    if (out <= 0) return;
    const y = Math.round(CARD_Y + (1 - rise) * 40);
    const x = Math.round(VW / 2 - CARD_W / 2);
    const a = Math.min(rise, out);

    ctx.save();
    ctx.globalAlpha = a;
    // bayangan + kertas
    R(x + 6, y + 8, CARD_W, CARD_H, 'rgba(0,0,0,0.45)');
    R(x, y, CARD_W, CARD_H, '#f4ebd6');
    R(x, y, CARD_W, 2, '#fffaf0');
    O(x, y, CARD_W, CARD_H, '#a89674');
    O(x + 3, y + 3, CARD_W - 6, CARD_H - 6, 'rgba(168,150,116,0.45)');
    GRAIN(x, y, CARD_W, CARD_H, 'rgba(150,130,96,0.5)', 0.10);

    // kop berkas
    R(x + 10, y + 8, 62, 9, 'rgba(200,80,62,0.16)');
    txt('BERKAS RAHASIA', x + 13, y + 15, { font: FONT_PS(6), color: '#8e2a24', world: true });
    txt('23:47 • KURIR MALAM', x + CARD_W - 12, y + 15, { font: FONT_VT(13), color: '#8a7a5a', align: 'right', world: true });
    R(x + 10, y + 21, CARD_W - 20, 1, 'rgba(168,150,116,0.55)');

    // teks sandi: acak dulu, lalu terkunci huruf demi huruf
    const tick = Math.floor(t * 13);
    const rev1 = (t - T.cipher) / CHAR_T;
    const rev2 = (t - T.cipher - T.cipherGap) / CHAR_T;
    if (t > T.cipher) {
      const full = rev1 >= HEAD1.length;              // sudah terkunci semua -> tinta penuh
      txt(scramble(HEAD1, rev1, tick), x + 26, y + 50,
        { font: FONT_VT(19), color: full ? '#2b2440' : '#6a5a86', alpha: a * Math.min(1, Math.max(0.3, rev1 * 3)), world: true });
    }
    if (t > T.cipher + T.cipherGap) {
      const s2 = scramble(HEAD2, rev2, tick);
      txt(s2, x + 26, y + 74, { font: FONT_VT(19), color: '#3a3054', alpha: a * 0.95, world: true });
    }
    ctx.restore();

    // segel kecil + kilau di sudut berkas
    waxSeal(x + CARD_W - 40, y + CARD_H - 26, fade(t, T.cipher + 1.1, T.cipher + 1.5) * 0.8);
    glint(t, x + CARD_W - 40, y + CARD_H - 26, fade(t, T.cipher + 1.4, T.cipher + 1.7));
  }
  /* kilau bintang kecil yang berputar lalu hilang */
  function glint(t, cx, cy, p) {
    if (p <= 0 || p >= 1) return;
    const s = Math.sin(p * Math.PI) * 7;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.sin(p * Math.PI);
    ctx.strokeStyle = '#fff6d8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy);
    ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s);
    ctx.stroke();
    ctx.restore();
  }

  /* ============================================================
     LOGO (kanvas UI -> teks tajam, seperti layar judul)
     ============================================================ */
  function logo(t) {
    const p0 = fade(t, T.logo, T.logo + 0.2);
    if (p0 <= 0) return;
    const g = uictx;
    const text = 'SECRET MAIL', size = 26, sp = 4, by = LOGO_Y;
    g.save();
    g.font = FONT_PS(size);
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    const adv = [];
    let total = 0;
    for (const ch of text) { const w = g.measureText(ch).width; adv.push(w); total += w + sp; }
    total -= sp;
    const x0 = Math.round(VW / 2 - total / 2);

    // pendar di belakang judul
    const bloom = g.createRadialGradient(VW / 2, by - 9, 8, VW / 2, by - 9, 210);
    bloom.addColorStop(0, 'rgba(232,192,74,' + (0.14 * p0).toFixed(3) + ')');
    bloom.addColorStop(1, 'rgba(232,192,74,0)');
    g.fillStyle = bloom;
    g.fillRect(VW / 2 - 220, by - 66, 440, 132);

    let x = x0;
    for (let i = 0; i < text.length; i++) {
      const pi = clamp((t - (T.logo + i * 0.05)) / 0.34, 0, 1);
      if (pi > 0 && text[i] !== ' ') {
        const e = easeOutBack(pi);
        const dy = (1 - e) * -18;
        g.globalAlpha = Math.min(1, pi * 1.4);
        g.fillStyle = 'rgba(0,0,0,0.6)';
        g.fillText(text[i], x + 1, by + dy + 2);
        const metal = g.createLinearGradient(0, by - size + 3, 0, by + 2);
        metal.addColorStop(0, GOLD.hi);
        metal.addColorStop(0.35, GOLD.mid);
        metal.addColorStop(0.62, GOLD.base);
        metal.addColorStop(1, GOLD.deep);
        g.fillStyle = metal;
        g.fillText(text[i], x, by + dy);
        g.globalAlpha = Math.min(1, pi * 1.4) * 0.15;
        g.fillStyle = '#fffdf2';
        g.fillText(text[i], x, by + dy - 1);
        g.globalAlpha = 1;
      }
      x += adv[i] + sp;
    }

    // kilau melintas setelah semua huruf turun
    const sweep = fade(t, T.logo + 0.62, T.logo + 1.35);
    if (sweep > 0 && sweep < 1) {
      const gx = x0 - 60 + (total + 120) * sweep;
      const gl = g.createLinearGradient(gx - 22, 0, gx + 22, 0);
      gl.addColorStop(0, 'rgba(255,255,255,0)');
      gl.addColorStop(0.5, 'rgba(255,255,255,0.85)');
      gl.addColorStop(1, 'rgba(255,255,255,0)');
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = gl;
      g.fillRect(gx - 24, by - size - 4, 48, size + 10);
      g.globalCompositeOperation = 'source-over';
    }
    g.restore();

    // garis emas + wajik, membuka dari tengah
    const ruleP = fade(t, T.sub, T.sub + 0.5);
    if (ruleP > 0) {
      const halfW = 150 * easeOutCubic(ruleP);
      uictx.globalAlpha = ruleP;
      uictx.fillStyle = 'rgba(232,192,74,0.45)';
      uictx.fillRect(Math.round(VW / 2 - halfW), by + 16, Math.round(halfW), 1);
      uictx.fillRect(Math.round(VW / 2), by + 16, Math.round(halfW), 1);
      uictx.fillStyle = 'rgba(255,233,168,0.9)';
      uictx.beginPath();
      const cy = by + 16.5;
      uictx.moveTo(VW / 2, cy - 4); uictx.lineTo(VW / 2 + 4, cy); uictx.lineTo(VW / 2, cy + 4); uictx.lineTo(VW / 2 - 4, cy);
      uictx.closePath(); uictx.fill();
      uictx.globalAlpha = 1;
    }
  }

  /* subjudul: jarak antar huruf membuka pelan */
  function subtitle(t) {
    const p = fade(t, T.sub + 0.1, T.sub + 0.7);
    if (p <= 0) return;
    const g = uictx;
    const text = 'PETUALANGAN ENKRIPSI RAHASIA';
    const sp = 2.6 * easeOutCubic(p);
    g.save();
    g.font = FONT_VT(14);
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    const sadv = [];
    let sw = 0;
    for (const ch of text) { const w = g.measureText(ch).width; sadv.push(w); sw += w + sp; }
    sw -= sp;
    let sx = Math.round(VW / 2 - sw / 2);
    g.globalAlpha = p * 0.72;
    g.fillStyle = '#e8e2d6';
    for (let i = 0; i < text.length; i++) { g.fillText(text[i], sx, LOGO_Y + 38); sx += sadv[i] + sp; }
    g.restore();
  }

  /* ajakan mulai + petunjuk lewati */
  function prompts(t) {
    const p = fade(t, T.cta, T.cta + 0.5);
    if (p > 0) {
      const blink = (t % 1) < 0.62 ? 1 : 0.45;
      txt('TEKAN ENTER  /  KETUK UNTUK MULAI', VW / 2, VH - 42,
        { font: FONT_PS(8), color: '#ffe9a8', align: 'center', alpha: p * blink, shadow: 'rgba(0,0,0,.75)' });
      txt('WASD gerak  •  E periksa  •  TAB jurnal', VW / 2, VH - 22,
        { font: FONT_VT(14), color: 'rgba(180,172,214,0.62)', align: 'center', alpha: p });
    }
    const sp = fade(t, T.envIn, T.envIn + 0.8);
    if (sp > 0 && t < T.cta) {
      txt(TOUCH ? 'ketuk untuk lewati ▸' : 'ENTER ▸ lewati', VW - 14, VH - 12,
        { font: FONT_VT(13), color: 'rgba(180,172,214,0.45)', align: 'right', alpha: sp * 0.9 });
    }
  }

  /* ============================================================
     LAPISAN CRT: scanline, roll bar, butir film, vignette
     ============================================================ */
  function crt(t) {
    // kedip lampu di detik pertama
    if (t < 0.95) {
      const flick = Math.sin(t * 74) > 0.1 ? 0 : 1;
      if (flick) { ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.fillRect(0, 0, VW, VH); }
    }
    // scanline halus
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = scanPat;
    ctx.fillRect(0, 0, VW, VH);
    ctx.globalAlpha = 1;
    // roll bar bergerak naik-turun pelan
    const ry = ((t * 74) % (VH + 150)) - 75;
    const rg = ctx.createLinearGradient(0, ry - 28, 0, ry + 28);
    rg.addColorStop(0, 'rgba(255,255,255,0)');
    rg.addColorStop(0.5, 'rgba(222,232,255,0.05)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, ry - 28, VW, 56);
    // butir film (deterministik per 1/24 detik)
    const fr = Math.floor(t * 24);
    for (let i = 0; i < 28; i++) {
      const gx = Math.floor(hash2(i * 13 + fr, i * 29) * VW);
      const gy = Math.floor(hash2(i * 7 + fr * 3, i * 11) * VH);
      ctx.fillStyle = 'rgba(255,240,210,' + (0.05 + hash2(i, fr) * 0.07).toFixed(3) + ')';
      ctx.fillRect(gx, gy, 1, 1);
    }
    // vignette
    const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.32, VW / 2, VH / 2, VH * 1.05);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VW, VH);
  }

  /* ============================================================
     FRAME UTAMA — gambar satu frame pada waktu t (detik)
     ============================================================ */
  function frame(t) {
    t = clamp(t, 0, DUR);
    uiBegin();                                  // sekaligus membersihkan kanvas UI

    // --- dunia: latar, hujan, amplop, berkas ---
    ctx.save();
    if (t < T.reveal + 0.6) {
      const shake = t > T.seal && t < T.seal + 0.35 ? (1 - (t - T.seal) / 0.35) * 3 : 0;
      if (shake > 0) ctx.translate(Math.round(Math.sin(t * 90) * shake), Math.round(Math.cos(t * 71) * shake * 0.6));
      backdrop(t);
      rain(t, 0.42 + 0.1 * Math.sin(t * 0.8));
      const envP = easeOutCubic(fade(t, T.envIn, T.envArrive));
      if (envP > 0) {
        const ex = Math.round(lerp(-60, VW / 2, envP));
        const bob = Math.sin(t * 1.6) * (envP >= 1 ? 1.6 : 0);
        const envAlpha = Math.min(envP * (1 - fade(t, T.reveal, T.reveal + 0.6)), 1) * (t < T.letter + 0.4 ? 1 : 0.62);
        const flap = easeOutCubic(fade(t, T.letter - 0.15, T.letter + 0.35));
        envelope(ex, ENV_Y + bob, flap, envAlpha);
        waxSeal(ex, ENV_Y + bob + 8, fade(t, T.seal, T.seal + 0.22));
        shockwave(t);
        sealSparks(t);
        // jejak debu emas saat amplop melintas
        if (envP < 1) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 14; i++) {
            const back = i / 14;
            const px = ex - back * 120 + Math.sin(t * 3 + i) * 6;
            if (px < -10) continue;
            ctx.globalAlpha = (1 - back) * (1 - envP) * 0.8;
            ctx.fillStyle = i % 2 ? '#ffd75e' : '#fff6d8';
            ctx.fillRect(Math.round(px), Math.round(ENV_Y + bob + Math.sin(t * 5 + i * 2) * 12), 2, 2);
          }
          ctx.restore();
        }
      }
    }
    dossier(t);
    ctx.restore();

    // --- lapisan CRT di atas dunia ---
    crt(t);

    // --- tipografi (kanvas UI, tajam) ---
    const dim = fade(t, T.reveal + 0.2, T.logo + 0.1);
    if (dim > 0) {
      uictx.fillStyle = 'rgba(6,5,14,' + (dim * 0.55).toFixed(3) + ')';
      uictx.fillRect(0, 0, VW, VH);
    }
    logo(t);
    subtitle(t);
    prompts(t);

    // --- masuk / keluar ---
    const fin = 1 - fade(t, 0, 0.55);
    const fout = fade(t, T.end - 0.5, T.end);
    const a = Math.max(fin, fout);
    if (a > 0) {
      ctx.fillStyle = 'rgba(4,3,10,' + a.toFixed(3) + ')';
      ctx.fillRect(0, 0, VW, VH);
      uictx.fillStyle = 'rgba(4,3,10,' + a.toFixed(3) + ')';
      uictx.fillRect(0, 0, VW, VH);
    }
  }

  /* ---------- bunyi per babak (dipakai scene 'cinema') ---------- */
  const beats = [
    { t: T.wind, f: () => Snd.noise(1.4, 0.028) },
    { t: T.envIn, f: () => { SFX.swoosh(); } },
    { t: T.envArrive, f: () => { SFX.paper(); Snd.tone(320, { d: .2, v: .05, type: 'triangle' }); } },
    { t: T.seal, f: () => { Snd.tone(120, { d: .45, v: .13, type: 'sine' }); Snd.noise(.22, .08); SFX.door(); } },
    { t: T.letter, f: () => { SFX.paper(); SFX.sparkle(); } },
    { t: T.cipher, f: () => Snd.noise(.5, .018) },
    { t: T.logo, f: () => { for (let i = 0; i < 11; i++) Snd.tone(440 + i * 62, { d: .1, v: .04, type: 'triangle', when: i * .05 }); } },
    { t: T.logo + 0.7, f: () => SFX.chime() },
    { t: T.cta, f: () => SFX.uiSelect() }
  ];

  /* jumlah huruf sandi yang sudah terkunci pada waktu t (untuk tik suara) */
  function lockedChars(t) {
    const a = clamp(Math.floor((t - T.cipher) / CHAR_T), 0, HEAD1.length);
    const b = clamp(Math.floor((t - T.cipher - T.cipherGap) / CHAR_T), 0, HEAD2.length);
    return a + b;
  }

  return { DUR, T, CHAR_T, beats, frame, lockedChars };
})();

/* musik khusus intro: arpeggio lambat bernuansa misteri */
if (typeof Music !== 'undefined' && Music.defs && !Music.defs.intro) {
  Music.defs.intro = { notes: [0, 3, 7, 10, 15, 12, 10, 7], base: 147, dur: .42, type: 'triangle', v: .022 };
}
