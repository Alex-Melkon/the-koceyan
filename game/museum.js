/* ==========================================================================
   MUSEUM MODE — a retro third-person walk-through of Alex Koceyan's work.
   Loaded by index2.html. Reads the site's own data (ILL, ILL_INFO, PROJECTS,
   MURALS, src) so anything added to the site shows up on the museum walls.
   The 3D engine (three.js) is only downloaded when the toggle is clicked.
   ========================================================================== */
(() => {
  "use strict";

  const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js";
  const FONT_URL = "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap";
  const PIXEL = '"Press Start 2P", ui-monospace, "Courier New", monospace';

  /* ---------------- floor plan (metres; north is -z) ---------------- */
  const H = 6, DOOR_H = 3.6, R = 0.45;           // wall height, door height, player radius
  const RENDER_H = 360;                           // internal resolution (the retro look)
  const ROOMS = {
    lobby: { name: "LOBBY",               x0: -8,  x1: 8,   z0: -6,  z1: 6,  wall: "#2f6b3a", floor: ["#ece6d6", "#2b7a34"], gaps: { N: [-2, 2], W: [-2, 2], E: [-2, 2] } },
    ill:   { name: "ILLUSTRATION HALL",   x0: -16, x1: 16,  z0: -36, z1: -8, wall: "#6a1f26", floor: ["#8c5c36", "#7a4c2a"], gaps: { S: [-2, 2] } },
    gd:    { name: "GRAPHIC DESIGN WING", x0: -30, x1: -10, z0: -7,  z1: 7,  wall: "#e6e1d6", floor: ["#d2cdc0", "#bdb7a8"], gaps: { E: [-2, 2] } },
    mur:   { name: "THE MURAL YARD",      x0: 10,  x1: 42,  z0: -7,  z1: 17, outdoor: true },   // open air: see buildYard()
  };
  const DOORS = [
    { x0: -2,  x1: 2,  z0: -8, z1: -6, ax: "z" },   // lobby <-> illustration
    { x0: -10, x1: -8, z0: -2, z1: 2,  ax: "x" },   // lobby <-> graphic design
    { x0: 8,   x1: 10, z0: -2, z1: 2,  ax: "x" },   // lobby <-> murals
  ];
  const BENCHES = [
    { x0: -3, x1: 3, z0: -16.6, z1: -15.4 }, { x0: -3, x1: 3, z0: -28.6, z1: -27.4 },
    { x0: -21.5, x1: -18.5, z0: -0.6, z1: 0.6 }, { x0: 24, x1: 28, z0: 4.4, z1: 5.6, out: true },
  ];
  // freestanding walls in the yard, one mural each (the last one carries the in-progress photos)
  const SLABS = [
    { cx: 19,   cz: -3.5, w: 9.5,  h: 5.6, along: "x", nx: 0,  nz: 1 },
    { cx: 32,   cz: -3.5, w: 7,    h: 5.6, along: "x", nx: 0,  nz: 1 },
    { cx: 19,   cz: 13.5, w: 9.5,  h: 5.6, along: "x", nx: 0,  nz: -1 },
    { cx: 32.5, cz: 13.5, w: 10.5, h: 5.6, along: "x", nx: 0,  nz: -1 },
    { cx: 40.2, cz: 5,    w: 9.5,  h: 5.6, along: "z", nx: -1, nz: 0 },
  ];
  const LAMPS = [{ x: 14.5, z: 7.5 }, { x: 26, z: 1.2 }, { x: 26, z: 9.2 }, { x: 36.5, z: -1 }];
  const BLOCKERS = BENCHES.concat(
    SLABS.map((s) => (s.along === "x" ? { x0: s.cx - s.w / 2, x1: s.cx + s.w / 2, z0: s.cz - 0.3, z1: s.cz + 0.3 } : { x0: s.cx - 0.3, x1: s.cx + 0.3, z0: s.cz - s.w / 2, z1: s.cz + s.w / 2 })),
    LAMPS.map((l) => ({ x0: l.x - 0.15, x1: l.x + 0.15, z0: l.z - 0.15, z1: l.z + 0.15 })));
  const START = { x: 0, z: 1.2, yaw: 0 };

  function walkable(x, z, r = R) {
    for (const b of BLOCKERS) if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return false;
    for (const k in ROOMS) { const m = ROOMS[k]; if (x >= m.x0 + r && x <= m.x1 - r && z >= m.z0 + r && z <= m.z1 - r) return true; }
    for (const d of DOORS) {
      if (d.ax === "z" && x >= d.x0 + r && x <= d.x1 - r && z >= d.z0 - r - 0.25 && z <= d.z1 + r + 0.25) return true;
      if (d.ax === "x" && z >= d.z0 + r && z <= d.z1 - r && x >= d.x0 - r - 0.25 && x <= d.x1 + r + 0.25) return true;
    }
    return false;
  }
  function roomAt(x, z) {
    for (const k in ROOMS) { const m = ROOMS[k]; if (x >= m.x0 && x <= m.x1 && z >= m.z0 && z <= m.z1) return k; }
    return null;
  }

  /* ---------------- styles + nav toggle ---------------- */
  const css = `
  .game-toggle{font-family:${PIXEL};font-size:10px;line-height:1;letter-spacing:.02em;text-transform:uppercase;color:#8dff9a;background:#111;border:2px solid #111;padding:9px 11px 8px;cursor:pointer;box-shadow:3px 3px 0 var(--green,#2b7a34);display:inline-flex;align-items:center;gap:9px;white-space:nowrap;transition:transform .12s,box-shadow .12s,background .12s}
  .game-toggle .gt-sw{position:relative;width:26px;height:12px;border:2px solid #8dff9a;flex:none}
  .game-toggle .gt-sw i{position:absolute;top:1px;left:1px;width:8px;height:6px;background:#8dff9a;animation:mg-blink 1s steps(2,jump-none) infinite}
  @media (hover:hover){.game-toggle:hover{transform:translate(-2px,-2px);box-shadow:5px 5px 0 var(--green,#2b7a34)}.game-toggle:hover .gt-sw i{left:13px;animation:none}}
  .game-toggle:focus-visible{outline:3px solid var(--green,#2b7a34);outline-offset:3px}
  .game-toggle .gt-txt{display:grid;gap:4px;text-align:left;font-size:8px}
  @media (min-width:721px){
    nav.has-game{gap:clamp(9px,1.3vw,18px)}
    nav.has-game a:not(.cta){font-size:clamp(12px,1.5vw,19.5px)}
    nav.has-game a.cta{font-size:clamp(12px,1.3vw,18px);margin-left:0}
    .game-toggle{padding:7px 9px 6px;gap:8px}
  }
  @media (max-width:1040px) and (min-width:721px){
    .game-toggle .gt-txt{display:none}.game-toggle{padding:9px 8px}
    header .logo{width:clamp(165px,22vw,280px)}   /* the bar was already too wide for small laptop windows */
  }
  @media (max-width:720px){.game-toggle{justify-content:center;margin-top:14px;padding:13px 11px 12px}.game-toggle .gt-txt{display:block;font-size:11px}.game-toggle .gt-txt span+span::before{content:" "}}
  @keyframes mg-blink{50%{opacity:.25}}

  #mg{position:fixed;inset:0;z-index:1000;background:#050505;color:#f4f1e6;font-family:${PIXEL};font-size:11px;line-height:1.7;display:none;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:none}
  #mg:focus{outline:none}
  #mg .mg-card,#mg .mg-look .txt{touch-action:pan-y}
  #mg.on{display:block;animation:mg-crt-on .5s steps(12) both}
  #mg.off{animation:mg-crt-off .28s steps(8) both}
  @keyframes mg-crt-on{0%{clip-path:inset(49.6% 0 49.6% 0);filter:brightness(6)}45%{clip-path:inset(49.6% 0 49.6% 0);filter:brightness(6)}100%{clip-path:inset(0);filter:none}}
  @keyframes mg-crt-off{to{clip-path:inset(49.8% 0 49.8% 0);filter:brightness(5)}}
  #mg canvas.mg-view{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;image-rendering:crisp-edges;display:block}
  #mg .mg-scan{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.2) 0 1px,transparent 1px 3px),radial-gradient(ellipse at center,transparent 58%,rgba(0,0,0,.5) 100%)}
  #mg button{font:inherit;color:inherit;cursor:pointer}
  #mg .mg-top{position:absolute;top:14px;left:14px;right:14px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;pointer-events:none}
  #mg .mg-top > *{pointer-events:auto}
  #mg .mg-exit{background:#111;border:2px solid #f4f1e6;padding:9px 11px 8px;display:inline-flex;gap:9px;align-items:center;box-shadow:3px 3px 0 #2b7a34;line-height:1}
  #mg .mg-exit:hover{background:#f4f1e6;color:#111}
  #mg .mg-exit .gt-sw{position:relative;width:26px;height:12px;border:2px solid currentColor;flex:none}
  #mg .mg-exit .gt-sw i{position:absolute;top:1px;left:13px;width:8px;height:6px;background:#8dff9a}
  #mg .mg-room{margin-top:10px;color:#8dff9a;text-shadow:2px 2px 0 #000;pointer-events:none}
  #mg .mg-time{display:none;margin-top:8px;padding:0;background:none;border:0;font-size:9px;line-height:1.6;text-align:left;color:#f4f1e6;text-shadow:1px 1px 0 #000}
  #mg .mg-time.show{display:block}
  #mg .mg-map{border:2px solid #f4f1e6;background:rgba(0,0,0,.6);image-rendering:pixelated;display:block}
  #mg .mg-keys{margin-top:6px;text-align:right;font-size:8px;opacity:.75;text-shadow:1px 1px 0 #000}
  #mg .mg-cap{position:absolute;left:50%;bottom:26px;transform:translateX(-50%);max-width:min(760px,calc(100% - 32px));background:rgba(8,8,8,.88);border:2px solid #f4f1e6;padding:11px 16px 9px;text-align:center;box-shadow:4px 4px 0 #2b7a34;display:none}
  #mg .mg-cap.show{display:block}
  #mg .mg-cap b{display:block;font-weight:400;color:#fff}
  #mg .mg-cap span{display:block;color:#8dff9a;font-size:9px;margin-top:3px;animation:mg-blink 1s steps(2,jump-none) infinite}

  #mg .mg-card{position:absolute;inset:0;background:#050505;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center;overflow:auto}
  #mg .mg-card.hide{display:none}
  #mg .mg-card-in{max-width:680px;width:100%}
  #mg .mg-kick{color:#8dff9a;font-size:10px;letter-spacing:.1em}
  #mg h2{font:400 clamp(20px,4.6vw,40px)/1.25 ${PIXEL};margin:14px 0 6px;color:#fff;text-shadow:4px 4px 0 #2b7a34}
  #mg .mg-sub{font-size:10px;opacity:.8;margin:0 0 26px}
  #mg .mg-how{display:grid;grid-template-columns:auto 1fr;gap:14px 20px;align-items:center;text-align:left;border:2px solid #f4f1e6;padding:20px 22px;margin:0 auto 24px;max-width:560px;background:#0c0c0c;box-shadow:6px 6px 0 #2b7a34}
  #mg .mg-how .k{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end;max-width:210px}
  #mg kbd{font:inherit;font-size:10px;display:inline-block;min-width:28px;text-align:center;padding:6px 6px 4px;border:2px solid #f4f1e6;border-bottom-width:4px;background:#1b1b1b;color:#fff;line-height:1.2}
  #mg kbd.ar{font:700 15px/1 system-ui,"Segoe UI Symbol",sans-serif;padding:4px 6px 3px}
  #mg .mg-how .d{font-size:10px}
  #mg .mg-how .or{font-size:8px;opacity:.6;align-self:center}
  #mg .mg-load{height:14px;border:2px solid #f4f1e6;max-width:320px;margin:0 auto 10px;padding:2px}
  #mg .mg-load i{display:block;height:100%;width:0;background:#8dff9a;transition:width .2s steps(6)}
  #mg .mg-status{font-size:9px;opacity:.8;min-height:1.7em}
  #mg .mg-start{margin-top:8px;background:#8dff9a;color:#0a0a0a;border:0;padding:15px 20px 12px;font-size:12px;box-shadow:4px 4px 0 #f4f1e6;display:none}
  #mg .mg-start.ready{display:inline-block;animation:mg-blink 1.1s steps(2,jump-none) infinite}
  #mg .mg-start:hover{animation:none;background:#fff}
  #mg .mg-touchnote{display:none;font-size:9px;opacity:.75;margin:-8px 0 20px}

  #mg .mg-look{position:absolute;inset:0;background:rgba(4,4,4,.93);display:none;grid-template-columns:minmax(0,1.5fr) minmax(240px,1fr);gap:26px;align-items:center;padding:64px clamp(16px,4vw,56px) 28px}
  #mg .mg-look.show{display:grid}
  #mg .mg-look .pic{min-height:0;height:100%;display:flex;align-items:center;justify-content:center}
  #mg .mg-look img{max-width:100%;max-height:100%;object-fit:contain;border:4px solid #f4f1e6;box-shadow:8px 8px 0 #2b7a34;background:#111}
  #mg .mg-look .txt{max-height:100%;overflow:auto;user-select:text;-webkit-user-select:text}
  #mg .mg-look .tag{color:#8dff9a;font-size:9px;letter-spacing:.08em}
  #mg .mg-look h3{font:400 clamp(14px,1.9vw,20px)/1.5 ${PIXEL};margin:10px 0 12px;color:#fff}
  #mg .mg-look p{font:400 15px/1.6 "Bitter",Georgia,serif;color:#e9e5d8;margin:0 0 16px}
  #mg .mg-look .acts{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}
  #mg .mg-look .acts button{background:#111;border:2px solid #f4f1e6;padding:10px 12px 8px;font-size:9px;line-height:1.4}
  #mg .mg-look .acts button.go{background:#8dff9a;color:#0a0a0a;border-color:#8dff9a}
  #mg .mg-look .acts button:hover{background:#f4f1e6;color:#111;border-color:#f4f1e6}

  #mg .mg-pad{position:absolute;left:18px;bottom:22px;display:none;grid-template-columns:repeat(3,56px);grid-template-rows:repeat(2,56px);gap:6px}
  #mg .mg-pad button,#mg .mg-act{background:rgba(10,10,10,.72);border:2px solid #f4f1e6;font-size:16px;line-height:1;touch-action:none}
  #mg .mg-pad .u{grid-column:2;grid-row:1}#mg .mg-pad .l{grid-column:1;grid-row:2}#mg .mg-pad .dn{grid-column:2;grid-row:2}#mg .mg-pad .r{grid-column:3;grid-row:2}
  #mg .mg-act{position:absolute;right:22px;bottom:34px;width:76px;height:76px;border-radius:50%;display:none;font-size:10px;color:#0a0a0a;background:#8dff9a;border-color:#0a0a0a}
  @media (pointer:coarse){
    #mg .mg-pad{display:grid}#mg .mg-act{display:block}#mg .mg-cap{bottom:158px}#mg .mg-keys{display:none}
    #mg .mg-touchnote{display:block}#mg .mg-how{display:none}
  }
  @media (max-width:760px){
    #mg .mg-look{grid-template-columns:1fr;grid-template-rows:minmax(0,1.2fr) minmax(0,1fr);gap:16px;padding:60px 16px 16px}
    #mg .mg-map{width:104px;height:auto}
  }`;
  document.head.appendChild(Object.assign(document.createElement("style"), { textContent: css }));
  document.head.appendChild(Object.assign(document.createElement("link"), { rel: "stylesheet", href: FONT_URL }));

  const toggle = document.createElement("button");
  toggle.type = "button"; toggle.className = "game-toggle"; toggle.id = "game-toggle";
  toggle.setAttribute("role", "switch"); toggle.setAttribute("aria-checked", "false");
  toggle.setAttribute("aria-label", "Museum mode: walk through the work as a retro video game");
  toggle.title = "Museum mode: walk through the work like a retro video game";
  toggle.innerHTML = '<span class="gt-sw" aria-hidden="true"><i></i></span><span class="gt-txt"><span>Museum</span><span>mode</span></span>';
  const nav = document.getElementById("nav");
  if (!nav) return;
  nav.insertBefore(toggle, nav.querySelector(".cta"));
  nav.classList.add("has-game");
  toggle.addEventListener("click", open);

  /* ---------------- overlay DOM ---------------- */
  let root, ui = {};
  function buildDOM() {
    root = document.createElement("div");
    root.id = "mg"; root.tabIndex = -1;
    root.setAttribute("role", "application"); root.setAttribute("aria-label", "Museum mode");
    root.innerHTML = `
      <canvas class="mg-view"></canvas>
      <div class="mg-scan"></div>
      <div class="mg-top">
        <div>
          <button class="mg-exit" type="button" aria-label="Exit museum mode"><span class="gt-sw" aria-hidden="true"><i></i></span><span>Exit [Esc]</span></button>
          <div class="mg-room"></div>
          <button class="mg-time" type="button" aria-label="Change the time of day in the mural yard"></button>
        </div>
        <div>
          <canvas class="mg-map" width="150" height="106" aria-hidden="true"></canvas>
          <div class="mg-keys">[H] HELP</div>
        </div>
      </div>
      <div class="mg-cap" aria-live="polite"><b></b><span></span></div>
      <div class="mg-pad" aria-hidden="true">
        <button class="u" data-k="up">▲</button><button class="l" data-k="left">◀</button><button class="dn" data-k="down">▼</button><button class="r" data-k="right">▶</button>
      </div>
      <button class="mg-act" type="button">LOOK</button>
      <div class="mg-look" role="dialog" aria-label="Artwork">
        <div class="pic"><img alt=""></div>
        <div class="txt"><div class="tag"></div><h3></h3><p class="note"></p><p class="body"></p><div class="acts"></div></div>
      </div>
      <div class="mg-card">
        <div class="mg-card-in">
          <div class="mg-kick">★ ALEX KOCEYAN PRESENTS ★</div>
          <h2>MUSEUM MODE</h2>
          <p class="mg-sub">WALK THE GALLERIES. EVERY PIECE IS ON THE WALLS.</p>
          <div class="mg-how">
            <div class="k"><kbd>W</kbd><kbd>S</kbd><span class="or">OR</span><kbd class="ar">↑</kbd><kbd class="ar">↓</kbd></div><div class="d">WALK FORWARD / BACK</div>
            <div class="k"><kbd>A</kbd><kbd>D</kbd><span class="or">OR</span><kbd class="ar">←</kbd><kbd class="ar">→</kbd></div><div class="d">TURN LEFT / RIGHT</div>
            <div class="k"><kbd>SHIFT</kbd></div><div class="d">HOLD TO RUN</div>
            <div class="k"><kbd>T</kbd></div><div class="d">MURAL YARD: SWITCH DAY / SUNSET / NIGHT</div>
            <div class="k"><kbd>E</kbd><span class="or">OR</span><kbd>SPACE</kbd></div><div class="d">LOOK AT THE ART IN FRONT OF YOU</div>
            <div class="k"><kbd>ESC</kbd></div><div class="d">BACK TO THE WEBSITE</div>
          </div>
          <p class="mg-touchnote">USE THE ARROW PAD TO WALK AND TURN.<br>TAP “LOOK” WHEN YOU ARE IN FRONT OF A PIECE.</p>
          <div class="mg-load"><i></i></div>
          <div class="mg-status">LOADING…</div>
          <button class="mg-start" type="button">▶ PRESS ENTER TO START</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    ui = {
      view: root.querySelector(".mg-view"), room: root.querySelector(".mg-room"), time: root.querySelector(".mg-time"), map: root.querySelector(".mg-map"),
      cap: root.querySelector(".mg-cap"), capT: root.querySelector(".mg-cap b"), capK: root.querySelector(".mg-cap span"),
      card: root.querySelector(".mg-card"), bar: root.querySelector(".mg-load i"), status: root.querySelector(".mg-status"),
      start: root.querySelector(".mg-start"), look: root.querySelector(".mg-look"), lookImg: root.querySelector(".mg-look img"),
      lookTag: root.querySelector(".mg-look .tag"), lookH: root.querySelector(".mg-look h3"), lookNote: root.querySelector(".mg-look .note"),
      lookBody: root.querySelector(".mg-look .body"), lookActs: root.querySelector(".mg-look .acts"),
    };
    root.querySelector(".mg-exit").addEventListener("click", close);
    ui.start.addEventListener("click", begin);
    ui.time.addEventListener("click", cycleTime);
    root.querySelector(".mg-act").addEventListener("click", () => (state.looking ? closeLook() : tryLook()));
    root.querySelectorAll(".mg-pad button").forEach((b) => {
      const k = b.dataset.k;
      const set = (v) => (e) => { e.preventDefault(); keys[k] = v; };
      b.addEventListener("pointerdown", set(true)); b.addEventListener("pointerup", set(false));
      b.addEventListener("pointerleave", set(false)); b.addEventListener("pointercancel", set(false));
    });
  }

  /* ---------------- state ---------------- */
  const keys = { up: false, down: false, left: false, right: false, run: false };
  const state = { open: false, playing: false, looking: false, ready: false, failed: false, raf: 0, near: null, room: "" };
  const player = { x: START.x, z: START.z, yaw: START.yaw, walk: 0, moving: 0 };
  let T = null, renderer, scene, camera, avatar, camYaw = START.yaw, lastT = 0;
  const ARTS = [];
  let loaded = 0, total = 0;

  const KEYMAP = { KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", ShiftLeft: "run", ShiftRight: "run" };
  function onKey(e) {
    if (!state.open) return;
    const down = e.type === "keydown";
    const typing = e.target instanceof HTMLElement && e.target.matches("input,textarea");
    if (typing) return;
    const k = KEYMAP[e.code];
    if (k) { keys[k] = down; e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (!down) return;
    let used = true;
    if (e.code === "Escape") { if (state.looking) closeLook(); else close(); }
    else if (e.code === "Enter") { if (!state.playing) begin(); else if (state.looking && state.near && state.near.data.go) state.near.data.go(); else tryLook(); }
    else if (e.code === "KeyE" || e.code === "Space") { if (!state.playing) begin(); else if (state.looking) closeLook(); else tryLook(); }
    else if (e.code === "KeyH") { if (state.playing && !state.looking) showCard(); }
    else if (e.code === "KeyT") { if (state.playing && !state.looking) cycleTime(); }
    else used = false;
    if (used) { e.preventDefault(); e.stopImmediatePropagation(); }
  }
  const clearKeys = () => { for (const k in keys) keys[k] = false; };

  /* ---------------- open / close ---------------- */
  let prevFocus = null, prevOverflow = "";
  async function open() {
    if (state.open) return;
    if (!root) buildDOM();
    state.open = true; prevFocus = document.activeElement;
    prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    nav.classList.remove("open");
    toggle.setAttribute("aria-checked", "true");
    root.classList.remove("off"); root.classList.add("on");
    showCard();
    root.focus({ preventScroll: true });
    addEventListener("keydown", onKey, true); addEventListener("keyup", onKey, true);
    addEventListener("blur", clearKeys); addEventListener("resize", resize);
    if (!state.ready && !state.failed) {
      try { await boot(); }
      catch (err) {
        console.error("Museum mode failed to start:", err);
        state.failed = true;
        ui.status.textContent = "COULDN’T LOAD THE 3D ENGINE. CHECK YOUR CONNECTION, THEN PRESS ESC AND TRY AGAIN.";
        return;
      }
    }
    if (state.failed) { state.failed = false; try { await boot(); } catch { state.failed = true; return; } }
    resize();
    lastT = performance.now();
    cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(frame);
  }
  function close() {
    if (!state.open) return;
    state.open = false; state.playing = false;
    closeLook(); clearKeys();
    cancelAnimationFrame(state.raf);
    removeEventListener("keydown", onKey, true); removeEventListener("keyup", onKey, true);
    removeEventListener("blur", clearKeys); removeEventListener("resize", resize);
    toggle.setAttribute("aria-checked", "false");
    root.classList.add("off");
    setTimeout(() => { if (!state.open) root.classList.remove("on", "off"); }, 280);
    document.documentElement.style.overflow = prevOverflow;
    if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
  }
  function showCard() {
    state.playing = false; clearKeys();
    ui.card.classList.remove("hide");
    if (state.ready) markReady();
  }
  function markReady() {
    ui.start.classList.add("ready");
    ui.start.textContent = matchMedia("(pointer:coarse)").matches ? "▶ TAP TO START" : "▶ PRESS ENTER TO START";
  }
  function begin() {
    if (!state.ready) return;
    ui.card.classList.add("hide");
    state.playing = true;
    root.focus({ preventScroll: true });
  }
  function setProgress() {
    const p = total ? loaded / total : 0;
    ui.bar.style.width = Math.round(p * 100) + "%";
    ui.status.textContent = loaded >= total ? "ALL ART IS ON THE WALLS." : `HANGING THE ART… ${loaded}/${total}`;
  }

  /* ---------------- build the world ---------------- */
  async function boot() {
    ui.status.textContent = "LOADING THE 3D ENGINE…";
    const [mod] = await Promise.all([
      import(THREE_URL),
      document.fonts && document.fonts.load ? Promise.race([document.fonts.load('16px "Press Start 2P"'), new Promise((r) => setTimeout(r, 2500))]).catch(() => {}) : null,
    ]);
    T = mod; tmpColor = new T.Color();
    renderer = new T.WebGLRenderer({ canvas: ui.view, antialias: false, powerPreference: "low-power" });
    renderer.setPixelRatio(1);
    scene = new T.Scene();
    scene.background = new T.Color(0x070707);
    scene.fog = new T.Fog(0x070707, 30, 110);
    camera = new T.PerspectiveCamera(62, 16 / 9, 0.1, 1200);
    scene.add(new T.AmbientLight(0xffffff, 2.3));
    const sun = new T.DirectionalLight(0xfff2d8, 1.4); sun.position.set(6, 12, 8); scene.add(sun);

    buildRooms();
    buildYard();
    hangEverything();
    avatar = buildAvatar(); scene.add(avatar);
    applyTime(hourNow());
    state.ready = true;
    markReady(); setProgress();
  }

  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c);
    t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false;
    t.colorSpace = T.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }
  const shade = (hex, k) => { const c = new T.Color(hex); c.multiplyScalar(k); return "#" + c.getHexString(); };
  function wallTex(hex) {              // 4 m x 4 m of slightly mottled paint
    return canvasTex(32, 32, (g, w, h) => {
      g.fillStyle = hex; g.fillRect(0, 0, w, h);
      let s = 7;
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        const k = (s >> 8) % 100;
        if (k < 16) { g.fillStyle = shade(hex, 0.93); g.fillRect(x, y, 2, 2); }
        else if (k > 90) { g.fillStyle = shade(hex, 1.06); g.fillRect(x, y, 2, 2); }
      }
    }, true);
  }
  function floorTex(a, b) {            // 2 m x 2 m checker
    return canvasTex(8, 8, (g) => {
      g.fillStyle = a; g.fillRect(0, 0, 8, 8);
      g.fillStyle = b; g.fillRect(0, 0, 4, 4); g.fillRect(4, 4, 4, 4);
      g.fillStyle = "rgba(0,0,0,.14)"; g.fillRect(0, 0, 8, 1); g.fillRect(0, 4, 8, 1); g.fillRect(0, 0, 1, 8); g.fillRect(4, 0, 1, 8);
    }, true);
  }

  // vertical wall from (x0,z0) to (x1,z1), facing (nx,nz)
  function vplane(x0, z0, x1, z1, y0, y1, nx, nz, mat, off = 0) {
    const len = Math.hypot(x1 - x0, z1 - z0), hh = y1 - y0;
    const g = new T.PlaneGeometry(len, hh);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 4, (uv.getY(i) * hh + y0) / 4);
    const m = new T.Mesh(g, mat);
    m.position.set((x0 + x1) / 2 + nx * off, (y0 + y1) / 2, (z0 + z1) / 2 + nz * off);
    m.rotation.y = Math.atan2(nx, nz);
    scene.add(m); return m;
  }
  function hplane(x0, x1, z0, z1, y, mat, up, tile) {
    const w = x1 - x0, d = z1 - z0;
    const g = new T.PlaneGeometry(w, d);
    if (tile) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile); }
    const m = new T.Mesh(g, mat);
    m.rotation.x = up ? -Math.PI / 2 : Math.PI / 2;
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    scene.add(m); return m;
  }

  function buildRooms() {
    const ceil = new T.MeshLambertMaterial({ color: 0x1c1b1a });
    const lamp = new T.MeshBasicMaterial({ color: 0xfff6dc, fog: false });
    const base = new T.MeshLambertMaterial({ color: 0x151413 });
    for (const key in ROOMS) {
      const m = ROOMS[key];
      if (m.outdoor) continue;
      const wall = new T.MeshLambertMaterial({ map: wallTex(m.wall) });
      m.wallMat = wall;
      hplane(m.x0, m.x1, m.z0, m.z1, 0, new T.MeshLambertMaterial({ map: floorTex(m.floor[0], m.floor[1]) }), true, 2);
      hplane(m.x0, m.x1, m.z0, m.z1, H, ceil, false);
      // skylights
      const nx = Math.max(1, Math.round((m.x1 - m.x0) / 8)), nz = Math.max(1, Math.round((m.z1 - m.z0) / 8));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const cx = m.x0 + (i + 0.5) * (m.x1 - m.x0) / nx, cz = m.z0 + (j + 0.5) * (m.z1 - m.z0) / nz;
        hplane(cx - 1.4, cx + 1.4, cz - 1.4, cz + 1.4, H - 0.02, lamp, false);
      }
      const sides = {
        N: { fixed: m.z0, a: m.x0, b: m.x1, along: "x", n: 1 }, S: { fixed: m.z1, a: m.x0, b: m.x1, along: "x", n: -1 },
        W: { fixed: m.x0, a: m.z0, b: m.z1, along: "z", n: 1 }, E: { fixed: m.x1, a: m.z0, b: m.z1, along: "z", n: -1 },
      };
      for (const sk in sides) {
        const s = sides[sk], gap = (m.gaps || {})[sk];
        const seg = (a, b, y0, y1, mat, off) => (s.along === "x"
          ? vplane(a, s.fixed, b, s.fixed, y0, y1, 0, s.n, mat, off)
          : vplane(s.fixed, a, s.fixed, b, y0, y1, s.n, 0, mat, off));
        const run = (a, b) => { seg(a, b, 0, H, wall, 0); seg(a, b, 0, 0.32, base, 0.02); };
        if (!gap) run(s.a, s.b);
        else { run(s.a, gap[0]); run(gap[1], s.b); seg(gap[0], gap[1], DOOR_H, H, wall, 0); }
      }
    }
    // doorways: floor, ceiling and two side walls
    const jamb = new T.MeshLambertMaterial({ map: wallTex("#3a3733") });
    const sill = new T.MeshLambertMaterial({ map: floorTex("#3d3a36", "#2f2c29") });
    for (const d of DOORS) {
      hplane(d.x0, d.x1, d.z0, d.z1, 0, sill, true, 2);
      hplane(d.x0, d.x1, d.z0, d.z1, DOOR_H, ceil, false);
      if (d.ax === "z") { vplane(d.x0, d.z0, d.x0, d.z1, 0, DOOR_H, 1, 0, jamb); vplane(d.x1, d.z0, d.x1, d.z1, 0, DOOR_H, -1, 0, jamb); }
      else { vplane(d.x0, d.z0, d.x1, d.z0, 0, DOOR_H, 0, 1, jamb); vplane(d.x0, d.z1, d.x1, d.z1, 0, DOOR_H, 0, -1, jamb); }
    }
    // benches
    const wood = new T.MeshLambertMaterial({ color: 0x2a1c12 }), pad = new T.MeshLambertMaterial({ color: 0x23402a });
    const woodOut = tinted(wood.clone()), padOut = tinted(new T.MeshLambertMaterial({ color: 0x6b655c }));
    for (const b of BENCHES) {
      const w = b.x1 - b.x0, dd = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      const legs = new T.Mesh(new T.BoxGeometry(w - 0.3, 0.4, dd - 0.3), b.out ? woodOut : wood); legs.position.set(cx, 0.2, cz); scene.add(legs);
      const seat = new T.Mesh(new T.BoxGeometry(w, 0.16, dd), b.out ? padOut : pad); seat.position.set(cx, 0.48, cz); scene.add(seat);
    }
  }

  /* ---------------- the mural yard: outdoors, and the sky follows the visitor's clock ---------------- */
  //             hour  sky top    horizon    light on surfaces  night (0-1)
  const SKY_KEYS = [
    [0,    "#04061a", "#141b3d", "#59628f", 1],
    [5,    "#04061a", "#141b3d", "#59628f", 1],
    [6.5,  "#3a4d8c", "#f4a56a", "#cfa696", 0.35],
    [8,    "#3f8fe0", "#c4e4f7", "#ffffff", 0],
    [17,   "#3f8fe0", "#c4e4f7", "#ffffff", 0],
    [19,   "#34407f", "#ff8748", "#e3a684", 0.3],
    [20.5, "#04061a", "#141b3d", "#59628f", 1],
    [24,   "#04061a", "#141b3d", "#59628f", 1],
  ];
  const TIME_MODES = [null, 12, 19, 23.5], TIME_NAMES = ["AUTO", "DAY", "SUNSET", "NIGHT"];   // null = the visitor's real local time
  const yard = { mats: [], art: [], glows: [], bulbs: [], accents: [], hour: -99, mode: 0, o: -1, night: 0, tint: null, artTint: null, haze: null };
  const avatarMats = [];
  function tinted(mat) { yard.mats.push({ mat, base: mat.color.clone() }); return mat; }
  const hex = (c) => "#" + c.getHexString();
  function hourNow() {
    const forced = TIME_MODES[yard.mode];
    if (forced != null) return forced;
    const d = new Date(); return d.getHours() + d.getMinutes() / 60;
  }
  function skyAt(h) {
    let i = 0;
    while (i < SKY_KEYS.length - 2 && h >= SKY_KEYS[i + 1][0]) i++;
    const a = SKY_KEYS[i], b = SKY_KEYS[i + 1], t = Math.min(1, Math.max(0, (h - a[0]) / (b[0] - a[0])));
    const mix = (k) => new T.Color(a[k]).lerp(new T.Color(b[k]), t);
    return { top: mix(1), hor: mix(2), tint: mix(3), night: a[4] + (b[4] - a[4]) * t };
  }
  function cycleTime() { yard.mode = (yard.mode + 1) % TIME_MODES.length; applyTime(hourNow()); }
  function timeLabel() {
    let t = "TIME: " + TIME_NAMES[yard.mode];
    if (yard.mode === 0) t += " " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toUpperCase();
    ui.time.textContent = t + (matchMedia("(pointer:coarse)").matches ? " (TAP)" : " [T]");
  }
  function scaleUV(g, u, v) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v); return g; }
  function brickTex(base, mortar) {          // 4 m x 4 m: bricks 1 m long, half a metre tall
    return canvasTex(32, 32, (g) => {
      g.fillStyle = mortar; g.fillRect(0, 0, 32, 32);
      let s = 3;
      for (let r = 0; r < 8; r++) for (let c = -1; c < 4; c++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        g.fillStyle = shade(base, 0.88 + ((s >> 8) % 24) / 100);
        g.fillRect(c * 8 + (r % 2) * 4, r * 4, 7, 3);
      }
    }, true);
  }
  function grassTex() {
    return canvasTex(16, 16, (g) => {
      g.fillStyle = "#3f6b35"; g.fillRect(0, 0, 16, 16);
      let s = 5;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        const k = (s >> 8) % 100;
        if (k < 22) { g.fillStyle = "#35602d"; g.fillRect(x, y, 1, 1); } else if (k > 88) { g.fillStyle = "#4d7c40"; g.fillRect(x, y, 1, 1); }
      }
    }, true);
  }

  function buildYard() {
    const M = ROOMS.mur, WH = 9;
    const brick = tinted(new T.MeshLambertMaterial({ map: brickTex("#8a4a3a", "#3a2f2b") }));
    const block = tinted(new T.MeshLambertMaterial({ map: brickTex("#a8a399", "#7c776f") }));     // painted cinder block
    const capM = tinted(new T.MeshLambertMaterial({ color: 0x4a463f }));
    const metal = tinted(new T.MeshLambertMaterial({ color: 0x2b2b2e }));
    hplane(M.x0, M.x1, M.z0, M.z1, 0, tinted(new T.MeshLambertMaterial({ map: floorTex("#8f8b83", "#868279") })), true, 4);
    hplane(-260, 320, -280, 300, -0.05, tinted(new T.MeshLambertMaterial({ map: grassTex() })), true, 4);

    // the museum seen from outside (so you never look "through" the building)
    vplane(M.x0, -8, M.x0, -2, 0, WH, 1, 0, brick); vplane(M.x0, 2, M.x0, 90, 0, WH, 1, 0, brick);
    vplane(M.x0, -2, M.x0, 2, DOOR_H, WH, 1, 0, brick);
    vplane(M.x0, -8, 16, -8, 0, WH, 0, 1, brick); vplane(16, -90, 16, -8, 0, WH, 1, 0, brick);

    // low brick wall around the yard
    const low = (x0, x1, z0, z1) => {
      const w = x1 - x0, d = z1 - z0;
      const m = new T.Mesh(scaleUV(new T.BoxGeometry(w, 1.3, d), Math.max(w, d) / 4, 1.3 / 4), brick);
      m.position.set((x0 + x1) / 2, 0.65, (z0 + z1) / 2); scene.add(m);
    };
    low(M.x0, M.x1 + 0.5, M.z0 - 0.5, M.z0); low(M.x1, M.x1 + 0.5, M.z0, M.z1); low(M.x0, M.x1 + 0.5, M.z1, M.z1 + 0.5);

    // soft pools of lamp light on the ground, only visible after dark
    const glowTex = canvasTex(32, 32, (g) => {
      const r = g.createRadialGradient(16, 16, 1, 16, 16, 16);
      r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r; g.fillRect(0, 0, 32, 32);
    });
    const pool = (x, z, sx, sz, max) => {
      const mat = new T.MeshBasicMaterial({ map: glowTex, color: 0xffd58a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
      const m = new T.Mesh(new T.PlaneGeometry(1, 1), mat);
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z); m.scale.set(sx, sz, 1); scene.add(m);
      yard.glows.push({ mat, max });
    };
    const bulb = (w, hh, d, x, y, z) => {
      const mat = new T.MeshBasicMaterial({ color: 0x4c4a45 });
      const m = new T.Mesh(new T.BoxGeometry(w, hh, d), mat); m.position.set(x, y, z); scene.add(m);
      yard.bulbs.push(mat);
    };

    // the mural walls: a cap on top, a floodlight bar, and a pool of light in front
    for (const s of SLABS) {
      const ax = s.along === "x", w = ax ? s.w : 0.6, d = ax ? 0.6 : s.w;
      const wall = new T.Mesh(scaleUV(new T.BoxGeometry(w, s.h, d), s.w / 4, s.h / 4), block);
      wall.position.set(s.cx, s.h / 2, s.cz); scene.add(wall);
      const cap = new T.Mesh(new T.BoxGeometry(w + 0.2, 0.18, d + 0.2), capM); cap.position.set(s.cx, s.h + 0.09, s.cz); scene.add(cap);
      bulb(ax ? s.w * 0.7 : 0.3, 0.14, ax ? 0.3 : s.w * 0.7, s.cx + s.nx * 0.6, s.h + 0.3, s.cz + s.nz * 0.6);
      pool(s.cx + s.nx * 2.8, s.cz + s.nz * 2.8, ax ? s.w * 1.1 : 6.5, ax ? 6.5 : s.w * 1.1, 0.42);
    }
    // lamp posts
    for (const l of LAMPS) {
      const pole = new T.Mesh(new T.BoxGeometry(0.16, 4.4, 0.16), metal); pole.position.set(l.x, 2.2, l.z); scene.add(pole);
      bulb(0.7, 0.24, 0.7, l.x, 4.5, l.z);
      pool(l.x, l.z, 9, 9, 0.5);
    }

    // The Detroit skyline, low-poly. One shared "windows" texture (they light up at night), tinted per building.
    yard.bldCanvas = document.createElement("canvas"); yard.bldCanvas.width = yard.bldCanvas.height = 32;
    yard.bldTex = new T.CanvasTexture(yard.bldCanvas);
    yard.bldTex.magFilter = yard.bldTex.minFilter = T.NearestFilter; yard.bldTex.generateMipmaps = false;
    yard.bldTex.colorSpace = T.SRGBColorSpace; yard.bldTex.wrapS = yard.bldTex.wrapT = T.RepeatWrapping;
    const glass = (color) => new T.MeshBasicMaterial({ map: yard.bldTex, color });
    // plain-coloured parts (roofs, spires, the bridge). "glow" = the colour it lights up to at night
    const accent = (color, glow) => { const mat = new T.MeshBasicMaterial({ color }); yard.accents.push({ mat, base: mat.color.clone(), glow: glow != null ? new T.Color(glow) : null }); return mat; };
    // everything below is laid out as if the city started ~100 m away, then the whole group is pushed back to the horizon
    const CITY_DX = 140, city = new T.Group(); city.position.x = CITY_DX; scene.add(city);
    const add = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); city.add(m); return m; };
    const uvBox = (w, hh, d) => scaleUV(new T.BoxGeometry(w, hh, d), Math.max(1, Math.round(Math.max(w, d) / 8)), Math.max(1, Math.round(hh / 8)));
    // a tower made of stacked tiers: [[width, depth, topHeight], ...]; returns the height of the top
    const stack = (x, z, tiers, mat) => { let y = 0; for (const [w, d, top] of tiers) { add(uvBox(w, top - y, d), mat, x, (y + top) / 2, z); y = top; } return y; };
    const pyramid = (x, y, z, r, hh, mat) => { const m = add(new T.ConeGeometry(r, hh, 4), mat, x, y + hh / 2, z); m.rotation.y = Math.PI / 4; return m; };
    const cyl = (x, z, r, hh, mat) => add(scaleUV(new T.CylinderGeometry(r, r, hh, 12), 4, Math.max(1, Math.round(hh / 8))), mat, x, hh / 2, z);
    const beam = (x1, y1, z1, x2, y2, z2, th, mat) => {
      const m = add(new T.BoxGeometry(th, th, Math.hypot(x2 - x1, y2 - y1, z2 - z1)), mat, (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
      m.lookAt(x2 + CITY_DX, y2, z2); return m;      // lookAt works in world space
    };
    const stone = glass(0xdccfb6), terracotta = glass(0xcc6f36), brownBrick = glass(0xa9674f), darkGlass = glass(0x566270),
      blueGlass = glass(0x7fb6da), granite = glass(0xd0b9a4), grey = glass(0xaab1bc), whiteStone = glass(0xeceef0);
    const steel = accent(0x3b4048), copper = accent(0x5fa58d), gold = accent(0xd9a441, 0xffc64d), orb = accent(0xb3261e, 0xff3b2f),
      crown = accent(0xdfe3e8, 0xfff3c4), teal = accent(0x4f7d78), lights = accent(0x6d8580, 0xffe9a8);
    let top;

    // Renaissance Center: the tall round tower with four shorter ones around it, on the riverfront
    const RX = 150, RZ = 44;
    add(uvBox(34, 9, 34), darkGlass, RX, 4.5, RZ);
    cyl(RX, RZ, 7.5, 88, darkGlass);
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([i, j]) => cyl(RX + i * 12.5, RZ + j * 12.5, 5.2, 58, darkGlass));
    add(new T.CylinderGeometry(8, 8, 1.8, 12), crown, RX, 88.9, RZ);
    add(new T.CylinderGeometry(4.6, 4.6, 3.2, 12), steel, RX, 91.4, RZ);
    stack(RX + 8, RZ + 34, [[12, 12, 30]], darkGlass); stack(RX - 9, RZ + 36, [[12, 12, 30]], darkGlass);

    // Ally Detroit Center: the postmodern one with the spiked gothic top
    top = stack(132, 17, [[16, 16, 62], [13, 13, 68]], granite);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([i, j]) => pyramid(132 + i * 4.3, top, 17 + j * 4.3, 3.5, 10, steel));

    // Penobscot Building: art-deco setbacks with the red ball on top
    top = stack(126, -6, [[15, 15, 50], [12, 12, 60], [9, 9, 68], [6, 6, 74]], stone);
    add(new T.BoxGeometry(0.8, 9, 0.8), steel, 126, top + 4.5, -6);
    add(new T.SphereGeometry(1.8, 8, 6), orb, 126, top + 10, -6);

    // Guardian Building: orange brick, taller tower at the north end
    stack(116, 7, [[11, 24, 40]], terracotta); stack(116, -3, [[11, 8, 50], [8, 6, 55]], terracotta); stack(116, 17, [[9, 5, 45]], terracotta);

    // David Stott Building: slim red-brown stepped tower
    stack(121, -22, [[9, 9, 40], [7, 7, 48], [5, 5, 54]], brownBrick);
    // Cadillac Tower
    stack(138, -20, [[12, 12, 50], [9, 9, 55]], stone);
    // Book Tower: green copper roof
    top = stack(128, -37, [[9, 9, 58], [7, 7, 63]], stone); pyramid(128, top, -37, 5.2, 6, copper);
    // Broderick Tower
    top = stack(140, -51, [[9, 9, 46], [7, 7, 51]], stone); pyramid(140, top, -51, 5, 3, steel);
    // Hudson's Detroit tower: the new glass one
    stack(131, -66, [[13, 13, 80]], blueGlass); add(new T.BoxGeometry(13.6, 1, 13.6), steel, 131, 80.5, -66);
    // 150 West Jefferson and One Woodward
    stack(122, 28, [[12, 12, 54], [8, 12, 58]], grey); stack(111, 24, [[9, 9, 38]], whiteStone);

    // Fisher Building, off to the north in New Center: golden roof that lights up at night
    stack(150, -120, [[32, 12, 24]], stone);
    top = stack(150, -120, [[11, 11, 52], [9, 9, 58], [7, 7, 62]], stone); pyramid(150, top, -120, 5.8, 10, gold);

    // Michigan Central Station: wide base with the tall office block on top
    stack(112, 86, [[42, 15, 14]], stone); stack(112, 86, [[28, 11, 50]], stone);

    // Ambassador Bridge, off to the south: two towers, a deck and suspension cables
    const BX = 128, T1 = 122, T2 = 178, DECK = 18, TOP = 50;
    add(new T.BoxGeometry(5, 1.2, 116), teal, BX, DECK, 150);
    add(new T.BoxGeometry(0.5, 0.5, 116), lights, BX - 2.7, DECK + 1.1, 150); add(new T.BoxGeometry(0.5, 0.5, 116), lights, BX + 2.7, DECK + 1.1, 150);
    for (const tz of [T1, T2]) {
      add(new T.BoxGeometry(1.4, TOP, 1.4), teal, BX - 2.8, TOP / 2, tz); add(new T.BoxGeometry(1.4, TOP, 1.4), teal, BX + 2.8, TOP / 2, tz);
      for (const y of [30, 42, TOP - 0.7]) add(new T.BoxGeometry(7, 1.4, 1.4), teal, BX, y, tz);
      add(new T.BoxGeometry(1, 1, 1), orb, BX - 2.8, TOP + 0.6, tz); add(new T.BoxGeometry(1, 1, 1), orb, BX + 2.8, TOP + 0.6, tz);
    }
    for (const sx of [BX - 2.8, BX + 2.8]) {
      const mid = (T1 + T2) / 2;
      beam(sx, TOP, T1, sx, DECK + 4, mid, 0.5, lights); beam(sx, TOP, T2, sx, DECK + 4, mid, 0.5, lights);
      beam(sx, TOP, T1, sx, DECK, 92, 0.5, lights); beam(sx, TOP, T2, sx, DECK, 208, 0.5, lights);
    }

    // low filler blocks further back so the horizon is never empty
    const fill = [glass(0x9aa3b1), glass(0xb9a892), glass(0x8f8a94), glass(0xa9b6bd)];
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 34; i++) {
      const ang = -1.75 + (i / 33) * 3.5 + (rnd() - 0.5) * 0.05;       // an arc to the north, east and south
      const dist = 330 + rnd() * 90, w = 14 + rnd() * 22, hh = 10 + rnd() * 30, d = 12 + rnd() * 16;
      add(uvBox(w, hh, d), fill[i % fill.length], 26 + Math.cos(ang) * dist - CITY_DX, hh / 2, 5 + Math.sin(ang) * dist);
    }

    // sky dome, sun and moon
    yard.skyCanvas = document.createElement("canvas"); yard.skyCanvas.width = 1024; yard.skyCanvas.height = 256;
    yard.skyTex = new T.CanvasTexture(yard.skyCanvas);
    yard.skyTex.magFilter = yard.skyTex.minFilter = T.NearestFilter; yard.skyTex.generateMipmaps = false;
    yard.skyTex.colorSpace = T.SRGBColorSpace; yard.skyTex.wrapS = T.RepeatWrapping;
    yard.dome = new T.Mesh(new T.SphereGeometry(520, 24, 12), new T.MeshBasicMaterial({ map: yard.skyTex, side: T.BackSide, fog: false, depthWrite: false }));
    yard.dome.renderOrder = -10; scene.add(yard.dome);
    const disc = (draw) => {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: canvasTex(16, 16, draw), fog: false, depthWrite: false }));
      sp.scale.set(52, 52, 1); scene.add(sp); return sp;
    };
    const circle = (g, col) => { g.fillStyle = col; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x - 7.5) ** 2 + (y - 7.5) ** 2 < 42) g.fillRect(x, y, 1, 1); };
    yard.sun = disc((g) => { circle(g, "#ffe27a"); g.fillStyle = "#fff6c9"; g.fillRect(5, 4, 4, 3); });
    yard.moon = disc((g) => { circle(g, "#e9e6d6"); g.fillStyle = "#c4c0ae"; g.fillRect(4, 5, 3, 2); g.fillRect(9, 8, 3, 3); g.fillRect(6, 11, 2, 1); });
    yard.sunDir = new T.Vector3(); yard.moonDir = new T.Vector3();
    sign([["THE MURAL YARD", 22], ["WALLS THAT USED TO BE BORING", 11, "#8dff9a"]], M.x0, 9, 1, 0, 5.6, 10, 2.2);
  }

  function applyTime(h) {
    const P = skyAt(h);
    yard.hour = h; yard.night = P.night; yard.tint = P.tint;
    yard.haze = P.hor.clone().lerp(P.top, 0.25);
    yard.artTint = P.tint.clone().lerp(new T.Color(0xffffff), 0.6);       // murals stay readable at night (floodlights)
    for (const o of yard.mats) o.mat.color.copy(o.base).multiply(P.tint);
    for (const m of yard.art) if (m.map) m.color.copy(yard.artTint);
    for (const gl of yard.glows) gl.mat.opacity = gl.max * P.night;
    for (const b of yard.bulbs) b.color.set(0x4c4a45).lerp(new T.Color(0xfff0b8), Math.min(1, P.night * 1.4));
    yard.o = -1;                                                          // re-tint the character next frame

    // sky: banded gradient, stars at night, chunky clouds by day
    const c = yard.skyCanvas, g = c.getContext("2d"), W = c.width, HZ = c.height / 2, bands = 14;
    g.globalAlpha = 1;
    for (let i = 0; i < bands; i++) {
      g.fillStyle = hex(P.top.clone().lerp(P.hor, Math.pow((i + 0.5) / bands, 1.8)));
      g.fillRect(0, Math.floor(i * HZ / bands), W, Math.ceil(HZ / bands) + 1);
    }
    g.fillStyle = hex(P.hor); g.fillRect(0, HZ, W, HZ);
    let seed = 77; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 280; i++) {
      const x = Math.floor(rnd() * W), y = Math.floor(rnd() * HZ * 0.93), a = 0.45 + 0.55 * rnd(), big = rnd() < 0.1;
      if (P.night > 0.05) { g.globalAlpha = P.night * a; g.fillStyle = "#ffffff"; g.fillRect(x, y, big ? 2 : 1, 1); }
    }
    g.fillStyle = hex(new T.Color(0xffffff).lerp(P.hor, 0.3 + 0.4 * P.night));
    for (let i = 0; i < 12; i++) {
      const cx = rnd() * W, cy = HZ * (0.5 + rnd() * 0.36);
      for (let j = 0; j < 5; j++) {
        const bx = cx + (j - 2) * 9 + rnd() * 6, by = cy - rnd() * 5, bw = 12 + rnd() * 14, bh = 4 + rnd() * 4;
        g.globalAlpha = 0.85 * (1 - 0.82 * P.night);
        g.fillRect(Math.round(bx), Math.round(by), Math.round(bw), Math.round(bh));
        if (bx + bw > W) g.fillRect(Math.round(bx - W), Math.round(by), Math.round(bw), Math.round(bh));
      }
    }
    g.globalAlpha = 1; yard.skyTex.needsUpdate = true;

    // skyline windows
    const b = yard.bldCanvas.getContext("2d");
    b.fillStyle = hex(new T.Color("#d2d5da").multiply(P.tint).lerp(new T.Color("#1a1f38"), P.night * 0.9)); b.fillRect(0, 0, 32, 32);
    const lit = hex(new T.Color("#6f7a89").lerp(new T.Color("#ffe08a"), P.night)), dark = hex(new T.Color("#6f7a89").lerp(new T.Color("#232a47"), P.night));
    seed = 5;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { b.fillStyle = rnd() < 0.42 ? lit : dark; b.fillRect(x * 4 + 1, y * 4 + 1, 2, 2); }
    yard.bldTex.needsUpdate = true;
    const dusk = new T.Color("#141a33");
    for (const a of yard.accents) {
      a.mat.color.copy(a.base).multiply(P.tint);
      if (a.glow) a.mat.color.lerp(a.glow, Math.min(1, P.night * 1.5)); else a.mat.color.lerp(dusk, P.night * 0.8);
    }

    // sun rises in the east (+x), moon takes the other half of the day
    const arc = (hr, v) => { const a = Math.PI * (hr - 6) / 12; return v.set(Math.cos(a), Math.sin(a) * 0.8, 0.3).normalize(); };
    arc(h, yard.sunDir); arc((h + 12) % 24, yard.moonDir);
    yard.sun.visible = yard.sunDir.y > -0.04; yard.moon.visible = yard.moonDir.y > -0.04;
    timeLabel();
  }

  /* ---------------- signs + art ---------------- */
  function sign(lines, x, z, nx, nz, y, w, hh, opt = {}) {
    const pxW = Math.round(w * 40), pxH = Math.round(hh * 40);
    const tex = canvasTex(pxW, pxH, (g) => {
      g.fillStyle = opt.bg || "#0d0d0d"; g.fillRect(0, 0, pxW, pxH);
      g.strokeStyle = opt.fg || "#f4f1e6"; g.lineWidth = 3; g.strokeRect(4.5, 4.5, pxW - 9, pxH - 9);
      g.textAlign = "center"; g.textBaseline = "middle";
      const n = lines.length;
      lines.forEach((ln, i) => {
        const [txt, size, col] = Array.isArray(ln) ? ln : [ln, 16, null];
        let px = size;
        g.font = `${px}px ${PIXEL}`;
        while (g.measureText(txt).width > pxW - 28 && px > 6) { px -= 1; g.font = `${px}px ${PIXEL}`; }
        g.fillStyle = col || opt.fg || "#f4f1e6";
        g.fillText(txt, pxW / 2, pxH * (i + 0.5) / n + 1);
      });
    });
    const m = new T.Mesh(new T.PlaneGeometry(w, hh), new T.MeshBasicMaterial({ map: tex }));
    m.position.set(x + nx * 0.05, y, z + nz * 0.05);
    m.rotation.y = Math.atan2(nx, nz);
    scene.add(m);
  }

  let loader;
  function hang({ url, ar = 1, maxW, maxH, x, z, nx, nz, data, frame = 0x14110f, outdoor = false, bottom = null }) {
    const grp = new T.Group();
    grp.position.set(x + nx * 0.09, 2.3, z + nz * 0.09);
    grp.rotation.y = Math.atan2(nx, nz);
    const mat = new T.MeshBasicMaterial({ color: 0x3a3632 });
    const art = new T.Mesh(new T.PlaneGeometry(1, 1), mat); art.position.z = 0.03;
    const fr = new T.Mesh(new T.BoxGeometry(1, 1, 0.1), new T.MeshLambertMaterial({ color: frame == null ? 0x000000 : frame })); fr.position.z = -0.03;
    const tagM = new T.Mesh(new T.PlaneGeometry(0.36, 0.22), new T.MeshBasicMaterial({ color: 0xf1ecdc }));   // the little wall label
    grp.add(fr, art, tagM); scene.add(grp);
    if (outdoor) { yard.art.push(mat); tagM.visible = false; if (frame == null) fr.visible = false; else tinted(fr.material); }
    const rec = { x, z, nx, nz, w: 1, data, grp };
    const fit = (a) => {
      const w = Math.min(maxW, maxH * a), hh = w / a;
      art.scale.set(w, hh, 1); fr.scale.set(w + 0.26, hh + 0.26, 1);
      grp.position.y = bottom != null ? bottom + hh / 2 : Math.max(2.3, 0.95 + hh / 2);
      tagM.position.set(w / 2 + 0.42, -hh / 2 + 0.16, 0);
      rec.w = w;
    };
    fit(ar);
    total++;
    loader.load(url, (tex) => {
      tex.colorSpace = T.SRGBColorSpace;
      tex.magFilter = T.NearestFilter; tex.minFilter = T.LinearMipmapLinearFilter;
      mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true;
      if (outdoor && yard.artTint) mat.color.copy(yard.artTint);
      if (tex.image && tex.image.width) fit(tex.image.width / tex.image.height);
      loaded++; setProgress();
    }, undefined, () => { loaded++; setProgress(); });
    ARTS.push(rec);
    return rec;
  }
  // spread n pieces evenly along a wall
  function along(side, room, from, to, items, opt) {
    const m = ROOMS[room], n = items.length;
    items.forEach((it, i) => {
      const t = from + (i + 0.5) * (to - from) / n;
      const p = side === "N" ? { x: t, z: m.z0, nx: 0, nz: 1 } : side === "S" ? { x: t, z: m.z1, nx: 0, nz: -1 }
        : side === "W" ? { x: m.x0, z: t, nx: 1, nz: 0 } : { x: m.x1, z: t, nx: -1, nz: 0 };
      hang({ ...opt, ...it, ...p });
    });
  }

  function hangEverything() {
    loader = new T.TextureLoader(); loader.setCrossOrigin("anonymous");
    const L = ROOMS.lobby, I = ROOMS.ill, G = ROOMS.gd, M = ROOMS.mur;

    /* lobby: signs over each door + the artist wall */
    const lint = (DOOR_H + H) / 2;
    sign([["ILLUSTRATION", 24]], 0, L.z0, 0, 1, lint, 6.4, 1.3);
    sign([["GRAPHIC DESIGN", 24]], L.x0, 0, 1, 0, lint, 6.4, 1.3);
    sign([["MURAL YARD", 24]], L.x1, 0, -1, 0, lint, 6.4, 1.3);
    sign([["", 6], ["ALEX KOCEYAN", 26], ["ILLUSTRATOR", 15, "#8dff9a"], ["DESIGNER + MURALIST", 15, "#8dff9a"], ["METRO DETROIT", 13], ["", 6]], 2.6, L.z1, 0, -1, 3, 8, 3.6);
    sign([["< DESIGN", 15]], -5, L.z0, 0, 1, 2.6, 3.6, 0.9, { bg: "#f1ecdc", fg: "#111" });
    sign([["MURALS >", 15]], 5, L.z0, 0, 1, 2.6, 3.6, 0.9, { bg: "#f1ecdc", fg: "#111" });
    const portrait = document.querySelector("img.portrait");
    const bio = (document.querySelector("#about-band .wrap p:not(.kicker)") || {}).textContent || "";
    if (portrait && portrait.src) hang({
      url: portrait.src, ar: 0.9, maxW: 2.6, maxH: 3, x: -4.6, z: L.z1, nx: 0, nz: -1, frame: 0x8a6a26,
      data: { tag: "THE ARTIST", title: "Alex Koceyan", body: bio.trim(), img: portrait.src, goLabel: "ABOUT ALEX ON THE SITE", go: () => leaveTo("#about") },
    });

    /* illustration hall: every piece from the Illustration page */
    const ills = ILL.map((it) => {
      const info = (typeof ILL_INFO !== "undefined" && ILL_INFO[it.f.slice(0, 6)]) || [];
      return {
        url: src(it.f, 720), ar: it.w / it.h,
        data: { tag: ["ILLUSTRATION"].concat(it.cats || []).join(" · ").toUpperCase(), title: info[0] || "Illustration", note: info[1] || "", img: src(it.f, 1600),
          goLabel: it.cls === "book" ? "READ THE COMIC ON THE SITE" : "SEE IT ON THE ILLUSTRATION PAGE", go: () => leaveTo("#illustration") },
      };
    });
    const iOpt = { maxW: 2.6, maxH: 3.1, frame: 0x8a6a26 };
    const nN = Math.min(8, ills.length), rest = ills.length - nN;
    const nE = Math.ceil(rest * 6 / 16), nW = Math.ceil((rest - nE) * 6 / 10), nS = Math.max(0, rest - nE - nW);
    let k = 0; const take = (n) => ills.slice(k, (k += n));
    along("N", "ill", I.x0 + 1, I.x1 - 1, take(nN), iOpt);
    along("E", "ill", I.z0 + 1, I.z1 - 1, take(nE), iOpt);
    const south = take(nS), half = Math.ceil(south.length / 2);
    along("S", "ill", I.x1 - 1, 2.6, south.slice(0, half), iOpt);
    along("S", "ill", -2.6, I.x0 + 1, south.slice(half), iOpt);
    along("W", "ill", I.z1 - 1, I.z0 + 1, take(nW), iOpt);
    sign([["LOBBY", 16]], 0, I.z1, 0, -1, lint, 4, 1, { bg: "#f1ecdc", fg: "#111" });

    /* graphic design wing: one bay per project */
    const projs = PROJECTS.map((p) => ({
      url: src(p.cover, 900), ar: 1.4,
      data: { tag: "GRAPHIC DESIGN · " + p.type.toUpperCase(), title: p.name, body: p.text, img: src(p.cover, 1600), goLabel: "OPEN THE FULL PROJECT", go: () => leaveTo("#" + p.slug) },
    }));
    const gOpt = { maxW: 4.6, maxH: 3.3, frame: 0x111111 };
    const gN = Math.ceil((projs.length - 1) / 2);
    along("N", "gd", G.x1 - 0.5, G.x0 + 0.5, projs.slice(0, gN), gOpt);
    along("W", "gd", G.z0, G.z1, projs.slice(gN, gN + 1), gOpt);
    along("S", "gd", G.x0 + 0.5, G.x1 - 0.5, projs.slice(gN + 1), gOpt);
    sign([["LOBBY", 16]], G.x1, 0, -1, 0, lint, 4, 1, { bg: "#111", fg: "#f4f1e6" });

    /* mural yard: each mural is painted on its own freestanding wall; process photos are pasted on the last one */
    const first = (m) => m.rows[0][0];
    const face = (sl, t = 0) => ({ x: sl.cx + sl.nx * 0.3 + (sl.along === "x" ? t : 0), z: sl.cz + sl.nz * 0.3 + (sl.along === "z" ? t : 0), nx: sl.nx, nz: sl.nz });
    MURALS.slice(0, SLABS.length - 1).forEach((m, i) => {
      const sl = SLABS[i];
      hang({
        url: src(first(m).f, 1200), ar: 1.6, maxW: sl.w - 0.8, maxH: sl.h - 1.1, outdoor: true, frame: null, bottom: 0.55, ...face(sl),
        data: { tag: "MURAL · " + m.tag.toUpperCase(), title: m.name, body: m.text, img: src(first(m).f, 1800), goLabel: "SEE IT ON THE MURALS PAGE", go: () => leaveTo("#murals") },
      });
    });
    const extras = [];
    MURALS.forEach((m) => m.rows.flat().forEach((it) => {
      if (it && it.f && it !== first(m) && it.cap && /progress/i.test(it.cap) && extras.length < 2)
        extras.push({ url: src(it.f, 720), ar: it.w / it.h, data: { tag: "MURAL · IN PROGRESS", title: m.name, note: "Process photo", body: m.text, img: src(it.f, 1600), goLabel: "SEE IT ON THE MURALS PAGE", go: () => leaveTo("#murals") } });
    }));
    const last = SLABS[SLABS.length - 1];
    extras.forEach((e, i) => hang({ ...e, maxW: 3.3, maxH: 3.9, outdoor: true, frame: 0xf1ecdc, bottom: 0.9, ...face(last, (i - (extras.length - 1) / 2) * 4.4) }));
    sign([["LOBBY", 16]], M.x0, 0, 1, 0, DOOR_H + 0.75, 4, 1, { bg: "#111", fg: "#f4f1e6" });
  }

  /* ---------------- the little guy ---------------- */
  function buildAvatar() {
    const g = new T.Group();
    const box = (w, hh, d, color, x, y, z, parent = g) => {
      const mat = new T.MeshLambertMaterial({ color });
      avatarMats.push({ mat, base: mat.color.clone() });
      const m = new T.Mesh(new T.BoxGeometry(w, hh, d), mat);
      m.position.set(x, y, z); parent.add(m); return m;
    };
    const limb = (x, y, w, hh, d, color, tipColor) => {
      const piv = new T.Group(); piv.position.set(x, y, 0); g.add(piv);
      box(w, hh, d, color, 0, -hh / 2, 0, piv);
      if (tipColor) box(w + 0.02, 0.14, d + 0.06, tipColor, 0, -hh + 0.05, -0.02, piv);
      return piv;
    };
    const SKIN = 0xd9a47c, HAIR = 0x1c1410, TEE = 0x2f7a3a, JEANS = 0x1f2a44, SHOE = 0xf2f2f2;
    g.userData.legL = limb(-0.13, 0.82, 0.2, 0.8, 0.22, JEANS, SHOE);
    g.userData.legR = limb(0.13, 0.82, 0.2, 0.8, 0.22, JEANS, SHOE);
    box(0.52, 0.62, 0.28, TEE, 0, 1.13, 0);                         // torso (green tee)
    g.userData.armL = limb(-0.35, 1.4, 0.16, 0.62, 0.18, TEE, SKIN);
    g.userData.armR = limb(0.35, 1.4, 0.16, 0.62, 0.18, TEE, SKIN);
    box(0.14, 0.08, 0.14, SKIN, 0, 1.47, 0);                         // neck
    const head = new T.Group(); head.position.set(0, 1.68, 0); g.add(head);
    box(0.36, 0.36, 0.34, SKIN, 0, 0, 0, head);
    box(0.42, 0.16, 0.4, HAIR, 0, 0.2, 0.01, head);                  // hair: top
    box(0.42, 0.3, 0.12, HAIR, 0, 0.04, 0.17, head);                 // hair: back
    box(0.14, 0.1, 0.1, HAIR, -0.1, 0.14, -0.17, head);              // curl over the forehead
    box(0.13, 0.1, 0.03, 0x111111, -0.085, 0.0, -0.18, head);        // glasses
    box(0.13, 0.1, 0.03, 0x111111, 0.085, 0.0, -0.18, head);
    box(0.06, 0.03, 0.03, 0x111111, 0, 0.01, -0.18, head);
    g.userData.head = head;
    const sh = new T.Mesh(new T.CircleGeometry(0.42, 12), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; g.add(sh);
    return g;
  }

  /* ---------------- looking at art ---------------- */
  function findNear() {
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    let best = null, bd = 1e9;
    for (const a of ARTS) {
      const dx = player.x - a.x, dz = player.z - a.z;
      const out = dx * a.nx + dz * a.nz;                      // distance out from the wall
      if (out < 0.2 || out > Math.max(5.2, a.w * 1.25)) continue;
      const lat = Math.abs(dx * a.nz - dz * a.nx);            // distance along the wall
      if (lat > Math.max(1.5, a.w / 2 + 0.3)) continue;
      if (fx * -a.nx + fz * -a.nz < 0.25) continue;           // must be facing the wall
      const d = out + lat * 1.5;
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }
  function tryLook() {
    if (!state.playing || state.looking || !state.near) return;
    const d = state.near.data;
    state.looking = true; clearKeys();
    ui.lookImg.src = d.img; ui.lookImg.alt = d.title;
    ui.lookTag.textContent = d.tag || "";
    ui.lookH.textContent = d.title;
    ui.lookNote.textContent = d.note || ""; ui.lookNote.style.display = d.note ? "" : "none";
    ui.lookBody.textContent = d.body || ""; ui.lookBody.style.display = d.body ? "" : "none";
    ui.lookActs.innerHTML = "";
    const back = Object.assign(document.createElement("button"), { type: "button", textContent: "◀ BACK [E]" });
    back.addEventListener("click", closeLook); ui.lookActs.append(back);
    if (d.go) {
      const go = Object.assign(document.createElement("button"), { type: "button", className: "go", textContent: `${d.goLabel} [ENTER]` });
      go.addEventListener("click", d.go); ui.lookActs.append(go);
    }
    ui.look.classList.add("show");
  }
  function closeLook() {
    if (!state.looking) return;
    state.looking = false;
    ui.look.classList.remove("show");
    ui.lookImg.removeAttribute("src");
    if (root) root.focus({ preventScroll: true });
  }
  function leaveTo(hash) {
    close();
    if (hash === "#about") { const a = document.querySelector('nav a[data-nav="about"]'); if (a) return a.click(); }
    if (location.hash === hash) dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = hash;
  }

  /* ---------------- loop ---------------- */
  function resize() {
    if (!renderer) return;
    const w = innerWidth, hh = innerHeight;
    const rh = Math.min(RENDER_H, hh), rw = Math.max(160, Math.round(rh * w / hh));
    renderer.setSize(rw, rh, false);
    camera.aspect = w / hh;
    camera.fov = w < hh ? 78 : 62;
    camera.updateProjectionMatrix();
  }
  let tmpColor, camK = 1;
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  function frame(now) {
    if (!state.open) return;
    state.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    if (!state.ready) return;

    let moving = 0;
    if (state.playing && !state.looking) {
      const turn = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
      player.yaw += turn * 2.5 * dt;
      const dir = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
      if (dir) {
        const sp = (dir > 0 ? (keys.run ? 9 : 5) : 3) * dir * dt;
        const nx = player.x - Math.sin(player.yaw) * sp, nz = player.z - Math.cos(player.yaw) * sp;
        if (walkable(nx, nz)) { player.x = nx; player.z = nz; moving = 1; }
        else if (walkable(nx, player.z)) { player.x = nx; moving = 1; }      // slide along walls
        else if (walkable(player.x, nz)) { player.z = nz; moving = 1; }
        if (moving) player.walk += Math.abs(sp) * 2.4;
      }
    }
    player.moving += (moving - player.moving) * Math.min(1, dt * 12);

    // avatar
    avatar.position.set(player.x, Math.abs(Math.sin(player.walk)) * 0.05 * player.moving, player.z);
    avatar.rotation.y = player.yaw;
    const sw = Math.sin(player.walk) * 0.75 * player.moving, u = avatar.userData;
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armL.rotation.x = -sw * 0.8; u.armR.rotation.x = sw * 0.8;
    u.head.rotation.y = state.playing ? Math.sin(now / 1700) * 0.12 * (1 - player.moving) : 0;

    // third-person camera, pulled in when a wall is behind you
    camYaw += angDiff(player.yaw, camYaw) * (1 - Math.exp(-dt * 7));
    const bx = Math.sin(camYaw), bz = Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);      // to the player's right
    const BACK = 5.4, SIDE = 1.15;
    // Push the camera out along its boom until something is in the way. It has to stay in the same room as the
    // character with a clear line to him, so it never ends up behind a wall or looking in from the next room.
    const home = roomAt(player.x, player.z);
    const camOK = (q) => {
      const cx = player.x + (bx * BACK + rx * SIDE) * q, cz = player.z + (bz * BACK + rz * SIDE) * q;
      return walkable(cx, cz, 0.3) && (!home || roomAt(cx, cz) === home);
    };
    let k = 0.12;
    while (k < 1 && camOK(k + 0.03)) k += 0.03;
    k = camK += (Math.min(1, k) - camK) * (k < camK ? 1 : 1 - Math.exp(-dt * 5));   // snap in, ease back out
    avatar.visible = k > 0.3;                                  // squeezed against a wall or doorway: get the head out of the shot
    camera.position.set(player.x + (bx * BACK + rx * SIDE) * k, 2.05 + 0.75 * k, player.z + (bz * BACK + rz * SIDE) * k);
    camera.lookAt(player.x - bx * 6 + rx * SIDE * 0.75 * k, 2.0, player.z - bz * 6 + rz * SIDE * 0.75 * k);

    // outdoors: keep the sky on the visitor's clock, and blend fog + character shading as you step through the door
    const hr = hourNow();
    if (Math.abs(hr - yard.hour) > 0.008) applyTime(hr);
    const o = Math.min(1, Math.max(0, (player.x - 8.5) / 2));
    scene.fog.color.setHex(0x070707).lerp(yard.haze, o); scene.fog.near = 30 + 90 * o; scene.fog.far = 110 + 850 * o;
    if (Math.abs(o - yard.o) > 0.01) {
      yard.o = o; tmpColor.setHex(0xffffff).lerp(yard.tint, o);
      for (const a of avatarMats) a.mat.color.copy(a.base).multiply(tmpColor);
    }
    yard.dome.position.copy(camera.position);
    yard.sun.position.copy(camera.position).addScaledVector(yard.sunDir, 420);
    yard.moon.position.copy(camera.position).addScaledVector(yard.moonDir, 420);

    // HUD
    const rk = roomAt(player.x, player.z);
    if (rk && rk !== state.room) { state.room = rk; ui.room.textContent = "> " + ROOMS[rk].name; ui.time.classList.toggle("show", !!ROOMS[rk].outdoor); }
    const near = state.playing && !state.looking ? findNear() : state.near;
    if (near !== state.near || (!state.playing && state.near)) {
      state.near = state.playing ? near : null;
      if (state.near) {
        ui.capT.textContent = state.near.data.title;
        ui.capK.textContent = matchMedia("(pointer:coarse)").matches ? "TAP LOOK" : "PRESS [E] TO LOOK";
      }
      ui.cap.classList.toggle("show", !!state.near);
    }
    drawMap();
    renderer.render(scene, camera);
  }

  function drawMap() {
    const c = ui.map, g = c.getContext("2d"), S = 1.9, ox = 31, oz = 37;
    const X = (x) => Math.round((x + ox) * S) + 2, Z = (z) => Math.round((z + oz) * S) + 2;
    g.clearRect(0, 0, c.width, c.height);
    for (const key in ROOMS) {
      const m = ROOMS[key];
      g.fillStyle = key === state.room ? "#8dff9a" : "#5d6b5f";
      g.fillRect(X(m.x0), Z(m.z0), X(m.x1) - X(m.x0), Z(m.z1) - Z(m.z0));
    }
    g.fillStyle = "#5d6b5f";
    for (const d of DOORS) g.fillRect(X(d.x0), Z(d.z0), Math.max(2, X(d.x1) - X(d.x0)), Math.max(2, Z(d.z1) - Z(d.z0)));
    g.fillStyle = "#2c332d";
    for (const sl of SLABS) { const ax = sl.along === "x"; g.fillRect(X(sl.cx - (ax ? sl.w / 2 : 0.4)), Z(sl.cz - (ax ? 0.4 : sl.w / 2)), Math.max(2, Math.round((ax ? sl.w : 0.8) * S)), Math.max(2, Math.round((ax ? 0.8 : sl.w) * S))); }
    g.fillStyle = "#0a0a0a";
    for (const a of ARTS) g.fillRect(X(a.x + a.nx * 0.6) - 1, Z(a.z + a.nz * 0.6) - 1, 2, 2);
    const px = X(player.x), pz = Z(player.z), fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    g.fillStyle = "#ff3b3b";
    g.beginPath();
    g.moveTo(px + fx * 6, pz + fz * 6);
    g.lineTo(px - fx * 3 - fz * 4, pz - fz * 3 + fx * 4);
    g.lineTo(px - fx * 3 + fz * 4, pz - fz * 3 - fx * 4);
    g.closePath(); g.fill();
  }

  // for testing from the console: __museum.open(), __museum.tp(x, z, yaw)
  window.__museum = { open, close, begin, state, player, yard, setTime: (mode) => { yard.mode = mode; applyTime(hourNow()); }, tp: (x, z, yaw = player.yaw) => { player.x = x; player.z = z; player.yaw = yaw; camYaw = yaw; } };
})();
