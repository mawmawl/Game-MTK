'use strict';
/* ============================================================
   SECRET MAIL — main.js
   Boot, save/load, game loop 60fps.
   ============================================================ */

const G = {
  params: new URLSearchParams(location.search),
  save: null
};

const SAVE_KEY = 'secretMailV1';
const SAVE_KEY_OLD = 'kurirSandiV1';   // migrasi dari nama game lama

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(SAVE_KEY_OLD);
    const s = JSON.parse(raw);
    if (s && typeof s.unlocked === 'number') return s;
  } catch (e) { /* abaikan */ }
  return { unlocked: 1, best: {}, muted: false };
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.save)); } catch (e) { /* abaikan */ }
}

function boot() {
  G.save = loadSave();
  Snd.muted = !!G.save.muted;
  if (G.params.has('mute')) Snd.muted = G.params.get('mute') === '1';
  Scenes.go(introWanted() ? 'cinema' : 'title');
  Music.set(introWanted() ? 'intro' : 'title');

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    Fade.update(dt);
    uiBegin();
    try {
      Scenes.update(dt);
      Scenes.render();
      if (TouchUI.blocking) {
        // petunjuk putar layar (potret): ketukan pertama hanya menutup petunjuk
        TouchUI.drawHint();
        if (Input.mouse.clicked || Input.pressed.size > 0) TouchUI.hintOff = true;
        TouchUI.consume();
      } else {
        UI.process(); // klik diproses terhadap tombol frame ini (posisi segar)
      }
    } catch (e) {
      // satu frame buruk tidak boleh membekukan game
      console.error(e);
    }
    Music.update();
    Fade.draw();
    Input.endFrame();
    // kursor pointer saat di atas tombol
    canvas.style.cursor = UI.hovering ? 'pointer' : 'default';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* Aset gambar lokal. Bila gagal dimuat, lapisan aset dilewati dan game tetap jalan. */
const IMG = {};
const IMG_LIST = [
  ['velvet', 'assets/tex/velvet.png'],
  ['dust', 'assets/tex/golddust.png'],
  ['emblem', 'assets/emblem.png']
];
function loadAssets(cb) {
  let done = false;
  const finish = () => { if (!done) { done = true; cb(); } };
  let left = IMG_LIST.length;
  if (!left) return finish();
  IMG_LIST.forEach(([key, src]) => {
    const im = new Image();
    const step = () => {
      IMG[key] = (im.complete && im.naturalWidth) ? im : null;
      if (--left === 0) finish();
    };
    im.onload = step;
    im.onerror = step;
    im.src = src;
  });
  setTimeout(finish, 2500); // jangan biarkan permintaan menggantung menahan game
}

/* Tunggu font pixel + aset siap agar tampilan tidak melompat */
if (document.fonts && document.fonts.ready) {
  let started = false;
  const go = () => { if (!started) { started = true; loadAssets(boot); } };
  document.fonts.ready.then(go);
  setTimeout(go, 2500); // jaga-jaga bila font gagal dimuat (offline)
} else loadAssets(boot);

/* Tombol UI hover → untuk kursor */
(function patchHover() {
  const origReg = UI.reg.bind(UI);
  // teruskan SEMUA argumen (termasuk label) agar pembungkus ini tidak membuangnya
  UI.reg = (...args) => {
    origReg(...args);
    const b = UI.buttons[UI.buttons.length - 1];
    if (Input.mouse.x >= b.x && Input.mouse.x <= b.x + b.w &&
        Input.mouse.y >= b.y && Input.mouse.y <= b.y + b.h) UI.hovering = true;
  };
})();

/* Ekspos untuk pengujian otomatis / debugging */
window.game = {
  G, Scenes, Input, Crypto,
  get level() { return L; },
  tp(tx, ty) { // teleport pemain ke tile (alat bantu uji)
    if (!L) return;
    L.player.x = tx * TILE + 8;
    L.player.y = ty * TILE + 10;
    L.player.vx = L.player.vy = 0;
  },
  goto(scene, data) { Scenes.go(scene, data); }
};
