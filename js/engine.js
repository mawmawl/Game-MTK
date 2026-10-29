'use strict';
/* ============================================================
   SECRET MAIL — engine.js
   Canvas, input, kamera, collision, partikel, audio, teks
   ============================================================ */

const TILE = 32;
let VW = 640, VH = 360;          // lebar internal mengikuti rasio layar (mode layar penuh)
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const uiCanvas = document.getElementById('ui');
const uictx = uiCanvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
let viewScale = 1;

/* Lebar internal = rasio layar x 360. Dibuat adaptif supaya latar & UI
   mengisi seluruh jendela tanpa kotak hitam di pinggir (bukan letterbox).
   Batas 620..1200: di bawah 620 panel UI (kurir 620px) tidak muat,
   di atas 1200 teks jadi terlalu kecil relatif layar. */
function fitView() {
  const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
  VH = 360;
  VW = Math.round(VH * (w / h));
  VW = VW < 620 ? 620 : (VW > 1200 ? 1200 : VW);
  if (VW % 2) VW++;
  canvas.width = VW;
  canvas.height = VH;
  const s = Math.min(w / VW, h / VH);
  viewScale = s;
  canvas.style.width = (VW * s) + 'px';
  canvas.style.height = (VH * s) + 'px';
  // kanvas UI pada resolusi tampilan agar teks tajam (tidak ikut ter-upscale)
  uiCanvas.style.width = canvas.style.width;
  uiCanvas.style.height = canvas.style.height;
  uiCanvas.width = Math.max(1, Math.round(VW * s));
  uiCanvas.height = Math.max(1, Math.round(VH * s));
}
window.addEventListener('resize', fitView);
fitView();

/* bersihkan kanvas UI di awal tiap frame (transform = skala tampilan) */
function uiBegin() {
  uictx.setTransform(1, 0, 0, 1, 0, 0);
  uictx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
  uictx.setTransform(viewScale, 0, 0, viewScale, 0, 0);
}

/* ---------------- Helper umum ---------------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ (x << 13);
  h = (h ^ (h >>> 15)) * 1274126177;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeOutBack = t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
function fmtTime(sec) {
  sec = Math.floor(sec);
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

/* ---------------- RNG (untuk konten level, bisa diberi seed) ---------------- */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let rng = Math.random;               // diganti srand() saat membangun level
function srand(seed) { rng = mulberry32(seed); }
function sri(min, max) { return min + Math.floor(rng() * (max - min + 1)); }
function spick(arr) { return arr[Math.floor(rng() * arr.length)]; }
function sshuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------------- Input ---------------- */
const TOUCH = (('ontouchstart' in window) || ((navigator.maxTouchPoints | 0) > 0)
  || new URLSearchParams(location.search).has('touch'));

