'use strict';
/* ============================================================
   SECRET MAIL — scenes.js
   State level + semua scene: title, pilih level, cara main,
   intro, gameplay, hasil, ending.
   ============================================================ */

let L = null; // state level yang sedang berjalan
let LEVEL_RUN = 0; // penghitung build level (lihat buildLevel)

/* Bisukan/nyalakan suara dari mana pun (tanpa masuk panel jeda) */
function toggleMute() {
  Snd.muted = !Snd.muted;
  G.save.muted = Snd.muted;
  persist();
  if (!Snd.muted) SFX.uiSelect(); else SFX.uiBack();
}
function checkMute() { if (Input.press('m', 'M')) toggleMute(); }

/* ============================================================
   MEMBANGUN LEVEL (dengan pengacakan anti-hafalan)
   ============================================================ */
function buildLevel(idx) {
  const def = LEVELS[idx];
  // seed: acak penuh setiap kali (anti-hafalan).
  //   ?seed=N        -> tiap level tetap deterministik per build, tapi ULANG tetap beda
  //   ?seed=N&run=K  -> persis sama (untuk pengujian otomatis / reproduksi)
  LEVEL_RUN++;
  const run = G.params.has('run') ? (parseInt(G.params.get('run'), 10) || 0) : LEVEL_RUN;
  const seed = G.params.has('seed')
    ? (parseInt(G.params.get('seed'), 10) * 7919 + idx * 104729 + run * 40503) | 0
    : (Math.random() * 2 ** 31) | 0;
  srand(seed);
  const puzzle = Crypto.randomPuzzle(idx + 1);

  const objs = def.objects.map(o => Object.assign({ searched: false, has: null }, o));
  const cands = sshuffle(objs.filter(o => o.search));
  if (cands.length >= 2) { cands[0].has = 'message'; cands[1].has = 'note'; }

  const wallRects = mergeWallRects(def.map, TILE);
  // benda solid bisa punya kotak collision kecil (o.col) agar
  // properti tipis seperti tiang lampu tidak jadi dinding tak terlihat
  const objRect = o => o.col
    ? { x: (o.x + o.col.x) * TILE, y: (o.y + o.col.y) * TILE, w: o.col.w * TILE, h: o.col.h * TILE }
    : { x: o.x * TILE, y: o.y * TILE, w: o.w * TILE, h: o.h * TILE };
  const objSolids = objs.filter(o => o.solid).map(objRect);
  const objSights = objs.filter(o => o.sight).map(o => ({ x: o.x * TILE, y: o.y * TILE, w: o.w * TILE, h: o.h * TILE }));

  const st = def.playerStart;
  const player = {
    x: st.x * TILE + (TILE - 16) / 2, y: st.y * TILE + (TILE - 12) / 2,
    w: 16, h: 12, vx: 0, vy: 0, dir: 'down', walk: 0, stepT: 0, stepAlt: false
  };

  L = {
    defIndex: idx, def, roomW: def.w * TILE, roomH: def.h * TILE,
    solidRects: wallRects.concat(objSolids),
    sightRects: wallRects.concat(objSights),
    objects: objs,
    message: puzzle.message, a: puzzle.a, b: puzzle.b, encrypted: null,
    found: { message: false, note: false, enc: false }, delivered: false,
    player,
    courier: { x: (def.courier.x + .5) * TILE, y: (def.courier.y + 1) * TILE, alpha: 1 },
    enemies: def.enemies.map(e => new Enemy(e)),
    timer: 0, catches: 0, immunity: 1.2, flash: null, t: 0,
    dialog: null,
    machine: { open: false, phase: 'input', fa: '', fb: '', focus: 'a', msg: null, workT: 0, resultText: '' },
    courierUI: { open: false, value: '', msg: null, shakeT: 0 },
    journal: false, journalA: 0, pause: null, courierLeaving: null, resultsGiven: false
  };
  Camera.snap(player.x, player.y, L.roomW, L.roomH);
  Music.set(def.themeMusic);
  Particles.clear();
  srand((Math.random() * 2 ** 31) | 0); // setelah konten diacak, kembalikan ke acak penuh
}

/* ============================================================
   DIALOG
   ============================================================ */
function openDialog(name, text, onDone, accent) {
  L.dialog = { name, text, shown: '', chars: 0, done: false, onDone: onDone || null, accent };
  SFX.paper();
}
function updateDialog(dt) {
  const d = L.dialog;
  d.chars = Math.min(d.text.length, d.chars + dt * 48);
  d.shown = d.text.slice(0, Math.round(d.chars));
  d.done = d.chars >= d.text.length;
  if (Input.press('e', 'E', 'Enter', ' ') || Input.mouse.clicked) {
    if (!d.done) { d.chars = d.text.length; d.shown = d.text; d.done = true; }
    else {
      SFX.uiSelect();
      L.dialog = null;
      // telan input frame ini supaya ketukan yang menutup dialog tidak
      // ikut menekan tombol panel yang baru terbuka
      Input.mouse.clicked = false; Input.pressed.clear(); Input.charQueue.length = 0;
      if (d.onDone) d.onDone();
    }
  }
}

/* ============================================================
   INTERAKSI OBJEK
   ============================================================ */
function nearestInteractable() {
  let best = null, bd = 1e9;
  const p = L.player;
  const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
  const list = L.objects.filter(o => o.search || o.type === 'machine' || o.type === 'exitdoor');
  list.push({ type: 'courier', x: L.def.courier.x, y: L.def.courier.y, w: 1, h: 1, label: 'Kurir Surat' });
  for (const o of list) {
    if (o.type === 'exitdoor') continue;
    // jarak dari pemain ke tepi objek (bukan titik tengah) agar objek besar
    // seperti mesin tetap bisa dipakai saat berdiri di dekat sisi mana pun
    const rx = o.x * TILE, ry = o.y * TILE, rw = o.w * TILE, rh = o.h * TILE;
    const qx = clamp(pcx, rx, rx + rw), qy = clamp(pcy, ry, ry + rh);
    const d = (qx - pcx) ** 2 + (qy - pcy) ** 2;
    const rad = 44 + (o.type === 'machine' ? 14 : 0);
    if (d < rad * rad && d < bd) { bd = d; best = o; }
  }
  return best;
}
function interact(o) {
  if (o.type === 'machine') {
    if (!L.found.message || !L.found.note) {
      const miss = [];
      if (!L.found.message) miss.push('PESAN RAHASIA');
      if (!L.found.note) miss.push('CATATAN FUNGSI');
      openDialog('Mesin Enkripsi', 'Brr... Aku masih kosong. Bawakan aku ' + miss.join(' dan ') + ' dulu! Periksa objek-objek di ruangan ini [E].');
    } else if (L.encrypted) {
      openDialog('Mesin Enkripsi', 'Pesanmu sudah terenkripsi dan tersimpan di jurnal [TAB]. Antar segera ke kurir di dekat pintu!');
    } else {
      L.machine.open = true; L.machine.phase = 'input';
      L.machine.msg = null; SFX.uiSelect();
    }
  } else if (o.type === 'courier') {
    if (!L.encrypted) {
      openDialog('Kurir Surat', 'Halo, agen! Pesannya belum terenkripsi... Aku tidak mau membawa pesan terbuka, bahaya disadap! Gunakan mesin enkripsi dulu (ikuti panah emas).');
    } else if (L.delivered) {
      openDialog('Kurir Surat', 'Pesan aman di tanganku. Kerja bagus, agen!');
    } else {
      openDialog('Kurir Surat', 'Pesan sudah siap? Bagus! Ketik persis teks terenkripsi dari jurnalmu [TAB], jangan sampai salah satu huruf pun.', () => {
        L.courierUI.open = true; L.courierUI.value = ''; L.courierUI.msg = null;
      }, '#e8a44a');
    }
  } else if (o.search) {
    if (o.searched) { openDialog(o.label, 'Sudah kau periksa. Tidak ada lagi di sini.'); return; }
    o.searched = true;
    const cx = (o.x + o.w / 2) * TILE, cy = o.y * TILE + 10;
    if (o.has === 'message') {
      L.found.message = true;
      SFX.discover();
      Particles.burst(cx, cy, { n: 18, c: ['#ffe28a', '#fff6d8', '#ffb54a'], sp: 70, life: .8 });
      Particles.text(cx, cy - 14, '+ PESAN DITEMUKAN', '#ffe28a');
      openDialog('Pesan Rahasia', '“' + L.message + '” — pesan ini harus segera dienkripsi! Sekarang cari catatan fungsinya.', null, '#ffe28a');
    } else if (o.has === 'note') {
      L.found.note = true;
      SFX.discover();
      Particles.burst(cx, cy, { n: 18, c: ['#7ae68a', '#d0ffe0', '#3a9a6a'], sp: 70, life: .8 });
      Particles.text(cx, cy - 14, '+ CATATAN FUNGSI', '#7ae68a');
      openDialog('Catatan Fungsi', 'Tertulis: ' + Crypto.fmtFn(L.a, L.b) + '. Masukkan nilai a dan b ke mesin enkripsi!', null, '#7ae68a');
    } else {
      SFX.paper();
      openDialog(o.label, spick(L.def.flavor));
    }
  }
}

/* ============================================================
   MESIN ENKRIPSI
   ============================================================ */
