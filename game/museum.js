/* ==========================================================================
   MUSEUM MODE — a retro third-person walk-through of Alex Koceyan's work.
   Loaded by index.html. Reads the site's own data (ILL, ILL_INFO, PROJECTS,
   MURALS, src) so anything added to the site shows up on the museum walls.
   The nav switch (#game-toggle), its styles and the "Press Start 2P" font are
   in index.html so they are there from the first paint; this file wires the
   switch up. The 3D engine (three.js) is only downloaded when it is clicked.
   ========================================================================== */
(() => {
  "use strict";

  const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js";
  const PIXEL = '"Press Start 2P", ui-monospace, "Courier New", monospace';

  /* ---------------- floor plan (metres; north is -z) ---------------- */
  const H = 6, DOOR_H = 3.6, R = 0.45;           // wall height, door height, player radius
  const RENDER_H = 360;                           // internal resolution (the retro look)
  const ROOMS = {
    lobby: { name: "LOBBY",               x0: -8,  x1: 8,   z0: -6,  z1: 6,  wall: "#2f6b3a", floor: ["#ece6d6", "#2b7a34"], gaps: { N: [-2, 2], W: [-2, 2], E: [-2, 2] } },
    ill:   { name: "ILLUSTRATION SALON",  x0: -16, x1: 16,  z0: -36, z1: -8, wall: "#6a1f26", floor: ["#8c5c36", "#7a4c2a"], gaps: { S: [-2, 2] } },
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
  // a guard in every room. yaw is where they face when nobody is near; they turn to you as you come over.
  const GUARDS = [
    { room: "lobby", x: 6.2,  z: -4.2,  yaw: Math.PI * 0.69, look: { skin: 0x7a4a24, hair: 0x140e0a, tall: 1.03 },
      line: "Please, no flash photography. We have standards here." },
    { room: "ill",   x: 7,    z: -20,   yaw: Math.PI * 0.8, look: { skin: 0xf0c08a, hair: 0x6b3a18, pony: true, tall: 0.96 },
      line: "I see you've been admiring that piece for a while now\u2026 Good taste." },
    { room: "gd",    x: -16.5, z: 0,    yaw: Math.PI * 1.5, look: { skin: 0xc07a46, hair: 0x201610, tall: 0.99 },
      line: "Man, if I were a recruiter, I'd hire this guy in a heartbeat. I'm not one, though. Are you?" },
    { room: "mur",   x: 24.5, z: 1.2,   yaw: Math.PI * 0.5, out: true, look: { skin: 0x9c6b3f, hair: 0x15100c, pony: true, tall: 1.01 },
      line: "You're not thinking of touching that, are you? I wouldn't want to start a scene." },   // stood under the lamp by the yard bench
  ];
  // gallery visitors — civilians musing about the art. Different heights and builds.
  // They stand a few metres back from the wall so the player can approach from behind without triggering the art.
  const VIEWERS = [
    { room: "ill", x: -13, z: -32, yaw: 0, kind: "visitor", look: { civ: true, skin: 0xe8b98a, hair: 0x3a2416, top: 0x7a4b63, tall: 0.91 },
      line: "I think there’s a deeper meaning here. Or maybe I’m just looking at birds. Hard to tell." },
    { room: "gd", x: -22, z: -3, yaw: 0, kind: "visitor", look: { civ: true, skin: 0x9c6b3f, hair: 0x14100c, top: 0x3c6e55, pony: true, tall: 1.05 },
      line: "Just took a picture with my flash on. These guards are rookies." },
    { room: "mur", x: 22, z: 9.5, yaw: Math.PI, out: true, kind: "visitor", look: { civ: true, skin: 0xd8a070, hair: 0x2a1c12, top: 0x8a5a2a, tall: 0.97 },
      line: "I believe the artist is exploring the tension between the natural and the man-made, perhaps commenting on humanity’s complicated relationship with its environment, which ultimately raises the question of… Wait, is that the GM Building?" },
  ];
  const NPCS = GUARDS.concat(VIEWERS);
  // freestanding walls in the yard, one mural each (the last one carries the in-progress photos)
  const SLABS = [
    { cx: 19,   cz: -3.5, w: 9.5,  h: 5.6, along: "x", nx: 0,  nz: 1 },
    { cx: 32,   cz: -3.5, w: 7,    h: 5.6, along: "x", nx: 0,  nz: 1 },
    { cx: 19,   cz: 13.5, w: 9.5,  h: 5.6, along: "x", nx: 0,  nz: -1 },
    { cx: 32.5, cz: 13.5, w: 10.5, h: 5.6, along: "x", nx: 0,  nz: -1 },
    { cx: 40.2, cz: 5,    w: 9.5,  h: 5.6, along: "z", nx: -1, nz: 0 },
  ];
  const LAMPS = [{ x: 26, z: 1.2 }, { x: 26, z: 9.2 }];   // the pair either side of the yard bench
  const BLOCKERS = BENCHES.map((b) => ({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, bench: true })).concat(
    NPCS.map((q) => ({ x0: q.x - 0.38, x1: q.x + 0.38, z0: q.z - 0.38, z1: q.z + 0.38 })),
    SLABS.map((s) => (s.along === "x" ? { x0: s.cx - s.w / 2, x1: s.cx + s.w / 2, z0: s.cz - 0.3, z1: s.cz + 0.3 } : { x0: s.cx - 0.3, x1: s.cx + 0.3, z0: s.cz - s.w / 2, z1: s.cz + s.w / 2 })),
    LAMPS.map((l) => ({ x0: l.x - 0.15, x1: l.x + 0.15, z0: l.z - 0.15, z1: l.z + 0.15 })));
  const START = { x: 0, z: 1.2, yaw: 0 };

  // skipBench: the camera passes this while you are sat down, so the bench right behind you is not treated as
  // something in the way. Everything else about the view stays exactly as it is anywhere else in the museum.
  function walkable(x, z, r = R, skipBench) {
    for (const b of BLOCKERS) { if (skipBench && b.bench) continue; if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return false; }
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

  /* ---------------- styles (the nav switch's own styles + mg-blink/mg-demo keyframes are in index.html) ---------------- */
  const css = `
  #mg{position:fixed;inset:0;z-index:1000;background:#050505;color:#f4f1e6;font-family:${PIXEL};font-size:11px;line-height:1.7;display:none;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:none}
  #mg:focus{outline:none}
  #mg .mg-card,#mg .mg-look .txt{touch-action:pan-y}
  #mg.on{display:flex;animation:mg-crt-on .5s steps(12) both}
  /* The shut-down collapses the whole overlay into a thin horizontal strip, CRT style. That only reads as a screen
     switching off if the thing collapsing is dark — against the grey console shell it is a pale bar sweeping over
     the site on the way out — so the shell goes black for the animation. */
  #mg.off{animation:mg-crt-off .28s steps(8) both;background:#050505;background-image:none}
  /* and the same on the way in: the band is dark until the screen opens out into the console */
  @keyframes mg-crt-on{
    0%{clip-path:inset(49.6% 0 49.6% 0);filter:brightness(6);background-color:#050505;background-image:none}
    45%{clip-path:inset(49.6% 0 49.6% 0);filter:brightness(6);background-color:#050505;background-image:none}
    100%{clip-path:inset(0);filter:none}
  }
  @keyframes mg-crt-off{to{clip-path:inset(49.8% 0 49.8% 0);filter:brightness(5)}}
  #mg .mg-stage{position:absolute;inset:0;overflow:hidden}
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
  /* both text boxes live inside the screen, stacked at the bottom of it like a handheld's dialogue box */
  #mg .mg-hud{position:absolute;left:0;right:0;bottom:22px;display:flex;flex-direction:column;align-items:center;gap:10px;padding:0 16px;pointer-events:none}
  #mg .mg-cap{max-width:min(760px,100%);background:rgba(8,8,8,.88);border:2px solid #f4f1e6;padding:11px 16px 9px;text-align:center;box-shadow:4px 4px 0 #2b7a34;display:none}
  #mg .mg-cap.show{display:block}
  #mg .mg-cap b{display:block;font-weight:400;color:#fff}
  #mg .mg-say{max-width:min(640px,100%);
    background:rgba(8,8,8,.9);border:2px solid #8dff9a;padding:11px 15px 10px;text-align:left;box-shadow:4px 4px 0 #000;display:none}
  #mg .mg-say.show{display:block}
  #mg .mg-say b{display:block;font-weight:400;color:#8dff9a;font-size:8px;letter-spacing:.12em;margin-bottom:6px}
  #mg .mg-say span{display:block;font-size:10px;line-height:1.75;color:#f4f1e6}
  /* the prompt text stays steady: nothing in the HUD blinks at you */
  #mg .mg-cap span{display:block;color:#8dff9a;font-size:9px;margin-top:3px}

  /* ---- the handheld ----
     The whole thing is a console: a grey-green shell with the 3D view set into a bezel, the way out, room name,
     clock and map along the top strip, and the screen taking everything that is left. Captions and what a guard
     says sit on the screen itself, like a handheld's dialogue box. Touch adds a d-pad and a button underneath
     (see the pointer:coarse block); on a desktop that space carries the name instead, since you play on keys.
     This block sits after the plain HUD rules above on purpose — it overrides them, so it has to come later. */
  /* Desktop: the console is only its frame. The screen fills the window inside the bezel and the HUD sits on the
     screen, exactly as it did before — nothing is given up to shell bands. Touch gets the whole handheld instead:
     shell, strip above, controls below (see the pointer:coarse block at the end). */
  #mg{flex-direction:column;justify-content:flex-start;background:#c9ccbe;background-image:linear-gradient(#d3d6c8,#b9bdae)}
  #mg .mg-stage{position:absolute;inset:46px;overflow:hidden;background:#000;
    border:4px solid #15170f;border-radius:10px 10px 10px 42px;box-shadow:0 0 0 16px #5c6054, 0 0 0 20px #44483d}
  #mg .mg-top{top:65px;left:65px;right:65px}
  #mg .mg-time{display:none;margin-top:8px;padding:6px 9px 5px;border:2px solid #f4f1e6;background:rgba(10,10,10,.82);
    color:#8dff9a;font-size:9px;line-height:1.3;text-align:left;box-shadow:2px 2px 0 #000}
  #mg .mg-time.show{display:block}
  #mg .mg-controls{display:none}
  #mg .mg-go,#mg .mg-begin,#mg .mg-tbtn{display:none}
  #mg .mg-brand{display:none}

  #mg .mg-card{position:absolute;inset:0;background:#050505;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center;overflow:auto;z-index:3}
  #mg .mg-card.hide{display:none}
  #mg .mg-card-in{max-width:680px;width:100%}
  #mg .mg-kick{color:#8dff9a;font-size:10px;letter-spacing:.1em}
  #mg h2{font:400 clamp(20px,4.6vw,40px)/1.25 ${PIXEL};margin:14px 0 16px;color:#fff;text-shadow:4px 4px 0 #2b7a34}
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
  /* not a button — just the blinking prompt, like a title screen */
  #mg .mg-start{margin-top:14px;background:none;color:#8dff9a;border:0;padding:0;font-size:12px;letter-spacing:.08em;display:none}
  #mg .mg-start.ready{display:inline-block;animation:mg-blink 1.1s steps(2,jump-none) infinite}
  /* touch controls legend: a little cross + a little button, each with one line of plain-case text */
  #mg .mg-touchnote{display:none;grid-template-columns:auto 1fr;gap:10px 11px;align-items:center;text-align:left;
    max-width:300px;margin:4px auto 20px;font-size:10px;line-height:1.45;color:#d8d5c8;text-transform:none;letter-spacing:0}
  #mg .mg-touchnote b{color:#8dff9a;font-weight:400}
  #mg .mg-touchnote .tn-i{width:17px;height:17px;flex:none;align-self:start;margin-top:1px}
  #mg .mg-touchnote .tn-pad{background:#2f322a;
    clip-path:polygon(36% 0,64% 0,64% 36%,100% 36%,100% 64%,64% 64%,64% 100%,36% 100%,36% 64%,0 64%,0 36%,36% 36%)}
  #mg .mg-touchnote .tn-act{background:#9c2b56;border-radius:50%;box-shadow:inset 0 -2px 0 rgba(0,0,0,.4)}

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
  /* a proper cross: up, then left and right either side of a centre hub, then down underneath */
  #mg .mg-pad .u{grid-column:2;grid-row:1}#mg .mg-pad .l{grid-column:1;grid-row:2}
  #mg .mg-pad .r{grid-column:3;grid-row:2}#mg .mg-pad .dn{grid-column:2;grid-row:3}
  #mg .mg-act{position:absolute;right:22px;bottom:34px;width:76px;height:76px;border-radius:50%;display:none;font-size:10px;color:#0a0a0a;background:#8dff9a;border-color:#0a0a0a}
  /* ---- touch layout: a handheld, not an overlay ----
     The 3D view becomes a 4:3 panel and everything else moves off it into bands above and below, so nothing a guard
     says and no caption ever sits on top of the gallery. Top band: exit, room, clock, map. Bottom: what you are
     looking at, then the d-pad and the action button. Spare height goes between the bands, not into the view. */
  @media (pointer:coarse){
    /* touch: the full handheld. The strip and the controls come out of the screen and onto the shell. */
    #mg .mg-top{position:relative;inset:auto;top:auto;left:auto;right:auto;order:1;padding:9px 12px 7px;gap:10px;align-items:flex-start}
    #mg .mg-exit{background:#2a2d26;border-color:#2a2d26;color:#e7e9df;box-shadow:2px 2px 0 #8a8d80;padding:8px 10px 7px}
    #mg .mg-room{color:#343730;text-shadow:none;margin-top:7px;font-size:9px}
    #mg .mg-map{border-color:#2a2d26;background:#1b1d18;width:124px;height:auto}
    #mg .mg-time{margin-top:7px;padding:7px 9px 6px;font-size:8px;border-color:#2a2d26;background:#2a2d26;box-shadow:2px 2px 0 #8a8d80}
    #mg .mg-stage{position:relative;inset:auto;order:2;flex:1 1 auto;min-height:0;margin:12px 14px 0;
      border-radius:7px 7px 7px 30px;box-shadow:0 0 0 7px #5c6054, 0 0 0 9px #44483d}
    #mg .mg-hud{bottom:10px;gap:7px;padding:0 10px}
    #mg .mg-cap{padding:8px 12px 7px;box-shadow:3px 3px 0 #000}
    #mg .mg-say{padding:9px 12px 8px}
    #mg .mg-say span{font-size:9px;line-height:1.7}
    #mg .mg-controls{display:flex;order:3;align-items:center;justify-content:space-between;gap:12px;padding:16px 26px 8px;margin-top:auto}
    #mg .mg-brand{display:block;order:4;text-align:center;letter-spacing:.22em;color:#5e6257;padding:0 0 10px;font-size:8px}
    #mg .mg-pad{position:relative;left:auto;bottom:auto;display:grid;grid-template-columns:repeat(3,46px);grid-template-rows:repeat(3,46px);gap:0}
    /* No inset shading on the arms: the up arm's bottom edge meets the hub, so its shadow drew a line straight
       across the middle of the cross. The cross is one flat moulded piece now. */
    #mg .mg-pad button{background:#2f322a;border:0;box-shadow:none;
      display:flex;align-items:center;justify-content:center;font-size:0;line-height:1;padding:0}
    /* The arrow glyphs fall back to the system font — Press Start 2P has no triangles — so they came out smooth
       next to the pixel lettering on the button. These are drawn instead as stair-stepped shapes: every edge is
       horizontal or vertical, so there is nothing for the renderer to soften. */
    #mg .mg-pad button::before{content:"";width:26px;height:26px;background:#d8dbce;
      clip-path:polygon(40% 0,60% 0,60% 20%,70% 20%,70% 40%,80% 40%,80% 60%,90% 60%,90% 80%,100% 80%,100% 100%,
        0 100%,0 80%,10% 80%,10% 60%,20% 60%,20% 40%,30% 40%,30% 20%,40% 20%)}
    #mg .mg-pad .dn::before{transform:rotate(180deg)}
    #mg .mg-pad .l::before{transform:rotate(-90deg)}
    #mg .mg-pad .r::before{transform:rotate(90deg)}
    /* the hub fills the middle so the four arms read as one cross rather than four separate keys */
    #mg .mg-pad::after{content:"";grid-column:2;grid-row:2;background:#2f322a;
      background-image:radial-gradient(circle at 50% 50%, #272a22 0 30%, transparent 31%)}
    #mg .mg-pad .u{border-radius:8px 8px 0 0}#mg .mg-pad .l{border-radius:8px 0 0 8px}
    #mg .mg-pad .dn{border-radius:0 0 8px 8px}#mg .mg-pad .r{border-radius:0 8px 8px 0}
    #mg .mg-pad button:active{background:#24271f}
    /* Moulded like the LOOK button: a darker lip along the bottom and a soft offset shadow. The lip goes only on
       the edges that really are the bottom of the cross (under the left arm, the down arm and the right arm), so
       nothing draws a line across the middle where the arms meet the hub. The offset shadow is each arm's own
       box-shadow, not a filter on the whole pad: on iPhone a filter is redrawn every time an arm is pressed, which
       made the shadow flicker off and back (twice) after each press. Where an arm's shadow would fall on the cross
       itself, the next arm or the hub is drawn over it, so only the outside edge shows. */
    #mg .mg-pad .u{box-shadow:3px 3px 0 rgba(0,0,0,.2)}
    #mg .mg-pad .l,#mg .mg-pad .r,#mg .mg-pad .dn{box-shadow:inset 0 -4px 0 rgba(0,0,0,.4),3px 3px 0 rgba(0,0,0,.2)}
    #mg .mg-pad .l:active,#mg .mg-pad .r:active,#mg .mg-pad .dn:active{box-shadow:inset 0 -1px 0 rgba(0,0,0,.4),3px 3px 0 rgba(0,0,0,.2)}
    #mg .mg-act{position:relative;right:auto;bottom:auto;display:block;width:76px;height:76px;
      background:#9c2b56;border:0;color:#ffe6ef;font-size:10px;box-shadow:inset 0 -4px 0 rgba(0,0,0,.4),3px 3px 0 rgba(0,0,0,.2)}
    #mg .mg-act:active{box-shadow:inset 0 -1px 0 rgba(0,0,0,.4);transform:translateY(2px)}
    /* T: a little time button down and to the left of the main button. It only appears in the mural yard (the one
       place the time of day changes anything) and does what tapping the clock in the corner of the screen does.
       The main button never moves when it comes and goes. */
    #mg .mg-tbtn{position:absolute;right:106px;bottom:12px;width:40px;height:40px;border:0;border-radius:50%;padding:0;
      align-items:center;justify-content:center;background:#9c2b56;color:#ffe6ef;font-size:11px;
      box-shadow:inset 0 -4px 0 rgba(0,0,0,.4),3px 3px 0 rgba(0,0,0,.2)}
    #mg .mg-tbtn:active{box-shadow:inset 0 -1px 0 rgba(0,0,0,.4),3px 3px 0 rgba(0,0,0,.2);transform:translateY(2px)}
    #mg.outdoor.playing:not(.viewing) .mg-tbtn{display:flex}
    /* Viewing a piece: the console face stays above the overlay so both buttons are still under your thumbs.
       The d-pad has nothing to steer, so its side becomes the way through to the site and the other side goes
       back. The label stays "OPEN" whatever the piece is — the overlay already says where it leads, and a button
       whose text changes length every time makes the face jump about. */
    #mg .mg-look{z-index:4;padding-bottom:126px}
    #mg .mg-controls{position:relative;z-index:6;min-height:138px}
    #mg.viewing .mg-pad{display:none}
    #mg.viewing .mg-go{display:flex;align-items:center;justify-content:center}
    #mg .mg-go{width:138px;height:76px;border:0;border-radius:40px;background:#3f7d4a;color:#eafbe8;
      font-size:11px;letter-spacing:.08em;box-shadow:inset 0 -4px 0 rgba(0,0,0,.4),3px 3px 0 rgba(0,0,0,.2)}
    #mg .mg-go:active{box-shadow:inset 0 -1px 0 rgba(0,0,0,.4);transform:translateY(2px)}
    /* before the game starts there is nothing to steer or look at, so the face carries one START button */
    #mg:not(.playing) .mg-pad,#mg:not(.playing) .mg-act{display:none}
    #mg:not(.playing) .mg-controls{justify-content:center}
    #mg:not(.playing) .mg-begin{display:flex;align-items:center;justify-content:center}
    #mg .mg-begin{width:168px;height:76px;border:0;border-radius:40px;background:#9c2b56;color:#ffe6ef;
      font-size:12px;letter-spacing:.14em;box-shadow:inset 0 -4px 0 rgba(0,0,0,.4),3px 3px 0 rgba(0,0,0,.2)}
    #mg .mg-begin:active{box-shadow:inset 0 -1px 0 rgba(0,0,0,.4);transform:translateY(2px)}
    #mg .mg-keys{display:none}
    #mg .mg-touchnote{display:grid}#mg .mg-how{display:none}
  }
  @media (max-width:760px){
    #mg .mg-look{grid-template-columns:1fr;grid-template-rows:minmax(0,1.2fr) minmax(0,1fr);gap:16px;padding:60px 16px 16px}
    #mg .mg-map{width:104px;height:auto}
  }
  /* Last word on the artwork view for touch. These come after everything else on purpose: the blocks above set
     the overlay's padding and grid, and this has to win.
       - its own BACK / OPEN buttons go: the console face below carries both, which is where your thumbs are
       - nothing scrolls. A phone screen is small enough that a scrollbox inside an overlay is miserable, so the
         description is trimmed to what fits and the rest is a tap away on the site. */
  @media (pointer:coarse){
    #mg .mg-look{padding-bottom:126px}
    #mg .mg-look .acts{display:none}
    /* The screen runs right up under the EXIT button: only EXIT stays on the shell above it. The room name, the
       clock button and the map sit inside the top of the screen instead (as on desktop), so the view gains the
       height the strip used to take. They are positioned from the bottom of the top band, i.e. the top of the
       screen (band + the screen's 12px margin + 8px inside the bezel). */
    /* z-index: flex "order" puts the screen after the top band when painting, which would hide these under it.
       2 keeps them over the view but under the start card (3) and the artwork view (4). */
    #mg .mg-top{padding:9px 14px 0;z-index:2}
    #mg .mg-top > div:last-child{position:absolute;top:calc(100% + 20px);right:22px}
    #mg .mg-map{width:84px;height:auto;border-color:#f4f1e6;background:rgba(0,0,0,.6)}
    #mg .mg-room{position:absolute;top:calc(100% + 20px);left:22px;margin:0;font-size:9px;color:#8dff9a;text-shadow:2px 2px 0 #000}
    #mg .mg-time{position:absolute;top:calc(100% + 42px);left:22px;margin:0;border-color:#f4f1e6;background:rgba(10,10,10,.82);box-shadow:none}
    #mg .mg-look .txt{overflow:hidden}
    #mg .mg-look .note{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    #mg .mg-look .body{display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}
    #mg .mg-look h3{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  }`;
  document.head.appendChild(Object.assign(document.createElement("style"), { textContent: css }));

  const nav = document.getElementById("nav");
  if (!nav) return;
  // the switch is in the page's own markup (see index.html); built here only as a fallback if it is ever missing
  let toggle = document.getElementById("game-toggle");
  if (!toggle) {
    toggle = document.createElement("button");
    toggle.type = "button"; toggle.className = "game-toggle"; toggle.id = "game-toggle";
    toggle.setAttribute("role", "switch"); toggle.setAttribute("aria-checked", "false");
    toggle.setAttribute("aria-label", "Museum mode: walk through the work as a retro video game");
    toggle.title = "Museum mode: walk through the work like a retro video game";
    toggle.innerHTML = '<span class="gt-sw" aria-hidden="true"><i></i></span><span class="gt-txt"><span>Museum</span><span>mode</span></span>';
    nav.appendChild(toggle);                    // after the Contact button
  }
  nav.classList.add("has-game");
  toggle.addEventListener("click", open);
  // iOS is unreliable about :active on a button, so the "switch thrown" look is set from the touch directly
  toggle.addEventListener("touchstart", () => toggle.classList.add("pressed"), { passive: true });
  ["touchend", "touchcancel"].forEach(ev =>
    toggle.addEventListener(ev, () => setTimeout(() => toggle.classList.remove("pressed"), 220), { passive: true }));

  /* ---------------- overlay DOM ---------------- */
  let root, ui = {};
  function buildDOM() {
    root = document.createElement("div");
    root.id = "mg"; root.tabIndex = -1;
    root.setAttribute("role", "application"); root.setAttribute("aria-label", "Museum mode");
    root.innerHTML = `
      <div class="mg-stage"><canvas class="mg-view"></canvas><div class="mg-scan"></div>
        <div class="mg-hud">
          <div class="mg-say" aria-live="polite"><b>SECURITY</b><span></span></div>
          <div class="mg-cap" aria-live="polite"><b></b><span></span></div>
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
              <div class="k"><kbd>E</kbd><span class="or">OR</span><kbd>SPACE</kbd></div><div class="d">LOOK AT THE ART IN FRONT OF YOU<br>OR SIT DOWN WHEN YOU ARE BY A BENCH</div>
              <div class="k"><kbd>ESC</kbd></div><div class="d">BACK TO THE WEBSITE</div>
            </div>
            <div class="mg-touchnote">
              <span class="tn-i tn-pad" aria-hidden="true"></span><span><b>MOVE</b> — up/down walks, left/right turns</span>
              <span class="tn-i tn-act" aria-hidden="true"></span><span><b>ACT</b> — look, sit, talk; the button fits whatever is in front of you</span>
            </div>
            <div class="mg-load"><i></i></div>
            <div class="mg-status">LOADING…</div>
            <button class="mg-start" type="button">PRESS ENTER OR SPACE</button>
          </div>
        </div>
      </div>
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
      <div class="mg-say" aria-live="polite"><b>SECURITY</b><span></span></div>
      <div class="mg-cap" aria-live="polite"><b></b><span></span></div>
      <div class="mg-controls">
        <div class="mg-pad" aria-hidden="true">
          <button class="u" data-k="up">▲</button><button class="l" data-k="left">◀</button><button class="dn" data-k="down">▼</button><button class="r" data-k="right">▶</button>
        </div>
        <button class="mg-go" type="button">OPEN</button>
        <button class="mg-begin" type="button">START</button>
        <button class="mg-act" type="button">LOOK</button>
        <button class="mg-tbtn" type="button" aria-label="Change the time of day">T</button>
      </div>
      <div class="mg-brand">ALEX KOCEYAN</div>
      <div class="mg-look" role="dialog" aria-label="Artwork">
        <div class="pic"><img alt=""></div>
        <div class="txt"><div class="tag"></div><h3></h3><p class="note"></p><p class="body"></p><div class="acts"></div></div>
      </div>
`;
    document.body.appendChild(root);
    ui = {
      view: root.querySelector(".mg-view"), room: root.querySelector(".mg-room"), time: root.querySelector(".mg-time"), map: root.querySelector(".mg-map"),
      cap: root.querySelector(".mg-cap"), capT: root.querySelector(".mg-cap b"), capK: root.querySelector(".mg-cap span"),
      say: root.querySelector(".mg-say"), sayB: root.querySelector(".mg-say b"), sayT: root.querySelector(".mg-say span"),
      act: root.querySelector(".mg-act"), go: root.querySelector(".mg-go"),
      card: root.querySelector(".mg-card"), bar: root.querySelector(".mg-load i"), status: root.querySelector(".mg-status"),
      start: root.querySelector(".mg-start"), look: root.querySelector(".mg-look"), lookImg: root.querySelector(".mg-look img"),
      lookTag: root.querySelector(".mg-look .tag"), lookH: root.querySelector(".mg-look h3"), lookNote: root.querySelector(".mg-look .note"),
      lookBody: root.querySelector(".mg-look .body"), lookActs: root.querySelector(".mg-look .acts"),
    };
    root.querySelector(".mg-exit").addEventListener("click", close);
    // there is no Esc key on a phone, so do not advertise one
    if (matchMedia("(pointer:coarse)").matches) root.querySelector(".mg-exit span:last-child").textContent = "Exit";
    ui.start.addEventListener("click", begin);
    ui.time.addEventListener("click", cycleTime);
    root.querySelector(".mg-tbtn").addEventListener("click", cycleTime);
    root.querySelector(".mg-act").addEventListener("click", act);
    root.querySelector(".mg-go").addEventListener("click", () => { if (state.view && state.view.go) state.view.go(); });
    root.querySelector(".mg-begin").addEventListener("click", begin);
    root.querySelectorAll(".mg-pad button").forEach((b) => {
      const k = b.dataset.k;
      const set = (v) => (e) => { e.preventDefault(); keys[k] = v; };
      b.addEventListener("pointerdown", set(true)); b.addEventListener("pointerup", set(false));
      b.addEventListener("pointerleave", set(false)); b.addEventListener("pointercancel", set(false));
    });
  }

  /* ---------------- state ---------------- */
  const keys = { up: false, down: false, left: false, right: false, run: false };
  const state = { open: false, playing: false, looking: false, ready: false, failed: false, raf: 0, near: null, room: "", bench: null, sitting: null, guard: null, talking: null, view: null };
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
    if (k) {
      // seated: left / right still turn you on the spot, but trying to walk gets you up
      if (down && state.sitting && (k === "up" || k === "down")) { stand(); e.preventDefault(); e.stopImmediatePropagation(); return; }
      keys[k] = down; e.preventDefault(); e.stopImmediatePropagation(); return;
    }
    if (!down) return;
    let used = true;
    if (e.code === "Escape") { if (state.looking) closeLook(); else close(); }
    // state.view is the piece you are looking at. (state.near is cleared while the overlay is open — it tracks what
    // is in front of you in the room, which is nothing while you are reading about something.)
    else if (e.code === "Enter") { if (state.looking && state.view && state.view.go) state.view.go(); else act(); }
    else if (e.code === "KeyE" || e.code === "Space") { act(); }
    else if (e.code === "KeyH") { if (state.playing && !state.looking) showCard(); }
    else if (e.code === "KeyT") { if (state.playing && !state.looking) cycleTime(); }
    else used = false;
    if (used) { e.preventDefault(); e.stopImmediatePropagation(); }
  }
  const clearKeys = () => { for (const k in keys) keys[k] = false; };
  // E / SPACE / the on-screen button all come here: whatever is in front of you is what it does
  function act() {
    if (!state.playing) return begin();
    if (state.looking) return closeLook();
    if (state.talking) return hush();
    if (state.sitting) return stand();
    if (state.near) return tryLook();
    if (state.guard) return speak(state.guard);
    if (state.bench) return sit(state.bench);
  }
  function speak(q) { state.talking = q; ui.sayB.textContent = q.kind === "visitor" ? "GALLERY VISITOR" : "SECURITY"; ui.sayT.textContent = "“" + q.line + "”"; ui.say.classList.add("show"); }
  function hush() { state.talking = null; ui.say.classList.remove("show"); }

  /* ---------------- open / close ---------------- */
  let prevFocus = null, prevOverflow = "";
  async function open() {
    if (state.open) return;
    if (!root) buildDOM();
    state.open = true; prevFocus = document.activeElement;
    prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    // shut the phone menu properly: the drop-down AND the menu button's "open" look (it used to stay green/crossed)
    nav.classList.remove("open");
    const mb = document.querySelector(".menu-btn"); if (mb) mb.setAttribute("aria-expanded", "false");
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
    // the stage is sized by css now, so watch the element itself as well as the window (the phone layout changes
    // height when the address bar slides away, which does not always arrive as a window resize)
    if (!state.ro && window.ResizeObserver) { state.ro = new ResizeObserver(resize); state.ro.observe(ui.view.parentElement); }
    lastT = performance.now();
    cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(frame);
  }
  // refocus: put the keyboard back on the Museum Mode button. Right when you have just stepped out of the game and
  // are still on the same page; wrong when you followed a piece through to somewhere else, where it leaves the
  // button sitting there focus-ringed on a page it has nothing to do with. Called straight from a click handler
  // the argument is the event, which is truthy, so that path keeps the old behaviour.
  function close(refocus = true) {
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
    if (refocus && prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
  }
  function showCard() {
    state.playing = false; clearKeys();
    ui.card.classList.remove("hide");
    root.classList.remove("playing");   // until you are in, the console face carries one START button
    if (state.ready) markReady();
  }
  function markReady() {
    ui.start.classList.add("ready");
    ui.start.textContent = matchMedia("(pointer:coarse)").matches ? "PRESS START" : "PRESS ENTER OR SPACE";
  }
  function begin() {
    if (!state.ready) return;
    ui.card.classList.add("hide");
    state.playing = true;
    root.classList.add("playing");
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
    // "highp" and no alpha: a phone will otherwise happily hand back a low-precision buffer.
    renderer = new T.WebGLRenderer({ canvas: ui.view, antialias: false, powerPreference: "low-power", precision: "highp", alpha: false });
    renderer.setPixelRatio(1);
    scene = new T.Scene();
    scene.background = new T.Color(0x070707);
    scene.fog = new T.Fog(0x070707, 30, 110);
    // The near plane drives how much depth precision there is to go round, and on a phone there may only be 16 bits
    // of it. 0.1 spent most of that range on the first few centimetres; 0.25 is still closer than the camera ever
    // gets to anything (it hides the character before it is squeezed in that far) and roughly doubles the rest.
    camera = new T.PerspectiveCamera(62, 16 / 9, 0.25, 1200);
    scene.add(new T.AmbientLight(0xffffff, 2.3));
    const sun = new T.DirectionalLight(0xfff2d8, 1.4); sun.position.set(6, 12, 8); scene.add(sun);

    buildRooms();
    buildYard();
    hangEverything();
    avatar = buildAvatar(); scene.add(avatar);
    for (const q of NPCS) { q.mesh = buildGuard(q.out, q.look); q.mesh.position.set(q.x, 0, q.z); q.mesh.rotation.y = q.yaw; scene.add(q.mesh); }
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
  const yard = { mats: [], art: [], glows: [], bulbs: [], accents: [], lamp: [], hour: -99, mode: 0, o: -1, night: 0, tint: null, artTint: null, lampTint: null, haze: null };
  const avatarMats = [];
  function tinted(mat) { yard.mats.push({ mat, base: mat.color.clone() }); return mat; }
  // for things standing in a lamp's pool of light: they follow the time of day, but the lamp keeps them readable
  // after dark instead of letting them sink into the night like the rest of the yard
  function lamplit(mat) { yard.lamp.push({ mat, base: mat.color.clone() }); return mat; }
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
    ui.time.textContent = t + (matchMedia("(pointer:coarse)").matches ? " (T)" : " [T]");
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

    // Soft pools of lamp light on the ground, only visible after dark.
    // The glow texture is computed, NOT drawn on a canvas. A canvas stores colour premultiplied by alpha, and
    // Safari on iOS dithers gradients with a little per-channel noise; when that is handed to WebGL it is divided
    // back out by alpha, and across a faint gradient the noise comes back as confetti — pink, green and blue
    // specks all over the pool. (Desktop Chrome draws the same gradient cleanly, which is why it only showed on
    // phones, and why nothing done to the depth buffer ever touched it.) Here every texel is exactly white and
    // only the alpha varies, so there is no colour in it to go wrong.
    const GS = 128, glowPx = new Uint8Array(GS * GS * 4);
    for (let y = 0; y < GS; y++) for (let x = 0; x < GS; x++) {
      const t = Math.min(1, Math.max(0, (Math.hypot(x + 0.5 - GS / 2, y + 0.5 - GS / 2) - 2) / (GS / 2 - 2)));
      const al = t < 0.45 ? 1 - (t / 0.45) * 0.58 : 0.42 * (1 - (t - 0.45) / 0.55);   // 1 -> .42 at 45% -> 0 at the rim
      const i = (y * GS + x) * 4;
      glowPx[i] = glowPx[i + 1] = glowPx[i + 2] = 255; glowPx[i + 3] = Math.round(al * 255);
    }
    const glowTex = new T.DataTexture(glowPx, GS, GS, T.RGBAFormat);
    glowTex.colorSpace = T.SRGBColorSpace; glowTex.magFilter = glowTex.minFilter = T.LinearFilter;
    glowTex.generateMipmaps = false; glowTex.needsUpdate = true;
    const pool = (x, z, sx, sz, max) => {
      // depthWrite off + polygonOffset keep the plane from fighting the grass it lies on
      const mat = new T.MeshBasicMaterial({ map: glowTex, color: 0xffd58a, transparent: true, opacity: 0,
        blending: T.AdditiveBlending, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      const m = new T.Mesh(new T.PlaneGeometry(1, 1), mat);
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.06, z); m.scale.set(sx, sz, 1); scene.add(m);
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
    const CITY_DX = 140, city = new T.Group(); city.position.x = CITY_DX; scene.add(city); yard.city = city;
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
    yard.lampTint = P.tint.clone().lerp(new T.Color(0xfff0cf), 0.72);     // and so does anyone stood under a lamp
    for (const o of yard.mats) o.mat.color.copy(o.base).multiply(P.tint);
    for (const o of yard.lamp) o.mat.color.copy(o.base).multiply(yard.lampTint);
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
  // crop: [x, y, w, h] as fractions, to show only part of a picture so its subject fills the frame.
  // alpha: a second image whose shape the first one shows through — used to hang a logo with artwork inside it.
  // bg: a solid card behind the picture. A logo on a transparent background needs one — without it the see-through
  // parts come out black (nothing is compositing them), which for a black logo means a black rectangle.
  function hang({ url, ar = 1, maxW, maxH, x, z, nx, nz, data, frame = 0x14110f, outdoor = false, bottom = null, crop = null, alpha = null, bg = null }) {
    const grp = new T.Group();
    grp.position.set(x + nx * 0.09, 2.3, z + nz * 0.09);
    grp.rotation.y = Math.atan2(nx, nz);
    const mat = new T.MeshBasicMaterial({ color: 0x3a3632 });
    // With a backing card the picture has to stand further off the wall: the frame is a box whose front face is at
    // z 0.02, so a card sitting on 0.02 fights it for every pixel, and a picture 0.01 in front of the card fights
    // that. Spaced 3cm apart there is nothing to argue about.
    const art = new T.Mesh(new T.PlaneGeometry(1, 1), mat); art.position.z = bg == null ? 0.03 : 0.08;
    const fr = new T.Mesh(new T.BoxGeometry(1, 1, 0.1), new T.MeshLambertMaterial({ color: frame == null ? 0x000000 : frame })); fr.position.z = -0.03;
    const tagM = new T.Mesh(new T.PlaneGeometry(0.36, 0.22), new T.MeshBasicMaterial({ color: 0xf1ecdc }));   // the little wall label
    const card = bg == null ? null : new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: bg }));
    if (card) { card.position.z = 0.05; grp.add(card); mat.transparent = true; }   // the picture composites onto it
    grp.add(fr, art, tagM); scene.add(grp);
    if (outdoor) { yard.art.push(mat); tagM.visible = false; if (frame == null) fr.visible = false; else tinted(fr.material); }
    const rec = { x, z, nx, nz, w: 1, data, grp };
    const fit = (a) => {
      const w = Math.min(maxW, maxH * a), hh = w / a;
      art.scale.set(w, hh, 1); fr.scale.set(w + 0.26, hh + 0.26, 1);
      if (card) card.scale.set(w, hh, 1);
      grp.position.y = bottom != null ? bottom + hh / 2 : Math.max(2.3, 0.95 + hh / 2);
      tagM.position.set(w / 2 + 0.42, -hh / 2 + 0.16, 0);
      rec.w = w;
    };
    fit(ar);
    total++;
    loader.load(url, (tex) => {
      tex.colorSpace = T.SRGBColorSpace;
      tex.magFilter = T.NearestFilter; tex.minFilter = T.LinearMipmapLinearFilter;
      if (crop) { tex.repeat.set(crop[2], crop[3]); tex.offset.set(crop[0], 1 - crop[1] - crop[3]); }   // three counts up from the bottom
      mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true;
      if (outdoor && yard.artTint) mat.color.copy(yard.artTint);
      // with an alpha image the shape of that decides the frame, so leave the fitting to it
      if (!alpha && tex.image && tex.image.width)
        fit((tex.image.width * (crop ? crop[2] : 1)) / (tex.image.height * (crop ? crop[3] : 1)));
      loaded++; setProgress();
    }, undefined, () => { loaded++; setProgress(); });
    if (alpha) {
      total++;
      loader.load(alpha, (t2) => {
        t2.magFilter = T.LinearFilter; t2.minFilter = T.LinearMipmapLinearFilter;
        mat.alphaMap = t2; mat.transparent = true; mat.needsUpdate = true;
        if (t2.image && t2.image.width) fit(t2.image.width / t2.image.height);
        loaded++; setProgress();
      }, undefined, () => { loaded++; setProgress(); });
    }
    ARTS.push(rec);
    return rec;
  }
  // Composite a logo shape filled with a gradient, on white, into one image for the view overlay. The logo image
  // is the mask; the gradient (optionally a crop band of it) is cover-fit inside it. Both images are served with
  // CORS headers, so the canvas stays clean and toDataURL works.
  function bakeMasked(gradUrl, logoUrl, crop, cb) {
    const lg = new Image(), gd = new Image(); lg.crossOrigin = gd.crossOrigin = "anonymous";
    let n = 0;
    const go = () => { if (++n < 2) return;
      try {
        const w = lg.naturalWidth, h = lg.naturalHeight;
        const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d");
        x.drawImage(lg, 0, 0, w, h);                                   // the logo is the shape to keep
        x.globalCompositeOperation = "source-in";                     // paint the gradient only inside it
        const gw = gd.naturalWidth, gh = gd.naturalHeight;
        const cx = crop ? crop[0] * gw : 0, cy = crop ? crop[1] * gh : 0;
        const cw = crop ? crop[2] * gw : gw, ch = crop ? crop[3] * gh : gh;
        const s = Math.max(w / cw, h / ch), dw = cw * s, dh = ch * s;
        x.drawImage(gd, cx, cy, cw, ch, (w - dw) / 2, (h - dh) / 2, dw, dh);
        x.globalCompositeOperation = "destination-over";              // then white behind the logo
        x.fillStyle = "#fff"; x.fillRect(0, 0, w, h);
        cb(c.toDataURL("image/png"));
      } catch (e) {}
    };
    lg.onload = gd.onload = go;
    lg.src = logoUrl; gd.src = gradUrl;
  }
  // crop an image to [x, y, w, h] (fractions) and hand back a data URL, so the look-view shows the same framing
  // the wall does. The canvas stays clean (CORS), so toDataURL works.
  function bakeCrop(url, crop, cb) {
    const im = new Image(); im.crossOrigin = "anonymous";
    im.onload = () => {
      try {
        const iw = im.naturalWidth, ih = im.naturalHeight;
        const sx = crop[0] * iw, sy = crop[1] * ih, sw = crop[2] * iw, sh = crop[3] * ih;
        const c = document.createElement("canvas"); c.width = Math.round(sw); c.height = Math.round(sh);
        c.getContext("2d").drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
        cb(c.toDataURL("image/jpeg", 0.9));
      } catch (e) {}
    };
    im.src = url;
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
    sign([["ILLUSTRATION SALON", 24]], 0, L.z0, 0, 1, lint, 6.4, 1.3);
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
          goLabel: it.cls === "book" ? "READ THE COMIC ON THE SITE" : "SEE IT ON THE ILLUSTRATION PAGE", go: () => leaveTo("#illustration", it.f) },
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
    // most projects hang their cover photo; these four read better as something else on a wall
    const GD_PIC = {
      luxor:      { crop: [0.12, 0.26, 0.76, 0.56] },                                     // tighter, so the sign carries across the room
      // the full logo with "Simply. Bumpin'" tagline — a local image (the site's cutout mask doesn't include the tagline)
      "dj-hayko": { raw: "game/hayko-logo.webp", bg: 0xffffff, viewBg: "#fff" },
      arakyal:    { url: "5500a9ae2a854a10bef8faad35266281.png", bg: 0xffffff, viewBg: "#fff" },   // the plain logo, on white
      marlenka:   { url: "76efed98c5ff4fecb9ea59b6b327f049.jpg" },                        // the postcard, held
    };
    const projs = PROJECTS.map((p) => {
      const o = GD_PIC[p.slug] || {}, pic = o.url || p.cover;
      // "raw" = a local image path used as-is (not a Cargo hash)
      const wallUrl = o.raw || src(pic, 900), viewUrl = o.raw || src(pic, 1600);
      const data = { tag: "GRAPHIC DESIGN · " + p.type.toUpperCase(), title: p.name, body: p.text,
        img: viewUrl, viewBg: o.viewBg || null, goLabel: "OPEN THE FULL PROJECT", go: () => leaveTo("#" + p.slug) };
      // the view shows one flat image. For the gradient-through-logo piece that has to be baked (a raw gradient is
      // just a gradient), so composite the logo shape filled with the gradient on white and use that.
      if (o.viewMask) bakeMasked(src(pic, 1200), src(o.viewMask, 900), o.crop, (u) => { data.img = u; });
      return {
        url: wallUrl, ar: 1.4, crop: o.crop || null, alpha: o.alpha ? src(o.alpha, 900) : null, bg: o.bg != null ? o.bg : null,
        data,
      };
    });
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
      const sl = SLABS[i], fm = first(m);
      const d = { tag: "MURAL · " + m.tag.toUpperCase(), title: m.name, body: m.text, img: src(fm.f, 1800), goLabel: "SEE IT ON THE MURALS PAGE", go: () => leaveTo("#murals", null, MURALS.indexOf(m)) };
      if (fm.crop) bakeCrop(src(fm.f, 1800), fm.crop, (u) => { d.img = u; });   // the view matches the cropped wall
      hang({
        url: src(fm.f, 1200), ar: 1.6, crop: fm.crop || null, maxW: sl.w - 0.8, maxH: sl.h - 1.1, outdoor: true, frame: null, bottom: 0.55, ...face(sl),
        data: d,
      });
    });
    const extras = [];
    MURALS.forEach((m) => m.rows.flat().forEach((it) => {
      if (it && it.f && it !== first(m) && it.cap && /progress/i.test(it.cap) && extras.length < 2)
        extras.push({ url: src(it.f, 720), ar: it.w / it.h, data: { tag: "MURAL · IN PROGRESS", title: m.name, note: "Process photo", body: m.text, img: src(it.f, 1600), goLabel: "SEE IT ON THE MURALS PAGE", go: () => leaveTo("#murals", null, MURALS.indexOf(m)) } });
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
    // same build as the guards: eight-sided prisms that taper, rather than stacked cubes
    const tube = (rt, rb, hh, color, x, y, z, parent = g, seg = 8) => {
      const mat = new T.MeshLambertMaterial({ color });
      avatarMats.push({ mat, base: mat.color.clone() });
      const m = new T.Mesh(new T.CylinderGeometry(rt, rb, hh, seg), mat);
      m.position.set(x, y, z); parent.add(m); return m;
    };
    // the pivots stay where they were (hips at 0.82, shoulders at 1.44) so the walk cycle and the seated pose
    // keep working off the same numbers
    const limb = (x, y, rt, hh, rb, color, tipColor, flatTip) => {
      const piv = new T.Group(); piv.position.set(x, y, 0); g.add(piv);
      tube(rt, rb, hh, color, 0, -hh / 2, 0, piv);
      if (tipColor && flatTip) box(rb * 2 + 0.06, 0.12, rb * 2 + 0.16, tipColor, 0, -hh + 0.05, -0.04, piv);
      // hands built exactly like the guards': a short tube (0.07 → 0.06, 0.14 tall) sitting at the wrist
      else if (tipColor) tube(0.07, 0.06, 0.14, tipColor, 0, -hh - 0.05, 0, piv);
      return piv;
    };
    const SKIN = 0xd9a47c, HAIR = 0x1c1410, TEE = 0x2f7a3a, JEANS = 0x1f2a44, SHOE = 0xf2f2f2;
    g.userData.legL = limb(-0.125, 0.82, 0.105, 0.8, 0.085, JEANS, SHOE, true);
    g.userData.legR = limb(0.125, 0.82, 0.105, 0.8, 0.085, JEANS, SHOE, true);
    tube(0.23, 0.2, 0.2, JEANS, 0, 0.9, 0);                          // hips
    tube(0.275, 0.215, 0.58, TEE, 0, 1.2, 0);                        // torso (green tee), shoulders to waist
    g.userData.armL = limb(-0.315, 1.44, 0.08, 0.62, 0.06, TEE, SKIN);
    g.userData.armR = limb(0.315, 1.44, 0.08, 0.62, 0.06, TEE, SKIN);
    tube(0.072, 0.082, 0.1, SKIN, 0, 1.54, 0);                       // neck
    const head = new T.Group(); head.position.set(0, 1.74, 0); g.add(head);
    tube(0.163, 0.153, 0.33, SKIN, 0, 0, 0, head);                   // head
    tube(0.172, 0.167, 0.11, HAIR, 0, 0.15, 0, head);                // hair: top
    box(0.29, 0.26, 0.1, HAIR, 0, 0.03, 0.13, head);                 // hair: back
    box(0.12, 0.09, 0.08, HAIR, -0.085, 0.1, -0.12, head);           // curl over the forehead
    box(0.12, 0.09, 0.03, 0x111111, -0.078, -0.01, -0.158, head);    // glasses
    box(0.12, 0.09, 0.03, 0x111111, 0.078, -0.01, -0.158, head);
    box(0.06, 0.03, 0.03, 0x111111, 0, -0.005, -0.158, head);
    g.userData.head = head;
    const sh = new T.Mesh(new T.CircleGeometry(0.42, 12), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; g.add(sh);
    return g;
  }

  // A guard in a navy uniform with a peaked cap and a brass badge. Built from eight-sided prisms rather than cubes:
  // at this size that reads as rounded shoulders, arms and a head, so they are not four stacks of blocks. The torso
  // tapers from shoulder to waist and the limbs taper toward wrist and ankle, which is what stops it looking carved
  // out of boxes. Outdoors the materials join the yard's lamp-lit set so they take the sky colour as the day turns.
  function buildGuard(outdoor, look = {}) {
    const g = new T.Group();
    const mk = (hex) => { const m = new T.MeshLambertMaterial({ color: hex }); return outdoor ? lamplit(m) : m; };
    const box = (w, hh, d, color, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, hh, d), mk(color)); m.position.set(x, y, z); g.add(m); return m; };
    // rt / rb = radius at the top and bottom, so a limb can taper
    const tube = (rt, rb, hh, color, x, y, z, seg = 8) => {
      const m = new T.Mesh(new T.CylinderGeometry(rt, rb, hh, seg), mk(color)); m.position.set(x, y, z); g.add(m); return m;
    };
    const SKIN = look.skin || 0xc98f68, HAIR = look.hair || 0x1a1410;
    // the yard guard works nights, so his uniform is a few shades lighter — a dark navy out there just reads as
    // a silhouette no matter how much the lamp lifts it
    const NAVY = outdoor ? 0x46598a : 0x27344f, DARK = outdoor ? 0x33425f : 0x1b2236;
    const SHOE = outdoor ? 0x2a2a2a : 0x141414, CAP = outdoor ? 0x2c3a5e : 0x161d2e, BRASS = 0xd8b64a;
    tube(0.115, 0.085, 0.8, DARK, -0.125, 0.46, 0); tube(0.115, 0.085, 0.8, DARK, 0.125, 0.46, 0);   // legs, tapering to the ankle
    box(0.2, 0.11, 0.3, SHOE, -0.125, 0.055, -0.03); box(0.2, 0.11, 0.3, SHOE, 0.125, 0.055, -0.03); // shoes
    tube(0.235, 0.205, 0.2, DARK, 0, 0.94, 0);                                                       // hips
    const TOP = look.top || NAVY;                                                                    // a visitor wears their own colour
    tube(0.3, 0.225, 0.62, TOP, 0, 1.32, 0);                                                         // torso: shoulders down to waist
    if (!look.civ) tube(0.24, 0.235, 0.07, DARK, 0, 1.02, 0);                                        // belt (uniform only)
    if (!look.civ) box(0.075, 0.075, 0.03, BRASS, -0.15, 1.42, -0.2);                                // badge (uniform only)
    tube(0.082, 0.062, 0.62, TOP, -0.33, 1.26, 0); tube(0.082, 0.062, 0.62, TOP, 0.33, 1.26, 0);     // arms
    tube(0.07, 0.06, 0.14, SKIN, -0.33, 0.9, 0); tube(0.07, 0.06, 0.14, SKIN, 0.33, 0.9, 0);         // hands
    tube(0.075, 0.085, 0.1, SKIN, 0, 1.63, 0);                                                       // neck
    tube(0.165, 0.155, 0.33, SKIN, 0, 1.83, 0);                                                      // head
    if (look.civ) {
      tube(0.178, 0.172, 0.15, HAIR, 0, 2.0, 0);                                                     // full hair top
      box(0.33, 0.24, 0.12, HAIR, 0, 1.9, 0.13);                                                     // hair back
      if (look.pony) tube(0.065, 0.04, 0.3, HAIR, 0, 1.84, 0.2, 6);                                  // ponytail
    } else {
      tube(0.172, 0.168, 0.09, HAIR, 0, 1.96, 0);                                                    // hair under the cap
      if (look.pony) tube(0.07, 0.045, 0.28, HAIR, 0, 1.86, 0.17, 6);                                // tied back
      tube(0.185, 0.19, 0.11, CAP, 0, 2.03, 0);                                                      // cap crown
      tube(0.2, 0.2, 0.035, CAP, 0, 1.97, 0);                                                        // cap band
      box(0.3, 0.035, 0.18, CAP, 0, 1.975, -0.23);                                                   // peak
    }
    const sh = new T.Mesh(new T.CircleGeometry(0.42, 14), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; g.add(sh);
    if (look.tall) g.scale.setScalar(look.tall);
    return g;
  }

  /* ---------------- benches: sitting down ---------------- */
  // the nearest bench you could drop onto, or null
  function benchNear() {
    let best = null, bd = 1.4;
    for (const b of BENCHES) {
      const cx = Math.min(Math.max(player.x, b.x0), b.x1), cz = Math.min(Math.max(player.z, b.z0), b.z1);
      const d = Math.hypot(player.x - cx, player.z - cz);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  function sit(b) {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, alongX = b.x1 - b.x0 >= b.z1 - b.z0;
    // you sit down where you walked up to, facing out from the bench rather than along it
    const sx = alongX ? Math.min(Math.max(player.x, b.x0 + 0.7), b.x1 - 0.7) : cx;
    const sz = alongX ? cz : Math.min(Math.max(player.z, b.z0 + 0.7), b.z1 - 0.7);
    const ox = alongX ? 0 : Math.sign(player.x - cx) || 1;
    const oz = alongX ? Math.sign(player.z - cz) || 1 : 0;
    player.x = sx; player.z = sz; player.yaw = Math.atan2(-ox, -oz);
    state.sitting = b; clearKeys();
  }
  function stand() {
    if (!state.sitting) return;
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    for (let d = 1; d <= 2.4; d += 0.3) {                      // step off the way you were facing
      const nx = player.x + fx * d, nz = player.z + fz * d;
      if (walkable(nx, nz)) { player.x = nx; player.z = nz; break; }
    }
    state.sitting = null;
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
    ui.lookImg.style.background = d.viewBg || "";   // logos sit on white; everything else keeps the dark default
    ui.lookTag.textContent = d.tag || "";
    ui.lookH.textContent = d.title;
    ui.lookNote.textContent = d.note || ""; ui.lookNote.style.display = d.note ? "" : "none";
    ui.lookBody.textContent = d.body || ""; ui.lookBody.style.display = d.body ? "" : "none";
    ui.lookActs.innerHTML = "";
    // no key names on a touch screen: there is no E or Enter to press there
    const keys = !matchMedia("(pointer:coarse)").matches;
    const back = Object.assign(document.createElement("button"), { type: "button", textContent: keys ? "◀ BACK [E]" : "◀ BACK" });
    back.addEventListener("click", closeLook); ui.lookActs.append(back);
    if (d.go) {
      const go = Object.assign(document.createElement("button"), { type: "button", className: "go", textContent: d.goLabel + (keys ? " [ENTER]" : "") });
      go.addEventListener("click", d.go); ui.lookActs.append(go);
    }
    ui.look.classList.add("show");
    // the console face swaps the d-pad for a way through to the site while you are looking at something
    state.view = d;
    root.classList.add("viewing");
    ui.go.style.display = d.go ? "" : "none";
  }
  function closeLook() {
    if (!state.looking) return;
    state.looking = false;
    state.view = null;
    root.classList.remove("viewing");
    ui.look.classList.remove("show");
    ui.lookImg.removeAttribute("src");
    if (root) root.focus({ preventScroll: true });
  }
  // `file` (illustration only): once the page is up, open that exact piece rather than dropping you at the top of
  // the gallery to go hunting for it. The grid is rebuilt by the router, so it takes a few tries before it is there.
  // `mural` (index into MURALS): land on that mural's own section of the murals page, not the top of it.
  function leaveTo(hash, file, mural) {
    close(false);   // you are going somewhere else: leave the focus for the page, not the button you came from
    if (hash === "#about") { const a = document.querySelector('nav a[data-nav="about"]'); if (a) return a.click(); }
    if (location.hash === hash) dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = hash;
    if (mural != null && mural >= 0) {
      // the router jumps to the top when the page changes, so this runs after it - and again a moment later,
      // in case pictures above the section were still settling into place
      const land = () => {
        const art = document.querySelectorAll("#murals-list .mural")[mural], hd = document.querySelector("header .bar");
        if (!art) return;
        const el = art.querySelector("h3") || art;                       // its heading sits just under the bar
        const y = el.getBoundingClientRect().top + scrollY - (hd ? hd.offsetHeight : 80) - 28;
        try { scrollTo({ top: Math.max(0, y), behavior: "instant" }); } catch (e) { scrollTo(0, Math.max(0, y)); }
      };
      [60, 350, 900].forEach((t) => setTimeout(land, t));
      return;
    }
    if (!file) return;
    let tries = 0;
    const open = () => {
      const fig = document.querySelector('#ill figure[data-file="' + file + '"]');
      if (fig) { fig.scrollIntoView({ block: "center" }); fig.click(); return; }
      if (++tries < 25) setTimeout(open, 60);
    };
    setTimeout(open, 60);
  }

  /* ---------------- loop ---------------- */
  function resize() {
    if (!renderer) return;
    // measure the stage, not the window: on a phone the view is a panel with the controls in bands around it
    const st = ui.view.parentElement;
    const w = st.clientWidth || innerWidth, hh = st.clientHeight || innerHeight;
    const rh = Math.min(RENDER_H, hh), rw = Math.max(160, Math.round(rh * w / hh));
    renderer.setSize(rw, rh, false);
    camera.aspect = w / hh;
    camera.fov = w < hh ? 78 : 62;
    camera.updateProjectionMatrix();
  }
  let tmpColor, camK = 1;
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  const FPS_CAP = 1000 / 30;   // ~30 fps — easy on the GPU, suits the retro look
  function frame(now) {
    if (!state.open) return;
    state.raf = requestAnimationFrame(frame);
    if (now - lastT < FPS_CAP) return;             // skip frames to stay at ~30 fps
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    if (!state.ready) return;

    let moving = 0;
    if (state.playing && !state.looking) {
      const turn = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
      player.yaw += turn * 2.5 * dt;                                   // you can still look around while seated
      const dir = state.sitting ? 0 : (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
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
    const u = avatar.userData, sitY = state.sitting ? -0.21 : 0;   // the seat sits at 0.56, so the hips drop to meet it
    avatar.position.set(player.x, sitY + Math.abs(Math.sin(player.walk)) * 0.05 * player.moving, player.z);
    avatar.rotation.y = player.yaw;
    const sw = Math.sin(player.walk) * 0.75 * player.moving;
    if (state.sitting) {
      // +x swings a limb forward (that is the sign the walk cycle uses for the legs), so these were the wrong way round
      u.legL.rotation.x = u.legR.rotation.x = 1.45;                 // thighs forward off the bench
      u.legL.rotation.z = -0.22; u.legR.rotation.z = 0.22;          // knees apart, the way anyone sits
      u.armL.rotation.x = u.armR.rotation.x = -0.25;                // hands back on the seat
    } else {
      u.legL.rotation.z = u.legR.rotation.z = 0;
      u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armL.rotation.x = -sw * 0.8; u.armR.rotation.x = sw * 0.8;
    }
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
      return walkable(cx, cz, 0.3, !!state.sitting) && (!home || roomAt(cx, cz) === home);
    };
    let k = 0.12;
    while (k < 1 && camOK(k + 0.03)) k += 0.03;
    k = camK += (Math.min(1, k) - camK) * (k < camK ? 1 : 1 - Math.exp(-dt * 5));   // snap in, ease back out
    avatar.visible = k > 0.3;                                  // squeezed against a wall or doorway: get the head out of the shot
    camera.position.set(player.x + (bx * BACK + rx * SIDE) * k, 2.05 + 0.75 * k, player.z + (bz * BACK + rz * SIDE) * k);
    camera.lookAt(player.x - bx * 6 + rx * SIDE * 0.75 * k, 2.0, player.z - bz * 6 + rz * SIDE * 0.75 * k);

    // outdoors: keep the sky on the visitor's clock, and blend fog + character shading as you step through the door.
    // The skyline, dome, sun and moon are hidden when you are indoors — no point rendering hundreds of meshes
    // the player cannot see. They pop back on once you step near the yard door.
    const o = Math.min(1, Math.max(0, (player.x - 8.5) / 2));
    const outdoorVis = o > 0.01;
    if (yard.city.visible !== outdoorVis) { yard.city.visible = yard.dome.visible = yard.sun.visible = yard.moon.visible = outdoorVis; }
    if (outdoorVis) {
      const hr = hourNow();
      if (Math.abs(hr - yard.hour) > 0.008) applyTime(hr);
      yard.dome.position.copy(camera.position);
      yard.sun.position.copy(camera.position).addScaledVector(yard.sunDir, 420);
      yard.moon.position.copy(camera.position).addScaledVector(yard.moonDir, 420);
    }
    scene.fog.color.setHex(0x070707).lerp(yard.haze, o); scene.fog.near = 30 + 90 * o; scene.fog.far = 110 + 850 * o;
    if (Math.abs(o - yard.o) > 0.01) {
      yard.o = o; tmpColor.setHex(0xffffff).lerp(yard.tint, o);
      for (const a of avatarMats) a.mat.color.copy(a.base).multiply(tmpColor);
    }

    // NPCs: guards turn to face you; visitors keep gazing at the art.
    let g = null, gd = 1e9;
    for (const q of NPCS) {
      if (!q.mesh) continue;
      const dx = player.x - q.x, dz = player.z - q.z, d2 = dx * dx + dz * dz;
      const want = (q.kind !== "visitor" && d2 < 49) ? Math.atan2(-dx, -dz) : q.yaw;
      q.mesh.rotation.y += angDiff(want, q.mesh.rotation.y) * (1 - Math.exp(-dt * 4));
      if (d2 < gd) { gd = d2; g = q; }
    }
    state.guard = state.playing && !state.looking && gd < 11 ? g : null;   // close enough to talk to: ~3.3 m
    if (state.talking && (state.talking !== g || gd > 25)) hush();          // walked off mid-sentence

    // HUD
    const rk = roomAt(player.x, player.z);
    if (rk && rk !== state.room) { state.room = rk; ui.room.textContent = "> " + ROOMS[rk].name; ui.time.classList.toggle("show", !!ROOMS[rk].outdoor); root.classList.toggle("outdoor", !!ROOMS[rk].outdoor); }
    // what is in front of you: a piece to look at, a person to listen to, or a bench to sit on.
    // When an NPC is very close (< 2 m) they take priority over art so you can actually talk to them
    // even when they are standing in front of a piece.
    const live = state.playing && !state.looking;
    const npcClose = state.guard && gd < 4;             // ~2 m
    state.near = live && !state.sitting && !npcClose ? findNear() : null;
    state.bench = live && !state.sitting && !state.near && !state.guard ? benchNear() : null;
    const sig = (state.looking ? "viewing" : state.talking ? "talk:" + (state.talking.kind || "guard") : state.sitting ? "sit" : state.near ? "art:" + state.near.data.title
      : state.guard ? "npc:" + state.guard.room + ":" + (state.guard.kind || "guard") : state.bench ? "bench" : "");
    if (sig !== state.sig) {
      state.sig = sig;
      const coarse = matchMedia("(pointer:coarse)").matches;
      let title = "", key = "", label = "LOOK";
      // looking at a piece: the big button closes it, so your thumb never leaves the bottom of the phone
      if (state.looking) { label = "BACK"; }
      else if (state.talking) {
        const isV = state.talking.kind === "visitor";
        title = isV ? "GALLERY VISITOR" : "SECURITY GUARD"; key = coarse ? "PRESS DONE" : "PRESS [E] WHEN YOU ARE DONE"; label = "DONE";
      }
      else if (state.sitting) { title = "SITTING"; key = coarse ? "PRESS STAND" : "PRESS [E] TO STAND"; label = "STAND"; }
      else if (state.near) { title = state.near.data.title; key = coarse ? "PRESS LOOK" : "PRESS [E] TO LOOK"; }
      else if (state.guard) {
        const isV = state.guard.kind === "visitor";
        title = isV ? "GALLERY VISITOR" : "SECURITY GUARD";
        key = coarse ? "PRESS LISTEN" : "PRESS [E] TO LISTEN";
        label = "LISTEN";
      }
      else if (state.bench) { title = "BENCH"; key = coarse ? "PRESS SIT" : "PRESS [E] TO SIT"; label = "SIT"; }
      if (title) { ui.capT.textContent = title; ui.capK.textContent = key; }
      ui.cap.classList.toggle("show", !!title);
      ui.act.textContent = label;
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
