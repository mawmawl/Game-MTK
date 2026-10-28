'use strict';
/* ============================================================
   KURIR SANDI — sprites.js  (versi detail/premium)
   Seluruh pixel art digambar programatik (tanpa aset eksternal).
   Semua fungsi menggambar di koordinat dunia (ctx sudah digeser kamera).
   ============================================================ */

/* ---------- Helper gambar dasar ---------- */
function R(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function O(x, y, w, h, c) { R(x, y, w, 1, c); R(x, y + h - 1, w, 1, c); R(x, y, 1, h, c); R(x + w - 1, y, 1, h, c); }
function DITH(x, y, w, h, c, off = 0) {
  ctx.fillStyle = c;
  for (let j = 0; j < h; j++)
    for (let i = (off + j) % 2; i < w; i += 2)
      ctx.fillRect(Math.round(x) + i, Math.round(y) + j, 1, 1);
}
/* lingkaran pixel-crisp (tanpa antialias) */
function CIR(cx, cy, r, c) {
  ctx.fillStyle = c;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2, 1);
  }
}
/* bayangan dua lapis: lembut di luar, pekat di dalam */
function SHADOW(cx, cy, w, h = 6) {
  ctx.fillStyle = 'rgba(8,6,20,0.16)';
  ctx.beginPath(); ctx.ellipse(cx, cy, w / 2 + 3, h / 2 + 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(8,6,20,0.30)';
  ctx.beginPath(); ctx.ellipse(cx, cy, w / 2 - 1, h / 2 - 1, 0, 0, Math.PI * 2); ctx.fill();
}
/* tekstur grain halus deterministik untuk permukaan besar */
function GRAIN(x, y, w, h, c, density = 0.08) {
  ctx.fillStyle = c;
  for (let j = 0; j < h; j += 2)
    for (let i = 0; i < w; i += 2)
      if (hash2(Math.round(x) + i, Math.round(y) + j) < density)
        ctx.fillRect(Math.round(x) + i, Math.round(y) + j, 1, 1);
}
function HAZARD(x, y, w, h) {
  for (let i = -h; i < w; i += 8) {
    R(x + Math.max(0, i), y, Math.min(4, w - Math.max(0, i)) || 0, h, i >= 0 && i + 4 <= w ? '#e8c04a' : '#1a1a1a');
    R(x + Math.max(0, i + 4), y, Math.min(4, w - Math.max(0, i + 4)) || 0, h, '#22222a');
  }
}
/* baut/keling kecil */
function BOLT(x, y) { R(x, y, 2, 2, '#8a94a4'); R(x, y, 1, 1, '#c8d2e0'); }
/* garis kayu horizontal halus */
function WOODGRAIN(x, y, w, h, c, seed = 0) {
  ctx.fillStyle = c;
  for (let j = 2; j < h - 2; j += 4)
    for (let i = 2; i < w - 6; i += 3)
      if (hash2(x + i + seed, y + j) > 0.62) ctx.fillRect(x + i, y + j, 3 + (hash2(i, j) * 4 | 0), 1);
}
/* kilau kecil benda yang bisa diperiksa */
function drawGlint(o, t) {
  if (o.searched) return;
  const ph = (t * 0.7 + hash2(o.x, o.y) * 6) % 4;
  if (ph > 1) return;
  const cx = (o.x + o.w / 2) * TILE + (hash2(o.y, o.x) - .5) * o.w * 14;
  const cy = (o.y + 0.35) * TILE + ph * 5;
  const s = ph < .5 ? 1 : 2;
  ctx.fillStyle = 'rgba(255,246,210,' + (0.9 - ph * 0.9) + ')';
  ctx.fillRect(Math.round(cx), Math.round(cy - s), 1, s * 2);
  ctx.fillRect(Math.round(cx - s), Math.round(cy), s * 2, 1);
}

/* ============================================================
   KARAKTER — tubuh parametrik dengan outline, anchor = kaki tengah
   ============================================================ */
function drawActorBody(fx, fy, dir, walk, pal, opts = {}) {
  const moving = walk >= 0;
  const phase = moving ? Math.floor(walk) % 4 : 0;
  const bob = moving && (phase === 1 || phase === 3) ? 1 : 0;
  const armA = moving ? [0, -2, 0, 2][phase] : 0;

  ctx.save();
  if (opts.flip) { ctx.translate(Math.round(fx) * 2, 0); ctx.scale(-1, 1); }
  const x = Math.round(fx), y = Math.round(fy);

  SHADOW(x, y + 1, opts.shadowW || 20);

  const coat = opts.coat || 0;
  const bodyH = 12 + coat;
  const by = y - 9 - bodyH + bob;
  const hy = by - 11;
  const OUT = pal.outline || '#1a1428';

  /* --- outline siluet (digambar dulu, mengembang 1px) --- */
  R(x - 9, hy - 1, 18, (by + bodyH) - hy + 2, OUT);                 // kepala+badan
  if (opts.hood) R(x - 9, hy - 3, 18, 3, OUT);                      // puncak tudung
  if (opts.hat === 'fedora') R(x - 10, hy - 6, 20, 6, OUT);
  if (opts.hat === 'cap') R(x - 8, hy - 4, 16, 5, OUT);

  /* --- kaki: menyamping = langkah horizontal, menghadap kamera = angkat kaki --- */
  const legY = y - 9 + bob;
  const sideView = dir === 'left' || dir === 'right';
  const stride = moving ? [0, 2, 0, -2][phase] : 0;          // rentang langkah
  const liftF = moving && phase === 1 ? 1 : 0;               // kaki depan terangkat
  const liftB = moving && phase === 3 ? 1 : 0;               // kaki belakang terangkat
  R(x - 8, legY - 1, 7, 11, OUT);
  R(x + 1, legY - 1, 7, 11, OUT);
  const backX = x - 7 + (sideView ? -stride : 0);
  const frontX = x + 2 + (sideView ? stride : 0);
  const backH = 9 - (sideView ? 0 : liftB);
  const frontH = 9 - (sideView ? 0 : liftF);
  R(backX, legY, 5, backH, pal.pants);
  R(frontX, legY, 5, frontH, pal.pants);
  R(backX, legY, 1, backH, pal.pantsDark || pal.pants);      // sisi gelap kaki
  R(frontX, legY, 1, frontH, pal.pantsDark || pal.pants);
  const shoeYB = legY + backH - 2, shoeYF = legY + frontH - 2;
  R(backX, shoeYB, 5, 2, pal.shoe);
  R(frontX, shoeYF, 5, 2, pal.shoe);
  R(backX, shoeYB, 5, 1, pal.shoeLight || pal.shoe);
  R(frontX, shoeYF, 5, 1, pal.shoeLight || pal.shoe);

  /* --- badan --- */
  R(x - 8, by, 16, bodyH, pal.shirt);
  R(x - 8, by, 16, 2, pal.shirtLight);
  DITH(x - 8, by + bodyH - 3, 16, 3, pal.shirtDark, 1);
  R(x - 8, by, 1, bodyH, pal.shirtDark);
  R(x + 7, by, 1, bodyH, pal.shirtDark);
  if (pal.zip) { R(x - 1, by + 2, 1, bodyH - 4, pal.zip); R(x - 2, by + 2, 3, 1, pal.zip); }
  if (pal.stripe) R(x - 8, by + Math.floor(bodyH / 2) - 1, 16, 2, pal.stripe); // garis reflektif rompi
  if (pal.pocket) R(x - 6, by + bodyH - 6, 4, 3, pal.shirtDark);   // saku jaket
  if (pal.buttons) { R(x - 1, by + 3, 1, 1, pal.buttons); R(x - 1, by + 7, 1, 1, pal.buttons); R(x - 1, by + 11, 1, 1, pal.buttons); }

  /* --- tas punggung / tali tas --- */
  if (opts.pack) {
    if (dir === 'up') {
      R(x - 5, by + 1, 10, 10, pal.pack);
      R(x - 5, by + 1, 10, 2, pal.packLight);
      R(x - 5, by + 6, 10, 2, pal.packDark);          // penutup
      R(x - 1, by + 8, 2, 2, '#e8c04a');              // gesper
      O(x - 5, by + 1, 10, 10, OUT);
    } else if (dir === 'left' || dir === 'right') {
      R(x - 9, by + 2, 2, 8, pal.pack);               // sisik tas di punggung
      R(x - 9, by + 2, 1, 8, pal.packLight);
    } else {
      R(x - 7, by + 1, 2, 3, pal.pack);               // tali bahu terlihat
      R(x + 5, by + 1, 2, 3, pal.pack);
    }
  }

  /* --- lengan --- */
  const armY = by + 2;
  R(x - 11, armY + armA, 3, bodyH - 5, pal.shirtDark);
  R(x + 8, armY - armA, 3, bodyH - 5, pal.shirtDark);
  R(x - 11, armY + armA + bodyH - 6, 3, 2, pal.skin);
  R(x + 8, armY - armA + bodyH - 6, 3, 2, pal.skin);

  /* --- kepala --- */
  if (opts.hood) {
    /* kepala berserudung (agen kurir) */
    if (dir === 'up') {
      R(x - 7, hy - 2, 14, 12, pal.hood);
      R(x - 7, hy - 2, 14, 2, pal.hoodLight);
      R(x - 7, hy + 4, 14, 1, pal.hoodDark);           // jahitan tudung
      DITH(x - 5, hy + 6, 10, 4, pal.hoodDark, 1);
    } else {
      R(x - 5, hy + 2, 10, 9, pal.skin);               // wajah
      R(x + 3, hy + 2, 2, 9, pal.skinShade || pal.skin);
      R(x - 8, hy - 2, 16, 5, pal.hood);               // tudung atas
      R(x - 8, hy - 2, 16, 2, pal.hoodLight);
      R(x - 8, hy + 3, 3, 8, pal.hood);                // sisi tudung
      R(x + 5, hy + 3, 3, 8, pal.hood);
      R(x - 7, hy + 9, 14, 2, pal.hoodDark);           // dagu tudung
      if (dir === 'down') {
        R(x - 3, hy + 4, 2, 2, pal.eye);
        R(x + 1, hy + 4, 2, 2, pal.eye);
      } else {
        R(x - 3, hy + 4, 2, 2, pal.eye);
      }
      R(x - 4, hy + 7, 8, 4, pal.mask);                // masker mulut
      R(x - 4, hy + 7, 8, 1, pal.maskLight);
      DITH(x - 4, hy + 9, 8, 2, pal.maskDark, 0);
    }
  } else {
    R(x - 6, hy, 12, 11, pal.skin);
    R(x + 4, hy, 2, 11, pal.skinShade || pal.skin);                // pipi gelap sisi
    R(x - 6, hy, 12, 4, pal.hair);
    R(x - 6, hy, 12, 1, pal.hairLight || pal.hair);                // kilau rambut
    if (dir === 'up') { R(x - 6, hy, 12, 9, pal.hair); DITH(x - 6, hy + 4, 12, 4, pal.hairLight || pal.hair, 0); }
    else {
      R(x - 7, hy + 2, 1, 4, pal.hair);
      R(x + 6, hy + 2, 1, 4, pal.hair);
      if (dir === 'down') {
        R(x - 4, hy + 6, 2, 2, pal.eye);
        R(x + 2, hy + 6, 2, 2, pal.eye);
        R(x - 2, hy + 9, 4, 1, pal.mouth || 'rgba(0,0,0,0.25)');      // mulut kecil
      } else {
        R(x - 4, hy + 6, 2, 2, pal.eye);
      }
      if (pal.mustache) R(x - 3, hy + 8, 6, 2, pal.mustache);
    }
  }

  /* --- aksesori --- */
  if (pal.scarf) { R(x - 6, by, 12, 2, pal.scarf); R(x - 2, by + 2, 3, 4, pal.scarf); R(x - 2, by + 2, 1, 4, 'rgba(0,0,0,0.2)'); }
  if (pal.bag) {
    R(x - 6, by + 1, 12, 2, pal.bag);
    R(x + 5, by + 6, 7, 8, pal.bag);
    R(x + 5, by + 6, 7, 2, pal.bagLight);
    R(x + 8, by + 9, 2, 2, '#e8c04a');                              // gesper
    O(x + 5, by + 6, 7, 8, OUT);
  }
  if (opts.hat === 'fedora') {
    R(x - 9, hy - 1, 18, 2, pal.hatBrim);
    R(x - 6, hy - 5, 12, 4, pal.hat);
    R(x - 6, hy - 5, 12, 1, pal.hatLight);
    R(x - 6, hy - 2, 12, 1, pal.hatBand);
  } else if (opts.hat === 'cap') {
    R(x - 7, hy - 3, 14, 4, pal.hat);
    R(x - 6, hy - 4, 12, 1, pal.hatLight);
    if (dir !== 'up') R(dir === 'left' ? x - 11 : x + 5, hy, 6, 1, pal.hatLight);
  }
  ctx.restore();
}

/* Agen kurir: hoodie indigo + masker oranye + tas punggung */
const PAL_PLAYER = {
  skin: '#f2c496', skinShade: '#d8a878', eye: '#26202c',
  hood: '#31406b', hoodLight: '#48598a', hoodDark: '#232c48',
  mask: '#e8833c', maskLight: '#ffa85e', maskDark: '#c05f22',
  shirt: '#31406b', shirtLight: '#48598a', shirtDark: '#232c48',
  pants: '#2c2f3e', pantsDark: '#20222e', shoe: '#5a3a28', shoeLight: '#7a5238',
  pack: '#c86a34', packLight: '#e8894a', packDark: '#9a4e22',
  outline: '#141126'
};
const PAL_COURIER = {
  skin: '#eab585', skinShade: '#d09a68', hair: '#3a2a1a', hairLight: '#54402a', eye: '#26202c',
  shirt: '#d9a441', shirtLight: '#f0c060', shirtDark: '#b0802c',
  pants: '#4d4a5c', pantsDark: '#3a3848', shoe: '#3a3228', shoeLight: '#554a3a',
  mustache: '#4a3020', hat: '#b8842e', hatLight: '#d9a441', hatBrim: '#8a621e',
  bag: '#7a4a2a', bagLight: '#96613a', buttons: '#6a4a10', outline: '#17122a'
};
const PAL_SPY = {
  skin: '#d8b090', skinShade: '#bc9478', hair: '#22201f', eye: '#161420',
  shirt: '#5a6070', shirtLight: '#747b8d', shirtDark: '#424755',
  pants: '#3a3d49', pantsDark: '#2c2f3a', shoe: '#26262e',
  hat: '#43474f', hatLight: '#565b66', hatBrim: '#31343c', hatBand: '#22242c',
  buttons: '#2c2f3a', outline: '#101018'
};
/* Penjaga lab: rompi hi-vis oranye berstrip reflektif + topi */
const PAL_GUARD = {
  skin: '#d8b090', skinShade: '#bc9478', hair: '#2a2622', hairLight: '#3c3630', eye: '#161420',
  shirt: '#e8942f', shirtLight: '#f8b850', shirtDark: '#c0721c',
  stripe: '#d8dde8',
  pants: '#3a4258', pantsDark: '#2c3344', shoe: '#26262e', shoeLight: '#3a3a44',
  hat: '#2c3344', hatLight: '#3c4458', hatBrim: '#1e2430',
  buttons: '#8a5510', outline: '#141126'
};

function drawPlayer(fx, fy, dir, walk) {
  drawActorBody(fx, fy, dir, walk, PAL_PLAYER, { flip: dir === 'left', hood: true, pack: true });
}
function drawCourier(fx, fy, t, wave) {
  const bob = Math.sin(t * 2.4) >= 0 ? 0 : 1;
  drawActorBody(fx, fy - bob, 'down', -1, PAL_COURIER, { hat: 'cap', shadowW: 22 });
  if (wave >= 0) {
    const a = Math.sin(wave * 6) * 2;
    R(Math.round(fx) + 9, Math.round(fy) - 24 + a, 3, 7, PAL_COURIER.shirtDark);
    R(Math.round(fx) + 9, Math.round(fy) - 26 + a, 3, 2, PAL_COURIER.skin);
  }
}
function drawSpy(fx, fy, dir, walk, pal, hat) {
  const p = pal || PAL_SPY, h = hat || 'fedora';
  drawActorBody(fx, fy, dir, walk, p, {
    flip: dir === 'left', coat: h === 'cap' ? 2 : 4, hat: h, shadowW: 22
  });
}
function drawDrone(fx, fy, t, alert) {
  const x = Math.round(fx), y = Math.round(fy) + Math.round(Math.sin(t * 3) * 2);
  SHADOW(x, fy + 14, 18, 4);
  // baling utama (blur bolak-balik)
  const rw = 9 + Math.round(Math.sin(t * 22) * 4);
  R(x - rw, y - 10, rw * 2, 1, 'rgba(200,220,255,0.55)');
  R(x - 1, y - 9, 2, 3, '#5a6270');
  // rotor samping
  R(x - 13, y - 6, 3, 1, 'rgba(200,220,255,0.4)');
  R(x + 10, y - 6, 3, 1, 'rgba(200,220,255,0.4)');
  R(x - 12, y - 5, 2, 2, '#5a6270'); R(x + 10, y - 5, 2, 2, '#5a6270');
  // badan
  R(x - 9, y - 6, 18, 9, '#8a94a4');
  R(x - 9, y - 6, 18, 2, '#b8c2d2');
  R(x - 9, y + 1, 18, 2, '#5a6270');
  O(x - 9, y - 6, 18, 9, '#262b36');
  BOLT(x - 8, y - 5); BOLT(x + 6, y - 5);
  // kaki
  R(x - 6, y + 3, 2, 2, '#3a4050'); R(x + 4, y + 3, 2, 2, '#3a4050');
  // mata sensor
  const eye = Math.round(Math.sin(t * 2.2) * 3);
  R(x - 3 + eye, y - 4, 4, 3, '#1a0d10');
  R(x - 2 + eye, y - 3, 2, 1, alert ? '#ffe04a' : '#ff4a5a');
  if (!alert) { // garis pindai tipis
    ctx.fillStyle = 'rgba(255,74,90,0.10)';
    ctx.fillRect(x - 2 + eye, y - 1, 2, 14);
  }
  // lampu status
  const blink = Math.sin(t * 6) > 0;
  R(x - 8, y - 5, 1, 1, blink ? '#4aff8a' : '#1a5a34');
  R(x + 7, y - 5, 1, 1, blink ? '#ff5a4a' : '#5a1a1a');
  R(x - 4, y + 1, 8, 1, '#c8a83a');
}

/* ============================================================
   OBJEK & FURNITURE — fn(o, t, theme); o.x/y dalam tile
   ============================================================ */
const OBJ_ART = {

  /* ---------- KAMAR ---------- */
  bed(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
    SHADOW(x + w / 2 + 2, y + h - 2, w - 4, 10);
    // headboard berpanel
    R(x + 2, y + 2, w - 4, 14, th.wood);
    R(x + 2, y + 2, w - 4, 2, th.woodLight);
    R(x + 4, y + 5, w - 12, 8, th.woodLight);
    O(x + 4, y + 5, w - 12, 8, th.woodDark);
    R(x, y, 4, 18, th.woodDark);                       // tiang kiri
    R(x + w - 4, y, 4, 18, th.woodDark);
    R(x + 1, y, 2, 3, th.woodLight);
    R(x + w - 3, y, 2, 3, th.woodLight);
    // rangka + kasur
    R(x + 2, y + 16, w - 4, h - 18, th.wood);
    R(x + 4, y + 18, w - 8, h - 22, '#f2ead8');
    R(x + 4, y + 18, w - 8, 2, '#ffffff');
    R(x + w - 10, y + 18, 6, h - 22, '#d8cbb2');
    R(x + 4, y + 18, 2, h - 22, '#faf4e4');
    // bantal utama + bantal aksen
    R(x + 8, y + 20, w - 30, 18, '#fdf8ec');
    O(x + 8, y + 20, w - 30, 18, '#c9bda2');
    R(x + 11, y + 23, w - 36, 3, '#ffffff');
    R(x + w - 20, y + 22, 12, 12, th.accentLight);
    O(x + w - 20, y + 22, 12, 12, th.accentDark);
    R(x + w - 18, y + 24, 8, 3, th.accent);
    // selimut plaid lembut
    const by = y + 42;
    R(x + 4, by, w - 8, h - 46, th.accent);
    R(x + 4, by, w - 8, 3, th.accentLight);
    ctx.globalAlpha = 0.5;
    for (let i = 8; i < w - 10; i += 16) R(x + 4 + i, by + 3, 2, h - 49, th.accentDark);
    for (let j = by + 12; j < y + h - 8; j += 16) R(x + 7, j, w - 14, 1, th.accentDark);
    ctx.globalAlpha = 1;
    R(x + 7, by + 26, w - 14, 1, th.accentLight);        // lipatan kain
    DITH(x + w - 12, by + 3, 8, h - 49, th.accentDark);
    O(x + 4, by, w - 8, h - 46, th.accentDark);
    // lipatan kaki ranjang
    R(x + 2, y + h - 6, w - 4, 4, th.woodDark);
    WOODGRAIN(x + 2, y + 16, w - 4, h - 22, th.woodDark, o.x);
  },

  nightstand(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
    SHADOW(x + w / 2, y + h - 2, w + 4);
    R(x + 2, y + 8, w - 4, h - 10, th.wood);
    O(x + 2, y + 8, w - 4, h - 10, th.woodDark);
    R(x + 2, y + 8, w - 4, 2, th.woodLight);
    R(x + 5, y + 13, w - 10, 9, th.woodLight);          // laci
    O(x + 5, y + 13, w - 10, 9, th.woodDark);
    R(x + w / 2 - 2, y + 17, 5, 2, '#e8c04a');
    R(x + 4, y + h - 3, w - 8, 2, th.woodDark);
    // jam weker di atas
    R(x + w / 2 - 6, y, 12, 8, '#b04a5a');
    R(x + w / 2 - 5, y + 1, 10, 5, '#f2ead8');
    R(x + w / 2 - 1, y + 2, 1, 3, '#26202c');
    R(x + w / 2 + 1, y + 3, 2, 1, '#26202c');
    R(x + w / 2 - 8, y - 2, 2, 2, '#b04a5a');           // lonceng
    R(x + w / 2 + 6, y - 2, 2, 2, '#b04a5a');
    WOODGRAIN(x + 2, y + 8, w - 4, h - 10, th.woodDark, o.x * 3);
  },

  floorlamp(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE;
    SHADOW(x + w / 2, y + TILE - 3, 18, 5);
    R(x + w / 2 - 6, y + TILE - 5, 12, 3, th.woodDark);  // alas
    R(x + w / 2 - 1, y + 10, 2, TILE - 15, '#4a5568');   // tiang
    R(x + w / 2 - 8, y + 2, 16, 10, th.accent);          // tudung lampu
    R(x + w / 2 - 6, y + 4, 12, 3, th.accentLight);
    R(x + w / 2 - 8, y + 10, 16, 2, th.accentDark);
    const fl = Math.sin(t * 7 + o.x) > -0.92 ? 1 : 0.6;
    ctx.fillStyle = 'rgba(255,200,110,' + (0.14 * fl) + ')';
    ctx.beginPath(); ctx.arc(x + w / 2, y + 14, 22, 0, Math.PI * 2); ctx.fill();
  },

  laundry(o, t, th) {
    const x = o.x * TILE + 2, y = o.y * TILE + 6;
    SHADOW(x + 14, y + 26, 24, 5);
    // pakaian menjorok
    R(x + 6, y - 4, 10, 8, '#cfd8e8');
    R(x + 14, y - 2, 9, 6, '#8ab0c8');
    // keranjang anyaman
    R(x, y + 2, 28, 22, '#b08a52');
    O(x, y + 2, 28, 22, '#6a4e2c');
    for (let j = 4; j < 22; j += 5) R(x + 2, y + j, 24, 2, '#8a6a3c');
    for (let i = 3; i < 26; i += 6) R(x + i, y + 4, 2, 18, '#6a4e2c');
    R(x - 2, y, 32, 4, '#c8a066');                      // bibir
    O(x - 2, y, 32, 4, '#6a4e2c');
  },

  toycar(o, t, th) {
    const x = o.x * TILE + 4, y = o.y * TILE + 14;
    SHADOW(x + 12, y + 10, 22, 4);
    R(x, y + 2, 24, 7, '#c0403a');                      // bodi
    R(x + 5, y - 3, 12, 6, '#c0403a');                  // kabin
    R(x + 7, y - 1, 8, 4, '#a8d8e8');                   // kaca
    R(x, y + 2, 24, 1, '#e06a60');
    R(x + 22, y + 3, 2, 3, '#ffe08a');                  // lampu
    CIR(x + 5, y + 9, 3, '#26202c'); CIR(x + 19, y + 9, 3, '#26202c');
    CIR(x + 5, y + 9, 1, '#8a94a4'); CIR(x + 19, y + 9, 1, '#8a94a4');
  },

  desk(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
    SHADOW(x + w / 2, y + h - 2, w - 6, 8);
    // badan meja
    R(x + 2, y + 14, w - 4, h - 20, th.wood);
    O(x + 2, y + 14, w - 4, h - 20, th.woodDark);
    // laci kanan
    R(x + w - 44, y + 18, 36, h - 28, th.woodLight);
    O(x + w - 44, y + 18, 36, h - 28, th.woodDark);
    R(x + w - 40, y + 22, 28, 5, th.wood);
    R(x + w - 31, y + (h - 10) / 2, 10, 3, '#e8c04a');
    // panel kiri dengan garis kayu
    WOODGRAIN(x + 6, y + 18, w - 54, h - 28, th.woodDark, o.x);
    // kaki
    R(x + 2, y + h - 6, 8, 5, th.woodDark);
    R(x + w - 10, y + h - 6, 8, 5, th.woodDark);
    // permukaan atas
    R(x, y + 6, w, 10, th.woodLight);
    O(x, y + 6, w, 10, th.woodDark);
    R(x, y + 6, w, 2, '#ffe8c8');
    WOODGRAIN(x + 2, y + 8, w - 4, 6, '#c89868', o.y);
    // tumpukan buku
    R(x + 8, y + 2, 22, 6, '#b04a5a');
    R(x + 9, y + 3, 20, 1, '#d06a78');
    R(x + 10, y - 3, 20, 5, '#4a8ab0');
    R(x + 11, y - 2, 18, 1, '#6aaad0');
    R(x + 12, y - 8, 18, 5, '#58a06a');
    R(x + 13, y - 7, 16, 1, '#78c08a');
    // kertas berantakan
    R(x + 36, y + 1, 24, 7, '#f5f0e0');
    R(x + 38, y + 2, 18, 1, '#b8b0a0');
    R(x + 38, y + 4, 14, 1, '#b8b0a0');
    R(x + 40, y - 1, 20, 4, '#ece6d4');
    R(x + 42, y, 14, 1, '#b8b0a0');
    // lampu belajar (menyala)
    R(x + 70, y + 2, 12, 3, '#4a5568');
    R(x + 76, y - 6, 3, 8, '#4a5568');
    R(x + 70, y - 12, 16, 7, '#e8a84a');
    R(x + 72, y - 10, 12, 3, '#ffd98a');
    R(x + 74, y - 9, 2, 1, '#fff2c8');
    const fl = Math.sin(t * 9) > -0.9 ? 1 : 0.5;
    ctx.fillStyle = 'rgba(255,200,110,' + (0.16 * fl) + ')';
    ctx.beginPath(); ctx.arc(x + 78, y + 4, 26, 0, Math.PI * 2); ctx.fill();
    // gelas pensil
    R(x + w - 20, y - 2, 8, 10, '#7a8aa0');
    R(x + w - 19, y - 1, 6, 1, '#9aa8bc');
    R(x + w - 19, y - 8, 2, 6, '#e8b84a');
    R(x + w - 15, y - 7, 2, 5, '#b05a4a');
    R(x + w - 12, y - 9, 2, 7, '#4a8ab0');
    // mug uap
    R(x + w - 34, y - 4, 8, 8, '#b04a5a');
    R(x + w - 33, y - 3, 6, 2, '#d06a78');
    R(x + w - 26, y - 2, 2, 3, '#b04a5a');              // pegangan
    if (Math.sin(t * 2) > 0) R(x + w - 31, y - 9, 2, 3, 'rgba(255,255,255,0.35)');
  },

  dresser(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
    SHADOW(x + w / 2, y + h - 2, w - 4, 7);
    R(x + 1, y + 2, w - 2, h - 4, th.wood);
    O(x + 1, y + 2, w - 2, h - 4, th.woodDark);
    R(x + 1, y + 2, w - 2, 2, th.woodLight);
    for (let i = 0; i < 2; i++) {
      const dy = y + 5 + i * ((h - 8) / 2);
      R(x + 4, dy, w - 8, (h - 10) / 2, th.wood);
      O(x + 4, dy, w - 8, (h - 10) / 2, th.woodDark);
      R(x + 4, dy, w - 8, 1, th.woodLight);
      R(x + w / 2 - 3, dy + (h - 10) / 4 - 1, 6, 3, '#e8c04a');
      R(x + w / 2 - 3, dy + (h - 10) / 4 - 1, 6, 1, '#fff0b8');
    }
    // jam + bingkai foto di atas
    R(x + 6, y - 6, 10, 6, '#4a8ab0');
    R(x + 7, y - 5, 8, 3, '#a8d8e8');
    R(x + w - 16, y - 8, 12, 8, th.woodDark);           // bingkai
    R(x + w - 14, y - 6, 8, 5, '#e8c8a0');
    R(x + w - 12, y - 5, 2, 2, '#c07850');              // wajah mini
    GRAIN(x + 1, y + 2, w - 2, h - 4, th.woodDark, 0.05);
  },

  wardrobe(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
    SHADOW(x + w / 2, y + h - 2, w - 2, 8);
    R(x, y + 4, w, h - 6, th.wood);
    O(x, y + 4, w, h - 6, th.woodDark);
    R(x - 1, y, w + 2, 6, th.woodLight);                // kornis
    O(x - 1, y, w + 2, 6, th.woodDark);
    R(x - 1, y, w + 2, 1, '#ffe8c8');
    // pintu kiri: dengan cermin
    R(x + 3, y + 10, w / 2 - 5, h - 18, th.woodLight);
    O(x + 3, y + 10, w / 2 - 5, h - 18, th.woodDark);
    R(x + 6, y + 14, w / 2 - 11, h - 28, '#a8c8d8');    // cermin
    O(x + 6, y + 14, w / 2 - 11, h - 28, '#6a8a98');
    R(x + 8, y + 16, 3, h - 32, 'rgba(255,255,255,0.45)'); // kilau
    // pintu kanan: panel garis
    R(x + w / 2 + 2, y + 10, w / 2 - 5, h - 18, th.woodLight);
    O(x + w / 2 + 2, y + 10, w / 2 - 5, h - 18, th.woodDark);
    WOODGRAIN(x + w / 2 + 4, y + 12, w / 2 - 9, h - 22, th.woodDark, o.y);
    R(x + w / 2 - 4, y + h / 2 - 2, 2, 8, '#e8c04a');
    R(x + w / 2 + 2, y + h / 2 - 2, 2, 8, '#e8c04a');
    DITH(x + 3, y + 10, w - 6, 2, th.woodDark, 0);
    R(x + 2, y + h - 2, w - 4, 2, th.woodDark);
  },

  shelf(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
    SHADOW(x + w / 2, y + h - 2, w + 2, 7);
    R(x, y, w, h, th.wood);
    O(x, y, w, h, th.woodDark);
    R(x, y, 2, h, th.woodLight);
    const bookCols = ['#b04a5a', '#4a8ab0', '#58a06a', '#d9a441', '#8a5aa8', '#c8784a', '#4aa8a0', '#a84a6a'];
    for (let s = 0; s < 3; s++) {
      const sy = y + 4 + s * (h - 8) / 3;
      R(x + 2, sy, w - 4, 3, th.woodLight);
      let bx = x + 3;
      while (bx < x + w - 7) {
        const bw = 4 + Math.floor(hash2(o.x + bx, s) * 4);
        const bh = 8 + Math.floor(hash2(bx, o.y + s) * 6);
        const bc = bookCols[(hash2(bx, s * 7 + o.x) * bookCols.length) | 0];
        R(bx, sy - bh, bw, bh, bc);
        R(bx, sy - bh, bw, 1, 'rgba(255,255,255,0.28)');
        R(bx, sy - bh, 1, bh, 'rgba(255,255,255,0.12)');
        bx += bw + 1;
      }
      if (s === 1) { // tanaman mini di rak tengah
        R(x + 4, sy - 5, 6, 5, '#b06a42');
        CIR(x + 7, sy - 7, 3, '#4a9a54');
        R(x + 7, sy - 12, 1, 5, '#3a7a44');
        CIR(x + 8, sy - 12, 2, '#5aaa64');
      }
    }
  },

  trophy(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
    SHADOW(x + w / 2, y + h - 2, w + 2, 7);
    R(x, y, w, h, th.wood);
    O(x, y, w, h, th.woodDark);
    R(x, y, w, 3, th.woodLight);
    // kaca depan
    R(x + 4, y + 6, w - 8, h - 12, '#a8c8d8');
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (let i = 0; i < w - 10; i += 2)
      if ((i / 2 + o.x) % 3 === 0) ctx.fillRect(x + 5 + i, y + 7 + (i / 2) % 3, 1, h - 14 - (i / 2) % 3);
    O(x + 4, y + 6, w - 8, h - 12, '#6a8a98');
    // rak kaca
    R(x + 4, y + h / 2, w - 8, 2, th.woodDark);
    // trofi emas
    R(x + 9, y + 10, 8, 2, '#e8c04a');
    R(x + 10, y + 5, 6, 5, '#e8c04a');
    R(x + 11, y + 6, 4, 2, '#fff0b0');
    R(x + 7, y + 7, 2, 4, '#c8a83a');                   // pegangan
    R(x + 17, y + 7, 2, 4, '#c8a83a');
    R(x + 12, y + 12, 2, 2, '#8a6a1a');
    // plakat bintang
    R(x + 9, y + h / 2 + 6, 10, 8, th.woodLight);
    O(x + 9, y + h / 2 + 6, 10, 8, th.woodDark);
    R(x + 13, y + h / 2 + 8, 2, 4, '#e8c04a');
    R(x + 11, y + h / 2 + 9, 6, 2, '#e8c04a');
    // pita di sisi
    R(x + 24, y + 12, 3, 6, '#c0403a');
    R(x + 24, y + 18, 3, 2, '#8a2420');
  },

  rug(o, t, th) {
    const x = o.x * TILE + 3, y = o.y * TILE + 3, w = o.w * TILE - 6, h = o.h * TILE - 6;
    R(x, y, w, h, th.rug);
    O(x, y, w, h, th.rugDark);
    O(x + 3, y + 3, w - 6, h - 6, th.rugLight);
    O(x + 6, y + 6, w - 12, h - 12, th.rugDark);
    // medali tengah: belah ketupat ganda
    const cx = x + w / 2, cy = y + h / 2;
    const m = Math.min(w, h) / 2 - 14;
    for (let i = 0; i <= m; i += 2) {
      const k = Math.max(0, m - i);
      const col = i % 6 === 0 ? th.rugLight : (i % 4 === 0 ? th.rugDark : th.rug);
      R(cx - k, cy - i, k * 2, 1, col);
      R(cx - k, cy + i, k * 2, 1, col);
    }
    // mata medali
    CIR(cx, cy, 4, th.rugLight);
    CIR(cx, cy, 2, th.rugDark);
    // sudut: motif kecil
    for (const [sx, sy] of [[x + 10, y + 10], [x + w - 10, y + 10], [x + 10, y + h - 10], [x + w - 10, y + h - 10]]) {
      R(sx - 3, sy, 7, 1, th.rugLight); R(sx, sy - 3, 1, 7, th.rugLight);
      R(sx - 2, sy - 2, 5, 1, th.rugLight); R(sx - 2, sy + 2, 5, 1, th.rugLight);
      R(sx - 2, sy - 2, 1, 5, th.rugLight); R(sx + 2, sy - 2, 1, 5, th.rugLight);
    }
    DITH(x + 2, y + 2, w - 4, 5, th.rugDark, 0);
    DITH(x + 2, y + h - 7, w - 4, 5, th.rugDark, 1);
    for (let i = 4; i < w - 4; i += 8) { R(x + i, y + 1, 4, 1, th.rugDark); R(x + i, y + h - 2, 4, 1, th.rugDark); }
  },

  poster(o, t, th) {
    const x = o.x * TILE + 4, y = o.y * TILE + 2, w = 24, h = 28;
    R(x - 2, y - 2, w + 4, h + 4, '#c8b8a0');
    R(x, y, w, h, '#f5f0e0');
    O(x, y, w, h, '#a09880');
    R(x + 2, y + 2, w - 4, 11, '#e8935a');               // langit senja
    R(x + 2, y + 7, w - 4, 6, '#d97b8a');
    CIR(x + w - 8, y + 6, 3, '#ffe8a0');                 // matahari
    R(x + 2, y + 13, w - 4, 13, '#4a3a6b');              // gunung
    R(x + 4, y + 9, 8, 8, '#3a2d55');
    R(x + 10, y + 6, 9, 11, '#3a2d55');
    R(x + 12, y + 9, 5, 5, '#4a3a6b');
    R(x + 6, y + 4, 2, 1, '#3a2d55');                    // burung
    R(x + 9, y + 3, 2, 1, '#3a2d55');
    R(x + 4, y + 20, w - 8, 1, 'rgba(255,255,255,0.25)');// refleksi bintang
    R(x + 8, y + 23, w - 16, 1, 'rgba(255,255,255,0.15)');
  },

  window(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = 26;
    // rel + korden
    R(x - 4, y - 3, w + 8, 3, th.woodDark);
    R(x - 4, y - 3, w + 8, 1, th.woodLight);
    R(x - 5, y - 1, 9, 30, th.accent);                   // korden kiri
    DITH(x - 5, y - 1, 9, 30, th.accentDark, 0);
    R(x + w - 4, y - 1, 9, 30, th.accent);               // korden kanan
    DITH(x + w - 4, y - 1, 9, 30, th.accentDark, 1);
    R(x - 5, y - 1, 9, 2, th.accentLight);
    R(x + w - 4, y - 1, 9, 2, th.accentLight);
    R(x - 5, y + 22, 9, 8, th.accentDark);               // ikatan bawah
    R(x + w - 4, y + 22, 9, 8, th.accentDark);
    // bidang kaca
    R(x - 2, y + 2, w + 4, h + 4, th.woodDark);
    R(x, y + 4, w, h, th.sky[0]);
    R(x, y + 4 + h / 3, w, h / 3, th.sky[1]);
    R(x, y + 4 + h * 2 / 3, w, h / 3, th.sky[2]);
    if (th.sun) {
      CIR(x + w - 14, y + 12, 4, th.sun);
      CIR(x + w - 14, y + 12, 2, '#fff8d8');
    } else {
      CIR(x + w - 14, y + 11, 3, '#e8e8f0');             // bulan
      R(x + 5, y + 9, 2, 1, '#c8d8e8');                  // bintang
      R(x + 14, y + 14, 1, 1, '#c8d8e8');
      R(x + 24, y + 8, 1, 1, '#c8d8e8');
    }
    R(x + 8, y + 9, 10, 2, 'rgba(255,255,255,0.75)');    // awan
    R(x + 11, y + 7, 6, 2, 'rgba(255,255,255,0.75)');
    R(x + w / 2 - 1, y + 4, 2, h, th.woodDark);          // palang
    R(x, y + 4 + h / 2 - 1, w, 2, th.woodDark);
    O(x, y + 4, w, h, th.woodDark);
    R(x - 3, y + h + 6, w + 6, 3, th.woodLight);         // ambang
    O(x - 3, y + h + 6, w + 6, 3, th.woodDark);
  },

  blocks(o, t, th) {
    const x = o.x * TILE + 8, y = o.y * TILE + 16;
    SHADOW(x + 10, y + 12, 22, 4);
    R(x, y, 8, 8, '#b04a5a'); O(x, y, 8, 8, '#1a1428');
    R(x + 2, y + 2, 4, 2, 'rgba(255,255,255,0.3)');
    R(x + 7, y - 6, 8, 8, '#4a8ab0'); O(x + 7, y - 6, 8, 8, '#1a1428');
    R(x + 9, y - 4, 4, 2, 'rgba(255,255,255,0.3)');
    R(x + 3, y - 12, 7, 7, '#58a06a'); O(x + 3, y - 12, 7, 7, '#1a1428');
    R(x + 5, y - 10, 3, 1, 'rgba(255,255,255,0.3)');
  },

  /* ---------- MESIN ENKRIPSI (pusat perhatian) ---------- */
  machine(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
    SHADOW(x + w / 2, y + h - 2, w, 9);
    // kabel ke dinding
    R(x - 6, y + h / 2 - 1, 8, 3, '#232836');
    R(x - 10, y + h / 2 - 2, 5, 5, '#232836');
    // kabinet utama
    R(x + 1, y + 6, w - 2, h - 8, '#3a4254');
    O(x + 1, y + 6, w - 2, h - 8, '#161a26');
    R(x + 1, y + 6, w - 2, 3, '#5a6478');
    R(x + 1, y + 6, 2, h - 8, '#4a5264');
    BOLT(x + 3, y + 9); BOLT(x + w - 6, y + 9);
    BOLT(x + 3, y + h - 10); BOLT(x + w - 6, y + h - 10);
    R(x + 4, y + h - 4, w - 8, 3, '#232836');
    // layar dengan bar animasi + teks
    const sx = x + 6, sy = y + 11, sw = w - 26, sh = 24;
    R(sx - 2, sy - 2, sw + 4, sh + 4, '#232836');
    R(sx, sy, sw, sh, '#0d2a1c');
    ctx.save();
    ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
    const scroll = (t * 14) % (sw + 20);
    for (let i = 0; i < 4; i++) {
      const lw = 12 + ((hash2(i, 3) * 30) | 0);
      const lx = sx + 3 + ((i * 23 + scroll) % (sw - 10));
      R(lx, sy + 4 + i * 5, Math.min(lw, sx + sw - lx - 2), 2, i % 2 ? '#4ae68a' : '#2e9a58');
    }
    // gelombang berjalan
    ctx.fillStyle = '#7af2b8';
    for (let i = 0; i < sw; i += 3) {
      const yy = sy + sh - 4 - Math.round(Math.sin(t * 5 + i * 0.5) * 2 + 2);
      ctx.fillRect(sx + i, yy, 2, 1);
    }
    if (Math.sin(t * 5) > 0) R(sx + 3, sy + 2, 5, 2, '#4ae68a');
    ctx.restore();
    ctx.fillStyle = 'rgba(74,230,138,0.10)';
    ctx.beginPath(); ctx.arc(sx + sw / 2, sy + sh / 2, 34, 0, Math.PI * 2); ctx.fill();
    // panel tombol + LED
    for (let i = 0; i < 3; i++) R(sx + sw + 5, sy + 4 + i * 8, 6, 4, '#5a6478');
    R(sx + sw + 5, sy + 4, 6, 1, '#7a8296');
    R(sx + sw + 5, sy + sh - 6, 4, 3, Math.sin(t * 4) > 0 ? '#ff5a4a' : '#5a1a1a');
    R(sx + sw + 11, sy + sh - 6, 4, 3, Math.sin(t * 4 + 2) > 0 ? '#4aff8a' : '#1a5a34');
    // celah ventilasi samping
    for (let i = 0; i < 4; i++) R(x + 5, sy + sh + 8 + i * 4, 8, 2, '#2a303c');
    // papan tombol
    R(x + 6, y + h - 16, w - 12, 9, '#565e70');
    O(x + 6, y + h - 16, w - 12, 9, '#262b36');
    for (let i = 0; i < 8; i++) R(x + 8 + i * ((w - 18) / 8), y + h - 14, (w - 22) / 8 - 2, 5, '#7a8296');
    // antena + lampu ujung
    R(x + w - 8, y - 8, 2, 14, '#7a8296');
    R(x + w - 9, y - 2, 4, 1, '#8a94a4');
    CIR(x + w - 7, y - 9, 2, Math.sin(t * 3) > 0 ? '#ffd98a' : '#8a6a2a');
    // pelat label
    R(x + 6, y + h - 24, 30, 6, '#e8c04a');
    O(x + 6, y + h - 24, 30, 6, '#8a6a1a');
    R(x + 9, y + h - 22, 24, 2, '#7a5a10');
  },

  exitdoor(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
    SHADOW(x + w / 2, y + h, w, 8);
    R(x, y - 6, w, h + 6, th.woodDark);
    R(x + 3, y - 3, w - 6, h + 1, th.wood);
    O(x + 3, y - 3, w - 6, h + 1, th.woodDark);
    WOODGRAIN(x + 5, y, w - 10, h, th.woodDark, o.x);
    R(x + 7, y + 1, w - 18, 10, th.sky ? th.sky[1] : '#3a4a6a');
    O(x + 7, y + 1, w - 18, 10, th.woodDark);
    R(x + 8, y + 2, w - 20, 3, 'rgba(255,255,255,0.2)');
    R(x + w - 10, y + 16, 4, 3, '#e8c04a');
    R(x + 4, y - 10, w - 8, 7, '#2c5a46');
    O(x + 4, y - 10, w - 8, 7, '#1a3a2c');
    R(x + 6, y - 9, w - 12, 2, '#4aff8a');
    R(x + 6, y - 6, w - 12, 2, '#4aff8a');
    const gl = 0.12 + Math.sin(t * 2) * 0.04;
    ctx.fillStyle = 'rgba(255,214,140,' + gl + ')';
    ctx.beginPath(); ctx.arc(x + w / 2, y + 10, 30, 0, Math.PI * 2); ctx.fill();
    // keset doormat
    R(x + 6, y + h + 1, w - 12, 4, '#8a6a48');
    O(x + 6, y + h + 1, w - 12, 4, '#5a4430');
  },

  /* ---------- SEKOLAH ---------- */
  blackboard(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE;
    R(x - 2, y + 2, w + 4, 28, th.woodDark);
    R(x - 2, y + 2, w + 4, 2, th.wood);
    R(x, y + 4, w, 22, '#2c4a3a');
    txt('f(x) = ax + b', x + w / 2, y + 15, { font: FONT_VT(14), color: 'rgba(240,240,225,0.85)', align: 'center', world: true });
    // coretan kapur tambahan
    R(x + 10, y + 19, 22, 1, 'rgba(240,240,225,0.4)');
    txt('a=2', x + 22, y + 24, { font: FONT_VT(11), color: 'rgba(240,240,225,0.55)', align: 'center', world: true });
    txt('b=3', x + 46, y + 24, { font: FONT_VT(11), color: 'rgba(240,240,225,0.55)', align: 'center', world: true });
    CIR(x + w - 26, y + 12, 4, 'rgba(240,240,225,0.0)');
    // matahari kapur
    ctx.strokeStyle = 'rgba(240,240,225,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x + w - 26, y + 12, 4, 0, Math.PI * 2); ctx.stroke();
    R(x + w - 27, y + 18, 3, 1, 'rgba(240,240,225,0.5)'); // senyum matahari
    R(x + w - 42, y + 8, 1, 6, 'rgba(240,240,225,0.4)');
    R(x + w - 40, y + 6, 1, 8, 'rgba(240,240,225,0.35)');
    R(x + 4, y + 26, w - 8, 3, th.wood);                 // talang kapur
    R(x + 14, y + 24, 8, 2, '#f0f0e0'); R(x + 26, y + 24, 6, 2, '#e8c8c8');
  },

  noticeboard(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE;
    R(x - 2, y + 3, w + 4, 26, th.woodDark);
    R(x, y + 5, w, 20, '#c8a06a');                       // gabus
    GRAIN(x, y + 5, w, 20, '#a8804a', 0.14);
    const pins = [['#f5f0e0', 6], ['#ffd75e', 30], ['#e8a0b0', 54], ['#a8d8b0', 78], ['#a0c8e8', 102]];
    for (const [c, px] of pins) {
      if (px > w - 16) break;
      ctx.save();
      ctx.translate(x + px, y + 8);
      ctx.rotate(((px % 3) - 1) * 0.06);
      R(0, 0, 16, 12, c);
      O(0, 0, 16, 12, 'rgba(0,0,0,0.25)');
      R(2, 2, 12, 1, 'rgba(0,0,0,0.2)');
      R(7, -2, 2, 2, '#c0403a');                         // pin
      ctx.restore();
    }
  },

  schooldesk(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
    SHADOW(x + w / 2, y + h - 2, w - 2, 8);
    // meja
    R(x + 2, y + 10, w - 10, 8, th.woodLight);
    O(x + 2, y + 10, w - 10, 8, th.woodDark);
    R(x + 3, y + 11, w - 12, 2, '#e8c898');
    WOODGRAIN(x + 3, y + 12, w - 12, 5, '#a87848', o.x);
    // buku + pensil di atas
    R(x + 8, y + 5, 18, 5, '#4a8ab0');
    R(x + 9, y + 4, 16, 1, '#6aaad0');
    R(x + 30, y + 6, 8, 1, '#e8b84a');
    R(x + 30, y + 5, 2, 1, '#b05a4a');
    // rangka besi
    R(x + 4, y + 18, 3, h - 20, '#8a94a4');
    R(x + w - 9, y + 18, 3, h - 20, '#8a94a4');
    R(x + 4, y + 18, 3, 2, '#b8c2d2'); R(x + w - 9, y + 18, 3, 2, '#b8c2d2');
    R(x + 4, y + h - 12, w - 10, 2, '#6a7484');          // palang bawah
    // kursi menempel di kanan
    R(x + w - 16, y + 26, 14, 4, th.wood);
    O(x + w - 16, y + 26, 14, 4, th.woodDark);
    R(x + w - 5, y + 10, 3, 18, th.woodDark);            // sandaran
    R(x + w - 5, y + 10, 3, 2, th.woodLight);
    R(x + w - 15, y + 30, 3, h - 32, th.woodDark);
  },

  teacherdesk(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
    SHADOW(x + w / 2, y + h - 2, w - 2, 8);
    R(x + 2, y + 4, w - 4, h - 8, th.wood);
    O(x + 2, y + 4, w - 4, h - 8, th.woodDark);
    R(x + 2, y + 4, w - 4, 3, th.woodLight);
    R(x + 8, y + 12, w / 2 - 12, h - 22, th.woodLight);  // panel depan
    O(x + 8, y + 12, w / 2 - 12, h - 22, th.woodDark);
    WOODGRAIN(x + 10, y + 14, w / 2 - 16, h - 26, th.woodDark, o.x);
    R(x + w - 40, y + 12, w / 2 - 14, h - 22, th.woodLight); // laci kanan
    O(x + w - 40, y + 12, w / 2 - 14, h - 22, th.woodDark);
    R(x + w - 28, y + 16, 8, 3, '#e8c04a');
    // dokumen + apel + lampu + buku
    R(x + w - 44, y, 24, 6, '#f5f0e0');
    R(x + w - 42, y + 1, 16, 1, '#b8b0a0');
    CIR(x + w - 12, y + 2, 3, '#c0392b');
    R(x + w - 13, y - 3, 1, 3, '#58a06a');
    R(x + 8, y - 2, 14, 4, '#8a5aa8');                   // buku
    R(x + 9, y - 3, 12, 1, '#a87ac8');
    R(x + 24, y - 6, 16, 7, '#e8a84a');                  // lampu meja
    R(x + 26, y - 4, 12, 3, '#ffd98a');
    R(x + 30, y + 1, 3, 3, '#4a5568');
    ctx.fillStyle = 'rgba(255,200,110,0.12)';
    ctx.beginPath(); ctx.arc(x + 32, y + 4, 14, 0, Math.PI * 2); ctx.fill();
  },

  lockers(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
    SHADOW(x + w / 2 + 2, y + h - 2, w + 2, 7);
    const n = Math.round(h / TILE);
    for (let i = 0; i < n; i++) {
      const ly = y + i * TILE;
      const tint = i % 2 ? '#6a86a8' : '#64809f';
      R(x, ly, w, TILE - 2, tint);
      R(x, ly, w, 3, '#8aa4c4');
      R(x + w - 6, ly + 6, w - 8, TILE - 12, '#5a7494');
      O(x, ly, w, TILE - 2, '#3c4e66');
      R(x + 4, ly + 6, TILE - 12, 2, '#4a6280');         // ventilasi
      R(x + 4, ly + 9, TILE - 12, 2, '#4a6280');
      R(x + w - 8, ly + 14, 3, 6, '#c8d2e0');            // gagang
      R(x + w - 8, ly + 14, 3, 1, '#e8f0f8');
      R(x + 3, ly + TILE - 6, w - 6, 3, '#4a6280');      // pelat kaki
      if (i === 1) { R(x + 5, ly + 16, 6, 4, '#e8a0b0'); R(x + 13, ly + 18, 5, 3, '#a8d8b0'); } // stiker
      if (i === 2) { R(x + 6, ly + 10, 1, 8, '#3c4e66'); R(x + 7, ly + 12, 4, 1, '#3c4e66'); } // goresan
    }
  },

  bookshelf(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
    SHADOW(x + w / 2 + 2, y + h - 2, w + 2, 7);
    R(x, y, w, h, '#8a6a48');
    O(x, y, w, h, '#5a4430');
    R(x, y, 2, h, '#a88a68');
    const cols = ['#b04a5a', '#4a8ab0', '#58a06a', '#d9a441', '#8a5aa8', '#c8784a', '#4aa8a0'];
    for (let s = 0; s < 4; s++) {
      const sy = y + 5 + s * (h - 8) / 4;
      R(x + 2, sy + 10, w - 4, 2, '#a88a68');
      let bx = x + 2;
      while (bx < x + w - 6) {
        const bw = 4 + Math.floor(hash2(o.x + bx, s) * 3);
        const bh = 9 + Math.floor(hash2(bx, o.y + s) * 3);
        R(bx, sy + 10 - bh, bw, bh, cols[(hash2(bx * 3, s + o.y) * cols.length) | 0]);
        R(bx, sy + 10 - bh, bw, 1, 'rgba(255,255,255,0.22)');
        bx += bw + 1;
      }
      if (s === 2) { // kotak arsip di rak 3
        R(x + 8, sy + 2, 14, 8, '#c8b088');
        O(x + 8, sy + 2, 14, 8, '#8a7454');
        R(x + 10, sy + 5, 10, 1, '#8a7454');
      }
    }
  },

  globe(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
    SHADOW(x + w / 2, y + h - 2, w - 6, 7);
    R(x + 4, y + h - 14, w - 8, 12, th.wood);
    O(x + 4, y + h - 14, w - 8, 12, th.woodDark);
    R(x + 4, y + h - 14, w - 8, 2, th.woodLight);
    R(x + 6, y + h - 11, w - 20, 6, th.woodLight);       // pintu kabinet
    O(x + 6, y + h - 11, w - 20, 6, th.woodDark);
    R(x + w / 2 - 2, y + h - 26, 4, 12, th.woodDark);
    // bola dunia
    const cx = x + w / 2, cy = y + h - 34, r = 9;
    CIR(cx, cy, r, '#3a7ac8');
    CIR(cx, cy, r - 1, '#4a92d8');
    const shift = Math.floor(t * 8) % 24;
    for (let i = 0; i < 5; i++) {
      const a = (i * 7 + shift) % 18 - 9;
      R(cx + a, cy - 5 + (i % 3) * 4, 3, 2, '#58a860');
    }
    ctx.strokeStyle = '#2a4a70'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r + .5, 0, Math.PI * 2); ctx.stroke();
    // busur meridian + dudukan
    ctx.strokeStyle = '#c8a04a';
    ctx.beginPath(); ctx.arc(cx, cy, r + 2, Math.PI * 0.9, Math.PI * 2.1); ctx.stroke();
    R(cx - 1, cy - r - 3, 2, 3, '#c8a04a');
    // peta gulung di samping
    R(x + w - 10, y + h - 20, 5, 8, '#e8d8b0');
    O(x + w - 10, y + h - 20, 5, 8, '#8a7454');
  },

  plant(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE;
    SHADOW(x + w / 2, y + TILE - 4, 16, 5);
    const sway = Math.sin(t * 1.6 + o.x) * 1;
    R(x + 8, y + TILE - 14, 16, 12, '#b06a42');
    O(x + 8, y + TILE - 14, 16, 12, '#6a3a22');
    R(x + 7, y + TILE - 16, 18, 4, '#c87a4e');
    R(x + 10, y + TILE - 12, 12, 3, '#5a3420');          // tanah
    R(x + 15 + sway, y + 4, 2, TILE - 16, '#3a7a44');
    CIR(x + 11 + sway, y + 8, 5, '#4a9a54');
    CIR(x + 20 + sway, y + 12, 4, '#3a8a48');
    CIR(x + 15 + sway, y + 2, 3, '#5aaa64');
    CIR(x + 24 + sway, y + 6, 3, '#5aaa64');
    CIR(x + 13 + sway, y + 1, 1, '#e8a0b0');             // bunga kecil
    CIR(x + 22 + sway, y + 4, 1, '#e8a0b0');
  },

  bin(o, t, th) {
    const x = o.x * TILE + 4, y = o.y * TILE + 4;
    SHADOW(x + 12, y + 26, 20, 5);
    R(x, y + 4, 24, 22, '#8a94a4');
    R(x, y + 4, 24, 3, '#a8b2c2');
    R(x, y + 22, 24, 4, '#5a6474');
    O(x, y + 4, 24, 22, '#3a4050');
    R(x + 4, y + 10, 16, 2, '#6a7484');
    R(x + 4, y + 15, 16, 2, '#6a7484');
    R(x + 8, y + 19, 8, 2, '#6a7484');
    CIR(x + 12, y + 2, 3, '#e8e4d8');
    R(x + 11, y - 3, 4, 3, '#f0ecdf');                   // kertas melayang
  },

  clock(o, t, th) {
    const x = o.x * TILE + 16, y = o.y * TILE + 16;
    CIR(x, y, 13, '#5a4430');
    CIR(x, y, 12, '#7a5a3c');
    CIR(x, y, 10, '#f5f0e0');
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      const tick = i % 3 === 0 ? 2 : 1;
      R(x + Math.cos(a) * 8 - 1, y + Math.sin(a) * 8 - 1, tick, tick, '#5a4430');
    }
    const ha = t * 0.02, ma = t * 0.24;
    R(x - 1, y - Math.cos(ha) * 5, 2, Math.cos(ha) * 5 + 1, '#26202c');
    R(x, y, Math.cos(ma) * 8, 1, '#26202c');
    R(x + Math.cos(ma) * 8 - 1, y + Math.sin(ma) * 8 - 1, 2, 2, '#26202c');
    CIR(x, y, 1, '#c0403a');
  },

  /* ---------- LAB RUSAK ---------- */
  computer(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
    SHADOW(x + w / 2, y + h - 2, w - 4, 8);
    // meja logam
    R(x + 2, y + h - 12, w - 4, 10, '#3a4250');
    O(x + 2, y + h - 12, w - 4, 10, '#181c26');
    R(x + 3, y + h - 12, w - 6, 2, '#566074');
    R(x + 4, y + h - 2, 3, 2, '#181c26'); R(x + w - 7, y + h - 2, 3, 2, '#181c26');
    // CRT
    R(x + 8, y + 4, w - 16, 26, '#8a94a4');
    O(x + 8, y + 4, w - 16, 26, '#262b36');
    R(x + 9, y + 5, w - 18, 2, '#b8c2d2');
    R(x + 12, y + 8, w - 24, 18, '#0d1a24');
    const on = Math.sin(t * 7 + o.x) > -0.3;
    if (on) {
      ctx.save();
      ctx.beginPath(); ctx.rect(x + 12, y + 8, w - 24, 18); ctx.clip();
      for (let i = 0; i < 4; i++) {
        if (hash2(Math.floor(t * 8), o.x + i) > .5)
          R(x + 12, y + 9 + i * 4, w - 24, 1, 'rgba(120,220,255,0.35)');
      }
      R(x + 14, y + 10, 10, 2, '#4ae6d8');
      R(x + 14, y + 14, 16, 2, '#2e9aa8');
      R(x + 14, y + 18, 8, 2, 'rgba(74,230,216,0.6)');
      // bilah glitch
      if (hash2(Math.floor(t * 6), o.y) > 0.6)
        R(x + 12, y + 12 + (t * 30 % 10 | 0), w - 24, 2, 'rgba(224,92,224,0.4)');
      ctx.restore();
    }
    // retakan kaca
    ctx.strokeStyle = 'rgba(220,240,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 20, y + 10); ctx.lineTo(x + 26, y + 15); ctx.lineTo(x + 22, y + 21);
    ctx.moveTo(x + 26, y + 15); ctx.lineTo(x + 33, y + 13);
    ctx.stroke();
    // papan nama + LED
    R(x + 10, y + 27, 14, 2, '#565e70');
    R(x + w - 14, y + 27, 2, 2, on ? '#4aff8a' : '#1a5a34');
    // keyboard + mouse + kabel
    R(x + 10, y + 32, w - 26, 6, '#565e70');
    O(x + 10, y + 32, w - 26, 6, '#262b36');
    for (let i = 0; i < 6; i++) R(x + 12 + i * ((w - 30) / 6), y + 33, (w - 34) / 6, 3, '#7a8296');
    R(x + w - 12, y + 34, 6, 4, '#6a7484');              // mouse
    R(x + w - 10, y + h - 9, 10, 1, '#4ae6d8');          // kabel
    R(x + 6, y + h - 8, 1, 8, '#4ae6d8');
    // sticky note
    R(x + w - 20, y + 2, 7, 7, '#ffe08a');
    R(x + w - 19, y + 4, 5, 1, '#c8a83a');
  },

  tank(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
    SHADOW(x + w / 2, y + h - 2, w - 2, 9);
    // dasar logam
    R(x, y + h - 14, w, 14, '#3a4250');
    O(x, y + h - 14, w, 14, '#181c26');
    R(x, y + h - 14, w, 2, '#566074');
    HAZARD(x + 4, y + h - 9, w - 8, 4);
    BOLT(x + 3, y + h - 12); BOLT(x + w - 5, y + h - 12);
    // pipa sisi ke dinding + klep
    R(x - 4, y + h / 2, 12, 4, '#4a5568');
    R(x - 4, y + h / 2, 12, 1, '#6a7688');
    CIR(x - 1, y + h / 2 - 4, 4, '#8a5a4a');
    CIR(x - 1, y + h / 2 - 4, 2, '#b07a62');
    R(x - 2, y + h / 2 - 8, 2, 8, '#6a3a30');
    // tabung kaca
    const gx = x + 8, gw = w - 16, gy = y + 4, gh = h - 20;
    R(gx, gy, gw, gh, 'rgba(140,220,230,0.14)');
    const lvl = gy + 12;
    R(gx + 2, lvl, gw - 4, gh - 14, 'rgba(58,180,150,0.55)');
    R(gx + 2, lvl, gw - 4, 2, 'rgba(150,255,220,0.5)');
    R(gx + 2, lvl + 2, 2, gh - 16, 'rgba(200,255,240,0.25)'); // kilau kiri
    ctx.save();
    ctx.beginPath(); ctx.rect(gx + 2, lvl, gw - 4, gh - 14); ctx.clip();
    for (let i = 0; i < 5; i++) {
      const by = gh - 8 - ((t * 14 + i * 17 + hash2(i, o.x) * 40) % (gh - 20));
      CIR(gx + 6 + (i * 8) % (gw - 14), by, 1 + i % 2, 'rgba(200,255,240,0.7)');
    }
    // partikel melayang
    for (let i = 0; i < 3; i++) {
      const py = lvl + 6 + ((t * 8 + i * 23) % (gh - 24));
      R(gx + 10 + ((i * 13 + o.x * 5) % (gw - 18)), py, 1, 1, 'rgba(150,255,220,0.5)');
    }
    ctx.restore();
    // mulut pecah bergerigi
    R(gx - 2, gy - 2, gw + 4, 4, '#3a4250');
    for (let i = 0; i < gw; i += 6) R(gx + i, gy + 2, 3, 2, 'rgba(220,250,255,0.4)');
    // retakan
    ctx.strokeStyle = 'rgba(220,250,255,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx + 4, gy + 8); ctx.lineTo(gx + 12, gy + 14); ctx.lineTo(gx + 8, gy + 22);
    ctx.stroke();
    O(gx, gy, gw, gh, 'rgba(180,230,240,0.5)');
    // penyangga
    R(gx - 2, gy + gh / 3, gw + 4, 3, '#2a303c');
    R(gx - 2, gy + gh * 2 / 3, gw + 4, 3, '#2a303c');
    BOLT(gx - 1, gy + gh / 3); BOLT(gx + gw - 2, gy + gh * 2 / 3);
    // label peringatan
    R(gx + gw / 2 - 6, gy + gh - 11, 12, 8, '#e8c04a');
    R(gx + gw / 2 - 6, gy + gh - 11, 12, 1, '#8a6a10');
    R(gx + gw / 2 - 1, gy + gh - 9, 2, 4, '#1a1a1a');
    // pendar cairan
    ctx.fillStyle = 'rgba(58,220,170,0.08)';
    ctx.beginPath(); ctx.arc(gx + gw / 2, lvl + 14, 30, 0, Math.PI * 2); ctx.fill();
  },

  electricbox(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
    SHADOW(x + w / 2, y + h - 2, w + 2, 7);
    // konduit atas & bawah
    R(x + w / 2 - 2, y - 6, 4, 8, '#4a5568');
    R(x + w / 2 - 2, y + h - 2, 4, 6, '#4a5568');
    R(x, y, w, h, '#4a5568');
    O(x, y, w, h, '#181c26');
    R(x + 2, y + 2, w - 4, 3, '#6a7688');
    HAZARD(x, y, w, 5);
    R(x + 5, y + 12, w - 10, 4, '#2a303c');
    R(x + 5, y + 20, w - 10, 4, '#2a303c');
    R(x + 5, y + 28, w - 10, 4, '#2a303c');
    BOLT(x + 2, y + 8); BOLT(x + w - 4, y + 8);
    // dial meter
    CIR(x + w / 2, y + h - 12, 5, '#2a303c');
    CIR(x + w / 2, y + h - 12, 4, '#d8d4c8');
    const na = Math.sin(t * 3 + o.y) * 1.2;
    R(x + w / 2, y + h - 13, Math.cos(na - 1.57) * 3, Math.sin(na - 1.57) * 3 + 1, '#c0403a');
    // lampu peringatan
    const blink = Math.sin(t * 5 + o.y) > 0.2;
    CIR(x + w / 2, y + 12, 3, blink ? '#ff5a4a' : '#5a1a1a');
    if (blink) {
      ctx.fillStyle = 'rgba(255,90,74,0.16)';
      ctx.beginPath(); ctx.arc(x + w / 2, y + 12, 13, 0, Math.PI * 2); ctx.fill();
    }
    // percikan listrik
    if (Math.sin(t * 13 + o.x * 2) > 0.9) {
      ctx.strokeStyle = '#7ae6ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + w - 2, y + 16);
      ctx.lineTo(x + w + 4, y + 20); ctx.lineTo(x + w, y + 24); ctx.lineTo(x + w + 6, y + 30);
      ctx.stroke();
      ctx.fillStyle = 'rgba(122,230,255,0.5)';
      ctx.fillRect(x + w - 2, y + 16, 2, 2);
    }
  },

  crate(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE, h = o.h * TILE;
    SHADOW(x + w / 2, y + h - 2, w, 9);
    R(x, y, w, h, '#5a6478');
    O(x, y, w, h, '#181c26');
    R(x + 2, y + 2, w - 4, 3, '#78829a');
    R(x + 2, y + 2, 2, h - 4, '#78829a');                // bevel kiri
    R(x + w - 4, y + 2, 2, h - 4, '#454e60');            // bevel kanan
    ctx.strokeStyle = '#454e60';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 6); ctx.lineTo(x + w - 4, y + h - 6);
    ctx.moveTo(x + w - 4, y + 6); ctx.lineTo(x + 4, y + h - 6);
    ctx.stroke();
    R(x + 2, y + h / 2 - 2, w - 4, 3, '#454e60');        // sambungan 2 peti
    HAZARD(x + 3, y + 3, 12, 4); HAZARD(x + w - 15, y + h - 7, 12, 4);
    txt('B-' + (12 + (o.x % 7)), x + w / 2, y + h / 2 + 4, { font: FONT_PS(7), color: '#c8d2e0', align: 'center', alpha: .85, world: true });
    // baut sudut + karat + goresan
    BOLT(x + 2, y + 2); BOLT(x + w - 4, y + 2);
    BOLT(x + 2, y + h - 4); BOLT(x + w - 4, y + h - 4);
    DITH(x + 2, y + h - 8, w - 4, 5, '#3a4254', 1);
    DITH(x + 8, y + 8, 10, 4, '#4a3a30', 0);
    R(x + 6, y + 10, 10, 1, '#78829a');
  },

  barrel(o, t, th) {
    const x = o.x * TILE + 2, y = o.y * TILE + 2;
    SHADOW(x + 12, y + 30, 22, 5);
    R(x, y + 2, 24, 30, '#6a5a48');
    R(x, y + 2, 24, 3, '#8a7a62');
    R(x - 1, y, 26, 4, '#7a6a54');                       // bibir atas
    O(x - 1, y, 26, 4, '#3a342a');
    R(x, y + 10, 24, 2, '#4a4034'); R(x, y + 20, 24, 2, '#4a4034');
    O(x, y + 2, 24, 30, '#2a241c');
    DITH(x + 2, y + 24, 20, 6, '#4a4034', 0);
    DITH(x + 14, y + 4, 8, 5, '#5a4a3a', 1);             // karat
    CIR(x + 12, y + 15, 5, '#c8a83a');
    CIR(x + 12, y + 15, 3, '#2a241c');
    R(x + 11, y + 13, 2, 4, '#c8a83a'); R(x + 10, y + 14, 4, 1, '#c8a83a');
    R(x, y + 30, 24, 2, '#3a342a');                      // dasar
  },

  pipes(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE;
    R(x, y + 8, w, 8, '#4a5568');
    R(x, y + 8, w, 2, '#6a7688');
    R(x, y + 14, w, 2, '#2a303c');
    for (let i = 32; i < w; i += 96) {
      R(x + i, y + 5, 6, 14, '#5a6478');
      O(x + i, y + 5, 6, 14, '#181c26');
      R(x + i + 1, y + 5, 4, 1, '#78829a');
      R(x + i - 3, y + 10, 12, 3, '#78829a');
      BOLT(x + i - 2, y + 10);
    }
    CIR(x + 64, y + 12, 5, '#8a5a4a');
    CIR(x + 64, y + 12, 3, '#b07a62');
    R(x + 63, y + 7, 2, 10, '#6a3a30');
    // tetesan air dari sambungan
    if (Math.sin(t * 2 + o.x) > 0.85) R(x + 66, y + 17, 1, 3, 'rgba(150,230,220,0.6)');
  },

  vent(o, t, th) {
    const x = o.x * TILE + 4, y = o.y * TILE + 8;
    R(x, y, 24, 14, '#3a4250');
    O(x, y, 24, 14, '#181c26');
    for (let i = 0; i < 4; i++) R(x + 3, y + 2 + i * 3, 18, 1, '#6a7688');
    BOLT(x + 1, y + 1); BOLT(x + 21, y + 1);
    BOLT(x + 1, y + 11); BOLT(x + 21, y + 11);
  },

  cables(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE;
    const w = o.w * TILE;
    // tiga kabel melengkung menggantung
    for (let c = 0; c < 3; c++) {
      const col = ['#4ae6d8', '#e05ce0', '#e8c04a'][c];
      const sag = 8 + c * 5;
      ctx.fillStyle = col;
      for (let i = 0; i <= w; i += 4) {
        const yy = y + 4 + Math.round(Math.sin(Math.PI * i / w) * sag);
        ctx.fillRect(x + i, yy, 3, 2);
      }
    }
    // titik korsleting berkedip
    if (Math.sin(t * 9 + o.x) > 0.75) {
      const sx = x + w / 2, sy = y + 12;
      ctx.strokeStyle = '#aef6ff';
      ctx.beginPath();
      ctx.moveTo(sx, sy); ctx.lineTo(sx + 4, sy + 3); ctx.lineTo(sx, sy + 6); ctx.lineTo(sx + 5, sy + 9);
      ctx.stroke();
    }
  },

  warningsign(o, t, th) {
    const x = o.x * TILE + 4, y = o.y * TILE + 6;
    R(x - 2, y - 2, 28, 26, '#3a4250');
    O(x - 2, y - 2, 28, 26, '#181c26');
    BOLT(x, y); BOLT(x + 22, y);
    // segitiga kuning
    ctx.fillStyle = '#e8c04a';
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 1); ctx.lineTo(x + 24, y + 20); ctx.lineTo(x, y + 20);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#8a6a10';
    ctx.stroke();
    R(x + 11, y + 6, 3, 8, '#1a1a1a');
    R(x + 11, y + 16, 3, 3, '#1a1a1a');
  },

  shards(o, t, th) {
    const x = o.x * TILE + 4, y = o.y * TILE + 10;
    ctx.fillStyle = 'rgba(190,240,240,0.75)';
    // serpihan segitiga kecil
    for (const [sx, sy, s] of [[0, 0, 5], [10, 3, 3], [18, 1, 4], [26, 4, 3]]) {
      ctx.beginPath();
      ctx.moveTo(x + sx, y + sy);
      ctx.lineTo(x + sx + s, y + sy + s);
      ctx.lineTo(x + sx, y + sy + s * 1.4);
      ctx.closePath(); ctx.fill();
    }
    R(x + 6, y + 6, 8, 1, 'rgba(190,240,240,0.4)');
    R(x + 22, y + 7, 5, 1, 'rgba(190,240,240,0.4)');
  },

  bookstack(o, t, th) {
    const x = o.x * TILE + 3, y = o.y * TILE + 12;
    SHADOW(x + 13, y + 14, 24, 4);
    R(x, y + 8, 26, 6, '#b04a5a');
    R(x + 2, y + 9, 22, 1, '#d06a78');
    R(x, y + 8, 26, 1, '#d06a78');
    R(x + 3, y + 3, 22, 5, '#4a8ab0');
    R(x + 4, y + 4, 20, 1, '#6aaad0');
    R(x + 5, y - 1, 19, 4, '#58a06a');
    R(x + 6, y, 17, 1, '#78c08a');
    R(x + 8, y - 4, 14, 3, '#d9a441');
    // tanaman mini di puncak
    R(x + 12, y - 7, 5, 3, '#b06a42');
    CIR(x + 14, y - 9, 2, '#4a9a54');
  },

  stringlights(o, t, th) {
    const x = o.x * TILE, y = o.y * TILE, w = o.w * TILE;
    // kabel melengkung
    ctx.fillStyle = '#2a2438';
    for (let i = 0; i <= w; i += 3) {
      const yy = y + 8 + Math.round(Math.abs(Math.sin(Math.PI * i / (w / 4))) * 4);
      ctx.fillRect(x + i, yy, 2, 2);
    }
    // bohlam warna berkedip
    const cols = ['#ff6a5a', '#ffd75e', '#5adf8a', '#5ab0ff'];
    for (let i = 12; i < w - 8; i += 24) {
      const yy = y + 8 + Math.round(Math.abs(Math.sin(Math.PI * i / (w / 4))) * 4);
      const c = cols[(i / 24) % 4 | 0];
      const tw = 0.55 + 0.45 * Math.sin(t * 3 + i);
      CIR(x + i, yy + 4, 2, c);
      ctx.fillStyle = 'rgba(255,255,240,' + (0.5 * tw) + ')';
      ctx.fillRect(x + i - 1, yy + 3, 1, 1);
      ctx.fillStyle = c;
      ctx.fillRect(x + i - 1, yy + 2, 3, 2);
    }
  }
};