function submitMachine(M) {
  if (M.fa === '' || M.fb === '' || M.fb === '-') {
    M.msg = { text: 'Isi dulu nilai a dan b.', c: '#ffb0a0' };
    SFX.deny(); return;
  }
  const a = parseInt(M.fa, 10), b = parseInt(M.fb, 10);
  if (a === L.a && b === L.b) {
    M.phase = 'work'; M.workT = 1.6; M.msg = null;
    SFX.machineRun();
  } else {
    M.msg = { text: 'PARAMETER TIDAK COCOK! Periksa catatan fungsimu.', c: '#ff8a7a' };
    SFX.deny(); Camera.shake(2, .25);
  }
}
function finishMachine(M) {
  L.encrypted = Crypto.encrypt(L.message, L.a, L.b);
  L.found.enc = true;
  M.phase = 'result';
  M.resultText = L.encrypted;
  SFX.chime();
  const cx = (L.def.objects.find(o => o.type === 'machine').x + 1) * TILE;
  const cy = L.def.objects.find(o => o.type === 'machine').y * TILE;
  Particles.burst(cx, cy + 16, { n: 22, c: ['#7ae68a', '#d0ffe0', '#4ae6d8'], sp: 80, life: .9 });
  Particles.text(cx, cy, '+ TEKS TERENKRIPSI', '#7ae68a');
}
function updateMachine(dt) {
  const M = L.machine;
  if (M.phase === 'work') {
    M.workT -= dt;
    if (Math.random() < dt * 20) Particles.burst(L.roomW - 90, 0, { n: 1, c: ['#4ae68a'], sp: 30, life: .4 });
    if (M.workT <= 0) finishMachine(M);
    return;
  }
  if (M.phase === 'result') {
    if (Input.press('Escape', 'e', 'E', 'Enter')) { M.open = false; SFX.uiBack(); }
    return;
  }
  for (const ch of Input.charQueue) {
    if (M.focus === 'a') {
      if (/[0-9]/.test(ch) && M.fa.length < 3) { M.fa += ch; SFX.type(); }
    } else {
      if (/[0-9]/.test(ch) && M.fb.length < 4) { M.fb += ch; SFX.type(); }
      else if (ch === '-' && M.fb === '') { M.fb = '-'; SFX.type(); }
    }
  }
  if (Input.press('Backspace')) {
    if (M.focus === 'a') M.fa = M.fa.slice(0, -1); else M.fb = M.fb.slice(0, -1);
    SFX.type();
  }
  if (Input.press('ArrowUp', 'ArrowDown', 'w', 's', 'W', 'S')) { M.focus = M.focus === 'a' ? 'b' : 'a'; SFX.uiMove(); }
  if (Input.press('Enter')) submitMachine(M);
  if (Input.press('Escape')) { M.open = false; SFX.uiBack(); }
}

/* ============================================================
   KETIK KE KURIR
   ============================================================ */
function submitCourier(C) {
  if (!C.value) { C.msg = { text: 'Tulis dulu teks terenkripsinya.', c: '#ffb0a0' }; return; }
  if (C.value === L.encrypted) {
    C.open = false;
    L.delivered = true;
    L.courierLeaving = { t: 0 };
    SFX.door(); SFX.fanfare();
    Particles.text(L.courier.x, L.courier.y - 34, 'PESAN AMAN!', '#7ae68a');
    Particles.burst(L.courier.x, L.courier.y - 16, { n: 26, c: ['#ffe28a', '#7ae68a', '#fff6d8'], sp: 90, life: 1 });
  } else {
    C.msg = { text: 'Teks tidak cocok! Periksa jurnalmu [TAB].', c: '#ff8a7a' };
    C.shakeT = .5; SFX.deny(); Camera.shake(2, .2);
  }
}
function updateCourierUI(dt) {
  const C = L.courierUI;
  if (C.shakeT > 0) C.shakeT -= dt;
  for (const ch of Input.charQueue) {
    if (/[a-zA-Z ]/.test(ch) && C.value.length < L.encrypted.length + 8) { C.value += ch; SFX.type(); }
  }
  if (Input.press('Backspace')) { C.value = C.value.slice(0, -1); SFX.type(); }
  if (Input.press('Enter')) submitCourier(C);
  if (Input.press('Escape')) { C.open = false; SFX.uiBack(); }
}

/* ============================================================
   PAUSE
   ============================================================ */
function pauseAction(i) {
  const P = L.pause;
  if (i === 0) { L.pause = null; SFX.uiBack(); }
  else if (i === 1) { L.pause = null; Fade.start(() => Scenes.go('game', { level: L.defIndex, rebuild: true })); SFX.uiSelect(); }
  else if (i === 2) { toggleMute(); }
  else if (i === 3) { L.pause = null; Music.set('title'); Fade.start(() => Scenes.go('title')); SFX.uiBack(); }
}
function updatePause(dt) {
  const P = L.pause;
  if (Input.press('ArrowUp', 'w', 'W')) { P.idx = (P.idx + 3) % 4; SFX.uiMove(); }
  if (Input.press('ArrowDown', 's', 'S')) { P.idx = (P.idx + 1) % 4; SFX.uiMove(); }
  if (Input.press('Enter', 'e', 'E', ' ')) pauseAction(P.idx);
  if (Input.press('Escape')) { L.pause = null; SFX.uiBack(); }
}

/* ============================================================
   UPDATE GAMEPLAY
   ============================================================ */
function anyModal() {
  // null-safe: dipanggil juga dari penanganan sentuh saat belum ada level (menu)
  return !!(L && (L.dialog || L.machine.open || L.courierUI.open || L.journal || L.pause));
}

function updateGame(dt) {
  if (!L || Scenes.data.level !== L.defIndex || Scenes.data.rebuild) {
    buildLevel(Scenes.data.level);
    Scenes.data.rebuild = false;
  }
  L.t += dt;
  if (L.immunity > 0) L.immunity -= dt;
  if (L.flash) { L.flash.t -= dt; if (L.flash.t <= 0) L.flash = null; }
  L.journalA = Math.min(1, L.journalA + dt * 8);

  if (L.dialog) { updateDialog(dt); }
  else if (L.machine.open) { updateMachine(dt); }
  else if (L.courierUI.open) { updateCourierUI(dt); }
  else if (L.journal) {
    if (Input.press('Tab', 'Escape')) { L.journal = false; SFX.uiBack(); }
  }
  else if (L.pause) { updatePause(dt); }
  else {
    /* ---------- dunia aktif ---------- */
    checkMute();
    L.timer += dt;
    const p = L.player;
    const ax = Input.axis();
    const sp = 118;
    const k = 1 - Math.exp(-dt * 14);
    p.vx = lerp(p.vx, ax.dx * sp, k);
    p.vy = lerp(p.vy, ax.dy * sp, k);
    moveActor(p, L.solidRects, dt);
    const moving = Math.hypot(p.vx, p.vy) > 24;
    if (moving) {
      p.walk += dt * 9;
      p.stepT -= dt;
      if (p.stepT <= 0) { p.stepT = .26; p.stepAlt = !p.stepAlt; SFX.step(p.stepAlt); }
      if (Math.random() < dt * 14)
        Particles.add({ x: p.x + 8 + (Math.random() - .5) * 8, y: p.y + 10, vx: (Math.random() - .5) * 8, vy: -6, life: .4, size: 1, c: 'rgba(255,255,255,0.25)' });
    } else p.walk = 0;
    if (ax.dx) p.dir = ax.dx < 0 ? 'left' : 'right';
    else if (ax.dy) p.dir = ax.dy < 0 ? 'up' : 'down';

    // musuh (dihentikan setelah kurir berangkat: tidak adil kehilangan
    // bintang gara-gara tertangkap di adegan penutup)
    if (!L.courierLeaving) for (const e of L.enemies) e.update(dt, L, p);

    // interaksi
    L.near = nearestInteractable();
    if (Input.press('e', 'E', ' ') && L.near) interact(L.near);
    if (Input.press('Tab')) { L.journal = true; L.journalA = 0; SFX.paper(); }
    if (Input.press('Escape')) { L.pause = { idx: 0 }; SFX.uiSelect(); }

    // kurir pergi (level selesai)
    if (L.courierLeaving) {
      L.courierLeaving.t += dt;
      const door = L.objects.find(o => o.type === 'exitdoor');
      const tx = (door.x + door.w / 2) * TILE;
      L.courier.x = lerp(L.courier.x, tx, dt * 2.2);
      L.courier.alpha = clamp(1 - (L.courierLeaving.t - .5) / .8, 0, 1);
      if (L.courierLeaving.t > 1.5 && !L.resultsGiven) {
        L.resultsGiven = true;
        computeResults();
      }
    }
  }

  /* partikel lingkungan per tema */
  const th = L.def.theme;
  if (Math.random() < dt * 5) {
    const x = Camera.x + Math.random() * VW, y = Camera.y + Math.random() * VH;
    Particles.add({ x, y, vx: (Math.random() - .5) * 6, vy: 5 + Math.random() * 5, life: 3, size: 1, c: 'rgba(' + th.dust + ',0.35)' });
  }
  if (L.defIndex === 2) { // lab: uap & percikan
    for (const o of L.objects) {
      if (o.type === 'vent' && Math.random() < dt * 3) {
        Particles.add({ x: (o.x + .5) * TILE, y: o.y * TILE + 6, vx: (Math.random() - .5) * 8, vy: -22, life: 1.6, size: 2, c: 'rgba(180,220,230,0.3)' });
      }
      if (o.type === 'tank' && Math.random() < dt * .8) {
        Particles.add({ x: (o.x + .5) * TILE + (Math.random() - .5) * 20, y: o.y * TILE + 4, vx: 0, vy: 30, life: .6, size: 1, c: 'rgba(150,230,220,0.5)' });
      }
      if (o.type === 'electricbox' && Math.random() < dt * .7) {
        Snd.tone(2400, { d: .04, v: .02 });
        Particles.burst((o.x + 1) * TILE, (o.y + .5) * TILE + 14, { n: 4, c: ['#7ae6ff', '#d0f6ff'], sp: 60, life: .3, add: true });
      }
    }
  }
  Camera.follow(L.player.x + 8, L.player.y + 6, L.roomW, L.roomH, dt);
  Particles.update(dt);
}

