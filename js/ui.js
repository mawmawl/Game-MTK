'use strict';
/* ============================================================
   KURIR SANDI — ui.js
   HUD, dialog, jurnal, panel mesin enkripsi, ketik kurir, pause.
   UI digambar di canvas; tombol bisa diklik mouse atau dinavigasi keyboard.
   ============================================================ */

const UI = {
  buttons: [], hovering: false,
  begin() { this.buttons = []; this.hovering = false; if (typeof vkeys !== 'undefined') vkeys.length = 0; },
  reg(x, y, w, h, cb, label) { this.buttons.push({ x, y, w, h, cb, label }); },
  inside(b) { return Input.mouse.x >= b.x && Input.mouse.x <= b.x + b.w && Input.mouse.y >= b.y && Input.mouse.y <= b.y + b.h; },
  process() {
    if (!Input.mouse.clicked) return false;
    for (const b of this.buttons) {
      if (this.inside(b)) { SFX.uiSelect(); b.cb(); return true; }
    }
    return false;
  }
};

/* ---------- Salin ke clipboard (dengan fallback) ---------- */
function copyText(str) {
  const done = () => { window.__copiedT = performance.now(); SFX.sparkle(); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(str).then(done).catch(() => fallbackCopy(str, done));
  } else fallbackCopy(str, done);
}
function fallbackCopy(str, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = str;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    done();
  } catch (e) { /* lingkungan tanpa clipboard: abaikan */ }
}
function copiedRecently() { return window.__copiedT && performance.now() - window.__copiedT < 1500; }

/* ---------- Penyesuaian huruf agar teks selalu muat (sandi = satu kata panjang) ---------- */
/* pilih ukuran huruf terbesar dari daftar yang masih muat dalam maxW */
function fitFont(str, sizes, maxW, fontFn) {
  ctx.save();
  let pick = sizes[sizes.length - 1];
  for (const s of sizes) {
    ctx.font = fontFn(s);
    if (ctx.measureText(String(str)).width <= maxW) { pick = s; break; }
  }
  ctx.restore();
  return pick;
}
/* bungkus teks; token yang lebih panjang dari maxW dipotong paksa (sandi tanpa spasi) */
function wrapHard(str, font, maxW) {
  const out = [];
  ctx.save();
  ctx.font = font;
  let cur = '';
  for (const ch of String(str)) {
    const test = cur + ch;
    if (cur && ctx.measureText(test).width > maxW) { out.push(cur); cur = ch; }
    else cur = test;
  }
  if (cur) out.push(cur);
  ctx.restore();
  return out;
}

/* ---------- Panel & tombol bergaya pixel premium ---------- */
function panel(x, y, w, h, o = {}) {
  const acc = o.accent || '#e8c04a';
  R(x - 3, y - 3, w + 6, h + 6, 'rgba(8,7,18,0.82)');
  R(x, y, w, h, o.bg || '#181430');
  O(x, y, w, h, '#3a2f66');
  O(x - 1, y - 1, w + 2, h + 2, '#0c0a18');
  O(x + 2, y + 2, w - 4, h - 4, 'rgba(120,100,220,0.25)');
  R(x, y, w, 2, acc + '88');
  R(x, y + h - 2, w, 2, acc + '44');
  if (o.title) {
    txt(o.title, x + w / 2, y + 18, { font: FONT_PS(9), color: acc, align: 'center', shadow: 'rgba(0,0,0,.7)' });
    R(x + 12, y + 26, w - 24, 1, 'rgba(120,100,220,0.35)');
  }
  if (o.close) {
    // tombol silang di sudut kanan atas (area sentuh diperbesar di mode mobile)
    const bx = x + w - 24, by = y + 6;
    const hov = Input.mouse.x >= bx && Input.mouse.x <= bx + 16 && Input.mouse.y >= by && Input.mouse.y <= by + 16;
    R(bx, by, 16, 16, hov ? '#5a2c3a' : '#221c44');
    O(bx, by, 16, 16, hov ? '#ff8a8a' : '#6a5aa8');
    ctx.strokeStyle = hov ? '#ffd0d0' : '#c8c2e8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx + 5, by + 5); ctx.lineTo(bx + 11, by + 11);
    ctx.moveTo(bx + 11, by + 5); ctx.lineTo(bx + 5, by + 11);
    ctx.stroke();
    const pad = TOUCH ? 15 : 3;
    UI.reg(bx - pad, by - pad, 16 + pad * 2, 16 + pad * 2, o.close);
  }
}
function button(x, y, w, h, label, cb, o = {}) {
  const focused = o.focused;
  const bg = focused ? '#2c2454' : '#1c1738';
  R(x + 2, y + 3, w, h, 'rgba(0,0,0,0.5)');
  R(x, y, w, h, bg);
  O(x, y, w, h, focused ? '#ffd75e' : '#4a3f86');
  R(x, y, w, 1, focused ? '#fff2c8' : '#5c50a0');
  txt(label, x + w / 2, y + h / 2 + 1, {
    font: FONT_PS(o.size || 8), color: focused ? '#ffe9a8' : '#c8c2e8',
    align: 'center', baseline: 'middle', shadow: 'rgba(0,0,0,.8)'
  });
  if (focused && Math.sin(performance.now() / 200) > 0) txt('>', x - 12, y + h / 2, { font: FONT_PS(8), color: '#ffd75e', align: 'center', baseline: 'middle' });
  UI.reg(x - 4, y - 4, w + 8, h + 8, cb, label);
}
function drawTextInput(x, y, w, h, value, focused, o = {}) {
  R(x + 2, y + 3, w, h, 'rgba(0,0,0,0.55)');
  R(x, y, w, h, focused ? '#221c44' : '#161230');
  O(x, y, w, h, focused ? '#ffd75e' : '#3a2f66');
  R(x + 2, y + 2, w - 4, 1, 'rgba(120,100,220,0.2)');
  const caret = focused && (performance.now() / 400 % 1) < 0.5 ? '|' : '';
  txt(value + caret, x + 10, y + h / 2 + 1, {
    font: FONT_VT(o.size || 22), color: o.color || '#e8e4ff',
    baseline: 'middle', shadow: 'rgba(0,0,0,.6)'
  });
}