const Input = {
  touchUI: {
    joyId: null, baseX: 92, baseY: VH - 92, kx: 0, ky: 0, mag: 0
  },
  down: Object.create(null),
  pressed: new Set(),
  charQueue: [],
  mouse: { x: 0, y: 0, clicked: false },
  init() {
    addEventListener('keydown', e => {
      const k = e.key;
      if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
      if (!e.repeat) {
        this.pressed.add(k);
        if (k.length === 1) this.charQueue.push(k);
        if (k.length === 1) this.pressed.add(k.toLowerCase());
      }
      this.down[k] = true;
      if (k.length === 1) this.down[k.toLowerCase()] = true;
      Snd.unlock();
    }, { passive: false });
    addEventListener('keyup', e => {
      const k = e.key;
      this.down[k] = false;
      if (k.length === 1) this.down[k.toLowerCase()] = false;
    });
    addEventListener('blur', () => { this.down = Object.create(null); });
    canvas.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (VW / r.width);
      this.mouse.y = (e.clientY - r.top) * (VH / r.height);
    });
    canvas.addEventListener('mousedown', () => {
      this.mouse.clicked = true;
      Snd.unlock();
    });
    if (TOUCH) {
      const gameXY = t => {
        const r = canvas.getBoundingClientRect();
        return { x: (t.clientX - r.left) * (VW / r.width), y: (t.clientY - r.top) * (VH / r.height) };
      };
      const handle = e => {
        e.preventDefault(); // cegah scroll/zoom & klik sintetis ganda
        Snd.unlock();
        for (const t of e.changedTouches) {
          const g = gameXY(t);
          this.applyTouch(e.type.slice(5), t.identifier, g.x, g.y);
        }
      };
      canvas.addEventListener('touchstart', handle, { passive: false });
      canvas.addEventListener('touchmove', handle, { passive: false });
      canvas.addEventListener('touchend', handle, { passive: false });
      canvas.addEventListener('touchcancel', handle, { passive: false });
    }
  },
  axis() {
    const d = k => !!(this.down[k] || this.down[k.toLowerCase()]);
    let dx = (d('ArrowRight') || d('D') ? 1 : 0) - (d('ArrowLeft') || d('A') ? 1 : 0);
    let dy = (d('ArrowDown') || d('S') ? 1 : 0) - (d('ArrowUp') || d('W') ? 1 : 0);
    // joystick analog: arah + kekuatan (0..1, zona mati 0.22)
    const J = this.touchUI;
    if (J.mag > 0) {
      const len = Math.hypot(J.kx, J.ky) || 1;
      dx = J.kx / len * J.mag;
      dy = J.ky / len * J.mag;
    } else if (dx !== 0 && dy !== 0) {
      // diagonal keyboard: normalisasi agar tidak 41% lebih cepat
      dx *= Math.SQRT1_2; dy *= Math.SQRT1_2;
    }
    return { dx, dy };
  },
  /* sentuh: dipakai listener TouchEvent & pengujian otomatis */
  applyTouch(type, id, gx, gy) {
    const J = this.touchUI;
    if (type === 'start') {
      // tombol layar (E, jurnal, jeda, keypad) dicek lebih dulu
      if (typeof hitVKey === 'function' && hitVKey(gx, gy)) return;
      // joystick tidak aktif saat panel terbuka (keypad bawah-kiri bisa bentrok)
      const modal = (typeof anyModal === 'function') && anyModal();
      if (!modal && Math.hypot(gx - J.baseX, gy - J.baseY) < 80) { J.joyId = id; this._joyMove(gx, gy); return; }
      // tap = klik mouse (untuk semua tombol UI) + umpan dialog
      this.mouse.x = gx; this.mouse.y = gy; this.mouse.clicked = true;
    } else if (type === 'move') {
      if (id === J.joyId) this._joyMove(gx, gy);
    } else {
      if (id === J.joyId) { J.joyId = null; J.kx = J.ky = 0; J.mag = 0; }
    }
  },
  /* tombol/keypad layar mengirim ke jalur input yang sama dengan keyboard */
  vkey(k) {
    this.pressed.add(k);
    if (k.length === 1) this.charQueue.push(k);
  },
  _joyMove(gx, gy) {
    const J = this.touchUI;
    let dx = gx - J.baseX, dy = gy - J.baseY;
    const d = Math.hypot(dx, dy), R = 46;
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    J.kx = dx; J.ky = dy;
    const m = Math.min(1, d / R);
    J.mag = m < 0.22 ? 0 : (m - 0.22) / (1 - 0.22);
  },
  press(...keys) { return keys.some(k => this.pressed.has(k)); },
  endFrame() { this.pressed.clear(); this.charQueue.length = 0; this.mouse.clicked = false; }
};
Input.init();

/* ---------------- Kamera ---------------- */
const Camera = {
  x: 0, y: 0, ox: 0, oy: 0, shakeT: 0, shakeA: 0,
  /* ruangan yang lebih sempit dari layar diletakkan di tengah
     (bukan menempel kiri) supaya latar terlihat penuh */
  snap(tx, ty, rw, rh) {
    this.x = rw <= VW ? (rw - VW) / 2 : Math.min(Math.max(tx - VW / 2, 0), rw - VW);
    this.y = rh <= VH ? (rh - VH) / 2 : Math.min(Math.max(ty - VH / 2, 0), rh - VH);
  },
  follow(tx, ty, rw, rh, dt) {
    const k = 1 - Math.exp(-dt * 7);
    const ax = rw <= VW ? (rw - VW) / 2 : Math.min(Math.max(tx - VW / 2, 0), rw - VW);
    const ay = rh <= VH ? (rh - VH) / 2 : Math.min(Math.max(ty - VH / 2, 0), rh - VH);
    this.x = lerp(this.x, ax, k);
    this.y = lerp(this.y, ay, k);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const s = this.shakeA * Math.max(0, this.shakeT);
      this.ox = (Math.random() * 2 - 1) * s;
      this.oy = (Math.random() * 2 - 1) * s;
    } else { this.ox = 0; this.oy = 0; }
  },
  shake(a, t) { this.shakeA = a; this.shakeT = t; }
};