/* ============================================================
   RENDER GAMEPLAY
   ============================================================ */
function drawTiles(Ld) {
  const th = Ld.def.theme;
  const map = Ld.def.map;
  const c0 = Math.max(0, Math.floor(Camera.x / TILE)), c1 = Math.min(Ld.def.w - 1, Math.ceil((Camera.x + VW) / TILE));
  const r0 = Math.max(0, Math.floor(Camera.y / TILE)), r1 = Math.min(Ld.def.h - 1, Math.ceil((Camera.y + VH) / TILE));
  const idx = Ld.defIndex;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const x = c * TILE, y = r * TILE;
      const wall = map[r][c] === '#';
      const faceBelow = r + 1 < map.length && map[r + 1][c] !== '#';
      if (wall && faceBelow) {
        /* ---- dinding tampak depan, gaya per tema ---- */
        if (idx === 0) {
          // wallpaper bergaris + molding + papan pinggir
          R(x, y, TILE, TILE, th.wallFace);
          ctx.globalAlpha = 0.22;
          for (let i = 6; i < TILE; i += 16) R(x + i, y + 5, 5, TILE - 14, th.wallLight);
          ctx.globalAlpha = 1;
          R(x, y, TILE, 3, th.wallLight);                       // mahkota
          R(x, y + 3, TILE, 1, th.wallDark);
          R(x, y + TILE - 9, TILE, 9, th.wallDark);             // planggar
          R(x, y + TILE - 9, TILE, 1, th.wallLight);
          R(x, y + TILE - 3, TILE, 3, th.wallCap);
          if (c % 2 === 0) R(x, y + 5, 1, TILE - 15, th.wallDark);
          if (hash2(c, r) > 0.86) R(x + 10, y + 8, 12, 8, th.wallLight); // pola dinding
        } else if (idx === 1) {
          // dinding sekolah: rel kursi + wainscot
          R(x, y, TILE, TILE, th.wallFace);
          R(x, y, TILE, 2, th.wallLight);
          R(x, y + 13, TILE, 2, th.wallDark);                   // rel kursi
          R(x, y + 15, TILE, 1, th.wallLight);
          ctx.globalAlpha = 0.18;
          R(x, y + 16, TILE, TILE - 16, th.wallDark);           // wainscot
          ctx.globalAlpha = 1;
          if (c % 2 === 0) R(x, y + 16, 1, TILE - 16, th.wallDark);
          R(x, y + TILE - 5, TILE, 5, th.wallDark);             // planggar
          R(x, y + TILE - 5, TILE, 1, th.wallLight);
          if (hash2(c, r * 3) > 0.88) R(x + 12, y + 5, 8, 6, th.wallLight); // detail
        } else {
          // dinding lab: pelat logam + konduit
          R(x, y, TILE, TILE, th.wallFace);
          R(x, y, TILE, 2, th.wallLight);
          R(x, y, 1, TILE, th.wallDark);
          BOLT(x + 3, y + 4); BOLT(x + TILE - 6, y + 4);
          ctx.globalAlpha = 0.25;
          R(x + 2, y + 8, TILE - 4, TILE - 16, th.wallDark);
          ctx.globalAlpha = 1;
          DITH(x + 2, y + 8, TILE - 4, TILE - 16, th.wallDark, c + r);
          R(x + 2, y + TILE - 9, TILE - 4, 5, '#3a4250');       // konduit bawah
          R(x + 2, y + TILE - 9, TILE - 4, 1, '#6a7688');
          if (c % 2 === 0) R(x + 14, y + TILE - 10, 4, 7, '#2a303c'); // braket
          if (hash2(c * 7, r) > 0.9) { R(x + 8, y + 6, 1, 10, th.wallDark); R(x + 12, y + 16, 8, 1, th.wallDark); }
        }
      } else if (wall) {
        /* ---- tepi/atap dinding ---- */
        R(x, y, TILE, TILE, th.wallCap);
        R(x, y + TILE - 2, TILE, 2, th.wallDark);
        GRAIN(x, y, TILE, TILE - 2, th.wallDark, 0.10);
        if (hash2(c, r) > 0.82) R(x + 6, y + 8, TILE - 12, 1, th.wallLight);
      } else {
        /* ---- lantai, gaya per tema ---- */
        if (idx === 0) {
          // papan kayu: warna per papan, sambungan selang-seling, mata kayu
          R(x, y, TILE, TILE, (r + (c >> 2)) % 2 ? th.floorA : th.floorB);
          if (r % 2 === 0) R(x, y + TILE - 1, TILE, 1, th.floorLine);
          if ((c + (r % 2)) % 4 === 0) R(x + (r % 2 ? 9 : 22), y + 1, 1, TILE - 2, 'rgba(125,81,56,0.45)');
          if (hash2(c * 5, r * 3) > .78)
            R(x + 4 + (hash2(r, c) * 18 | 0), y + 6 + (hash2(c, r * 7) * 18 | 0), 8, 1, 'rgba(125,81,56,0.32)');
          if (hash2(c * 9, r * 5) > .965) {                     // mata kayu
            CIR(x + 16, y + 16, 3, 'rgba(125,81,56,0.5)');
            CIR(x + 16, y + 16, 1, 'rgba(125,81,56,0.7)');
          }
        } else if (idx === 1) {
          // ubin sekolah: papan catur 2x2 + nat + kilap
          R(x, y, TILE, TILE, ((c >> 1) + (r >> 1)) % 2 ? th.floorA : th.floorB);
          ctx.globalAlpha = 0.45;
          R(x, y, TILE, 1, th.floorLine);
          R(x, y, 1, TILE, th.floorLine);
          ctx.globalAlpha = 1;
          if ((c % 2 === 0) && (r % 2 === 0)) R(x + 14, y + 14, 4, 2, 'rgba(255,255,255,0.3)');
          if (hash2(c * 3, r * 7) > 0.94) R(x + 20, y + 20, 5, 3, 'rgba(255,255,255,0.18)');
        } else {
          // pelat logam lab: bevel + keling + grate/retak/tumpahan
          R(x, y, TILE, TILE, th.floorA);
          ctx.globalAlpha = 0.5;
          R(x, y, TILE, 1, th.wallLight);
          R(x, y, 1, TILE, th.wallLight);
          R(x, y + TILE - 1, TILE, 1, th.floorLine);
          R(x + TILE - 1, y, 1, TILE, th.floorLine);
          ctx.globalAlpha = 1;
          R(x + 3, y + 3, 2, 2, th.wallLight); R(x + TILE - 5, y + 3, 2, 2, th.wallLight);
          R(x + 3, y + TILE - 5, 2, 2, th.wallLight); R(x + TILE - 5, y + TILE - 5, 2, 2, th.wallLight);
          const hv = hash2(c * 3, r * 7);
          if (hv > 0.93) { R(x + 8, y + 6, 1, 12, th.floorLine); R(x + 12, y + 18, 8, 1, th.floorLine); }
          else if (hv > 0.88) {                                 // grate ventilasi
            ctx.globalAlpha = 0.5;
            R(x + 5, y + 5, TILE - 10, TILE - 10, th.floorLine);
            for (let i = 7; i < TILE - 7; i += 4) R(x + 6, y + i, TILE - 12, 1, th.wallDark);
            ctx.globalAlpha = 1;
            O(x + 5, y + 5, TILE - 10, TILE - 10, th.wallDark);
          } else if (hv > 0.84) {
            ctx.globalAlpha = 0.25;                             // tumpahan
            CIR(x + 16, y + 18, 6, th.wallDark);
            CIR(x + 20, y + 14, 3, th.wallDark);
            ctx.globalAlpha = 1;
          }
        }
        // bayangan kontak di bawah dinding
        if (r > 0 && map[r - 1][c] === '#') {
          ctx.globalAlpha = 0.15;
          R(x, y, TILE, 5, '#0a0618');
          ctx.globalAlpha = 0.07;
          R(x, y + 5, TILE, 4, '#0a0618');
          ctx.globalAlpha = 1;
        }
      }
    }
  }
}