/* ---------- HUD ---------- */
function drawHUD(L) {
  const def = L.def;
  // panel objektif kiri atas
  const objs = [
    ['Temukan pesan', L.found.message],
    ['Temukan fungsi', L.found.note],
    ['Enkripsi pesan', L.found.enc],
    ['Serahkan ke kurir', L.delivered]
  ];
  const rowH = 17, W = 170, H = 30 + objs.length * rowH;
  R(8, 8, W, H, 'rgba(10,8,24,0.74)');
  O(8, 8, W, H, 'rgba(140,120,230,0.4)');
  O(9, 9, W - 2, H - 2, 'rgba(20,16,44,0.9)');
  R(8, 8, W, 2, 'rgba(232,192,74,0.6)');
  txt('OBJEKTIF', 17, 24, { font: FONT_PS(7), color: '#e8c04a' });
  txt(def.name.toUpperCase(), 8 + W - 10, 24, { font: FONT_VT(14), color: '#8f88c0', align: 'right' });
  R(16, 30, W - 16, 1, 'rgba(140,120,230,0.35)');
  objs.forEach((ob, i) => {
    const y = 38 + i * rowH;
    R(16, y, 10, 10, ob[1] ? '#e8c04a' : 'rgba(255,255,255,0.08)');
    O(16, y, 10, 10, ob[1] ? '#fff0c0' : 'rgba(255,255,255,0.35)');
    if (ob[1]) { R(18, y + 4, 2, 4, '#1a1408'); R(20, y + 6, 5, 2, '#1a1408'); }
    txt(ob[0], 33, y + 10, { font: FONT_VT(15), color: ob[1] ? '#8f88c0' : '#e8e4ff' });
  });
  // panel kanan: waktu + tertangkap
  R(VW - 150, 8, 142, 40, 'rgba(10,8,24,0.74)');
  O(VW - 150, 8, 142, 40, 'rgba(140,120,230,0.4)');
  R(VW - 150, 8, 142, 2, 'rgba(232,192,74,0.6)');
  CIR(VW - 134, 21, 6, '#e8c04a'); CIR(VW - 134, 21, 5, '#181430');
  R(VW - 135, 16, 1, 5, '#e8c04a'); R(VW - 134, 20, 3, 1, '#e8c04a');
  txt(fmtTime(L.timer), VW - 122, 25, { font: FONT_PS(8), color: '#fff' });
  txt('MATA-MATA', VW - 142, 41, { font: FONT_VT(13), color: '#8a84b8' });
  // hanya 3 titik tersedia; lebih dari itu ditampilkan sebagai "+N"
  const shownCatches = Math.min(L.catches, 3);
  for (let i = 0; i < 3; i++) {
    const filled = i < shownCatches;
    CIR(VW - 68 + i * 14, 38, 5, filled ? '#ff5a5a' : 'rgba(255,255,255,0.12)');
    if (filled) { R(VW - 69 + i * 14, 37, 3, 1, '#7a1a1a'); R(VW - 68 + i * 14, 36, 1, 3, '#7a1a1a'); }
  }
  if (L.catches > 3)
    txt('+' + (L.catches - 3), VW - 14, 43, { font: FONT_VT(13), color: '#ff8a7a', align: 'right' });
}

