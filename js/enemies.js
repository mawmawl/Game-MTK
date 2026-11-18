'use strict';
/* ============================================================
   SECRET MAIL — enemies.js
   AI mata-mata & drone: patroli -> waspada -> kejar -> tertangkap.
   Kerucut penglihatan terhalang perabot tinggi (bisa sembunyi).
   ============================================================ */

class Enemy {
  constructor(def, level) {
    this.type = def.type;            // 'spy' | 'drone'
    this.speed = def.speed;
    this.chaseSpeed = def.chaseSpeed;
    this.range = def.range;
    this.halfA = this.type === 'drone' ? 0.62 : 0.55;
    this.path = def.path.map(p => ({ x: (p[0] + .5) * TILE, y: (p[1] + .5) * TILE }));
    this.wp = 0;
    this.x = this.path[0].x;
    this.y = this.path[0].y;
    this.w = 18; this.h = 12;
    this.vx = 0; this.vy = 0;
    this.fx = 1; this.fy = 0;        // arah pandang
    this.state = 'patrol';           // patrol | chase | search
    this.susT = 0;
    this.loseT = 0;
    this.walk = 0;
    this.alertFlash = 0;
    this.look = def.look || null;    // 'guard' = satpam hi-vis, null = mata-mata
    /* pengawas macet: kalau jalur ke waypoint tertahan perabot, penjaga
       harus mengambil waypoint berikutnya, bukan mendorong dinding terus. */
    this.stuckT = 0;
    this.lastX = this.x;
    this.lastY = this.y;
  }

  eye() { return { x: this.x, y: this.y - 10 }; }