function drawLighting(Ld) {
  const th = Ld.def.theme;
  const cx = Math.round(Camera.x + Camera.ox), cy = Math.round(Camera.y + Camera.oy);
  if (th.ambient && th.ambient !== 'none') {
    ctx.fillStyle = th.ambient;
    ctx.fillRect(0, 0, VW, VH);
  }
  // pendar titik cahaya (additive)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const o of Ld.objects) {
    for (const g of objectGlows(o, Ld.t, th)) {
      const sx = g.x - cx, sy = g.y - cy;
      if (sx < -80 || sx > VW + 80 || sy < -80 || sy > VH + 80) continue;
      const grad = ctx.createRadialGradient(sx, sy, 2, sx, sy, g.r);
      grad.addColorStop(0, 'rgba(' + g.c + ',' + g.a + ')');
      grad.addColorStop(1, 'rgba(' + g.c + ',0)');
      ctx.fillStyle = grad;
      ctx.fillRect(sx - g.r, sy - g.r, g.r * 2, g.r * 2);
    }
  }
  // bilah cahaya dari jendela
  for (const o of Ld.objects) {
    if (o.type !== 'window') continue;
    const wx = o.x * TILE - cx, wy = o.y * TILE - cy;
    const ww = o.w * TILE;
    if (wx + ww < 0 || wx > VW) continue;
    const shaftTop = wy + 32, shaftBot = wy + 170;
    const gr = ctx.createLinearGradient(0, shaftTop, 0, shaftBot);
    gr.addColorStop(0, 'rgba(' + (th.glowWindow || '255,200,140') + ',0.10)');
    gr.addColorStop(1, 'rgba(' + (th.glowWindow || '255,200,140') + ',0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(wx + 4, shaftTop);
    ctx.lineTo(wx + ww - 4, shaftTop);
    ctx.lineTo(wx + ww + 44, shaftBot);
    ctx.lineTo(wx - 20, shaftBot);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // vignette
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH / 2.4, VW / 2, VH / 2, VH * 1.02);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(4,2,12,0.34)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VW, VH);
  // scanline halus
  ctx.globalAlpha = .5;
  ctx.fillStyle = scanPat;
  ctx.fillRect(0, 0, VW, VH);
  ctx.globalAlpha = 1;
}

function renderGame() {
  if (!L) { // frame pertama sebelum buildLevel: gambar hitam saja
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, VW, VH);
    return;
  }
  const cx = Math.round(Camera.x + Camera.ox), cy = Math.round(Camera.y + Camera.oy);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, VW, VH);
  ctx.save();
  ctx.translate(-cx, -cy);

  drawTiles(L);
  // dekorasi dinding
  for (const o of L.objects) if (o.deco === 'wall') OBJ_ART[o.type](o, L.t, L.def.theme);
  // kerucut pandang musuh
  for (const e of L.enemies) e.drawCone(L);
  // dekorasi lantai (non-solid)
  for (const o of L.objects) if (o.deco === 'floor' && !o.solid) OBJ_ART[o.type](o, L.t, L.def.theme);

  // entitas diurutkan berdasarkan kedalaman (baseline y)
  const ents = [];
  for (const o of L.objects) {
    if (o.deco === 'wall') continue;
    if (o.deco === 'floor' && !o.solid) continue;
    ents.push({ z: (o.y + o.h) * TILE, f: () => { OBJ_ART[o.type](o, L.t, L.def.theme); drawGlint(o, L.t); } });
  }
  const p = L.player;
  const blink = L.immunity > 0 && (L.t * 10) % 2 < 1;
  const moving = Math.hypot(p.vx, p.vy) > 24;
  if (!blink) ents.push({ z: p.y + p.h, f: () => drawPlayer(p.x + p.w / 2, p.y + p.h + 1, p.dir, moving ? Math.floor(p.walk) % 4 : -1) });
  const c = L.courier;
  if (c.alpha > 0) ents.push({ z: c.y, f: () => { ctx.globalAlpha = c.alpha; drawCourier(c.x, c.y, L.t, L.delivered ? -1 : L.t); ctx.globalAlpha = 1; } });
  for (const e of L.enemies) ents.push({ z: e.y + 6, f: () => e.draw(L.t) });
  ents.sort((a, b) => a.z - b.z);
  for (const en of ents) en.f();

  Particles.draw(cx, cy);
  // overlay debug collision (?debug=1): merah = solid, biru = penghalang pandangan
  if (G.params.get('debug') === '1') {
    for (const r of L.sightRects) { ctx.fillStyle = 'rgba(80,140,255,0.20)'; ctx.fillRect(r.x, r.y, r.w, r.h); }
    for (const r of L.solidRects) { ctx.strokeStyle = 'rgba(255,60,60,0.85)'; ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h); }
  }
  ctx.restore();

  drawLighting(L);

  // kilat tertangkap
  if (L.flash) {
    ctx.fillStyle = 'rgba(' + L.flash.c + ',' + (L.flash.t / .6 * .4).toFixed(3) + ')';
    ctx.fillRect(0, 0, VW, VH);
  }

  // HUD & UI
  UI.begin();
  drawHUD(L);
  if (TOUCH) drawTouchControls(L);
  if (!anyModal() && !L.courierLeaving) {
    // di mode sentuh, petunjuk interaksi digantikan gelembung di atas benda
    if (L.near && !TOUCH) {
      const label = L.near.type === 'machine' ? 'Gunakan Mesin Enkripsi'
        : L.near.type === 'courier' ? 'Bicara dengan Kurir'
        : (L.near.searched ? 'Periksa lagi ' : 'Periksa ') + (L.near.label || 'objek');
      drawPrompt(label);
    }
    // panah penunjuk objektif (disembunyikan saat pemain sudah sangat dekat)
    if (L.found.message && L.found.note && !L.encrypted) {
      const m = L.objects.find(o => o.type === 'machine');
      const mx = (m.x + m.w / 2) * TILE, my = m.y * TILE;
      if (dist(L.player.x + 8, L.player.y + 6, mx, my + m.h * TILE / 2) > 74)
        drawArrowHint(mx, my - 14, L.t, 'MESIN ENKRIPSI');
    } else if (L.encrypted && !L.delivered) {
      if (dist(L.player.x + 8, L.player.y + 6, L.courier.x, L.courier.y - 14) > 92)
        drawArrowHint(L.courier.x, L.courier.y - 40, L.t, 'KURIR');
    }
  }
  if (L.dialog) drawDialogBox(L.dialog);
  if (L.journal) drawJournal(L);
  if (L.machine.open) drawMachineUI(L.machine);
  if (L.courierUI.open) drawCourierUI(L.courierUI);
  if (L.pause) {
    ctx.fillStyle = 'rgba(6,5,14,0.55)';
    ctx.fillRect(0, 0, VW, VH);
    drawPauseMenu(L.pause);
  }
}

/* ============================================================
   HASIL LEVEL (bintang & skor)
   ============================================================ */
function computeResults() {
  const tg = L.def.target, t = L.timer, c = L.catches;
  let stars = 1;
  if (c === 0 && t <= tg) stars = 3;
  else if (c <= 2 && t <= tg + 60) stars = 2;
  const timePts = Math.max(0, Math.round((tg * 2 - t)) * 10);
  const stealth = Math.max(0, 2 - Math.min(c, 2)) * 250;
  const score = timePts + stealth;
  const key = 'lv' + (L.defIndex + 1);
  const best = G.save.best[key] || { stars: 0, score: 0 };
  const newBest = score > best.score;
  if (newBest) best.score = score;
  if (stars > best.stars) best.stars = stars;
  G.save.best[key] = best;
  G.save.unlocked = Math.max(G.save.unlocked, Math.min(3, L.defIndex + 2));
  persist();
  Music.set('title');
  Scenes.go('results', { level: L.defIndex, stars, score, time: t, catches: c, best, newBest, playedStars: 0, rT: 0, sel: 0 });
}

/* bintang pixel (peta 5 sudut) */
const STAR_MAP = [
  '.....#.....',
  '....###....',
  '....###....',
  '###########',
  '.#########.',
  '..#######..',
  '...#####...',
  '..###.###..',
  '..##...##..',
  '.##.....##.',
  '.#.......#.'
];
function drawStar(x, y, r, c) {
  const k = Math.max(1, Math.round(r / 5));
  const ox = Math.round(x) - 5 * k, oy = Math.round(y) - 5 * k;
  ctx.fillStyle = c;
  for (let j = 0; j < STAR_MAP.length; j++)
    for (let i = 0; i < 11; i++)
      if (STAR_MAP[j][i] === '#') ctx.fillRect(ox + i * k, oy + j * k, k, k);
}

/* ============================================================
   SCENES
   ============================================================ */
/* ============================================================
   LATAR MENU UTAMA — hitam berlapis + rumus naik (hologram halus)
   Ditambah: aura mengambang, garis rambut, butir film, tanda sudut,
   judul emas berlapis dengan kilau melintas, tombol gaya kaca gelap.
   Yang dipertahankan: judul + 3 tombol menu (MULAI/PILIH LEVEL/CARA MAIN).
   ============================================================ */
const LUX_COLS = 5;                       // jumlah kolom proyeksi