/* ---------- Petunjuk interaksi & panah objektif ---------- */
function drawPrompt(label) {
  ctx.font = FONT_VT(17);
  const bw = ctx.measureText(label).width + 44;
  const x = VW / 2 - bw / 2, y = VH - 46;
  R(x, y, bw, 26, 'rgba(10,8,22,0.78)');
  O(x, y, bw, 26, '#e8c04a');
  R(x + 4, y + 4, 18, 18, '#2c2454'); O(x + 4, y + 4, 18, 18, '#ffd75e');
  txt('E', x + 13, y + 13, { font: FONT_PS(8), color: '#ffe9a8', align: 'center', baseline: 'middle' });
  txt(label, x + 30, y + 13, { font: FONT_VT(17), color: '#f0ecff', baseline: 'middle' });
}
function drawArrowHint(wx, wy, t, label) {
  // koordinat dunia -> layar (bug lama: lupa mengurangi kamera)
  const cx = Math.round(Camera.x + Camera.ox), cy = Math.round(Camera.y + Camera.oy);
  let sx = wx - cx, sy = wy - cy;
  const onScreen = sx > 30 && sx < VW - 30 && sy > 34 && sy < VH - 30;
  const bob = Math.sin(t * 4) * 3;
  if (onScreen) {
    // panah mantul di atas target, menunjuk ke bawah
    const yy = Math.round(sy + bob);
    ctx.save();
    ctx.translate(Math.round(sx), yy);
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath();
    ctx.moveTo(0, 10); ctx.lineTo(-8, -2); ctx.lineTo(-3, -2); ctx.lineTo(-3, -10);
    ctx.lineTo(3, -10); ctx.lineTo(3, -2); ctx.lineTo(8, -2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#8a6a10'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    txt(label, sx, yy - 20, { font: FONT_VT(15), color: '#ffe9a8', align: 'center', shadow: 'rgba(0,0,0,.8)' });
  } else {
    // target di luar layar: penunjuk di tepi mengarah ke target
    sx = clamp(sx, 28, VW - 28);
    sy = clamp(sy, 44, VH - 44);
    const ang = Math.atan2(wy - cy - sy, wx - cx - sx);
    ctx.save();
    ctx.translate(Math.round(sx), Math.round(sy));
    ctx.rotate(ang - Math.PI / 2);
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath();
    ctx.moveTo(0, 12); ctx.lineTo(-8, 0); ctx.lineTo(8, 0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#8a6a10'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    txt(label, sx, sy + 26, { font: FONT_VT(15), color: '#ffe9a8', align: 'center', shadow: 'rgba(0,0,0,.8)' });
  }
}

/* ---------- Dialog ---------- */
function drawDialogBox(d) {
  const x = 40, w = VW - 80, h = 78, y = VH - h - 14;
  panel(x, y, w, h, { accent: d.accent || '#e8c04a', close: () => { L.dialog = null; SFX.uiBack(); } });
  if (d.name) {
    R(x + 14, y - 9, ctx.measureText(d.name).width + 26, 0, 'transparent');
    ctx.font = FONT_PS(8);
    const nw = ctx.measureText(d.name).width + 24;
    R(x + 14, y - 10, nw, 20, '#2c2454');
    O(x + 14, y - 10, nw, 20, '#6a5aa8');
    txt(d.name, x + 26, y + 4, { font: FONT_PS(8), color: '#ffe9a8', baseline: 'middle' });
  }
  const lines = wrap(d.shown, FONT_VT(19), w - 36);
  lines.forEach((ln, i) => txt(ln, x + 18, y + 38 + i * 20, { font: FONT_VT(19), color: '#f0ecff' }));
  if (d.done) {
    const a = (performance.now() / 400 % 1) < 0.5 ? 1 : 0.25;
    txt('E ▸', x + w - 14, y + h - 12, { font: FONT_PS(7), color: '#e8c04a', align: 'right', alpha: a });
  }
}

/* ---------- Jurnal (TAB) ---------- */
function iconEnvelope(x, y, c) {
  R(x, y, 18, 12, c);
  O(x, y, 18, 12, 'rgba(0,0,0,0.4)');
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 9, y + 7); ctx.lineTo(x + 18, y); ctx.stroke();
}
function iconFx(x, y, c) {
  txt('ƒ', x + 4, y + 13, { font: FONT_VT(16), color: c });
  txt('x', x + 11, y + 13, { font: FONT_VT(13), color: c });
}
function iconLock(x, y, c) {
  R(x + 3, y + 6, 12, 10, c);
  ctx.strokeStyle = c;
  ctx.beginPath(); ctx.arc(x + 9, y + 6, 4, Math.PI, 0); ctx.stroke();
  R(x + 8, y + 9, 2, 4, '#1a1428');
}
function drawJournal(L) {
  const w = 320, h = VH - 30, x = VW - w - 8, y = 15;
  const slide = L.journalA ?? 1;
  const jx = x + (1 - slide) * 60;
  panel(jx, y, w, h, { title: 'JURNAL AGEN', accent: '#e8c04a', bg: '#1a1532', close: () => { L.journal = false; SFX.uiBack(); } });

  // ukuran huruf sandi menyesuaikan LEBAR terukurnya (sandi tidak punya spasi,
  // jadi wrap biasa tidak bisa memotongnya), lalu tingginya ikut jumlah baris
  const avail = w - 36;                                   // kotak dalam dikurangi padding kiri
  const efsz = L.encrypted ? fitFont(L.encrypted, [22, 20, 18, 17, 16, 15, 14], avail, FONT_VT) : 22;
  const encLines = L.encrypted ? wrapHard(L.encrypted, FONT_VT(efsz), avail) : [];

  const sections = [
    { title: 'PESAN RAHASIA', hh: 70, fsz: 19, col: '#f0ecff', body: '', ok: false },
    { title: 'CATATAN FUNGSI', hh: 70, fsz: 19, col: '#f0ecff',
      body: L.found.note ? Crypto.fmtFn(L.a, L.b) : 'Belum ditemukan...', ok: L.found.note,
      hint: 'Cari kertas catatan tersembunyi' },
    { title: 'TEKS TERENKRIPSI', hh: L.encrypted ? Math.max(70, 36 + encLines.length * (efsz + 4)) : 70,
      fsz: efsz, col: '#7ae68a', body: L.encrypted || '???', ok: !!L.encrypted,
      hint: 'Gunakan mesin enkripsi' }
  ];
  sections[0].body = L.found.message ? '\u201c' + L.message + '\u201d' : 'Belum ditemukan...';
  sections[0].ok = L.found.message;
  sections[0].hint = 'Periksa objek di ruangan [E]';

  let sy = y + 40;
  sections.forEach((s, i) => {
    const hh = s.hh;
    R(jx + 12, sy, w - 24, hh, 'rgba(120,100,220,0.10)');
    O(jx + 12, sy, w - 24, hh, 'rgba(120,100,220,0.22)');
    if (i === 0) iconEnvelope(jx + 18, sy + 4, '#e8c04a');
    else if (i === 1) iconFx(jx + 18, sy + 4, '#7ae68a');
    else iconLock(jx + 18, sy + 4, '#7ac8ff');
    txt(s.title, jx + 44, sy + 16, { font: FONT_PS(7), color: s.ok ? '#ffe9a8' : '#8a84b8' });
    const col = s.ok ? s.col : '#6a6494';
    const lines = wrap(s.body, FONT_VT(s.fsz), w - (s.ok && i === 2 ? 116 : 60));
    lines.forEach((ln, li) =>
      txt(ln, jx + 24, sy + 40 + li * (s.fsz + 4), { font: FONT_VT(s.fsz), color: col }));
    if (!s.ok) txt(s.hint, jx + 24, sy + hh - 14, { font: FONT_VT(14), color: '#5a5488' });
    if (i === 2 && s.ok) {
      const bw = TOUCH ? 84 : 66, bh = TOUCH ? 30 : 22;
      button(jx + w - bw - 18, sy + 8, bw, bh, copiedRecently() ? '\u2713' : 'SALIN', () => copyText(L.encrypted), { size: 6 });
    }
    sy += hh + 8;
  });
  if (TOUCH) button(jx + w / 2 - 80, y + h - 44, 160, 32, 'TUTUP', () => { L.journal = false; SFX.uiBack(); }, { size: 7 });
  else txt('TAB — tutup jurnal', jx + w / 2, y + h - 12, { font: FONT_VT(14), color: '#8a84b8', align: 'center' });
}

/* ---------- Panel Mesin Enkripsi ---------- */
function drawMachineUI(M) {
  if (TOUCH) { drawMachineTouch(M); return; }
  const w = 360, h = 236, x = VW / 2 - w / 2, y = VH / 2 - h / 2 - 8;
  panel(x, y, w, h, { title: '\u2699 MESIN ENKRIPSI \u2699', accent: '#7ae68a', bg: '#141a2c', close: () => { M.open = false; SFX.uiBack(); } });
  // alur vertikal: mulai di bawah judul, setiap elemen menempel posisi elemen sebelumnya
  let cy = y + 40;

  if (M.phase === 'input') {
    txt('Masukkan parameter sesuai catatan fungsi:', x + w / 2, cy + 6, { font: FONT_VT(16), color: '#a8c8d8', align: 'center' });
    cy += 20;
    const fields = [['a', M.fa], ['b', M.fb]];
    fields.forEach((f, fi) => {
      const fy = cy + fi * 40;
      const focused = M.focus === f[0];
      txt(f[0] + ' =', x + 80, fy + 15, { font: FONT_PS(9), color: '#ffe9a8', align: 'right', baseline: 'middle' });
      drawTextInput(x + 92, fy, 130, 30, f[1], focused, { color: '#7ae68a' });
      if (focused) txt('\u25c0 tulis angka', x + 232, fy + 15, { font: FONT_VT(14), color: '#8a84b8', baseline: 'middle' });
    });
    cy += 40 + 40 + 8;
    button(x + 40, cy, 130, 30, 'ENKRIPSI', () => submitMachine(M), { focused: M.focus === 'go' });
    button(x + 190, cy, 130, 30, 'BATAL', () => { M.open = false; SFX.uiBack(); }, { focused: M.focus === 'cancel' });
    cy += 38;
    if (M.msg) txt(M.msg.text, x + w / 2, cy + 4, { font: FONT_VT(16), color: M.msg.c, align: 'center', maxWidth: w - 40 });
    txt('\u2191\u2193 pilih \u2022 0-9 isi \u2022 Enter: jalankan \u2022 Esc: tutup', x + w / 2, y + h - 10, { font: FONT_VT(13), color: '#5a5488', align: 'center' });

  } else if (M.phase === 'work') {
    const p = 1 - M.workT / 1.6;
    txt('MENGENKRIPSI' + '.'.repeat(1 + Math.floor(performance.now() / 300) % 3), x + w / 2, cy + 10, { font: FONT_PS(8), color: '#7ae68a', align: 'center' });
    cy += 26;
    R(x + 40, cy, w - 80, 18, '#0d1a24');
    O(x + 40, cy, w - 80, 18, '#2a4a3a');
    R(x + 43, cy + 3, (w - 86) * easeOutCubic(clamp(p, 0, 1)), 12, '#4ae68a');
    cy += 34;
    for (let i = 0; i < 6; i++) {
      const a = performance.now() / 130 + i;
      R(x + w / 2 + Math.cos(a) * 40 - 2, cy + Math.sin(a) * 8 - 2, 4, 4, '#4ae68a');
    }
    cy += 26;
    txt('memproses setiap huruf...', x + w / 2, cy, { font: FONT_VT(15), color: '#5a76a8', align: 'center' });

  } else if (M.phase === 'result') {
    // ukuran huruf menyesuaikan lebar terukur agar sandi panjang tidak keluar kotak
    const fsz = fitFont(M.resultText, [24, 22, 20, 18, 17, 16, 15, 14], w - 70, FONT_VT);
    const lines = wrapHard(M.resultText, FONT_VT(fsz), w - 70);
    const boxH = 18 + lines.length * (fsz + 4);
    R(x + 30, cy, w - 60, boxH, '#0d2a1c');
    O(x + 30, cy, w - 60, boxH, '#2a6a4a');
    lines.forEach((ln, i) =>
      txt(ln, x + w / 2, cy + 18 + i * (fsz + 4), { font: FONT_VT(fsz), color: '#7ae68a', align: 'center' }));
    cy += boxH + 16;
    txt('\u2714 TERSIMPAN DI JURNAL [TAB]', x + w / 2, cy, { font: FONT_PS(8), color: '#ffe9a8', align: 'center' });
    cy += 12;
    // tombol salin di tengah, teks berikutnya di bawahnya (tidak saling menimpa)
    button(x + w / 2 - 70, cy, 140, 26, copiedRecently() ? '\u2713 TERSALIN' : 'SALIN TEKS', () => copyText(M.resultText), { size: 7 });
    cy += 34;
    txt('Antar teks ini ke kurir di dekat pintu!', x + w / 2, cy, { font: FONT_VT(16), color: '#a8c8d8', align: 'center' });
    txt('Esc \u2014 tutup', x + w / 2, y + h - 10, { font: FONT_VT(13), color: '#5a5488', align: 'center' });
  }
}

/* ---------- Panel Ketik ke Kurir ---------- */
function drawCourierUI(C) {
  if (TOUCH) { drawCourierTouch(C); return; }
  const w = 520, h = 172, x = VW / 2 - w / 2, y = VH - h - 14;
  const shakeX = C.shakeT > 0 ? Math.sin(C.shakeT * 60) * 3 * C.shakeT : 0;
  panel(x + shakeX, y, w, h, { title: '📮 KURIR SURAT', accent: '#e8a44a', bg: '#20182c', close: () => { C.open = false; SFX.uiBack(); } });
  txt('Serahkan teks terenkripsinya (persis seperti di jurnal):', x + w / 2, y + 40, { font: FONT_VT(16), color: '#d8c8b8', align: 'center' });
  // huruf menyesuaikan lebar terukur (sandi = satu kata panjang tanpa spasi)
  const shown = C.value || L.encrypted || '';
  const csize = fitFont(shown, [24, 22, 20, 18, 17, 16, 15, 14], w - 70, FONT_VT);
  drawTextInput(x + 24, y + 50, w - 48, 34, C.value, true, { color: '#ffe9a8', size: csize });
  if (C.msg) txt(C.msg.text, x + 26, y + 100, { font: FONT_VT(16), color: C.msg.c });
  txt(C.value.length + ' / ' + (L.encrypted ? L.encrypted.length : 0) + ' huruf', x + w - 26, y + 100, { font: FONT_VT(14), color: '#8a84b8', align: 'right' });
  button(x + 26, y + 112, 152, 28, 'ISI OTOMATIS', () => { C.value = L.encrypted || ''; C.msg = null; SFX.paper(); }, { size: 7 });
  button(x + 190, y + 112, 118, 28, 'HAPUS', () => { C.value = ''; SFX.uiBack(); }, { size: 7 });
  button(x + 320, y + 112, 174, 28, 'KIRIM (ENTER)', () => submitCourier(C), { size: 7 });
  txt('Esc: batal • TAB: lihat jurnal', x + w / 2, y + h - 10, { font: FONT_VT(13), color: '#5a5488', align: 'center' });
}

/* ---------- Menu Pause ---------- */
function drawPauseMenu(P) {
  const w = 280, h = 210, x = VW / 2 - w / 2, y = VH / 2 - h / 2;
  panel(x, y, w, h, { title: 'JEDA', accent: '#e8c04a', bg: '#181430', close: () => pauseAction(0) });
  const opts = ['LANJUT', 'ULANG LEVEL', 'SUARA: ' + (Snd.muted ? 'MATI' : 'NYALA'), 'MENU UTAMA'];
  opts.forEach((o, i) => {
    button(x + 40, y + 40 + i * 40, w - 80, 30, o, () => pauseAction(i), { focused: P.idx === i });
  });
}

/* ============================================================
   MODE SENTUH (HP / tablet)
   Joystick, tombol aksi, dan keypad layar. Semua kendali di sini
   masuk lewat jalur input yang sama dengan keyboard
   (Input.pressed / Input.charQueue) sehingga logika game tidak
   perlu tahu bedanya.
   ============================================================ */
const vkeys = [];   // tombol layar pada frame ini (dibersihkan UI.begin)

/* tombol layar: digambar + didaftarkan; disentuh -> langsung aksi */
function vbutton(x, y, w, h, label, act, o = {}) {
  const acc = o.accent || '#4a3f86';
  R(x + 1, y + 2, w, h, 'rgba(0,0,0,0.45)');
  R(x, y, w, h, o.focused ? '#2c2454' : (o.bg || '#1c1738'));
  O(x, y, w, h, o.focused ? '#ffd75e' : acc);
  R(x, y, w, 1, o.focused ? '#fff2c8' : 'rgba(255,255,255,0.16)');
  if (o.icon) o.icon(x, y, w, h, o.focused ? '#ffd75e' : (o.iconColor || acc));
  else txt(label, x + w / 2, y + h / 2 + 1, {
    font: o.font || FONT_PS(o.size || 8),
    color: o.color || (o.focused ? '#ffe9a8' : '#c8c2e8'),
    align: 'center', baseline: 'middle', shadow: 'rgba(0,0,0,.8)'
  });
  vkeys.push({ x, y, w, h, label, act });
}

/* ---- ikon pixel untuk tombol layar ---- */
function iconBag(x, y, w, h, c) {          // tas agen (jurnal)
  const cx = x + w / 2, top = y + 9;
  ctx.strokeStyle = c; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, top + 7, 6, Math.PI, 0); ctx.stroke();   // pegangan
  R(cx - 12, top + 7, 24, 16, '#241d44');
  R(cx - 11, top + 8, 22, 14, '#2f2758');
  O(cx - 12, top + 7, 24, 16, c);
  R(cx - 12, top + 12, 24, 2, c);                                       // tali flap
  R(cx - 4, top + 16, 8, 5, '#241d44'); O(cx - 4, top + 16, 8, 5, c);    // kunci
}
function iconPause(x, y, w, h, c) {        // jeda
  const cx = x + w / 2, cy = y + h / 2;
  R(cx - 8, cy - 9, 6, 18, c);
  R(cx + 2, cy - 9, 6, 18, c);
}