/* titik glow per tipe objek (untuk pass pencahayaan) */
function objectGlows(o, t, th) {
  const cx = (o.x + o.w / 2) * TILE, top = o.y * TILE;
  switch (o.type) {
    case 'desk':    return [{ x: cx + 14, y: top - 6, r: 40, c: '255,200,110', a: .10 }];
    case 'floorlamp': return [{ x: cx, y: top + 14, r: 34, c: '255,200,110', a: .12 }];
    case 'window':  return [{ x: cx, y: top + 16, r: 60, c: th.glowWindow || '255,200,140', a: .10 }];
    case 'machine': return [{ x: cx - 8, y: top + 22, r: 44, c: '74,230,138', a: .12 }];
    case 'exitdoor':return [{ x: cx, y: top + 12, r: 40, c: '255,214,140', a: .10 }];
    case 'computer':return [{ x: cx, y: top + 16, r: 36, c: '74,230,216', a: .10 }];
    case 'tank':    return [{ x: cx, y: top + 44, r: 44, c: '58,220,170', a: .09 }];
    case 'electricbox': return [{ x: cx, y: top + 12, r: 30, c: '255,90,74', a: .10 }];
    case 'stringlights':
      return [0, 1, 2, 3].map(i => ({
        x: (o.x * TILE) + 12 + i * 24 + 12, y: top + 14, r: 14,
        c: ['255,106,90', '255,215,94', '90,223,138', '90,176,255'][i],
        a: .10 + 0.04 * Math.sin(t * 3 + i * 2)
      }));
    default: return [];
  }
}