  canSee(player, level) {
    if (level.immunity > 0) return false;
    const e = this.eye();
    const px = player.x + player.w / 2, py = player.y + player.h / 2;
    const d = dist(e.x, e.y, px, py);
    if (d > this.range) return false;
    const ang = Math.atan2(py - e.y, px - e.x);
    const myAng = Math.atan2(this.fy, this.fx);
    let diff = Math.abs(ang - myAng);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff > this.halfA && d > 34) return false;  // sangat dekat tetap terlihat
    return !losBlocked(e.x, e.y, px, py, level.sightRects);
  }

  update(dt, level, player) {
    const spd = this.state === 'chase' ? this.chaseSpeed : this.speed;
    let tx, ty;

    if (this.state === 'patrol') {
      const tgt = this.path[this.wp];
      tx = tgt.x; ty = tgt.y;
      if (dist(this.x, this.y, tx, ty) < 6) {
        this.wp = (this.wp + 1) % this.path.length;
      }
      if (this.canSee(player, level)) {
        this.susT += dt;
        if (this.susT > 0.3) {
          this.state = 'chase';
          this.loseT = 0;
          this.alertFlash = 1;
          SFX.alert();
          Camera.shake(2, .15);
        }
      } else this.susT = Math.max(0, this.susT - dt * 2);

    } else if (this.state === 'chase') {
      if (this.canSee(player, level)) {
        this.loseT = 0;
        tx = player.x + player.w / 2;
        ty = player.y + player.h / 2;
      } else {
        this.loseT += dt;
        /* revisi: 3 detik pemain tidak terlihat -> penjaga kembali patroli
           seperti biasa (tidak lagi mampir ke keadaan 'search'). */
        if (this.loseT > 3) { this.state = 'patrol'; this.loseT = 0; this.susT = 0; this.lastSeen = null; }
        tx = this.lastSeen ? this.lastSeen.x : this.x;
        ty = this.lastSeen ? this.lastSeen.y : this.y;
      }
      if (this.canSee(player, level)) this.lastSeen = { x: tx, y: ty };
      // sentuh pemain -> tertangkap
      const px = player.x + player.w / 2, py = player.y + player.h / 2;
      if (level.immunity <= 0 && dist(this.x, this.y, px, py) < 20) {
        onPlayerCaught(this, level);
        return;
      }

    } else { // search: berdiri sebentar mengintip, lalu kembali patroli
      this.loseT += dt;
      const px = player.x + player.w / 2, py = player.y + player.h / 2;
      if (this.canSee(player, level)) { this.state = 'chase'; this.loseT = 0; return; }
      if (this.loseT > 1.6) { this.state = 'patrol'; this.loseT = 0; this.susT = 0; }
      // tetap berputar menghadap sekeliling
      this.fx = Math.cos(this.loseT * 3);
      this.fy = Math.sin(this.loseT * 3);
      this.vx = this.vy = 0;
      this.updateAlertFlash(dt);
      return;
    }

    // gerak menuju target
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.vx = dx / d * spd;
    this.vy = dy / d * spd;
    if (this.type === 'spy') {
      moveActor(this, level.solidRects, dt);
    } else {
      // drone melayang: hanya dibatasi ruangan
      this.x = clamp(this.x + this.vx * dt, TILE * 1.5, level.roomW - TILE * 1.5);
      this.y = clamp(this.y + this.vy * dt, TILE * 2.2, level.roomH - TILE * 1.6);
    }
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > 1) {
      this.fx = this.vx / sp; this.fy = this.vy / sp;
      this.walk += sp * dt * 0.22;
    }
    /* --- pengawas macet (hanya saat patroli; mengejar tidak dihitung) --- */
    const gerak = Math.hypot(this.x - this.lastX, this.y - this.lastY);
    this.lastX = this.x; this.lastY = this.y;
    if (this.state === 'patrol') {
      if (gerak < spd * dt * 0.3) this.stuckT += dt;
      else this.stuckT = Math.max(0, this.stuckT - dt * 2);
      if (this.stuckT > 0.7) {
        this.wp = (this.wp + 1) % this.path.length;
        this.stuckT = 0;
        /* kalau dua kali berturut-turut gagal, pindahkan ke waypoint terdekat
           yang benar-benar kosong supaya penjaga tidak berputar di tempat */
        this.gagalWp = (this.gagalWp || 0) + 1;
        if (this.gagalWp >= 3) { this.gagalWp = 0; this.snapKeJalur(level); }
      } else if (gerak > 4) this.gagalWp = 0;
    } else { this.stuckT = 0; this.gagalWp = 0; }

    this.updateAlertFlash(dt);
  }

  /* pindah ke waypoint terdekat yang kotaknya tidak menabrak apa pun */
  snapKeJalur(level) {
    let best = null, bd = 1e9;
    for (const q of this.path) {
      if (this.kotakBentrok(q.x, q.y, level)) continue;
      const d = dist(this.x, this.y, q.x, q.y);
      if (d < bd) { bd = d; best = q; }
    }
    if (best) { this.x = best.x; this.y = best.y; this.wp = this.path.indexOf(best); this.stuckT = 0; }
  }
  kotakBentrok(cx, cy, level) {
    const hw = this.w / 2, hh = this.h / 2;
    const r = { x: cx - hw, y: cy - hh, w: this.w, h: this.h };
    for (const s of level.solidRects || []) {
      if (r.x < s.x + s.w && r.x + r.w > s.x && r.y < s.y + s.h && r.y + r.h > s.y) return true;
    }
    return false;
  }

  updateAlertFlash(dt) { if (this.alertFlash > 0) this.alertFlash -= dt; }

  draw(t) {
    if (this.type === 'spy') {
      const dir = Math.abs(this.fx) > Math.abs(this.fy) ? (this.fx < 0 ? 'left' : 'right') : (this.fy < 0 ? 'up' : 'down');
      if (this.look === 'guard') drawSpy(this.x, this.y + 6, dir, Math.floor(this.walk) % 4, PAL_GUARD, 'cap');
      else drawSpy(this.x, this.y + 6, dir, Math.floor(this.walk) % 4);
    } else {
      drawDrone(this.x, this.y, t, this.state === 'chase');
    }
    // gelembung status
    const bx = this.x, by = this.y - 34;
    if (this.state === 'chase' || this.alertFlash > 0) {
      CIR(bx, by, 7, '#c8283c');
      CIR(bx, by, 6, '#ff4a5a');
      txt('!', bx, by + 6, { font: FONT_PS(8), color: '#fff', align: 'center' });
    } else if (this.susT > 0.05) {
      CIR(bx, by, 7, '#b8902a');
      CIR(bx, by, 6, '#ffd24a');
      txt('?', bx, by + 6, { font: FONT_PS(8), color: '#3a2a10', align: 'center' });
    }
  }

  drawCone(level) {
    const e = this.eye();
    const myAng = Math.atan2(this.fy, this.fx);
    const pts = [[e.x, e.y]];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const a = myAng - this.halfA + (2 * this.halfA) * i / steps;
      let dd = 8;
      const maxD = this.range;
      while (dd < maxD) {
        const x = e.x + Math.cos(a) * dd, y = e.y + Math.sin(a) * dd;
        if (pointInRects(x, y, level.sightRects)) break;
        dd += 8;
      }
      pts.push([e.x + Math.cos(a) * dd, e.y + Math.sin(a) * dd]);
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = this.state === 'chase' ? 'rgba(255,64,54,0.24)' :
      this.state === 'search' ? 'rgba(255,170,50,0.20)' : 'rgba(255,190,40,0.18)';
    ctx.fill();
    ctx.strokeStyle = this.state === 'chase' ? 'rgba(255,90,80,0.5)' : 'rgba(255,210,90,0.42)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/* pemain tertangkap: hentakan + denyut merah, kembali ke titik awal, catat */
function onPlayerCaught(enemy, L) {
  L.catches++;
  L.immunity = 2.6;
  /* revisi: nyawa 3. Habis -> misi gagal, ulang dari level sebelumnya. */
  if (!L.gagal) {
    L.lives = Math.max(0, (L.lives === undefined ? 3 : L.lives) - 1);
    Particles.text(L.player.x + 8, L.player.y - 30,
      'NYAWA ' + L.lives + '/3', L.lives <= 1 ? '#ff6a5a' : '#ffd75e');
    if (L.lives <= 0) {
      L.gagal = true;
      /* revisi: nyawa habis -> OTOMATIS mengulang level yang sama (bukan
         kembali ke level sebelumnya). Nyawa kembali 3 karena level dibangun
         ulang. Dialog menutup sendiri 2,4 detik setelah teks selesai. */
      openDialog('MISI GAGAL', 'Tertangkap 3 kali — nyawa habis. ' + L.def.name +
        ' diulang otomatis dari awal, nyawa kembali 3.',
        () => { Fade.start(() => { Scenes.go('game', { level: L.defIndex, rebuild: true }); }); },
        '#ff8a7a', 2.4);
      SFX.deny();
    }
  }
  L.flash = { t: 0.6, c: '255,60,60' };
  L.pulse = { t: 0.75, t0: 0.75, c: '255,70,60' };   // denyut tepi layar
  L.hitstop = 0.16;                        // dunia beku sesaat -> tangkapan terasa "kena"
  SFX.caught();
  Camera.shake(5, 0.5);
  Particles.burst(L.player.x + 8, L.player.y + 6, { n: 16, c: ['#ff6a5a', '#ffd0c0', '#8a2020'], sp: 90, life: .7 });
  // kembali ke titik awal
  const st = L.def.playerStart;
  L.player.x = st.x * TILE + (TILE - L.player.w) / 2;
  L.player.y = st.y * TILE + (TILE - L.player.h) / 2;
  L.player.vx = L.player.vy = 0;
  // musuh kembali ke jalur
  enemy.state = 'patrol';
  enemy.susT = 0;
  enemy.loseT = 0;
  enemy.alertFlash = 0;
  // cari waypoint terdekat
  let bi = 0, bd = 1e9;
  enemy.path.forEach((p, i) => {
    const d = dist(enemy.x, enemy.y, p.x, p.y);
    if (d < bd) { bd = d; bi = i; }
  });
  enemy.wp = bi;
  Particles.text(L.player.x + 8, L.player.y - 14, 'TERTANGKAP!', '#ff8a7a');
}