/* tabrakan jari <-> tombol layar (dipanggil engine saat touchstart) */
function hitVKey(x, y) {
  for (let i = vkeys.length - 1; i >= 0; i--) {
    const b = vkeys[i];
    if (x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4) {
      SFX.uiSelect();
      b.act();
      return true;
    }
  }
  return false;
}

const TouchUI = {
  cap: false,        // ⇧ huruf kapital di keypad
  hintOff: false,    // pemain memilih tetap main walau potret
  get portrait() { return TOUCH && window.innerHeight > window.innerWidth; },
  get blocking() { return this.portrait && !this.hintOff; },
  /* telan input frame ini supaya ketukan untuk menutup petunjuk tidak
     ikut menekan tombol di belakangnya */
  consume() { Input.mouse.clicked = false; Input.pressed.clear(); Input.charQueue.length = 0; },
  drawHint() {
    ctx.fillStyle = 'rgba(6,5,14,0.94)';
    ctx.fillRect(0, 0, VW, VH);
    txt('PUTAR LAYAR', VW / 2, 74, { font: FONT_PS(16), color: '#ffd75e', align: 'center', shadow: 'rgba(0,0,0,.8)' });
    txt('Game ini paling nyaman dalam posisi mendatar', VW / 2, 96, { font: FONT_VT(19), color: '#c8c2f0', align: 'center' });
    // HP tegak -> HP mendatar
    ctx.save();
    ctx.translate(VW / 2 - 54, 186);
    R(-22, -38, 44, 76, '#1c1738'); O(-22, -38, 44, 76, '#6a5aa8');
    R(-17, -31, 34, 54, '#2c2454');
    ctx.restore();
    ctx.save();
    ctx.translate(VW / 2 + 54, 186);
    ctx.rotate(-Math.PI / 2 + Math.sin(performance.now() / 420) * 0.14);
    R(-22, -38, 44, 76, '#1c1738'); O(-22, -38, 44, 76, '#ffd75e');
    R(-17, -31, 34, 54, '#2c2454');
    R(-17, 17, 34, 6, '#4a3f86');
    ctx.restore();
    txt('ketuk layar untuk tetap main dalam posisi tegak', VW / 2, 268,
        { font: FONT_VT(16), color: '#8a84b8', align: 'center' });
    txt('kendali sentuh: joystick kiri-bawah • E • JURNAL • JEDA', VW / 2, 296,
        { font: FONT_VT(16), color: '#6a6494', align: 'center' });
  }
};