/* daftar rumus + kedalaman (paralaks: kecil & redup = jauh) */
const LUX_ITEMS = (() => {
  const teks = [
    'f(x) = ax + b', 'f(x) = 2x + 3', 'y = f(x)', 'mod 53',
    'A = 1 \u2026 Z = 26', 'a = \u22121 \u2026 z = \u221226', '\u2423 = 0', '53 prima',
    'f\u207b\u00b9(y) = a\u207b\u00b9(y \u2212 b)', 'x \u2192 ax + b', 'K \u2192 11', '2\u00b711 + 3 = 25',
    '25 \u2192 Y', 'gcd(a, 53) = 1', 'y \u2261 ax + b (mod 53)', 'x \u2208 [\u221226, 26]',
    'c = f(m)', 'm = f\u207b\u00b9(c)', 'a\u00b7x + b \u2261 c', 'x = a\u207b\u00b9(c \u2212 b)',
    'D(E(m, k), k) = m', '\u03b8 = (a\u00b7x + b) mod 53', 'a \u2261 a (mod 53)', 'k \u2208 \u2124\u2085\u2083'
  ];
  const out = [];
  for (let i = 0; i < teks.length; i++) {
    const depth = hash2(i * 31 + 7, 13);
    const col = i % LUX_COLS;
    out.push({
      s: teks[i],
      fx: (col + 0.5) / LUX_COLS + (hash2(i * 5 + 1, 19) - 0.5) * 0.07,
      spd: 6 + depth * 15,
      size: 11 + Math.round(depth * 6),
      a: 0.22 + depth * 0.36,
      off: hash2(i * 11 + 3, 23),
      drift: 5 + depth * 9
    });
  }
  return out;
})();

/* butir film (dibuat sekali, dipakai sebagai pola) */
const LUX_GRAIN = (() => {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 1100; i++) {
    g.fillStyle = 'rgba(255,255,255,' + (0.015 + Math.random() * 0.045).toFixed(3) + ')';
    g.fillRect((Math.random() * 128) | 0, (Math.random() * 128) | 0, 1, 1);
  }
  return c;
})();
let LUX_GRAIN_PAT = null;

/* dasar hitam berlapis + pendar proyeksi dari bawah */
/* lapisan statis di-cache sekali per ukuran layar: gradasi + pendar + horizon + tekstur */
let LUX_BG = null, LUX_BG_W = 0, LUX_BG_H = 0, LUX_BG_KEY = '';
let LUX_VELVET_A = 0.75;          // kepekatan tekstur beludru (aset) saat digambar
function luxBackdropCached() {
  // kunci ikut berubah bila ketersediaan aset berubah (aset telat dimuat pun ikut terpakai)
  const key = (IMG.velvet ? 1 : 0) + ':' + (IMG.dust ? 1 : 0) + ':' + (IMG.emblem ? 1 : 0) + ':' + LUX_VELVET_A;
  if (!LUX_BG || LUX_BG_W !== VW || LUX_BG_H !== VH || LUX_BG_KEY !== key) {
    const c = document.createElement('canvas');
    c.width = VW; c.height = VH;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, '#000000');
    grad.addColorStop(0.55, '#07060c');
    grad.addColorStop(1, '#000000');
    g.fillStyle = grad;
    g.fillRect(0, 0, VW, VH);
    const rg = g.createRadialGradient(VW / 2, VH + 40, 10, VW / 2, VH + 40, VH * 1.1);
    rg.addColorStop(0, 'rgba(232,192,74,0.10)');
    rg.addColorStop(0.5, 'rgba(122,92,200,0.05)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, VW, VH);
    const hy = VH - 24;
    const hg = g.createLinearGradient(0, hy - 18, 0, hy + 6);
    hg.addColorStop(0, 'rgba(232,192,74,0)');
    hg.addColorStop(0.75, 'rgba(232,192,74,0.16)');
    hg.addColorStop(1, 'rgba(232,192,74,0)');
    g.fillStyle = hg;
    g.fillRect(0, hy - 18, VW, 24);
    if (IMG.velvet) {          // tekstur beludru diulang 1:1 (tanpa penyaringan)
      const pat = g.createPattern(IMG.velvet, 'repeat');
      if (pat) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = LUX_VELVET_A;
        g.fillStyle = pat;
        g.fillRect(0, 0, VW, VH);
        g.restore();
      }
    }
    LUX_BG = c; LUX_BG_W = VW; LUX_BG_H = VH; LUX_BG_KEY = key;
  }
  ctx.drawImage(LUX_BG, 0, 0);
}
function luxAura(t) {
  const blobs = [
    { fx: 0.27, fy: 0.66, r: 0.62, c: '112,84,196', a: 0.055, ph: 0 },
    { fx: 0.76, fy: 0.38, r: 0.52, c: '232,192,74', a: 0.045, ph: 2.1 }
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of blobs) {
    const cx = VW * (b.fx + Math.sin(t * 0.05 + b.ph) * 0.035);
    const cy = VH * (b.fy + Math.cos(t * 0.04 + b.ph) * 0.045);
    const r = VH * b.r;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
    g.addColorStop(0, 'rgba(' + b.c + ',' + b.a + ')');
    g.addColorStop(1, 'rgba(' + b.c + ',0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();
}

/* rumus naik dari bawah ke atas, memudar di kedua ujung layar */
function luxFormulas(t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let c = 0; c < LUX_COLS; c++) {                 // kolom proyeksi samar
    const cx = VW * (c + 0.5) / LUX_COLS;
    const cg = ctx.createLinearGradient(0, 0, 0, VH);
    cg.addColorStop(0, 'rgba(122,216,208,0)');
    cg.addColorStop(1, 'rgba(122,216,208,0.05)');
    ctx.fillStyle = cg;
    ctx.fillRect(cx - 48, 0, 96, VH);
  }

  const span = VH + 90;
  for (let i = 0; i < LUX_ITEMS.length; i++) {
    const it = LUX_ITEMS[i];
    const y = VH + 45 - ((t * it.spd + it.off * span) % span);
    const fade = Math.min(1, (VH + 25 - y) / 75) * Math.min(1, (y + 30) / 130);
    let a = it.a * fade;
    if (hash2(i * 17 + 5, Math.floor(t * 1.7)) > 0.965) a *= 0.22;
    if (a <= 0.015) continue;
    const x = Math.round(VW * it.fx + Math.sin(t * 0.3 + i * 1.7) * it.drift);
    const yy = Math.round(y);
    ctx.font = FONT_VT(it.size);
    ctx.fillStyle = 'rgba(122,216,208,' + (a * 0.26).toFixed(3) + ')';
    ctx.fillText(it.s, x, yy + 1);
    ctx.fillText(it.s, x, yy - 1);
    ctx.fillStyle = 'rgba(255,240,196,' + a.toFixed(3) + ')';
    ctx.fillText(it.s, x, yy);
  }
  ctx.restore();
}

/* garis rambut horizontal + tanda sudut (bingkai halus tanpa kotak) */
function luxDustAsset(t) {
  if (!IMG.dust) return false;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;      // sprite kecil -> bundar halus
  for (let i = 0; i < 30; i++) {
    const ph = hash2(i * 7 + 3, 11);
    const sp = 5 + ph * 9;
    const y = VH + 12 - ((t * sp + ph * 400) % (VH + 30));
    const x = 36 + hash2(i * 3 + 1, 5) * (VW - 72) + Math.sin(t * 0.45 + i * 1.3) * 8;
    const fade = Math.min(1, (VH - y) / 50) * Math.min(1, (y + 20) / 90);
    const a = (0.16 + 0.38 * (0.5 + 0.5 * Math.sin(t * 1.5 + i * 2.1))) * fade;
    if (a <= 0.02) continue;
    const size = Math.round((ph > 0.75 ? 24 : 15) * (1 + 0.08 * Math.sin(t * 2 + i)));
    ctx.globalAlpha = Math.min(1, a * 2.0);
    ctx.drawImage(IMG.dust, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
  }
  ctx.restore();
  return true;
}
function luxHairlines() {
  for (let i = 1; i <= 3; i++) {
    ctx.fillStyle = 'rgba(232,192,74,0.06)';
    ctx.fillRect(0, Math.round(VH * i / 4), VW, 1);
  }
}
function luxCorners() {
  const m = 14, L = 18;
  ctx.strokeStyle = 'rgba(232,192,74,0.34)';
  ctx.lineWidth = 1;
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [VW - m, m, -1, 1], [m, VH - m, 1, -1], [VW - m, VH - m, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x + sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * L);
    ctx.stroke();
  }
}
function luxGrain() {
  if (!LUX_GRAIN_PAT) LUX_GRAIN_PAT = ctx.createPattern(LUX_GRAIN, 'repeat');
  if (!LUX_GRAIN_PAT) return;
  ctx.fillStyle = LUX_GRAIN_PAT;
  ctx.fillRect(0, 0, VW, VH);
}

function drawTitleBg(t) {
  luxBackdropCached();  // gradasi + pendar + horizon + tekstur beludru (di-cache)
  luxAura(t);
  luxHairlines();
  luxFormulas(t);
  luxDustAsset(t);      // debu emas (aset)
  luxGrain();
  // vignette penutup supaya tepi larut ke hitam
  const vg = ctx.createRadialGradient(VW / 2, VH * 0.46, VH * 0.32, VW / 2, VH * 0.5, VH * 1.05);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.48)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VW, VH);
  luxCorners();
}

