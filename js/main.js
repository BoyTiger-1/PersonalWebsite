/* site behavior. clean intro, smooth reveals, light stacking depth,
   3d tilt, magnetic buttons, labeled cursor, throttled canvas visuals.
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
    setupIntro(startHero);
  });

  /* ---------- intro: name + a quick progress bar, then fade out ---------- */
  function setupIntro(done) {
    const intro = document.getElementById('intro');
    if (!intro || reduce) { if (intro) intro.remove(); done(); return; }
    document.body.classList.add('intro-lock');
    const barEl = document.getElementById('introBarFill');
    const pctEl = document.getElementById('introPct');

    const t0 = performance.now(), dur = 1200;
    (function tick(now) {
      const p = Math.min(1, ((now || performance.now()) - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 2);
      pctEl.textContent = Math.round(eased * 100);
      barEl.style.width = (eased * 100) + '%';
      if (p < 1) requestAnimationFrame(tick); else finish();
    })(t0);

    function finish() {
      if (hasGSAP) gsap.to(intro, { opacity: 0, duration: .6, ease: 'power2.inOut', onComplete: kill });
      else { intro.style.transition = 'opacity .5s'; intro.style.opacity = '0'; setTimeout(kill, 500); }
    }
    function kill() { intro.remove(); document.body.classList.remove('intro-lock'); done(); }
  }

  /* ---------- hero entrance (clean slide + fade, no scramble) ---------- */
  function startHero() {
    if (reduce || !hasGSAP) return;
    const lines = document.querySelectorAll('.hero__line');
    gsap.set(lines, { yPercent: 108 });
    gsap.to(lines, { yPercent: 0, duration: 1.0, ease: 'power4.out', stagger: .1 });
    gsap.from('.hero__eyebrow, .hero__tagline, .hero__meta, .hero__scroll', { y: 22, opacity: 0, duration: .9, ease: 'power3.out', stagger: .08, delay: .35 });
    if (window.ScrollTrigger) {
      gsap.to('.hero__title', { yPercent: -14, opacity: .5, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.hero__glow', { opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'center top', end: 'bottom top', scrub: true } });
    }
  }

  /* ---------- canvas project visuals, throttled to ~30fps ----------
     with sticky stacking, a couple canvases can share the screen, so we
     cap the frame rate and the dpr to keep paint cheap. */
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
        const dpr = Math.min(window.devicePixelRatio || 1, 1.3);
        size = { w: rect.width, h: rect.height };
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      resize();
      window.addEventListener('resize', resize);
      const frame = factory(ctx, getSize);
      let raf = null, last = 0; const start = performance.now();
      frame(2.6); // settled idle frame right away
      function loop(now) {
        raf = requestAnimationFrame(loop);
        if (now - last < 33) return;         // ~30fps cap
        last = now;
        frame((now - start) / 1000);
      }
      new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && raf === null) { if (reduce) { frame(2.6); return; } raf = requestAnimationFrame(loop); }
          else if (!e.isIntersecting && raf !== null) { cancelAnimationFrame(raf); raf = null; }
        });
      }, { threshold: 0.03 }).observe(canvas);
    });
  }

  /* ---------- scroll reveals + title fill ---------- */
  function setupReveals() {
    const els = document.querySelectorAll('[data-reveal]');
    const fills = document.querySelectorAll('[data-fill]');
    if (reduce) { els.forEach((el) => el.classList.add('in')); return; }
    fills.forEach((el) => el.classList.add('is-outlined'));
    const fillIn = (el) => { el.classList.remove('is-outlined'); el.classList.add('is-filled'); };

    if (hasGSAP && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      els.forEach((el) => ScrollTrigger.create({ trigger: el, start: 'top 88%', onEnter: () => el.classList.add('in') }));
      fills.forEach((el) => ScrollTrigger.create({ trigger: el, start: 'top 82%', onEnter: () => fillIn(el) }));
    } else {
      const io = new IntersectionObserver((en, ob) => en.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); ob.unobserve(e.target); } }), { threshold: .15 });
      els.forEach((el) => io.observe(el));
      const io2 = new IntersectionObserver((en, ob) => en.forEach((e) => { if (e.isIntersecting) { fillIn(e.target); ob.unobserve(e.target); } }), { threshold: .4 });
      fills.forEach((el) => io2.observe(el));
    }
  }

  /* ---------- stacking depth: scale + fade each card as the next covers it.
     transform + opacity only, so it stays on the compositor (no repaint). */
  function setupStacking() {
    if (reduce || !hasGSAP || !window.ScrollTrigger) return;
    if (window.innerWidth <= 860) return;
    const cards = [...document.querySelectorAll('.project')];
    cards.forEach((card, i) => {
      if (i === cards.length - 1) return;
      const grid = card.querySelector('.project__grid');
      gsap.to(grid, {
        scale: 0.94, opacity: 0.45, ease: 'none', transformOrigin: 'center top',
        scrollTrigger: { trigger: cards[i + 1], start: 'top bottom', end: 'top top', scrub: true },
      });
    });
  }

  /* ---------- 3d tilt on hover ---------- */
  function setupTilt() {
    document.querySelectorAll('[data-tilt]').forEach((el) => {
      const inner = el.querySelector('.window') || el;
      const strength = 7;
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
      const pull = 0.3;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - (r.left + r.width / 2)) * pull}px, ${(e.clientY - (r.top + r.height / 2)) * pull}px)`;
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
    if (hasGSAP && window.ScrollTrigger) { lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); }
    else { (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0); }
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