/* gelembung "periksa": hanya muncul saat pemain mendekati benda,
   melayang tepat di atas bendanya — ketuk untuk berinteraksi */
function drawInteractPopup(L) {
  const o = L.near;
  const label = o.type === 'machine' ? 'Gunakan Mesin'
    : o.type === 'courier' ? 'Bicara Kurir'
    : (o.searched ? 'Periksa lagi ' : 'Periksa ') + (o.label || 'objek');
  ctx.save();
  ctx.font = FONT_VT(17);
  const tw = ctx.measureText(label).width;
  ctx.restore();
  const bw = Math.min(252, Math.max(126, Math.round(tw) + 58)), bh = 38;
  const cxw = (o.x + o.w / 2) * TILE, cyw = o.y * TILE + 2;
  const sx = clamp(Math.round(cxw - Camera.x - Camera.ox), bw / 2 + 10, VW - bw / 2 - 10);
  // utamakan di atas benda; kalau tidak muat (benda di tepi atas), pindah ke bawah benda
  const objTop = Math.round(cyw - Camera.y - Camera.oy);
  const objBot = Math.round((o.y + o.h) * TILE - Camera.y - Camera.oy);
  let below = false;
  let sy = objTop - 52;
  if (sy < 74) { below = true; sy = Math.min(objBot + 52, VH - 72); }
  // jaga agar area ketuk gelembung tidak menutupi ikon tas/jeda di baris atas (y 8..48)
  sy = Math.max(sy, 79);
  const bx = Math.round(sx - bw / 2), by = sy - bh / 2;
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
  R(bx + 2, by + 3, bw, bh, 'rgba(0,0,0,0.5)');
  R(bx, by, bw, bh, 'rgba(24,20,48,0.94)');
  O(bx, by, bw, bh, '#ffd75e');
  R(bx, by, bw, 2, 'rgba(255,242,200,' + (0.5 + 0.5 * pulse).toFixed(2) + ')');
  // panah kecil menunjuk benda (arah menyesuaikan posisi gelembung)
  ctx.fillStyle = '#ffd75e';
  if (below) {
    R(sx - 7, by - 7, 14, 7, 'rgba(24,20,48,0.94)');
    ctx.beginPath();
    ctx.moveTo(sx - 7, by - 1); ctx.lineTo(sx + 7, by - 1); ctx.lineTo(sx, by - 9);
    ctx.closePath(); ctx.fill();
  } else {
    R(sx - 7, by + bh, 14, 7, 'rgba(24,20,48,0.94)');
    ctx.beginPath();
    ctx.moveTo(sx - 7, by + bh + 1); ctx.lineTo(sx + 7, by + bh + 1); ctx.lineTo(sx, by + bh + 9);
    ctx.closePath(); ctx.fill();
  }
  // chip E + label
  R(bx + 9, by + 9, 20, 20, '#2c2454'); O(bx + 9, by + 9, 20, 20, '#ffd75e');
  txt('E', bx + 19, by + 20, { font: FONT_PS(8), color: '#ffe9a8', align: 'center', baseline: 'middle' });
  txt(label, bx + 36, by + 20, { font: FONT_VT(17), color: '#f0ecff', baseline: 'middle' });
  vkeys.push({ x: bx - 8, y: by - 8, w: bw + 16, h: bh + 24, label: 'E', act: () => Input.vkey('e') });
}