/* ---------------- Collision & garis pandang ---------------- */
function collideRect(a, rects) {
  for (const r of rects) {
    if (a.x < r.x + r.w && a.x + a.w > r.x && a.y < r.y + r.h && a.y + a.h > r.y) return r;
  }
  return null;
}
function moveActor(a, rects, dt) {
  const dx = a.vx * dt, dy = a.vy * dt;
  if (dx !== 0) {
    a.x += dx;
    const hit = collideRect(a, rects);
    if (hit) a.x = dx > 0 ? hit.x - a.w : hit.x + hit.w;
  }
  if (dy !== 0) {
    a.y += dy;
    const hit = collideRect(a, rects);
    if (hit) a.y = dy > 0 ? hit.y - a.h : hit.y + hit.h;
  }
}
function pointInRects(x, y, rects) {
  for (const r of rects) {
    if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true;
  }
  return false;
}
function losBlocked(x0, y0, x1, y1, rects) {
  const dx = x1 - x0, dy = y1 - y0;
  const d = Math.hypot(dx, dy);
  const n = Math.max(2, Math.ceil(d / 6));
  for (let i = 1; i < n; i++) {
    if (pointInRects(x0 + dx * i / n, y0 + dy * i / n, rects)) return true;
  }
  return false;
}
/* Gabungkan tile '#' per baris menjadi rect horizontal (efisien) */
function mergeWallRects(map, tw) {
  const rects = [];
  for (let r = 0; r < map.length; r++) {
    let c = 0;
    while (c < map[r].length) {
      if (map[r][c] === '#') {
        let c2 = c;
        while (c2 < map[r].length && map[r][c2] === '#') c2++;
        rects.push({ x: c * tw, y: r * tw, w: (c2 - c) * tw, h: tw, wall: true });
        c = c2;
      } else c++;
    }
  }
  return rects;
}

/* ---------------- Partikel ---------------- */
const Particles = {
  list: [], max: 420,
  add(p) {
    if (this.list.length < this.max) {
      p.life0 = p.life;
      this.list.push(p);
    }
  },
  burst(x, y, o = {}) {
    const n = o.n || 12, cols = o.c || ['#ffe28a', '#fff6d8', '#ffb54a'];
    for (let i = 0; i < n; i++) {
      const a = (o.dir ?? 0) + (Math.random() - .5) * (o.spread ?? Math.PI * 2);
      const sp = (o.sp || 60) * (0.4 + Math.random() * 0.9);
      this.add({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: (o.life || .6) * (0.6 + Math.random() * 0.7),
        grav: o.grav || 0, size: o.size || 2,
        c: cols[(Math.random() * cols.length) | 0],
        add: o.add || false
      });
    }
  },
  text(x, y, str, c = '#ffe28a') {
    this.add({ x, y, vx: 0, vy: -22, life: 1.4, grav: 0, size: 0, c, text: str });
  },
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.vy += (p.grav || 0) * dt;
      p.vx *= (1 - 1.6 * dt);
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) L.splice(i, 1);
    }
  },
  /* dipanggil DI DALAM ctx.translate(-kamera): semua koordinat memakai koordinat dunia.
     Sebelumnya posisi dikurangi kamera di sini, sehingga titik partikel tergeser
     dua kali (partikel tampak melenceng mengikuti kamera). */
  draw(cx, cy) {
    for (const p of this.list) {
      const a = clamp(p.life / p.life0, 0, 1);
      const x = Math.round(p.x), y = Math.round(p.y);
      if (p.text) {
        txt(p.text, x, y, { font: FONT_VT(17), color: p.c, align: 'center', alpha: a, shadow: 'rgba(0,0,0,.6)', world: true });
      } else {
        ctx.globalAlpha = a;
        if (p.add) ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = p.c;
        const s = Math.max(1, Math.round(p.size * (0.5 + a * 0.5)));
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
    }
  },
  clear() { this.list.length = 0; }
};

