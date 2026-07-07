/* site behavior. intro sequence, decode text, stacking depth, 3d tilt,
   magnetic buttons, labeled cursor, canvas lifecycle, count-ups, nav.
   anything that moves checks prefers-reduced-motion first. */

(function () {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined';
  const isTouch = window.matchMedia('(hover: none)').matches;
  const canHover = !isTouch && !reduce;

  document.addEventListener('DOMContentLoaded', () => {
    setupCanvases();
    setupCountUps();
    setupNav();
    setupScrollProgress();
    setupBrailleFooter();
    setupEasterEggs();
    if (canHover) { setupCursor(); setupTilt(); setupMagnetic(); }
    setupSmoothScroll();
    setupReveals();
    setupStacking();
    setupIntro(startHero); // intro calls startHero when it finishes (or immediately)
  });

  /* ---------- intro: ember particles + progress + name decode ---------- */
  function setupIntro(done) {
    const intro = document.getElementById('intro');
    if (!intro || reduce) { if (intro) intro.remove(); done(); return; }

    document.body.classList.add('intro-lock');
    const canvas = document.getElementById('introCanvas');
    const ctx = canvas.getContext('2d');
    const nameEl = document.getElementById('introName');
    const barEl = document.getElementById('introBarFill');
    const pctEl = document.getElementById('introPct');
    const target = nameEl.textContent;

    let w, h, dpr;
    const rs = () => { dpr = Math.min(devicePixelRatio || 1, 2); w = innerWidth; h = innerHeight; canvas.width = w*dpr; canvas.height = h*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); };
    rs(); addEventListener('resize', rs);

    const parts = Array.from({ length: 70 }, () => ({ x: Math.random()*innerWidth, y: innerHeight + Math.random()*160, vy: .6 + Math.random()*1.8, r: .6 + Math.random()*2.4, a: .2 + Math.random()*.5 }));
    const cols = ['#FF5C1F', '#FFB020', '#ff8a3d'];
    let raf, running = true;
    (function frame() {
      ctx.clearRect(0,0,w,h);
      parts.forEach((p,i) => { p.y -= p.vy; p.x += Math.sin((p.y+i)*.02)*.4; if (p.y < -10){ p.y = innerHeight+10; p.x = Math.random()*innerWidth; }
        ctx.globalAlpha = p.a * (p.y/innerHeight); ctx.fillStyle = cols[i%3]; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); });
      ctx.globalAlpha = 1;
      if (running) raf = requestAnimationFrame(frame);
    })();

    // scramble the name while the bar fills
    const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ01<>/*';
    const t0 = performance.now(), dur = 2000;
    (function tick(now) {
      const p = Math.min(1, ((now || performance.now()) - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 2);
      pctEl.textContent = Math.round(eased * 100);
      barEl.style.width = (eased * 100) + '%';
      // reveal name left-to-right, scramble the rest
      const revealed = Math.floor(eased * target.length);
      let out = '';
      for (let i = 0; i < target.length; i++) {
        if (target[i] === ' ') { out += ' '; continue; }
        out += i < revealed ? target[i] : glyphs[(Math.random()*glyphs.length)|0];
      }
      nameEl.textContent = out;
      if (p < 1) requestAnimationFrame(tick);
      else finish();
    })(t0);

    function finish() {
      nameEl.textContent = target;
      running = false; cancelAnimationFrame(raf);
      if (hasGSAP) {
        gsap.to(intro, { opacity: 0, duration: .7, ease: 'power2.inOut', onComplete: kill });
        gsap.to('.intro__center', { y: -20, duration: .7, ease: 'power2.in' });
      } else { intro.style.transition = 'opacity .6s'; intro.style.opacity = '0'; setTimeout(kill, 600); }
    }
    function kill() { intro.classList.add('is-gone'); intro.remove(); document.body.classList.remove('intro-lock'); done(); }
  }

  /* ---------- hero entrance ---------- */
  function startHero() {
    const lines = document.querySelectorAll('.hero__line');
    if (reduce || !hasGSAP) { lines.forEach((l) => l.dataset.decode && (l.textContent = l.dataset.decode)); return; }
    gsap.set(lines, { yPercent: 108 });
    gsap.to(lines, { yPercent: 0, duration: 1.05, ease: 'power4.out', stagger: .1, onStart: () => lines.forEach((l, i) => decodeEl(l, 500 + i * 120)) });
    gsap.from('.hero__eyebrow, .hero__tagline, .hero__meta, .hero__scroll', { y: 22, opacity: 0, duration: .9, ease: 'power3.out', stagger: .08, delay: .5 });
    // parallax the title as the hero scrolls away, and fade the webgl out
    if (window.ScrollTrigger) {
      gsap.to('.hero__title', { yPercent: -16, opacity: .4, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      const gl = document.getElementById('heroGl');
      if (gl) gsap.to(gl, { opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'center top', end: 'bottom top', scrub: true } });
    }
  }

  /* ---------- decode / scramble a single element to its data-decode text ---------- */
  function decodeEl(el, duration) {
    const target = el.dataset.decode || el.textContent;
    if (reduce) { el.textContent = target; return; }
    const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz.,&';
    const t0 = performance.now(), dur = duration || 700;
    (function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const revealed = Math.floor(p * target.length);
      let out = '';
      for (let i = 0; i < target.length; i++) {
        const ch = target[i];
        if (ch === ' ' || i < revealed) out += ch;
        else out += glyphs[(Math.random() * glyphs.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target;
    })(t0);
  }

  /* ---------- canvas project visuals (run only when on screen) ---------- */
  function setupCanvases() {
    document.querySelectorAll('.project__canvas').forEach((canvas) => {
      const kind = canvas.dataset.visual;
      const factory = window.RonitVisuals && window.RonitVisuals[kind];
      if (!factory) return;
      const ctx = canvas.getContext('2d');
      let size = { w: 0, h: 0 };
      const getSize = () => size;
      function resize() {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        size = { w: rect.width, h: rect.height };
        canvas.width = Math.max(1, rect.width * dpr);
        canvas.height = Math.max(1, rect.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      resize();
      window.addEventListener('resize', resize);
      const frame = factory(ctx, getSize);
      let raf = null; const start = performance.now();
      frame(2.6); // settled idle frame right away
      function loop(now) { frame((now - start) / 1000); raf = requestAnimationFrame(loop); }
      new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && raf === null) { if (reduce) { frame(2.6); return; } raf = requestAnimationFrame(loop); }
          else if (!e.isIntersecting && raf !== null) { cancelAnimationFrame(raf); raf = null; }
        });
      }, { threshold: 0.03 }).observe(canvas);
    });
  }

  /* ---------- scroll reveals + title fill + section-title decode ---------- */
  function setupReveals() {
    const els = document.querySelectorAll('[data-reveal]');
    const fills = document.querySelectorAll('[data-fill]');
    const decodes = document.querySelectorAll('.section-title[data-decode]');

    if (reduce) { els.forEach((el) => el.classList.add('in')); return; }
    fills.forEach((el) => el.classList.add('is-outlined'));
    const fillIn = (el) => { el.classList.remove('is-outlined'); el.classList.add('is-filled'); };

    if (hasGSAP && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      els.forEach((el) => ScrollTrigger.create({ trigger: el, start: 'top 88%', onEnter: () => el.classList.add('in') }));
      fills.forEach((el) => ScrollTrigger.create({ trigger: el, start: 'top 82%', onEnter: () => fillIn(el) }));
      decodes.forEach((el) => ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => decodeEl(el, 650) }));
    } else {
      const io = new IntersectionObserver((en, ob) => en.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); ob.unobserve(e.target); } }), { threshold: .15 });
      els.forEach((el) => io.observe(el));
      const io2 = new IntersectionObserver((en, ob) => en.forEach((e) => { if (e.isIntersecting) { fillIn(e.target); ob.unobserve(e.target); } }), { threshold: .4 });
      fills.forEach((el) => io2.observe(el));
    }
  }

  /* ---------- stacking depth: shrink each card as the next covers it ---------- */
  function setupStacking() {
    if (reduce || !hasGSAP || !window.ScrollTrigger) return;
    if (window.innerWidth <= 860) return; // cards are unstacked on mobile
    const cards = [...document.querySelectorAll('.project')];
    cards.forEach((card, i) => {
      if (i === cards.length - 1) return;
      const grid = card.querySelector('.project__grid');
      gsap.to(grid, {
        scale: 0.93, opacity: 0.5, filter: 'brightness(.7)', ease: 'none', transformOrigin: 'center top',
        scrollTrigger: { trigger: cards[i + 1], start: 'top bottom', end: 'top top', scrub: true },
      });
    });
  }

  /* ---------- 3d tilt on hover ---------- */
  function setupTilt() {
    document.querySelectorAll('[data-tilt]').forEach((el) => {
      const inner = el.querySelector('.window') || el;
      const strength = 8;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        inner.style.transform = `rotateY(${px * strength}deg) rotateX(${-py * strength}deg)`;
      });
      el.addEventListener('pointerleave', () => { inner.style.transform = 'rotateY(0) rotateX(0)'; });
    });
  }

  /* ---------- magnetic buttons ---------- */
  function setupMagnetic() {
    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      const pull = 0.35;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${x * pull}px, ${y * pull}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = 'translate(0,0)'; });
    });
  }

  /* ---------- count-ups ---------- */
  function setupCountUps() {
    const nums = document.querySelectorAll('[data-count]');
    const run = (el) => {
      const target = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimals || '0', 10);
      const suffix = el.dataset.suffix || '';
      const comma = el.dataset.comma === '1';
      const fmt = (v) => { let s = decimals ? v.toFixed(decimals) : String(Math.round(v)); if (comma) s = Number(s).toLocaleString('en-US'); return s + suffix; };
      if (reduce) { el.textContent = fmt(target); return; }
      const dur = 1400, t0 = performance.now();
      (function tick(now) { const p = Math.min(1, (now - t0) / dur); el.textContent = fmt(target * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); })(t0);
    };
    const io = new IntersectionObserver((en, ob) => en.forEach((e) => { if (e.isIntersecting) { run(e.target); ob.unobserve(e.target); } }), { threshold: .5 });
    nums.forEach((n) => io.observe(n));
  }

  /* ---------- nav hide/show ---------- */
  function setupNav() {
    const nav = document.getElementById('nav'); let last = 0;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      nav.classList.toggle('is-scrolled', y > 20);
      if (y > last && y > 400) nav.classList.add('is-hidden'); else nav.classList.remove('is-hidden');
      last = y;
    }, { passive: true });
  }

  /* ---------- scroll progress ---------- */
  function setupScrollProgress() {
    const bar = document.getElementById('scrollProgress');
    const on = () => { const d = document.documentElement; const max = d.scrollHeight - d.clientHeight; bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%'; };
    window.addEventListener('scroll', on, { passive: true }); on();
  }

  /* ---------- cursor with contextual label ---------- */
  function setupCursor() {
    const dot = document.getElementById('cursorDot'), ring = document.getElementById('cursorRing'), label = document.getElementById('cursorLabel');
    if (!dot || !ring) return;
    document.body.classList.add('has-cursor');
    let rx = 0, ry = 0, tx = 0, ty = 0;
    window.addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; dot.style.transform = `translate(${tx}px,${ty}px) translate(-50%,-50%)`; });
    (function follow() { rx += (tx - rx) * .18; ry += (ty - ry) * .18; ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`; requestAnimationFrame(follow); })();
    document.querySelectorAll('.project__canvas').forEach((el) => hot(el, 'view'));
    document.querySelectorAll('a, button').forEach((el) => hot(el, ''));
    function hot(el, text) {
      el.addEventListener('mouseenter', () => { ring.classList.add('is-hot'); if (label) label.textContent = text; });
      el.addEventListener('mouseleave', () => { ring.classList.remove('is-hot'); if (label) label.textContent = ''; });
    }
    window.addEventListener('error', () => { document.body.classList.remove('has-cursor'); dot.style.display = ring.style.display = 'none'; });
  }

  /* ---------- lenis smooth scroll ---------- */
  function setupSmoothScroll() {
    if (reduce || isTouch || typeof window.Lenis === 'undefined') return;
    const lenis = new window.Lenis({ duration: 1.1, smoothWheel: true });
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
    if (hasGSAP && window.ScrollTrigger) { lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); }
    document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => { const id = a.getAttribute('href'); if (id.length < 2) return; const el = document.querySelector(id); if (el) { e.preventDefault(); lenis.scrollTo(el, { offset: -10 }); } }));
    window.__lenis = lenis;
  }

  /* ---------- braille footer ---------- */
  function setupBrailleFooter() {
    const el = document.querySelector('.footer__braille'); if (!el) return;
    const braille = el.textContent, word = el.dataset.translate || 'ronit';
    const show = (v) => (el.textContent = v);
    el.addEventListener('mouseenter', () => show(word)); el.addEventListener('mouseleave', () => show(braille));
    el.addEventListener('focus', () => show(word)); el.addEventListener('blur', () => show(braille));
  }

  /* ---------- easter eggs ---------- */
  function setupEasterEggs() {
    const s1 = 'color:#FF5C1F;font-size:15px;font-weight:700;font-family:monospace', s2 = 'color:#A1A1AA;font-size:12px;font-family:monospace';
    console.log('%cRONIT AGARWAL', s1);
    console.log('%cbuilder / ai-ml developer. hiring or building something? ronit_agarwal@outlook.com', s2);
    console.log('%ctry typing "fire".', s2);
    const konami = [38,38,40,40,37,39,37,39,66,65]; let ki = 0, typed = '';
    window.addEventListener('keydown', (e) => {
      if (e.keyCode === konami[ki]) { ki++; if (ki === konami.length) { emberBurst(); ki = 0; } } else ki = 0;
      if (/^[a-z]$/i.test(e.key)) { typed = (typed + e.key.toLowerCase()).slice(-4); if (typed === 'fire') emberBurst(); }
    });
  }

  function emberBurst() {
    if (reduce) return;
    const canvas = document.getElementById('emberLayer'); if (!canvas) return;
    const ctx = canvas.getContext('2d'); const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    const cx = innerWidth/2, cy = innerHeight*.6;
    const parts = Array.from({ length: 150 }, () => { const a = Math.random()*Math.PI*2, sp = 2+Math.random()*8; return { x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-3,life:1,size:1+Math.random()*3 }; });
    const cols = ['#FF5C1F','#FFB020','#fff2d0']; const t0 = performance.now();
    (function anim(now) { const dt = Math.min(32, now - (anim._l || now)); anim._l = now; ctx.clearRect(0,0,innerWidth,innerHeight); let alive = false;
      parts.forEach((p) => { if (p.life <= 0) return; alive = true; p.vy += .12; p.x += p.vx*dt/16; p.y += p.vy*dt/16; p.life -= .012; ctx.globalAlpha = Math.max(0,p.life); ctx.fillStyle = cols[(p.size|0)%3]; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill(); });
      ctx.globalAlpha = 1; if (alive && now - t0 < 4000) requestAnimationFrame(anim); else ctx.clearRect(0,0,innerWidth,innerHeight);
    })(t0);
  }
})();