/* joystick + tombol ikon (jurnal & jeda di atas) */
function drawTouchControls(L) {
  const J = Input.touchUI;
  const active = J.joyId !== null;
  const cx = active ? J.baseX + J.kx : J.baseX;
  const cy = active ? J.baseY + J.ky : J.baseY;
  ctx.save();
  ctx.globalAlpha = active ? 0.9 : 0.55;
  ctx.beginPath(); ctx.arc(J.baseX, J.baseY, 46, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10,8,24,0.5)'; ctx.fill();
  ctx.strokeStyle = '#6a5aa8'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  ctx.fillStyle = active ? '#4a3f86' : 'rgba(74,63,134,0.5)'; ctx.fill();
  ctx.strokeStyle = active ? '#ffd75e' : '#8a7ad0'; ctx.lineWidth = 2; ctx.stroke();
  ctx.globalAlpha = active ? 0.5 : 0.3;
  R(J.baseX - 16, J.baseY - 1, 10, 2, '#c8c2e8');
  R(J.baseX + 6, J.baseY - 1, 10, 2, '#c8c2e8');
  R(J.baseX - 1, J.baseY - 16, 2, 10, '#c8c2e8');
  R(J.baseX - 1, J.baseY + 6, 2, 10, '#c8c2e8');
  ctx.restore();

  if (anyModal() || L.courierLeaving) return;
  // ikon jurnal (tas) & jeda di bagian atas layar
  vbutton(VW / 2 - 52, 8, 48, 40, 'JURNAL', () => Input.vkey('Tab'),
    { icon: iconBag, iconColor: '#7ac8ff', bg: 'rgba(24,20,48,0.82)' });
  vbutton(VW / 2 + 4, 8, 48, 40, 'JEDA', () => Input.vkey('Escape'),
    { icon: iconPause, iconColor: '#e8c04a', bg: 'rgba(24,20,48,0.82)' });
  // periksa: gelembung muncul hanya saat mendekati benda
  if (L.near) drawInteractPopup(L);
}

