/* ==========================================================================
   THE KOCEYAN — behaviour
   ========================================================================== */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const h = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (k === "style") n.style.cssText = v;
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat()) if (k != null) n.append(k.nodeType ? k : document.createTextNode(k));
    return n;
  };
  const pad = (n) => String(n).padStart(2, "0");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
  };

  // Full-size files that are not .jpg
  const EXT = {
    "arakyal-1": "png", "arakyal-3": "png", "armstrong-5": "png",
    "hayko-1": "webp", "hayko-5": "webp", "hayko-6": "webp", "hayko-8": "webp",
    "lia-1": "webp", "marlenka-7": "webp", "marlenka-8": "webp", "marlenka-10": "gif",
    "luxor-1": "webp", "luxor-4": "webp", "luxor-5": "webp", "luxor-6": "webp", "luxor-7": "webp",
    "luxor-8": "webp", "luxor-10": "webp", "luxor-11": "webp", "luxor-12": "webp",
  };
  const full = (id) => `img/${id}.${EXT[id] || "jpg"}`;
  const thumb = (id) => (EXT[id] === "gif" ? full(id) : `img/t/${id}.webp`);
  const img = (id, alt, extra = {}) => h("img", { src: thumb(id), alt, loading: "lazy", decoding: "async", ...extra });

  /* ---------------- TOAST ---------------- */
  const toastEl = $("#toast");
  let toastT;
  function toast(msg, ms = 3200) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("show"), ms);
  }

  /* ---------------- ENTRY ---------------- */
  const entry = $("#entry");
  const visitorNo = String(Math.floor(100000 + Math.random() * 899999));
  $("#ticketNo").textContent = "No. " + visitorNo;
  let entered = false;
  function enter(fast) {
    if (entered) return;
    entered = true;
    store.set("koceyan-entered", "1");
    if (!fast) $("#ticket").classList.add("torn");
    setTimeout(() => {
      entry.classList.add("open");
      document.body.classList.remove("locked");
      document.body.classList.add("loaded");
    }, fast ? 0 : 450);
    setTimeout(() => entry.classList.add("gone"), fast ? 900 : 1900);
  }
  if (store.get("koceyan-entered")) {
    entry.classList.add("gone");
    document.body.classList.add("loaded");
  } else {
    document.body.classList.add("locked");
    $("#ticket").addEventListener("click", () => enter(false));
    $("#skipEntry").addEventListener("click", () => enter(true));
    addEventListener("keydown", (e) => { if (e.key === "Escape") enter(true); });
    setTimeout(() => $("#ticket").focus({ preventScroll: true }), 300);
  }

  /* ---------------- CURSOR ---------------- */
  const cursor = $(".cursor");
  if (finePointer && !reduced) {
    const label = $(".cursor__label");
    addEventListener("pointermove", (e) => {
      cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      cursor.classList.add("on");
      const t = e.target.closest?.("[data-cursor]");
      cursor.classList.toggle("big", !!t);
      if (t) label.textContent = t.dataset.cursor;
    }, { passive: true });
    document.addEventListener("pointerleave", () => cursor.classList.remove("on"));
  }

  /* ---------------- LOBBY : flashlight ---------------- */
  const lobby = $("#lobby");
  const wall = $("#lobbyWall");
  const shuffled = [...ILLUSTRATIONS].sort(() => Math.random() - 0.5);
  shuffled.forEach((p) => wall.append(img(p.id, "", { loading: "eager" })));
  let userLit = false, lobbyVisible = true;
  lobby.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    userLit = true;
    const r = lobby.getBoundingClientRect();
    lobby.style.setProperty("--mx", e.clientX - r.left + "px");
    lobby.style.setProperty("--my", e.clientY - r.top + "px");
  });
  new IntersectionObserver(([en]) => (lobbyVisible = en.isIntersecting)).observe(lobby);
  if (!reduced) {
    // drifting spotlight until a mouse takes over (and always on touch devices)
    const drift = (t) => {
      if (!userLit && lobbyVisible) {
        const s = t / 1000;
        lobby.style.setProperty("--mx", 50 + Math.sin(s * 0.45) * 32 + "%");
        lobby.style.setProperty("--my", 45 + Math.sin(s * 0.7 + 1) * 22 + "%");
      }
      requestAnimationFrame(drift);
    };
    requestAnimationFrame(drift);
  }

  /* ---------------- MARQUEE ---------------- */
  const marq = [
    "Now showing", `${ILLUSTRATIONS.length} illustrations`, `${PROJECTS.length} identity exhibits`,
    `${MURALS.length} walls painted`, "Admission free", "No flash photography", "Commissions open", "Metro Detroit",
  ];
  $("#marquee").append(...[...marq, ...marq].map((t) => h("span", {}, t)));

  /* ---------------- DIRECTORY ---------------- */
  const dir = [
    ["I", "The Illustration Salon", "Characters, stories, screen prints", `${ILLUSTRATIONS.length} works`, "#illustration"],
    ["II", "Identity & Design", "Logos, campaigns, merch, packaging", `${PROJECTS.length} exhibits`, "#design"],
    ["III", "The Mural Yard", "Outdoors · bring sunglasses", `${MURALS.length} walls`, "#murals"],
    ["✎", "The Artist’s Studio", "Meet Alex", "Stop 00", "#studio"],
    ["✉", "Front Desk", "Commission a mural, a logo, a character", "Open", "#desk"],
  ];
  $("#directory").append(...dir.map(([c, n, s, k, href]) =>
    h("li", {}, h("a", { href, "data-cursor": "ENTER" },
      h("span", { class: "dir__code" }, c),
      h("span", { class: "dir__name" }, n, h("small", {}, s)),
      h("span", { class: "dir__count mono" }, k),
      h("span", { class: "dir__arrow", "aria-hidden": "true" }, "→")))));

  /* ---------------- GALLERY I : SALON ---------------- */
  // 5 styles so neighbouring columns of the masonry never start with the same frame
  const FRAMES = ["frame--gold mat", "frame--black", "frame--wood mat", "frame--canvas", "frame--black mat"];
  const salon = $("#salon");
  const ilItems = ILLUSTRATIONS.map((p, i) => ({
    id: p.id, src: full(p.id), title: p.title,
    meta: `${p.medium} · ${p.rooms.map((r) => ROOMS[r].label).join(" / ")}`,
    no: `Gallery I · No. ${pad(i + 1)}`,
  }));
  const pieces = ILLUSTRATIONS.map((p, i) => {
    const tilt = (((i * 37) % 7) - 3) * 0.45;
    const fig = h("figure", { class: `frame ${FRAMES[i % FRAMES.length]}` }, img(p.id, p.title));
    const btn = h("button", { class: "piece__btn", "data-cursor": "VIEW", "aria-label": `View ${p.title}` }, fig);
    const el = h("div", { class: "piece", style: `--tilt:${tilt}deg; animation-delay:${(i % 8) * 60}ms` },
      btn,
      h("div", { class: "label" },
        h("span", { class: "label__t" }, p.title),
        h("span", { class: "label__m" }, `No. ${pad(i + 1)} · ${p.medium}`)));
    el.dataset.rooms = p.rooms.join(" ");
    btn.addEventListener("click", () => {
      const visible = ilItems.filter((_, j) => !pieces[j].classList.contains("out"));
      viewer.open(visible, visible.findIndex((x) => x.id === p.id));
    });
    salon.append(el);
    return el;
  });
  const tabs = $("#roomTabs");
  const blurb = $("#roomBlurb");
  const roomList = [["all", { label: "Whole salon", code: "★", blurb: "Everything on the walls. Pick a room to narrow it down." }], ...Object.entries(ROOMS)];
  roomList.forEach(([key, r], i) => {
    const count = key === "all" ? ILLUSTRATIONS.length : ILLUSTRATIONS.filter((p) => p.rooms.includes(key)).length;
    const b = h("button", { class: "room", role: "tab", "aria-selected": i === 0 ? "true" : "false" },
      h("b", {}, r.code), r.label, h("small", {}, count));
    b.addEventListener("click", () => {
      $$(".room", tabs).forEach((x) => x.setAttribute("aria-selected", "false"));
      b.setAttribute("aria-selected", "true");
      blurb.textContent = r.blurb;
      pieces.forEach((el) => el.classList.toggle("out", key !== "all" && !el.dataset.rooms.split(" ").includes(key)));
    });
    tabs.append(b);
  });
  blurb.textContent = roomList[0][1].blurb;

  /* ---------------- GALLERY II : EXHIBITS ---------------- */
  const exhibits = $("#exhibits");
  PROJECTS.forEach((p, i) => {
    const items = p.images.map((id, j) => ({
      id, src: full(id), title: p.title, meta: p.kind,
      no: `Gallery II · Exhibit ${pad(i + 1)} · ${j + 1} of ${p.images.length}`,
      mat: (p.dark || []).includes(id) ? "dark" : "light",
    }));
    const heroIdx = Math.max(0, p.images.indexOf(p.hero));
    const strip = h("div", { class: "strip", role: "list" },
      p.images.map((id, j) => h("button", {
        class: (p.dark || []).includes(id) ? "dark" : null, role: "listitem", "data-cursor": "VIEW",
        "aria-label": `${p.title}, image ${j + 1}`, onclick: () => viewer.open(items, j),
      }, img(id, ""))));
    exhibits.append(h("article", { class: "exhibit reveal", id: `ex-${p.slug}` },
      h("div", { class: "walltext" },
        h("span", { class: "walltext__no", "aria-hidden": "true" }, pad(i + 1)),
        h("h3", {}, p.title),
        h("p", { class: "walltext__kind mono" }, p.kind),
        h("p", {}, p.text),
        p.badge ? h("span", { class: "badge mono" }, p.badge) : null),
      h("div", { class: "exhibit__media" },
        h("button", { class: "exhibit__hero", "data-cursor": "ENTER", "aria-label": `Open ${p.title} exhibit`, onclick: () => viewer.open(items, heroIdx) },
          h("img", { src: full(p.hero), alt: `${p.title} — ${p.kind}`, loading: "lazy", decoding: "async" })),
        strip)));
  });

  /* ---------------- GALLERY III : MURAL YARD ---------------- */
  $("#muralIntro").textContent = MURALS_INTRO;
  const walls = $("#walls");
  MURALS.forEach((m, i) => {
    const ids = [m.hero, ...m.process];
    const items = ids.map((id, j) => ({
      id, src: full(id), title: m.title, meta: m.where,
      no: `Gallery III · Wall ${pad(i + 1)} · ${j === 0 ? "Finished" : "Process"}`,
    }));
    const art = h("button", { class: "wall__art", "data-cursor": "VIEW", "aria-label": `View ${m.title} mural`, onclick: () => viewer.open(items, 0) },
      h("img", { src: full(m.hero), alt: `${m.title} mural`, loading: "lazy", decoding: "async" }));
    walls.append(h("article", { class: "wall" },
      art,
      h("div", { class: "casefile reveal" },
        h("span", { class: "stamp" }, m.stamp),
        h("span", { class: "casefile__no mono" }, `Wall No. ${pad(i + 1)}`),
        h("h3", {}, m.title),
        h("p", { class: "casefile__where mono" }, m.where),
        h("p", {}, m.text),
        h("div", { class: "polaroids" },
          m.process.map((id, j) => h("button", {
            class: "polaroid", style: `--tilt:${j % 2 ? 4 : -3}deg`, "data-cursor": "VIEW",
            "aria-label": `${m.title} process photo ${j + 1}`, onclick: () => viewer.open(items, j + 1),
          }, img(id, ""), h("span", {}, "process")))))));
  });
  // spray-paint reveal
  const sprayIO = new IntersectionObserver((ens) => ens.forEach((en) => {
    if (!en.isIntersecting) return;
    sprayIO.unobserve(en.target);
    const el = en.target;
    el.style.setProperty("--sx", 20 + Math.random() * 60 + "%");
    el.style.setProperty("--sy", 30 + Math.random() * 40 + "%");
    if (reduced) return el.style.setProperty("--spray", "150%");
    const t0 = performance.now(), dur = 1500;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      el.style.setProperty("--spray", (e * 150).toFixed(2) + "%");
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), { threshold: 0.25 });
  $$(".wall__art").forEach((el) => sprayIO.observe(el));

  /* ---------------- STUDIO ---------------- */
  $("#bio").textContent = ARTIST.bio;
  $("#facts").append(...ARTIST.facts.map(([k, v]) => h("div", {}, h("dt", {}, k), h("dd", {}, v))));

  /* ---------------- DESK ---------------- */
  const mail = $("#mailLink"), tel = $("#telLink");
  mail.href = `mailto:${ARTIST.email}`; mail.textContent = `✉ ${ARTIST.email}`;
  tel.href = `tel:+1${ARTIST.phone.replace(/\D/g, "")}`; tel.textContent = `☏ ${ARTIST.phone}`;
  $("#slipNo").textContent = `Slip #${visitorNo}`;
  $("#slip").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const subject = `Commission request: ${f.get("kind")} — ${f.get("name")}`;
    const body = `Hi Alex,\n\n${f.get("msg")}\n\n— ${f.get("name")}\n(sent from The Koceyan, visitor #${visitorNo})`;
    location.href = `mailto:${ARTIST.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast("Opening your email app. The artist has been notified (well, almost).");
  });
  $("#year").textContent = new Date().getFullYear();

  /* ---------------- VIEWER ---------------- */
  const viewer = (() => {
    const root = $("#viewer"), vImg = $("#vImg"), loupe = $("#loupe"), stage = $("#vStage");
    let list = [], idx = 0, lastFocus = null, touches = [];
    function show() {
      const it = list[idx];
      vImg.classList.remove("matlight", "matdark");
      if (it.mat) vImg.classList.add(it.mat === "dark" ? "matdark" : "matlight");
      vImg.src = thumb(it.id);           // instant
      const hi = new Image();
      hi.onload = () => { if (list[idx] === it) vImg.src = it.src; };
      hi.src = it.src;                    // swap to full-res when ready
      vImg.alt = it.title;
      loupe.style.backgroundImage = `url("${it.src}")`;
      $("#vNo").textContent = it.no;
      $("#vTitle").textContent = it.title;
      $("#vMeta").textContent = it.meta;
      vImg.style.animation = "none"; void vImg.offsetWidth; vImg.style.animation = "";
      const multi = list.length > 1;
      $("#vPrev").style.visibility = $("#vNext").style.visibility = multi ? "visible" : "hidden";
    }
    function open(l, i) {
      list = l; idx = Math.max(0, i);
      lastFocus = document.activeElement;
      root.hidden = false;
      document.body.classList.add("locked");
      show();
      $("#vClose").focus();
    }
    function close() {
      root.hidden = true;
      document.body.classList.remove("locked");
      loupe.classList.remove("on");
      lastFocus?.focus?.({ preventScroll: true });
    }
    const go = (d) => { idx = (idx + d + list.length) % list.length; show(); };
    $("#vClose").addEventListener("click", close);
    $("#vPrev").addEventListener("click", () => go(-1));
    $("#vNext").addEventListener("click", () => go(1));
    root.addEventListener("click", (e) => { if (e.target === root || e.target === stage) close(); });
    addEventListener("keydown", (e) => {
      if (root.hidden) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Tab") { // keep focus inside
        const f = $$("button", root).filter((b) => b.style.visibility !== "hidden");
        const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    });
    // loupe
    vImg.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = vImg.getBoundingClientRect(), s = stage.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top, Z = 2.6;
      loupe.classList.add("on");
      loupe.style.left = e.clientX - s.left + "px";
      loupe.style.top = e.clientY - s.top + "px";
      loupe.style.backgroundSize = `${r.width * Z}px ${r.height * Z}px`;
      loupe.style.backgroundPosition = `${-(x * Z - 110)}px ${-(y * Z - 110)}px`;
    });
    vImg.addEventListener("pointerleave", () => loupe.classList.remove("on"));
    // swipe
    let sx = null;
    stage.addEventListener("touchstart", (e) => (sx = e.touches[0].clientX), { passive: true });
    stage.addEventListener("touchend", (e) => {
      if (sx == null) return;
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      sx = null;
    });
    // please do not touch the art
    const GUARD = [
      "🚨 Security: please step back from the artwork.",
      "🚨 Sir/Ma’am. That is a priceless original.",
      "🚨 The guard is now watching you specifically.",
    ];
    let warned = 0;
    vImg.addEventListener("click", () => {
      const now = Date.now();
      touches = touches.filter((t) => now - t < 1500).concat(now);
      if (touches.length >= 3) {
        touches = [];
        toast(GUARD[Math.min(warned++, GUARD.length - 1)]);
        if (!reduced) vImg.animate([{ transform: "translateX(0)" }, { transform: "translateX(-10px)" }, { transform: "translateX(10px)" }, { transform: "translateX(0)" }], { duration: 300 });
      }
    });
    return { open };
  })();

  /* ---------------- WAYFINDING: active room + floor plan ---------------- */
  const plan = {
    lobby: [200, 165], illustration: [100, 130], design: [300, 130],
    murals: [100, 275], studio: [252, 270], desk: [347, 270],
  };
  const you = $(".plan__you");
  const ANNOUNCE = {
    illustration: "📢 Now entering Gallery I. No flash photography, please.",
    design: "📢 Gallery II. Please keep your voice at a respectful, design-appreciating volume.",
    murals: "📢 You are now outdoors. The art here is load-bearing.",
    desk: "📢 Commissions are open. The artist is suspiciously available.",
  };
  const announced = new Set();
  let current = "lobby";
  const roomIO = new IntersectionObserver((ens) => ens.forEach((en) => {
    if (!en.isIntersecting) return;
    current = en.target.dataset.room;
    $$(".topbar__nav a").forEach((a) => a.classList.toggle("active", a.dataset.room === current));
    $$(".plan__room").forEach((g) => g.classList.toggle("here", g.dataset.go === current));
    const [cx, cy] = plan[current];
    you.setAttribute("cx", cx); you.setAttribute("cy", cy);
    if (ANNOUNCE[current] && !announced.has(current) && entry.classList.contains("gone")) {
      announced.add(current);
      toast(ANNOUNCE[current], 2800);
    }
  }), { rootMargin: "-45% 0px -50% 0px" });
  $$("[data-room]").forEach((s) => s.tagName === "SECTION" && roomIO.observe(s));

  const fp = $("#floorplan"), mapBtn = $("#mapBtn");
  const toggleMap = (on) => { fp.hidden = !on; mapBtn.setAttribute("aria-expanded", on); };
  mapBtn.addEventListener("click", () => toggleMap(fp.hidden));
  $("#mapClose").addEventListener("click", () => toggleMap(false));
  fp.addEventListener("click", (e) => {
    const g = e.target.closest(".plan__room");
    if (g) { toggleMap(false); $("#" + g.dataset.go).scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); }
    else if (e.target === fp) toggleMap(false);
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !fp.hidden) toggleMap(false); });

  /* ---------------- REVEAL ---------------- */
  const revIO = new IntersectionObserver((ens) => ens.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("in"); revIO.unobserve(en.target); }
  }), { rootMargin: "0px 0px -10% 0px" });
  $$(".reveal").forEach((el) => revIO.observe(el));

  /* ---------------- IDLE GUARD ---------------- */
  let idleT;
  const idle = () => {
    clearTimeout(idleT);
    idleT = setTimeout(() => {
      if (current !== "lobby") toast("👀 A guard noticed you’ve been staring for a while. Excellent taste.", 4000);
    }, 45000);
  };
  ["pointermove", "scroll", "keydown"].forEach((ev) => addEventListener(ev, idle, { passive: true }));
})();