/* ---------------- Audio (chiptune lembut) ---------------- */
const Snd = {
  ctx: null, master: null, muted: false,
  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
      } catch (e) { /* tanpa audio */ }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(f, o = {}) {
    if (!this.ctx || this.muted) return;
    const { d = 0.1, type = 'square', v = 0.12, slide = 0, when = 0 } = o;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator(), g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, f), t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + d);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + d + 0.03);
  },
  noise(d = 0.15, v = 0.06, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const len = Math.floor(this.ctx.sampleRate * d);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = v;
    src.connect(g); g.connect(this.master);
    src.start(t);
  }
};
const SFX = {
  uiMove()    { Snd.tone(620, { d: .04, v: .045 }); },
  uiSelect()  { Snd.tone(520, { d: .06, v: .07 }); Snd.tone(780, { d: .09, v: .07, when: .06 }); },
  uiBack()    { Snd.tone(420, { d: .07, v: .06, slide: -160 }); },
  paper()     { Snd.noise(.12, .05); Snd.tone(240, { d: .06, v: .04, type: 'triangle' }); },
  discover()  { [660, 880, 1320].forEach((f, i) => Snd.tone(f, { d: .12, v: .09, type: 'triangle', when: i * .07 })); },
  type()      { Snd.tone(960, { d: .025, v: .035 }); },
  deny()      { Snd.tone(170, { d: .22, v: .11, type: 'sawtooth', slide: -70 }); Snd.tone(120, { d: .25, v: .08, type: 'sawtooth', when: .1 }); },
  machineRun(){ Snd.tone(180, { d: 1.3, v: .05, type: 'triangle', slide: 720 }); Snd.tone(90, { d: 1.3, v: .04, type: 'square', slide: 300, when: .1 }); },
  chime()     { [880, 1108, 1318, 1760].forEach((f, i) => Snd.tone(f, { d: .16, v: .08, type: 'triangle', when: i * .09 })); },
  alert()     { Snd.tone(950, { d: .07, v: .09 }); Snd.tone(950, { d: .07, v: .09, when: .1 }); },
  caught()    { Snd.tone(420, { d: .5, v: .12, type: 'sawtooth', slide: -340 }); Snd.noise(.3, .07, .05); },
  door()      { Snd.tone(140, { d: .18, v: .1, type: 'triangle', slide: -60 }); Snd.noise(.1, .04); },
  step(alt)   { Snd.tone(alt ? 130 : 115, { d: .03, v: .018 }); },
  star(i)     { Snd.tone(700 + i * 240, { d: .2, v: .1, type: 'triangle' }); },
  fanfare()   { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => Snd.tone(f, { d: .15, v: .09, type: 'square', when: i * .11 })); },
  sparkle()   { Snd.tone(1560, { d: .08, v: .05, type: 'triangle' }); Snd.tone(2080, { d: .1, v: .04, type: 'triangle', when: .05 }); },
  swoosh()    { Snd.noise(.2, .05); }
};

/* ---------------- Musik latar (pola arpeggio sederhana) ---------------- */
const Music = {
  pattern: null, step: 0, next: 0,
  defs: {
    title:   { notes: [0, 3, 7, 10, 12, 10, 7, 3], base: 220, dur: .26, type: 'triangle', v: .028 },
    bedroom: { notes: [0, 4, 7, 9, 7, 4, 2, 4],    base: 196, dur: .3,  type: 'triangle', v: .028 },
    school:  { notes: [0, 4, 7, 12, 9, 7, 4, 7],   base: 262, dur: .24, type: 'triangle', v: .026 },
    lab:     { notes: [0, 3, 7, 8, 10, 8, 7, 3],   base: 165, dur: .34, type: 'square',   v: .02 }
  },
  set(name) {
    this.pattern = name ? this.defs[name] : null;
    this.step = 0; this.next = 0;
  },
  update() {
    if (!Snd.ctx || Snd.muted || !this.pattern) return;
    const now = Snd.ctx.currentTime;
    if (this.next < now) this.next = now + 0.06;
    const p = this.pattern;
    while (this.next < now + 0.25) {
      const when = this.next - now;
      const n = p.notes[this.step % p.notes.length];
      Snd.tone(p.base * Math.pow(2, n / 12), { d: p.dur * .85, type: p.type, v: p.v, when });
      if (this.step % 4 === 0) {
        Snd.tone(p.base / 2, { d: p.dur * 1.7, type: 'sine', v: p.v * 1.5, when });
      }
      this.step++;
      this.next += p.dur;
    }
  }
};