/* keypad angka untuk mesin enkripsi */
function drawMachineTouch(M) {
  const w = 600, h = 328, x = VW / 2 - w / 2, y = 14;
  panel(x, y, w, h, { title: '\u2699 MESIN ENKRIPSI \u2699', accent: '#7ae68a', bg: '#141a2c',
    close: () => { M.open = false; SFX.uiBack(); } });

  if (M.phase === 'work') {
    const p = 1 - M.workT / 1.6;
    txt('MENGENKRIPSI' + '.'.repeat(1 + Math.floor(performance.now() / 300) % 3), x + w / 2, y + 150,
        { font: FONT_PS(10), color: '#7ae68a', align: 'center' });
    R(x + 60, y + 172, w - 120, 22, '#0d1a24'); O(x + 60, y + 172, w - 120, 22, '#2a4a3a');
    R(x + 64, y + 176, (w - 128) * easeOutCubic(clamp(p, 0, 1)), 14, '#4ae68a');
    txt('memproses setiap huruf...', x + w / 2, y + 226, { font: FONT_VT(17), color: '#5a76a8', align: 'center' });
    return;
  }

  if (M.phase === 'result') {
    const fsz = fitFont(M.resultText, [26, 24, 22, 20, 18, 17, 16, 15, 14], w - 90, FONT_VT);
    const lines = wrapHard(M.resultText, FONT_VT(fsz), w - 90);
    const boxH = 20 + lines.length * (fsz + 6);
    R(x + 40, y + 52, w - 80, boxH, '#0d2a1c'); O(x + 40, y + 52, w - 80, boxH, '#2a6a4a');
    lines.forEach((ln, i) => txt(ln, x + w / 2, y + 74 + i * (fsz + 6),
      { font: FONT_VT(fsz), color: '#7ae68a', align: 'center' }));
    txt('\u2714 TERSIMPAN DI JURNAL', x + w / 2, y + 60 + boxH + 24,
        { font: FONT_PS(8), color: '#ffe9a8', align: 'center' });
    button(x + w / 2 - 150, y + 60 + boxH + 42, 300, 46, copiedRecently() ? '\u2713 TERSALIN' : 'SALIN TEKS',
      () => copyText(M.resultText), { size: 8 });
    txt('Antar sandi ini ke kurir di dekat pintu', x + w / 2, y + h - 60,
        { font: FONT_VT(17), color: '#a8c8d8', align: 'center' });
    button(x + w / 2 - 80, y + h - 46, 160, 34, 'TUTUP', () => { M.open = false; SFX.uiBack(); }, { size: 7 });
    return;
  }

  /* ---- input a & b ---- */
  txt('Masukkan a dan b sesuai catatan fungsi:', x + 30, y + 48, { font: FONT_VT(17), color: '#a8c8d8' });
  const fw = 210;
  [['a', M.fa, x + 108], ['b', M.fb, x + 368]].forEach(([k, v, fx]) => {
    const focused = M.focus === k;
    txt(k + ' =', fx - 10, y + 80, { font: FONT_PS(9), color: '#ffe9a8', align: 'right', baseline: 'middle' });
    drawTextInput(fx, y + 64, fw, 34, v, focused, { color: '#7ae68a' });
    UI.reg(fx - 10, y + 58, fw + 20, 46, () => { M.focus = k; SFX.uiMove(); });   // ketuk untuk pilih
  });

  /* ---- keypad angka 3x4 ---- */
  const kw = 62, kh = 36, gp = 6, kx = x + 34, ky = y + 118;
  [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['-', '0', '\u232b']].forEach((row, r) =>
    row.forEach((k, c) => vbutton(kx + c * (kw + gp), ky + r * (kh + gp), kw, kh, k, () => {
      if (k === '\u232b') Input.vkey('Backspace'); else Input.vkey(k);
    }, { size: k === '\u232b' ? 11 : 13, accent: '#3a2f66' })));

  /* ---- tombol aksi kolom kanan ---- */
  const bx2 = x + 262, bw2 = 300;
  vbutton(bx2, ky, 142, 38, 'a \u21c4 b', () => Input.vkey('ArrowDown'), { size: 8, accent: '#7ac8ff' });
  vbutton(bx2 + 158, ky, 142, 38, 'HAPUS ISI', () => {
    if (M.focus === 'a') M.fa = ''; else M.fb = '';
    SFX.uiBack();
  }, { size: 7, accent: '#c0563f' });
  button(bx2, ky + 46, bw2, 58, 'ENKRIPSI', () => submitMachine(M), { size: 10 });
  button(bx2, ky + 112, bw2, 42, 'BATAL', () => { M.open = false; SFX.uiBack(); }, { size: 8 });
  if (M.msg) txt(M.msg.text, x + w / 2, y + 300, { font: FONT_VT(17), color: M.msg.c, align: 'center', maxWidth: 540 });
  else txt('Ketuk kotak a / b, lalu tekan angka • \u232b hapus', x + w / 2, y + 300,
    { font: FONT_VT(16), color: '#5a5488', align: 'center' });
}