/* ---------- tipografi judul (di kanvas UI agar tajam) ---------- */
function luxRule(x, y, w, c) {
  uictx.fillStyle = c;
  uictx.fillRect(Math.round(x), Math.round(y), Math.round(w), 1);
  const cx = x + w / 2;
  uictx.fillStyle = 'rgba(255,233,168,0.8)';
  uictx.beginPath();
  uictx.moveTo(cx, y - 3); uictx.lineTo(cx + 3, y + 0.5); uictx.lineTo(cx, y + 4); uictx.lineTo(cx - 3, y + 0.5);
  uictx.closePath(); uictx.fill();
}

/* judul emas berlapis + kilau yang melintas pelan */
function luxLogo(t) {
  const g = uictx;
  const text = 'SECRET MAIL', size = 26, sp = 3, by = 72;
  g.save();
  g.font = FONT_PS(size);
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  const adv = [];
  let total = 0;
  for (const ch of text) { const w = g.measureText(ch).width; adv.push(w); total += w + sp; }
  total -= sp;
  const x0 = Math.round(VW / 2 - total / 2);

  // bayangan dalam
  let x = x0;
  g.fillStyle = 'rgba(0,0,0,0.6)';
  for (let i = 0; i < text.length; i++) { g.fillText(text[i], x + 1, by + 2); x += adv[i] + sp; }

  // logam emas
  const metal = g.createLinearGradient(0, by - size + 3, 0, by + 2);
  metal.addColorStop(0, '#fff2cc');
  metal.addColorStop(0.35, '#ffe9a8');
  metal.addColorStop(0.62, '#e8c04a');
  metal.addColorStop(1, '#96701a');
  x = x0;
  g.fillStyle = metal;
  for (let i = 0; i < text.length; i++) { g.fillText(text[i], x, by); x += adv[i] + sp; }

  // lapisan emboss: pantulan terang di tepi atas tiap huruf
  x = x0;
  g.globalAlpha = 0.15;
  g.fillStyle = '#fffdf2';
  for (let i = 0; i < text.length; i++) { g.fillText(text[i], x, by - 1); x += adv[i] + sp; }
  g.globalAlpha = 1;

  // kilau melintas (hanya di atas huruf)
  const ph = (t % 7) / 7;
  if (ph < 0.14) {
    const gx = x0 - 50 + (total + 100) * (ph / 0.14);
    const gl = g.createLinearGradient(gx - 20, 0, gx + 20, 0);
    gl.addColorStop(0, 'rgba(255,255,255,0)');
    gl.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = gl;
    g.fillRect(gx - 22, by - size - 2, 44, size + 6);
    g.globalCompositeOperation = 'source-over';
  }

  // pendar lembut di belakang judul
  const bloom = g.createRadialGradient(VW / 2, by - 9, 8, VW / 2, by - 9, 200);
  bloom.addColorStop(0, 'rgba(232,192,74,0.13)');
  bloom.addColorStop(1, 'rgba(232,192,74,0)');
  g.fillStyle = bloom;
  g.fillRect(VW / 2 - 210, by - 60, 420, 120);
  g.restore();

  // subjudul berjarak huruf + garis pemisah
  const sub = 'PETUALANGAN ENKRIPSI RAHASIA';
  g.save();
  g.font = FONT_VT(14);
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  let sw = 0;
  const sadv = [];
  for (const ch of sub) { const w = g.measureText(ch).width; sadv.push(w); sw += w + 2.4; }
  sw -= 2.4;
  let sx = Math.round(VW / 2 - sw / 2);
  g.fillStyle = 'rgba(232,226,214,0.62)';
  for (let i = 0; i < sub.length; i++) { g.fillText(sub[i], sx, 92); sx += sadv[i] + 2.4; }
  g.restore();
  if (IMG.emblem) {
    // ornamen art-deco (aset, digambar 1:1 di kanvas game supaya tajam)
    const ew = IMG.emblem.width, eh = IMG.emblem.height;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.9;
    ctx.drawImage(IMG.emblem, Math.round(VW / 2 - ew / 2), 96);
    ctx.restore();
  } else {
    luxRule(VW / 2 - 74, 104, 148, 'rgba(232,192,74,0.28)');
  }
}

/* tombol gaya kaca gelap bertepi emas (khusus layar judul) */
function luxButton(x, y, w, h, label, cb, o = {}) {
  const foc = o.focused;
  const now = performance.now();
  const g = uictx;
  if (foc) {                                     // pendar fokus
    const gl = g.createRadialGradient(x + w / 2, y + h / 2, 6, x + w / 2, y + h / 2, w * 0.9);
    gl.addColorStop(0, 'rgba(232,192,74,0.13)');
    gl.addColorStop(1, 'rgba(232,192,74,0)');
    g.fillStyle = gl;
    g.fillRect(x - w * 0.35, y - h, w * 1.7, h * 3);
  }
  const bg = g.createLinearGradient(0, y, 0, y + h);
  bg.addColorStop(0, foc ? 'rgba(40,31,70,0.96)' : 'rgba(20,16,34,0.88)');
  bg.addColorStop(1, foc ? 'rgba(22,17,40,0.96)' : 'rgba(11,8,18,0.88)');
  g.fillStyle = bg;
  g.fillRect(x, y, w, h);
  g.fillStyle = foc ? 'rgba(255,248,226,0.30)' : 'rgba(255,255,255,0.05)';
  g.fillRect(x + 1, y + 1, w - 2, 1);
  g.strokeStyle = foc ? 'rgba(255,233,168,0.85)' : 'rgba(232,192,74,0.26)';
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  g.font = FONT_PS(8);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = foc ? '#ffe9a8' : '#b8b1d6';
  g.fillText(label, x + w / 2, y + h / 2 + 1);
  if (foc) {                                     // penanda berlian berdenyut
    const cx = x - 15, cy = y + h / 2;
    g.save();
    g.globalAlpha = 0.55 + 0.45 * Math.sin(now / 240);
    g.fillStyle = '#ffd75e';
    g.beginPath();
    g.moveTo(cx, cy - 4); g.lineTo(cx + 4, cy); g.lineTo(cx, cy + 4); g.lineTo(cx - 4, cy);
    g.closePath(); g.fill();
    g.restore();
  }
  UI.reg(x - 6, y - 6, w + 12, h + 12, cb, label);
}
function drawStarRow(x, y, n, total, r = 7) {
  for (let i = 0; i < total; i++) {
    const filled = i < n;
    drawStar(x + i * (r * 2 + 8), y, filled ? r : r - 2, filled ? '#ffd75e' : 'rgba(255,255,255,0.15)');
  }
}