/* ---------------- Teks ---------------- */
const FONT_PS = s => s + 'px "Press Start 2P", monospace';
const FONT_VT = s => s + 'px "VT323", monospace';
/* Teks UI digambar ke kanvas resolusi tinggi agar tajam;
   teks di dalam dunia (kapur papan tulis, stensil peti) tetap pixel:
   beri opsi { world: true }. */
function txt(str, x, y, o = {}) {
  const { font = FONT_VT(18), color = '#fff', align = 'left', alpha = 1,
          baseline = 'alphabetic', shadow = null, maxWidth = null, world = false } = o;
  const g = world ? ctx : uictx;
  g.save();
  g.globalAlpha = alpha;
  g.font = font;
  g.textAlign = align;
  g.textBaseline = baseline;
  if (maxWidth) {
    const lines = wrap(str, font, maxWidth);
    let yy = y;
    for (const ln of lines) {
      if (shadow) { g.fillStyle = shadow; g.fillText(ln, x + 1, yy + 2); }
      g.fillStyle = color;
      g.fillText(ln, x, yy);
      yy += parseInt(font) * 1.15;
    }
  } else {
    if (shadow) { g.fillStyle = shadow; g.fillText(str, x + 1, y + 2); }
    g.fillStyle = color;
    g.fillText(str, x, y);
  }
  g.restore();
}
function wrap(str, font, maxW) {
  ctx.save();
  ctx.font = font;
  const words = String(str).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  ctx.restore();
  return lines;
}

/* ---------------- Fade transisi ---------------- */
const Fade = {
  a: 0, dir: 0, cb: null, speed: 2.6, seq: 0,
  start(cb) { if (this.dir === 0) { this.dir = 1; this.cb = cb; this.seq++; } },
  update(dt) {
    if (this.dir === 1) {
      this.a += dt * this.speed;
      if (this.a >= 1) { this.a = 1; this.dir = -1; if (this.cb) { const f = this.cb; this.cb = null; f(); } }
    } else if (this.dir === -1) {
      this.a -= dt * this.speed;
      if (this.a <= 0) { this.a = 0; this.dir = 0; }
    }
  },
  /* tirai piksel: kolom-kolom 16px naik dari bawah dengan tinggi bertahap
     (pola dikunci oleh nomor transisi supaya tiap transisi terasa berbeda,
     tapi tetap bisa diulang) */
  draw() {
    const a = this.a;
    if (a <= 0) return;
    ctx.fillStyle = 'rgba(6,5,14,' + (a * 0.86).toFixed(3) + ')';
    ctx.fillRect(0, 0, VW, VH);
    const CW = 16, n = Math.ceil(VW / CW);
    for (let i = 0; i < n; i++) {
      const jit = hash2(i * 7 + this.seq * 31, this.seq * 13) * 0.38;
      const p = clamp((a - jit) / (1 - jit + 1e-6), 0, 1);
      const h = Math.round(p * VH);
      if (h <= 0) continue;
      const x = i * CW;
      ctx.fillStyle = '#080614';
      ctx.fillRect(x, VH - h, CW, h);
      ctx.fillStyle = '#0e0b20';
      ctx.fillRect(x, VH - h, CW, Math.min(5, h));
      ctx.fillStyle = 'rgba(232,192,74,' + (0.75 * p).toFixed(2) + ')';
      ctx.fillRect(x, VH - h, CW - 2, 1);
    }
    uictx.fillStyle = 'rgba(6,5,14,' + (a * 0.86).toFixed(3) + ')';
    uictx.fillRect(0, 0, VW, VH);
  }
};

/* Pola scanline halus (dibuat sekali) */
const scanPat = (() => {
  const c = document.createElement('canvas');
  c.width = 1; c.height = 3;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0.10)';
  g.fillRect(0, 2, 1, 1);
  return ctx.createPattern(c, 'repeat');
})();