/* papan huruf layar untuk panel kurir */
function drawCourierTouch(C) {
  const w = 620, h = 336, x = VW / 2 - w / 2, y = 12;
  const shakeX = C.shakeT > 0 ? Math.sin(C.shakeT * 60) * 3 * C.shakeT : 0;
  panel(x + shakeX, y, w, h, { title: '\ud83d\udcee KURIR SURAT', accent: '#e8a44a', bg: '#20182c',
    close: () => { C.open = false; SFX.uiBack(); } });
  txt('Ketik persis teks terenkripsi dari jurnal:', x + 30, y + 48, { font: FONT_VT(17), color: '#d8c8b8' });
  const shown = C.value || L.encrypted || '';
  const csize = fitFont(shown, [24, 22, 20, 18, 17, 16, 15, 14], w - 90, FONT_VT);
  drawTextInput(x + 30, y + 56, w - 60, 38, C.value, true, { color: '#ffe9a8', size: csize });
  txt(C.value.length + ' / ' + (L.encrypted ? L.encrypted.length : 0) + ' huruf', x + w - 34, y + 110,
      { font: FONT_VT(15), color: '#8a84b8', align: 'right' });
  if (C.msg) txt(C.msg.text, x + 30, y + 110, { font: FONT_VT(17), color: C.msg.c, maxWidth: 430 });
  else txt('besar / kecil huruf harus persis sama', x + 30, y + 110, { font: FONT_VT(15), color: '#5a5488' });

  /* papan huruf: 3 baris x 9 */
  const rows = ['abcdefghi', 'jklmnopqr', 'stuvwxyz'];
  const kw = 58, kh = 34, gp = 5, kx = x + 29, ky = y + 118;
  rows.forEach((row, r) => {
    for (let c = 0; c < 9; c++) {
      const bx = kx + c * (kw + gp), by = ky + r * (kh + gp);
      if (r === 2 && c === 8) {
        vbutton(bx, by, kw, kh, '\u232b', () => Input.vkey('Backspace'), { size: 11, accent: '#c0563f' });
        continue;
      }
      const ch = row[c];
      const out = TouchUI.cap ? ch.toUpperCase() : ch;
      vbutton(bx, by, kw, kh, out, () => Input.vkey(out),
        { size: 9, accent: TouchUI.cap ? '#e8a44a' : '#4a3f86' });
    }
  });
  const by2 = ky + 3 * (kh + gp) + 4;
  let bx2 = kx;
  vbutton(bx2, by2, 2 * kw + gp, kh, 'SPASI', () => Input.vkey(' '), { size: 7 });
  bx2 += 2 * (kw + gp);
  vbutton(bx2, by2, kw, kh, TouchUI.cap ? 'ABC' : 'abc',
    () => { TouchUI.cap = !TouchUI.cap; SFX.uiMove(); },
    { size: 8, accent: '#7ac8ff', focused: TouchUI.cap });
  bx2 += kw + gp;
  vbutton(bx2, by2, 2 * kw + gp, kh, 'ISI OTOMATIS', () => {
    C.value = L.encrypted || ''; C.msg = null; SFX.paper();
  }, { size: 6, accent: '#e8a44a' });
  bx2 += 2 * (kw + gp);
  vbutton(bx2, by2, kw, kh, 'HAPUS', () => { C.value = ''; SFX.uiBack(); }, { size: 6, accent: '#c0563f' });
  bx2 += kw + gp;
  vbutton(bx2, by2, 2 * kw + gp, kh, '\u23ce KIRIM', () => submitCourier(C), { size: 7, accent: '#7ae68a', color: '#d0ffe0' });
  txt('Ikon tas (jurnal) & jeda ada di bagian atas layar', x + w / 2, y + h - 16,
      { font: FONT_VT(15), color: '#5a5488', align: 'center' });
}