const Scenes = {
  cur: 'boot', data: {},
  go(n, d = {}) { this.cur = n; this.data = d; },
  update(dt) { this.fns[this.cur].update(dt); },
  render() { this.fns[this.cur].render(); },
  fns: {
    /* ---------- BOOT ---------- */
    boot: {
      update() { },
      render() {
        ctx.fillStyle = '#0c0a18'; ctx.fillRect(0, 0, VW, VH);
        txt('memuat...', VW / 2, VH / 2, { font: FONT_PS(10), color: '#6a6494', align: 'center' });
      }
    },

    /* ---------- INTRO SINEMATIK (grafik gerak) ---------- */
    cinema: {
      update(dt) {
        const d = Scenes.data;
        d.t = (d.t || 0) + dt;
        d.beat = d.beat || 0;
        while (d.beat < Cinematic.beats.length && d.t >= Cinematic.beats[d.beat].t) {
          Cinematic.beats[d.beat].f();
          d.beat++;
        }
        // tik mesin tik: setiap 3 huruf sandi yang terkunci
        const lock = Cinematic.lockedChars(d.t);
        if (lock > (d.lock || 0)) { if (lock % 3 === 0) SFX.type(); d.lock = lock; }
        if (d.done) return;
        // lewati dengan tombol/ketukan apa pun (mulai 0,6 detik) atau setelah selesai
        const skip = (Input.pressed.size > 0 || Input.mouse.clicked) && d.t > 0.6;
        if (skip || d.t >= Cinematic.T.end) {
          d.done = true;
          if (skip) SFX.uiBack();
          Fade.start(endCinema);
        }
      },
      render() { Cinematic.frame(Scenes.data.t || 0); }
    },

    /* ---------- TITLE ---------- */
    title: {
      update(dt) {
        const d = Scenes.data;
        checkMute();
        d.idx = d.idx ?? 0;
        if (d.idx > 2 || d.idx < 0) d.idx = 0;
        if (Input.press('ArrowUp', 'w', 'W')) { d.idx = (d.idx + 2) % 3; SFX.uiMove(); }
        if (Input.press('ArrowDown', 's', 'S')) { d.idx = (d.idx + 1) % 3; SFX.uiMove(); }
        if (Input.press('Enter', 'e', 'E', ' ')) {
          SFX.uiSelect();
          if (d.idx === 0) startLevel(Math.min(G.save.unlocked, 3) - 1);
          else if (d.idx === 1) Scenes.go('select', { idx: Math.min(G.save.unlocked, 3) - 1 });
          else Scenes.go('how', { page: 0 });
        }
      },
      render() {
        const t = performance.now() / 1000;
        drawTitleBg(t);
        // logo
        // judul emas berlapis + subjudul berjarak huruf + garis pemisah
        luxLogo(t);
        // menu
        UI.begin();
        const opts = ['MULAI', 'PILIH LEVEL', 'CARA MAIN'];
        opts.forEach((o, i) => {
          luxButton(VW / 2 - 92, 196 + i * 42, 184, 32, o, () => {
            if (i === 0) startLevel(Math.min(G.save.unlocked, 3) - 1);
            else if (i === 1) Scenes.go('select', { idx: Math.min(G.save.unlocked, 3) - 1 });
            else Scenes.go('how', { page: 0 });
          }, { focused: Scenes.data.idx === i });
        });
        txt(TOUCH
          ? 'joystick kiri • ketuk gelembung saat dekat benda' + (Snd.muted ? ' • suara MATI' : '')
          : 'WASD/panah gerak • E bicara • TAB jurnal • M suara' + (Snd.muted ? ' (MATI)' : ''),
            VW / 2, VH - 12, { font: FONT_VT(15), color: 'rgba(180,172,214,0.55)', align: 'center' });
      }
    },

    /* ---------- PILIH LEVEL ---------- */
    select: {
      update(dt) {
        const d = Scenes.data;
        checkMute();
        d.idx = d.idx ?? 0;
        if (d.idx > 2 || d.idx < 0) d.idx = Math.min(G.save.unlocked, 3) - 1;
        if (Input.press('ArrowLeft', 'a', 'A')) { d.idx = (d.idx + 2) % 3; SFX.uiMove(); }
        if (Input.press('ArrowRight', 'd', 'D')) { d.idx = (d.idx + 1) % 3; SFX.uiMove(); }
        if (Input.press('Escape')) { Scenes.go('title'); SFX.uiBack(); }
        if (Input.press('Enter', 'e', 'E', ' ')) {
          if (d.idx < G.save.unlocked) { SFX.uiSelect(); startLevel(d.idx); }
          else SFX.deny();
        }
      },
      render() {
        ctx.fillStyle = '#0c0a18'; ctx.fillRect(0, 0, VW, VH);
        drawTitleBg(performance.now() / 1000);
        ctx.fillStyle = 'rgba(8,6,18,0.72)'; ctx.fillRect(0, 0, VW, VH);
        txt('PILIH LEVEL', VW / 2, 44, { font: FONT_PS(16), color: '#ffd75e', align: 'center', shadow: 'rgba(0,0,0,.8)' });
        UI.begin();
        const names = ['KAMAR', 'SEKOLAH', 'LAB RUSAK'];
        const subs = ['Malam Pertama', 'Koridor yang Diawasi', 'Misi Terakhir'];
        const cols = ['#b0785a', '#7fa8c9', '#3ee6d8'];
        for (let i = 0; i < 3; i++) {
          const x = VW / 2 - 270 + i * 180, y = 84, w = 160, h = 190;
          const unlocked = i < G.save.unlocked;
          const focused = Scenes.data.idx === i;
          R(x + 4, y + 6, w, h, 'rgba(0,0,0,0.5)');
          R(x, y, w, h, unlocked ? '#181430' : '#12101f');
          O(x, y, w, h, focused ? '#ffd75e' : '#3a2f66');
          R(x, y, w, 3, cols[i]);
          txt('LEVEL ' + (i + 1), x + w / 2, y + 26, { font: FONT_PS(8), color: cols[i], align: 'center' });
          txt(names[i], x + w / 2, y + 48, { font: FONT_PS(10), color: unlocked ? '#fff' : '#5a5488', align: 'center' });
          txt(subs[i], x + w / 2, y + 68, { font: FONT_VT(15), color: '#8a84b8', align: 'center' });
          if (unlocked) {
            const b = G.save.best['lv' + (i + 1)];
            drawStarRow(x + w / 2 - 34, y + 100, b ? b.stars : 0, 3);
            txt('SKOR TERBAIK', x + w / 2, y + 132, { font: FONT_VT(13), color: '#8a84b8', align: 'center' });
            txt(b ? String(b.score) : '—', x + w / 2, y + 152, { font: FONT_PS(9), color: '#7ae68a', align: 'center' });
          } else {
            R(x + 2, y + 80, w - 4, 70, 'rgba(6,5,14,0.6)');
            iconLock(x + w / 2 - 9, y + 100, '#5a5488');
            txt('SELESAIKAN\nLEVEL SEBELUMNYA'.replace('\n', ' '), x + w / 2, y + 132, { font: FONT_VT(13), color: '#5a5488', align: 'center' });
          }
          UI.reg(x, y, w, h, () => {
            if (unlocked) { Scenes.data.idx = i; startLevel(i); }
            else SFX.deny();
          });
        }
        txt('←→ pilih • ENTER main • ESC menu utama   (bintang & skor terbaikmu tersimpan di sini)',
            VW / 2, VH - 16, { font: FONT_VT(15), color: '#8a84b8', align: 'center' });
      }
    },

    /* ---------- CARA MAIN ---------- */
    how: {
      update(dt) {
        const d = Scenes.data;
        checkMute();
        if (Input.press('ArrowRight', 'd', 'D', 'Enter', 'e', 'E', ' ') || Input.mouse.clicked) {
          if (d.page < 2) { d.page++; SFX.uiMove(); } else { Scenes.go('title'); SFX.uiBack(); }
        }
        if (Input.press('ArrowLeft', 'a', 'A')) { if (d.page > 0) { d.page--; SFX.uiMove(); } }
        if (Input.press('Escape')) { Scenes.go('title'); SFX.uiBack(); }
      },
      render() {
        const d = Scenes.data;
        ctx.fillStyle = '#0c0a18'; ctx.fillRect(0, 0, VW, VH);
        panel(VW / 2 - 250, 40, 500, 280, { title: 'CARA MAIN', accent: '#e8c04a' });
        const pages = [
          TOUCH ? [
            'Joystick kiri-bawah : bergerak',
            'Gelembung di benda : ketuk untuk periksa / bicara',
            'Ikon tas (atas)     : buka jurnal agen',
            'Ikon jeda (atas)    : jeda / menu',
            'Keypad layar        : isi angka & huruf',
            '',
            'Semua bisa dimainkan tanpa keyboard.'
          ] : [
            'WASD / panah  :  bergerak',
            'E / Spasi     :  periksa objek & bicara',
            'TAB           :  buka jurnal agen',
            'ESC           :  jeda / tutup panel',
            'M             :  suara nyala/mati',
            '',
            'Klik mouse juga bisa dipakai untuk tombol.'
          ],
          [
            '1. Temukan PESAN RAHASIA & CATATAN',
            '   FUNGSI f(x) = ax + b  (periksa objek [E])',
            '',
            '2. Masukkan nilai a dan b ke MESIN ENKRIPSI.',
            '   Semua perhitungan dikerjakan mesin —',
            '   kamu akan langsung dapat teks sandi!',
            '',
            '3. Ketik teks sandi itu ke KURIR SURAT.',
            '   Huruf kapital/kecil harus persis!'
          ],
          [
            'Level 2 & 3 dijaga mata-mata / drone:',
            '• Hindari kerucut pandang mereka',
            '• Sembunyi di balik perabot tinggi',
            '• Tertangkap = kembali ke titik awal',
            '  (barang yang sudah ditemukan tetap aman)',
            '',
            'Bintang: ★★★ tanpa tertangkap & cepat,',
            '★★ nyaris sempurna, ★ selesai.',
            'Pesan, fungsi, dan lokasinya selalu berubah',
            'setiap kali main — jangan hafal, pahami!'
          ]
        ];
        const lines = pages[d.page];
        // jarak baris menyesuaikan jumlah baris agar tidak menabrak keterangan halaman
        const lh = lines.length > 11 ? 18 : (lines.length > 9 ? 20 : 22);
        lines.forEach((ln, i) => txt(ln, VW / 2 - 224, 92 + i * lh, { font: FONT_VT(17), color: '#e8e4ff' }));
        txt('halaman ' + (d.page + 1) + '/3   •  → lanjut  ESC kembali', VW / 2, 304, { font: FONT_VT(14), color: '#8a84b8', align: 'center' });
            }
    },

    /* ---------- INTRO LEVEL ---------- */
    intro: {
      update(dt) {
        const d = Scenes.data;
        if (d.li === undefined) { d.li = 0; d.chars = 0; Music.set(null); }
        const lines = LEVELS[d.level].intro;
        d.chars += dt * 46;
        if (Input.press('Enter', 'e', 'E', ' ') || Input.mouse.clicked) {
          if (d.chars < lines[d.li].length) d.chars = lines[d.li].length;
          else if (d.li < lines.length - 1) { d.li++; d.chars = 0; SFX.uiMove(); }
          else { SFX.uiSelect(); Scenes.go('game', { level: d.level }); }
        }
        if (Input.press('Escape')) { SFX.uiSelect(); Scenes.go('game', { level: d.level }); }
      },
      render() {
        const d = Scenes.data, def = LEVELS[d.level];
        const th = def.theme;
        const g = ctx.createLinearGradient(0, 0, 0, VH);
        g.addColorStop(0, th.wallCap); g.addColorStop(1, th.floorA);
        ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
        ctx.fillStyle = 'rgba(8,6,18,0.45)'; ctx.fillRect(0, 0, VW, VH);
        // amplop besar
        ctx.save();
        ctx.translate(VW / 2, 84);
        ctx.rotate(Math.sin(performance.now() / 900) * .06);
        R(-34, -24, 68, 48, '#f0e6d0'); O(-34, -24, 68, 48, '#8a7a5a');
        ctx.strokeStyle = '#8a7a5a';
        ctx.beginPath(); ctx.moveTo(-34, -24); ctx.lineTo(0, 6); ctx.lineTo(34, -24); ctx.stroke();
        iconLock(-9, -6, '#c8503e');
        ctx.restore();
        txt('LEVEL ' + (d.level + 1), VW / 2, 150, { font: FONT_PS(10), color: th.accentLight || '#ffd75e', align: 'center' });
        txt(def.name.toUpperCase(), VW / 2, 178, { font: FONT_PS(22), color: '#fff', align: 'center', shadow: 'rgba(0,0,0,.8)' });
        txt('“ ' + def.subtitle + ' ”', VW / 2, 202, { font: FONT_VT(19), color: '#c8c2e8', align: 'center' });
        const line = def.intro[d.li] || '';
        const shown = line.slice(0, Math.floor(d.chars));
        wrap(shown, FONT_VT(20), 480).forEach((ln, i) =>
          txt(ln, VW / 2, 244 + i * 24, { font: FONT_VT(20), color: '#f0ecff', align: 'center' }));
        const a = (performance.now() / 400 % 1) < .5 ? 1 : .3;
        txt('ENTER ▸', VW - 60, VH - 20, { font: FONT_PS(7), color: '#ffd75e', align: 'right', alpha: a });
            }
    },

    /* ---------- GAMEPLAY ---------- */
    game: {
      update(dt) { updateGame(dt); },
      render() { renderGame(); }
    },

    /* ---------- HASIL ---------- */
    results: {
      update(dt) {
        const d = Scenes.data;
        checkMute();
        d.rT += dt;
        while (d.playedStars < d.stars && d.rT > .5 + d.playedStars * .38) {
          SFX.star(d.playedStars);
          Particles.burst(VW / 2 - 60 + d.playedStars * 60, 128, { n: 14, c: ['#ffd75e', '#fff6d8'], sp: 60, life: .6 });
          d.playedStars++;
        }
        const opts = 3;
        if (d.rT > .6) {
          if (Input.press('ArrowLeft', 'a', 'A')) { d.sel = (d.sel + opts - 1) % opts; SFX.uiMove(); }
          if (Input.press('ArrowRight', 'd', 'D')) { d.sel = (d.sel + 1) % opts; SFX.uiMove(); }
          if (Input.press('Enter', 'e', 'E', ' ')) {
            SFX.uiSelect();
            if (d.sel === 0) {
              if (d.level < 2) startLevel(d.level + 1);
              else Scenes.go('ending');
            } else if (d.sel === 1) Scenes.go('game', { level: d.level, rebuild: true });
            else { Scenes.go('title'); }
          }
        }
      },
      render() {
        const d = Scenes.data;
        renderGame(); // latar level beku
        ctx.fillStyle = 'rgba(6,5,14,0.78)';
        ctx.fillRect(0, 0, VW, VH);
        UI.begin();
        const w = 430, h = 264, x = VW / 2 - w / 2, y = 44;
        panel(x, y, w, h, { title: 'LEVEL SELESAI!', accent: '#7ae68a', bg: '#141a2c' });
        txt(LEVELS[d.level].name.toUpperCase(), x + w / 2, y + 46, { font: FONT_PS(10), color: '#a8c8d8', align: 'center' });
        // bintang
        for (let i = 0; i < 3; i++) {
          const sx = x + w / 2 + (i - 1) * 60, sy = y + 84;
          if (i < d.playedStars) {
            const pop = clamp((d.rT - (.5 + i * .38)) / .3, 0, 1);
            const s = easeOutBack(pop) * 11;
            drawStar(sx, sy, s, i < d.stars ? '#ffd75e' : 'rgba(255,255,255,0.15)');
          } else {
            drawStar(sx, sy, 8, 'rgba(255,255,255,0.10)');
          }
        }
        txt('WAKTU', x + 70, y + 128, { font: FONT_VT(16), color: '#8a84b8' });
        txt(fmtTime(d.time), x + w - 70, y + 128, { font: FONT_PS(9), color: '#fff', align: 'right' });
        txt('TERTANGKAP', x + 70, y + 152, { font: FONT_VT(16), color: '#8a84b8' });
        txt('× ' + d.catches, x + w - 70, y + 152, { font: FONT_PS(9), color: d.catches ? '#ff8a7a' : '#7ae68a', align: 'right' });
        txt('SKOR', x + 70, y + 176, { font: FONT_VT(16), color: '#8a84b8' });
        txt(String(d.score), x + w - 70, y + 176, { font: FONT_PS(9), color: '#ffd75e', align: 'right' });
        if (d.newBest && (performance.now() / 300 % 1) < .6)
          txt('★ REKOR BARU! ★', x + w / 2, y + 202, { font: FONT_PS(8), color: '#7ae68a', align: 'center' });
        else
          txt('target waktu: ' + fmtTime(LEVELS[d.level].target), x + w / 2, y + 202, { font: FONT_VT(14), color: '#5a5488', align: 'center' });
        const opts = [d.level < 2 ? 'LEVEL BERIKUT ▸' : 'TAMAT ▸', 'ULANGI', 'MENU'];
        opts.forEach((o, i) => button(x + 24 + i * 132, y + h - 46, 122, 30, o, () => {
          if (i === 0) { if (d.level < 2) startLevel(d.level + 1); else Scenes.go('ending'); }
          else if (i === 1) Scenes.go('game', { level: d.level, rebuild: true });
          else Scenes.go('title');
        }, { focused: d.sel === i }));
            }
    },

    /* ---------- ENDING ---------- */
    ending: {
      update(dt) {
        if (Input.press('Enter', 'e', 'E', ' ', 'Escape') || Input.mouse.clicked) { SFX.uiSelect(); Scenes.go('title'); }
      },
      render() {
        const t = performance.now() / 1000;
        const g = ctx.createLinearGradient(0, 0, 0, VH);
        g.addColorStop(0, '#0c0a24'); g.addColorStop(.6, '#1c1848'); g.addColorStop(1, '#3a2a5e');
        ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
        for (let i = 0; i < 60; i++) {
          const sx = hash2(i, 5) * VW, sy = hash2(i, 9) * VH;
          ctx.fillStyle = 'rgba(255,240,220,' + (0.3 + 0.5 * (Math.sin(t * 2 + i) > 0 ? 1 : 0)) + ')';
          ctx.fillRect(sx | 0, sy | 0, 2, 2);
        }
        // amplop terbang ke bulan
        const ex = lerp(80, VW - 100, (t * .1) % 1), ey = 120 + Math.sin(t * 2) * 12;
        R(ex - 14, ey - 10, 28, 20, '#f0e6d0'); O(ex - 14, ey - 10, 28, 20, '#8a7a5a');
        ctx.strokeStyle = '#8a7a5a';
        ctx.beginPath(); ctx.moveTo(ex - 14, ey - 10); ctx.lineTo(ex, ey + 3); ctx.lineTo(ex + 14, ey - 10); ctx.stroke();
        CIR(VW - 90, 90, 26, '#f0ead8'); CIR(VW - 97, 84, 5, '#d8d0bc'); CIR(VW - 80, 98, 4, '#d8d0bc');
        txt('MISI SELESAI!', VW / 2, 180, { font: FONT_PS(20), color: '#ffd75e', align: 'center', shadow: 'rgba(0,0,0,.8)' });
        let total = 0;
        for (let i = 1; i <= 3; i++) total += (G.save.best['lv' + i] || { stars: 0 }).stars;
        drawStarRow(VW / 2 - 46, 214, total, 9, 5);
        txt('bintang terkumpul: ' + total + ' / 9', VW / 2, 238, { font: FONT_VT(17), color: '#c8c2e8', align: 'center' });
        wrap('Kau telah membuktikan satu hal penting: pesan aman bukan karena jalannya tersembunyi, tetapi karena isinya terkunci — dan hanya penerima yang tepat yang memegang kuncinya.', FONT_VT(19), 460).forEach((ln, i) =>
          txt(ln, VW / 2, 262 + i * 22, { font: FONT_VT(19), color: '#f0ecff', align: 'center' }));
        txt('SECRET MAIL • dibuat dengan piksel & matematika', VW / 2, VH - 24, { font: FONT_VT(15), color: '#8a84b8', align: 'center' });
        txt('ENTER ▸ menu utama', VW - 40, VH - 8, { font: FONT_PS(7), color: '#ffd75e', align: 'right', alpha: (performance.now() / 400 % 1) < .5 ? 1 : .3 });
            }
    }
  }
};

function startLevel(i) {
  Fade.start(() => Scenes.go('intro', { level: i }));
}

/* ---------- Intro sinematik ---------- */
/* Setelah intro: simpan tanda "sudah pernah" & masuk ke menu utama */
function endCinema() {
  G.save.intro = 1;
  persist();
  Music.set('title');
  Scenes.go('title', { idx: 0 });
}

/* Perlu putar intro? ?intro=1 paksa, ?intro=0 lewati, selain itu sekali saja */
function introWanted() {
  const p = G.params.get('intro');
  if (p === '0' || p === 'false') return false;
  if (p === '1' || p === 'true') return true;
  return !G.save.intro;
}
