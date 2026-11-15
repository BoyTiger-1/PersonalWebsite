/* site behavior, v3. no framework and no animation library: one rAF loop
   drives every scroll-linked effect, IntersectionObserver drives reveals,
   field.js draws the particle sculpture. anything that moves checks
   prefers-reduced-motion first. */

(function () {
  'use strict';

  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduce;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const tickers = [];            // fns called every frame with (scrollY, vh, velocity, now)
  let lenis = null;
  let palette = [[61, 90, 254], [166, 77, 255], [255, 77, 157], [255, 162, 77]];

  document.addEventListener('DOMContentLoaded', () => {
    splitChars();
    setupPalette();
    setupLoader();
    setupSmoothScroll();
    setupReveals();
    setupField();
    setupNav();
    setupFlip();
    setupMarquee();
    setupBands();
    setupScrub();
    setupOdometers();
    setupShow();
    setupInterlude();
    setupHud();
    setupComet();
    setupLead();
    setupCanvases();
    setupRips();
    setupBarcode();
    setupAwards();
    setupContact();
    setupClock();
    setupBraille();
    if (canHover) { setupCursor(); setupMagnetic(); setupGlow(); setupScramble(); setupCoin(); }
    startLoop();
  });

  /* ---------- per-letter splitting ---------- */
  function splitChars() {
    $$('[data-split]').forEach((el) => {
      const text = el.textContent;
      el.textContent = '';
      Array.from(text).forEach((c, i) => {
        const s = document.createElement('span');
        s.className = 'ch'; s.style.setProperty('--i', i); s.textContent = c;
        s.setAttribute('aria-hidden', 'true');
        el.appendChild(s);
      });
    });
  }

  /* ---------- palette switcher: recolors css, particles and canvases ---------- */
  function hexToRgb(hex) {
    const h = hex.trim().replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function readPalette() {
    const cs = getComputedStyle(root);
    palette = ['--c1', '--c2', '--c3', '--c4'].map((v) => hexToRgb(cs.getPropertyValue(v)));
    if (window.RonitField) window.RonitField.setColors(palette);
  }
  function setupPalette() {
    const wrap = $('#pals');
    const mark = () => { if (wrap) $$('button', wrap).forEach((b) => b.classList.toggle('is-on', b.dataset.p === (root.dataset.pal || 'aurora'))); };
    readPalette(); mark();
    if (!wrap) return;
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      root.dataset.pal = b.dataset.p;
      try { localStorage.setItem('pal', b.dataset.p); } catch (err) { /* private mode */ }
      readPalette(); mark();
    });
  }

  /* ---------- opening: letterbox bars, particles assemble "RA", then the bars lift ---------- */
  function setupLoader() {
    const loader = $('#loader');
    let finished = false;
    const done = () => {
      if (finished) return; finished = true;
      root.classList.remove('is-loading'); root.classList.add('is-loaded');
      if (lenis) lenis.start();
      if (loader) { loader.classList.add('is-done'); setTimeout(() => loader.remove(), 1700); }
    };
    // skip the sequence for reduced motion, or when the browser restored a mid-page scroll position
    if (!loader || reduce || window.scrollY > 40) { if (loader) loader.remove(); root.classList.add('is-loaded'); return; }
    root.classList.add('is-loading');
    const num = $('#loaderNum'), line = $('#loaderLine'), word = $('#loaderWord');
    const words = ['assembling', 'projects', 'research', 'awards', 'ready'];
    const start = performance.now(), dur = 2300;
    (function tick(now) {
      const p = clamp((now - start) / dur, 0, 1), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      num.textContent = String(Math.round(e * 100)).padStart(3, '0');
      line.style.transform = `scaleX(${e})`;
      word.textContent = words[Math.min(words.length - 1, Math.floor(p * words.length))];
      if (p < 1) requestAnimationFrame(tick); else setTimeout(done, 260);
    })(start);
    setTimeout(done, 6000); // safety net if the tab was backgrounded
  }

  /* ---------- lenis smooth scroll (optional) ---------- */
  function scrollToY(y) {
    if (lenis) lenis.scrollTo(y, { duration: 1.4 });
    else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }
  function setupSmoothScroll() {
    if (!reduce && typeof window.Lenis !== 'undefined' && canHover) lenis = new window.Lenis({ duration: 1.1, smoothWheel: true });
    if (lenis && root.classList.contains('is-loading')) lenis.stop();
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const target = $(a.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        scrollToY(target.getBoundingClientRect().top + window.scrollY);
      });
    });
  }

  /* ---------- the one frame loop ---------- */
  function startLoop() {
    let lastY = window.scrollY, vel = 0;
    const bar = $('#progress');
    function frame(time) {
      if (lenis) lenis.raf(time);
      const y = window.scrollY, vh = window.innerHeight;
      vel = lerp(vel, y - lastY, 0.2); lastY = y;
      const max = document.documentElement.scrollHeight - vh;
      if (bar) bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      for (let i = 0; i < tickers.length; i++) tickers[i](y, vh, vel, time);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- reveals ---------- */
  function setupReveals() {
    const els = $$('[data-r], .aw__row');
    if (reduce || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      let n = 0;
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        if (el.classList.contains('aw__row')) { el.style.transitionDelay = `${n++ * 45}ms`; setTimeout(() => { el.style.transitionDelay = ''; }, 900); }
        el.classList.add('in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach((el) => io.observe(el));
  }

  /* ---------- particle sculpture: pick the shape for whichever section owns the screen ---------- */
  function setupField() {
    const F = window.RonitField;
    if (!F) return;
    F.setColors(palette);
    const secs = $$('[data-shape]');
    const hero = $('.hero__title');
    tickers.push((y, vh, vel, now) => {
      const mid = vh * 0.5;
      let shape = null;
      for (const s of secs) { if (s.getBoundingClientRect().top <= mid) shape = s.dataset.shape; }
      if (!root.classList.contains('is-loaded')) shape = 'ra';   // the opening monogram holds until the bars lift
      if (shape) F.setShape(shape, now);
      // scrolling out of the hero pushes the camera through the name and into the galaxy
      const hp = clamp(y / vh, 0, 1);
      F.frame(now, y, reduce, shape === 'galaxy' ? 1 + hp * 0.7 : 1);
      if (hero && !reduce && y < vh * 1.2) {
        hero.style.transform = `translate3d(0,${y * 0.3}px,0) scale(${1 + hp * 0.45})`;
        hero.style.opacity = clamp(1 - hp * 1.5, 0, 1);
        hero.style.filter = hp > 0.01 ? `blur(${(hp * 14).toFixed(1)}px)` : '';
      }
    });
  }

  /* ---------- nav ---------- */
  function setupNav() {
    const nav = $('#nav'), links = $$('.nav__links a');
    const map = links.map((a) => [a, $(a.getAttribute('href'))]).filter((p) => p[1]);
    let last = 0;
    tickers.push((y, vh) => {
      if (Math.abs(y - last) > 6) { nav.classList.toggle('is-hidden', y > last && y > vh * 0.6); last = y; }
      let active = null;
      map.forEach(([a, sec]) => { const r = sec.getBoundingClientRect(); if (r.top < vh * 0.5 && r.bottom > vh * 0.5) active = a; });
      links.forEach((a) => a.classList.toggle('is-active', a === active));
    });
  }

  /* ---------- hero: the rotating "I'm a ___" word ---------- */
  function setupFlip() {
    const el = $('#flip'); if (!el || reduce) return;
    const words = el.dataset.words.split(','); let i = 0;
    setInterval(() => {
      const cur = el.firstElementChild;
      i = (i + 1) % words.length;
      const next = document.createElement('span'); next.textContent = words[i]; next.className = 'pre';
      cur.classList.add('out');
      setTimeout(() => { el.replaceChildren(next); void next.offsetWidth; next.className = ''; }, 380);
    }, 2100);
  }

  /* ---------- marquee: constant drift plus scroll velocity ---------- */
  function setupMarquee() {
    $$('[data-marquee]').forEach((row) => {
      const track = $('.marquee__track', row);
      const dir = parseFloat(row.dataset.marquee) || -1;
      const originals = Array.from(track.children);
      let setW = track.scrollWidth, guard = 0;
      while (track.scrollWidth < window.innerWidth * 2 + setW && guard++ < 8) originals.forEach((n) => track.appendChild(n.cloneNode(true)));
      let x = 0;
      const measure = () => { setW = originals.reduce((w, n) => w + n.getBoundingClientRect().width, 0) + parseFloat(getComputedStyle(track).columnGap || 0) * originals.length; };
      measure(); window.addEventListener('resize', measure);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
      if (reduce) return;
      tickers.push((y, vh, vel) => {
        x += dir * (0.7 + Math.abs(vel) * 0.35) * (vel < -0.5 ? -1 : 1);
        if (setW > 0) { x = x % setW; if (x > 0) x -= setW; }
        track.style.transform = `translate3d(${x}px,0,0) skewX(${clamp(vel * -0.12, -8, 8)}deg)`;
      });
    });
  }

  /* ---------- giant outline text that slides sideways as you scroll past ---------- */
  function setupBands() {
    if (reduce) return;
    $$('[data-band]').forEach((band) => {
      const span = band.firstElementChild, dir = parseFloat(band.dataset.band) || -1;
      tickers.push((y, vh) => {
        const r = band.getBoundingClientRect();
        if (r.bottom < -50 || r.top > vh + 50) return;
        span.style.transform = `translate3d(${(r.top - vh) * 0.55 * -dir - (dir < 0 ? 0 : span.offsetWidth * 0.4)}px,0,0)`;
      });
    });
  }

  /* ---------- statement text lights up word by word ---------- */
  function setupScrub() {
    $$('[data-scrub]').forEach((el) => {
      const words = el.textContent.trim().split(/\s+/);
      el.textContent = '';
      const spans = words.map((w) => {
        const s = document.createElement('span'); s.className = 'w'; s.textContent = w;
        el.appendChild(s); el.appendChild(document.createTextNode(' '));
        return s;
      });
      if (reduce) return;
      tickers.push((y, vh) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        const p = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.32), 0, 1) * (spans.length + 2);
        for (let i = 0; i < spans.length; i++) spans[i].style.opacity = 0.14 + 0.86 * clamp(p - i, 0, 1);
      });
    });
  }

  /* ---------- odometers: each digit is a rolling column ---------- */
  function setupOdometers() {
    $$('[data-odo]').forEach((el) => {
      const val = el.dataset.odo;
      if (/\D/.test(val)) { el.innerHTML = val.replace('.', '<i class="pt">.</i>'); el.classList.add('odo-plain'); return; }
      el.classList.add('odo'); el.setAttribute('aria-label', val);
      Array.from(val).forEach((c, k) => {
        if (!/\d/.test(c)) { const s = document.createElement('span'); s.textContent = c; el.appendChild(s); return; }
        const col = document.createElement('span');
        col.className = 'odo__col'; col.style.setProperty('--v', c); col.style.setProperty('--k', k);
        for (let d = 0; d <= 9; d++) { const s = document.createElement('span'); s.textContent = d; col.appendChild(s); }
        col.setAttribute('aria-hidden', 'true');
        el.appendChild(col);
      });
    });
  }

  /* ---------- project showcase: vertical scroll steps through full-screen slides ---------- */
  function setupShow() {
    const sec = $('#work'); if (!sec) return;
    const stage = $('.show__stage', sec), slides = $$('.slide', sec), bar = $('#showBar'), flash = $('#showFlash');
    // the counter and the project index are generated from the slides themselves
    const two = (n) => String(n).padStart(2, '0');
    $('#showCount').innerHTML = slides.map((s, k) => `<i>${two(k + 1)}</i>`).join('');
    $('#showTotal').textContent = '/ ' + two(slides.length);
    $('#showList').innerHTML = slides.map((s) => `<li><button>${$('.slide__title', s).textContent}</button></li>`).join('');
    const items = $$('#showList button', sec), digits = $$('#showCount i', sec);
    const mq = window.matchMedia('(min-width: 981px) and (min-height: 620px)');
    let stat = true, step = 0, active = -1;
    function layout() {
      stat = reduce || !mq.matches;
      sec.classList.toggle('is-static', stat);
      active = -1;
      if (stat) { sec.style.height = ''; slides.forEach((s) => { s.classList.add('is-active'); s.classList.remove('is-past'); }); return; }
      step = window.innerHeight * 0.62;
      sec.style.height = `${step * slides.length + window.innerHeight}px`;
    }
    // a giant outlined copy of each title drifts behind its slide
    slides.forEach((s) => { const g = document.createElement('span'); g.className = 'slide__ghost'; g.setAttribute('aria-hidden', 'true'); g.textContent = $('.slide__title', s).textContent; s.prepend(g); });
    // the visual leans toward the cursor
    if (canHover) {
      stage.addEventListener('pointermove', (e) => {
        stage.style.setProperty('--ry', ((e.clientX / window.innerWidth - 0.5) * 14).toFixed(2));
        stage.style.setProperty('--rx', ((e.clientY / window.innerHeight - 0.5) * -10).toFixed(2));
      });
    }
    layout();
    window.addEventListener('resize', layout);
    items.forEach((b, k) => b.addEventListener('click', () => scrollToY(sec.getBoundingClientRect().top + window.scrollY + k * step + step * 0.4)));
    tickers.push(() => {
      if (stat) return;
      const p = clamp(-sec.getBoundingClientRect().top / (step * slides.length), 0, 0.9999);
      const i = Math.floor(p * slides.length);
      if (bar) bar.style.transform = `scaleX(${p})`;
      if (i === active) return;
      active = i;
      slides.forEach((s, k) => { s.classList.toggle('is-active', k === i); s.classList.toggle('is-past', k < i); });
      items.forEach((b, k) => b.classList.toggle('is-on', k === i));
      digits.forEach((d) => d.style.setProperty('--n', i));
      stage.style.setProperty('--pa', slides[i].style.getPropertyValue('--pa'));
      if (flash) { flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); }   // a light sweep on every cut
    });
  }

  /* ---------- interlude: two giant words slide apart around the trophy ---------- */
  function setupInterlude() {
    if (reduce) return;
    $$('.inter').forEach((sec) => {
      const l = $('.inter__w--l', sec), r = $('.inter__w--r', sec);
      tickers.push((y, vh) => {
        const rect = sec.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > vh) return;
        const p = clamp((vh - rect.top) / (rect.height + vh), 0, 1) - 0.5;
        l.style.transform = `translate3d(${p * -46}vw,0,0)`;
        r.style.transform = `translate3d(${p * 46}vw,0,0)`;
      });
    });
  }

  /* ---------- a shooting star every so often ---------- */
  function setupComet() {
    const el = $('#comet'); if (!el || reduce) return;
    const fire = () => {
      el.style.top = `${5 + Math.random() * 45}%`; el.style.left = `${10 + Math.random() * 60}%`;
      el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
      setTimeout(fire, 5000 + Math.random() * 7000);
    };
    setTimeout(fire, 6000);
  }

  /* ---------- chapter marker on the right edge: current section + scroll position ---------- */
  function setupHud() {
    const hud = $('#hud'), ch = $('#hudCh'), pct = $('#hudPct');
    if (!hud) return;
    const secs = $$('[data-ch]'); let cur = '';
    tickers.push((y, vh) => {
      const mid = vh * 0.5; let name = cur;
      let light = false;
      for (const s of secs) { const r = s.getBoundingClientRect(); if (r.top <= mid) { name = s.dataset.ch; light = s.id === 'awards' && r.bottom > mid; } }
      document.body.classList.toggle('on-light', light);   // no dark vignette over the light awards sheet
      if (name !== cur) {
        cur = name; ch.classList.add('out');
        setTimeout(() => { ch.textContent = name; ch.classList.remove('out'); }, 260);
      }
      const max = document.documentElement.scrollHeight - vh;
      pct.textContent = String(Math.round((max > 0 ? y / max : 0) * 100)).padStart(3, '0');
    });
  }

  /* ---------- leadership: vertical scroll drives a horizontal track ---------- */
  function setupLead() {
    const sec = $('#lead'), track = $('#leadTrack'), bar = $('#leadBar');
    if (!sec || !track) return;
    const mq = window.matchMedia('(min-width: 981px) and (min-height: 600px)');
    let dist = 0, native = true;
    function layout() {
      native = reduce || !mq.matches;
      sec.classList.toggle('is-native', native);
      track.style.transform = '';
      if (native) { sec.style.height = ''; return; }
      dist = Math.max(0, track.scrollWidth - window.innerWidth);
      sec.style.height = `${window.innerHeight + dist}px`;
    }
    layout();
    window.addEventListener('resize', layout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    let x = 0;
    tickers.push((y, vh, vel) => {
      if (native || dist <= 0) return;
      const p = clamp(-sec.getBoundingClientRect().top / dist, 0, 1);
      x = lerp(x, p * dist, 0.14);
      track.style.transform = `translate3d(${-x}px,0,0) skewX(${clamp(vel * -0.08, -5, 5)}deg)`;
      if (bar) bar.style.transform = `scaleX(${p})`;
    });
  }

  /* ---------- project canvases, ~30fps, only the one on screen ---------- */
  function setupCanvases() {
    $$('.viz').forEach((canvas) => {
      const factory = window.RonitVisuals && window.RonitVisuals[canvas.dataset.visual];
      if (!factory) return;
      const ctx = canvas.getContext('2d'), slide = canvas.closest('.slide');
      let size = { w: 0, h: 0 };
      function resize() {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (!w || !h) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        size = { w, h };
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      resize();
      const frame = factory(ctx, () => size);
      window.addEventListener('resize', () => setTimeout(() => { resize(); frame(2.6); }, 60));
      frame(2.6);
      let raf = null, last = 0; const start = performance.now();
      function loop(now) {
        raf = requestAnimationFrame(loop);
        if (now - last < 33) return;
        if (slide && !slide.classList.contains('is-active')) return;
        if (canvas.clientWidth !== size.w || canvas.clientHeight !== size.h) resize();
        last = now; frame((now - start) / 1000);
      }
      if (reduce || !('IntersectionObserver' in window)) return;
      new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && raf === null) raf = requestAnimationFrame(loop);
          else if (!e.isIntersecting && raf !== null) { cancelAnimationFrame(raf); raf = null; }
        });
      }, { rootMargin: '80px' }).observe(canvas);
    });
  }

  /* ---------- research: a live Vietoris–Rips complex you can poke ----------
     points drift; a radius ε breathes in and out. any two points closer
     than ε get an edge, any three mutually close get a filled triangle.
     β₀ (connected components) is counted with union-find each frame. */
  function setupRips() {
    const canvas = $('#rips');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const hud = { e: $('#hudE'), b: $('#hudB'), s: $('#hudS'), t: $('#hudT') };
    let w = 0, h = 0, pts = [], base = 90;
    const mouse = { x: -999, y: -999, on: false };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      base = clamp(Math.min(w, h) * 0.3, 60, 120);
      const n = clamp(Math.round((w * h) / 4200), 26, 64);
      if (pts.length !== n) {
        pts = [];
        for (let i = 0; i < n; i++) pts.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, ph: Math.random() * 6.28 });
      }
    }
    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true; });
    canvas.addEventListener('pointerleave', () => { mouse.on = false; });

    let frameNo = 0;
    function draw(t) {
      if (!w) { resize(); if (!w) return; }
      const eps = base * (0.7 + 0.3 * Math.sin(t * 0.45 - 1.2));
      const [c1, c2, c3] = palette;
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx + Math.sin(t * 0.5 + p.ph) * 0.08;
        p.y += p.vy + Math.cos(t * 0.4 + p.ph) * 0.08;
        if (p.x < -20) p.x = w + 20; else if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20; else if (p.y > h + 20) p.y = -20;
      }
      const nodes = mouse.on ? pts.concat([{ x: mouse.x, y: mouse.y, cursor: true }]) : pts;
      const n = nodes.length, adj = Array.from({ length: n }, () => []);
      const parent = new Int16Array(n); for (let i = 0; i < n; i++) parent[i] = i;
      const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
      let edges = 0, tris = 0;
      const e2 = eps * eps;
      ctx.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, d2 = dx * dx + dy * dy;
          if (d2 > e2) continue;
          adj[i].push(j); edges++;
          const ra = find(i), rb = find(j); if (ra !== rb) parent[ra] = rb;
          const a = 1 - Math.sqrt(d2) / eps;
          ctx.strokeStyle = nodes[j].cursor ? `rgba(${c3},${0.3 + a * 0.6})` : `rgba(244,242,236,${0.08 + a * 0.34})`;
          ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke();
        }
      }
      for (let i = 0; i < n; i++) {
        const a = adj[i];
        for (let x = 0; x < a.length; x++) for (let y2 = x + 1; y2 < a.length; y2++) {
          const j = a[x], k = a[y2];
          if (adj[j].indexOf(k) === -1) continue;
          tris++;
          ctx.fillStyle = `rgba(${(tris % 2 ? c1 : c2)},0.09)`;
          ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.lineTo(nodes[k].x, nodes[k].y); ctx.fill();
        }
      }
      for (const p of nodes) {
        if (p.cursor) { ctx.strokeStyle = `rgba(${c3},.6)`; ctx.beginPath(); ctx.arc(p.x, p.y, eps / 2, 0, 6.283); ctx.stroke(); continue; }
        ctx.fillStyle = 'rgba(244,242,236,.9)';
        ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, 6.283); ctx.fill();
      }
      if (frameNo++ % 5 === 0 && hud.e) {
        let comps = 0; for (let i = 0; i < n; i++) if (find(i) === i) comps++;
        hud.e.textContent = (eps / base).toFixed(2); hud.b.textContent = comps; hud.s.textContent = edges; hud.t.textContent = tris;
      }
    }

    if (reduce) { draw(3); return; }
    let visible = false;
    if ('IntersectionObserver' in window) new IntersectionObserver((en) => { visible = en[0].isIntersecting; }).observe(canvas); else visible = true;
    const t0 = performance.now();
    tickers.push(() => { if (visible) draw((performance.now() - t0) / 1000); });
  }

  /* ---------- research: an illustrative persistence barcode ---------- */
  function setupBarcode() {
    const plot = $('#barcodePlot');
    if (!plot) return;
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const bars = [];
    for (let i = 0; i < 7; i++) bars.push({ k: 0, s: 0, l: i === 0 ? 100 : 8 + rnd() * 34 });   // H0: all born at 0, one never dies
    bars.sort((a, b) => b.l - a.l);
    for (let i = 0; i < 4; i++) { const s = 22 + rnd() * 40; bars.push({ k: 1, s, l: Math.min(96 - s, 6 + rnd() * (i < 2 ? 46 : 16)) }); }
    bars.forEach((b, i) => {
      const d = document.createElement('div');
      d.className = 'bar bar--' + b.k;
      d.style.setProperty('--s', b.s.toFixed(1) + '%'); d.style.setProperty('--l', b.l.toFixed(1) + '%'); d.style.setProperty('--n', i);
      plot.appendChild(d);
    });
  }

  /* ---------- awards filter ---------- */
  function setupAwards() {
    const wrap = $('#filters'), list = $('#awList'), count = $('#awCount');
    if (!wrap || !list) return;
    const rows = $$('.aw__row', list), years = $$('.aw__year', list);
    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      $$('button', wrap).forEach((b) => b.classList.toggle('is-on', b === btn));
      const f = btn.dataset.f; let n = 0;
      rows.forEach((r) => {
        const show = f === 'all' || r.dataset.cat === f;
        r.classList.toggle('is-off', !show);
        if (show) {
          r.classList.remove('in'); void r.offsetWidth;
          r.style.transitionDelay = `${Math.min(n, 14) * 35}ms`; r.classList.add('in'); n++;
          setTimeout(() => { r.style.transitionDelay = ''; }, 1200);
        }
      });
      years.forEach((yEl) => {
        let any = false, el = yEl.nextElementSibling;
        while (el && !el.classList.contains('aw__year')) { if (!el.classList.contains('is-off')) any = true; el = el.nextElementSibling; }
        yEl.classList.toggle('is-off', !any);
      });
      if (count) count.textContent = n;
    });
  }

  /* ---------- awards: a medallion follows the cursor down the list ---------- */
  function setupCoin() {
    const coin = $('#coin'), text = $('#coinText'), list = $('#awList');
    if (!coin || !list) return;
    let x = 0, y = 0, tx = 0, ty = 0, rot = 0;
    list.addEventListener('pointermove', (e) => {
      tx = e.clientX; ty = e.clientY;
      const row = e.target.closest('.aw__row');
      coin.classList.toggle('on', !!row);
      if (row) text.textContent = $('.aw__place', row).textContent;
    });
    list.addEventListener('pointerleave', () => coin.classList.remove('on'));
    tickers.push(() => {
      const dx = tx - x; x = lerp(x, tx, 0.16); y = lerp(y, ty, 0.16);
      rot = lerp(rot, clamp(dx * 0.9, -28, 28), 0.15);
      coin.style.transform = `translate3d(${x}px,${y}px,0) rotate(${rot}deg)`;
    });
  }

  /* ---------- contact: click the address to copy it ---------- */
  function setupContact() {
    const btn = $('#mail'), hint = $('#mailHint');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const addr = btn.dataset.mail;
      const ok = () => { hint.textContent = 'copied'; setTimeout(() => { hint.textContent = 'click to copy'; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(addr).then(ok, () => { window.location.href = 'mailto:' + addr; });
      else window.location.href = 'mailto:' + addr;
    });
  }

  /* ---------- local time in Bothell ---------- */
  function setupClock() {
    const el = $('#clock'); if (!el) return;
    const fmt = () => {
      try { el.textContent = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }).format(new Date()) + ' in Bothell'; } catch (e) { /* keep the fallback text */ }
    };
    fmt(); setInterval(fmt, 30000);
  }

  /* ---------- footer braille: hover to translate ---------- */
  function setupBraille() {
    const el = $('.footer__braille'); if (!el) return;
    const braille = el.textContent, plain = el.dataset.translate;
    const show = (on) => { el.textContent = on ? plain : braille; };
    el.addEventListener('mouseenter', () => show(true)); el.addEventListener('mouseleave', () => show(false));
    el.addEventListener('focus', () => show(true)); el.addEventListener('blur', () => show(false));
  }

  /* ---------- cursor ---------- */
  function setupCursor() {
    const c = $('#cursor'), label = $('#cursorLabel');
    let x = -100, y = -100, tx = -100, ty = -100;
    window.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; c.classList.add('on'); }, { passive: true });
    document.addEventListener('mouseleave', () => c.classList.remove('on'));
    document.addEventListener('mouseover', (e) => {
      const lab = e.target.closest('[data-cursor]');
      const link = e.target.closest('a, button, .ap__tile, .card, .feat');
      c.classList.toggle('is-label', !!lab);
      c.classList.toggle('is-link', !lab && !!link);
      label.textContent = lab ? lab.dataset.cursor : '';
    });
    tickers.push(() => { x = lerp(x, tx, 0.22); y = lerp(y, ty, 0.22); c.style.transform = `translate3d(${x}px,${y}px,0)`; });
  }

  /* ---------- magnetic buttons ---------- */
  function setupMagnetic() {
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.transition = 'transform .15s ease-out';
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.3}px,${(e.clientY - r.top - r.height / 2) * 0.4}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transition = 'transform .7s cubic-bezier(.19,1,.22,1)'; el.style.transform = ''; });
    });
  }

  /* ---------- cards: a soft light follows the cursor ---------- */
  function setupGlow() {
    $$('.glow').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`); el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
  }

  /* ---------- nav link text scramble ---------- */
  function setupScramble() {
    const glyphs = 'ABCDEFGHKLMNPRSTUVXYZ0123456789';
    $$('[data-scramble]').forEach((el) => {
      const text = el.textContent; let raf = null;
      el.addEventListener('mouseenter', () => {
        cancelAnimationFrame(raf);
        const start = performance.now();
        (function tick(now) {
          const p = (now - start) / 380;
          el.textContent = Array.from(text).map((c, i) => (i / text.length < p ? c : glyphs[(Math.random() * glyphs.length) | 0])).join('');
          if (p < 1) raf = requestAnimationFrame(tick); else el.textContent = text;
        })(start);
      });
    });
  }
})();
